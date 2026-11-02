// Generates the voiceover clips (public/vo-01.mp3 …) from VOICEOVER.md with ElevenLabs.
// The API key is read from ELEVENLABS_API_KEY, or from video/.env (gitignored); it is never printed.
// Usage: node make-voice.mjs [voiceId]   (default: premade "Eric", cjVigY5qzO86Huf0OWal; "Mike" is zfc8CJQpe8Kqyl0vvCzo, paid plans only)
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";

const here = (p) => new URL(p, import.meta.url);
const VOICE = process.argv[2] ?? "cjVigY5qzO86Huf0OWal";
const MODEL = "eleven_multilingual_v2";

let key = process.env.ELEVENLABS_API_KEY;
if (!key && existsSync(here("./.env"))) {
  key = /^ELEVENLABS_API_KEY=(.+)$/m.exec(readFileSync(here("./.env"), "utf8"))?.[1]?.trim();
}
if (!key) {
  console.error("No ELEVENLABS_API_KEY: set it in the environment or in video/.env");
  process.exit(1);
}

// The "Say" column of the script table.
const lines = readFileSync(here("./VOICEOVER.md"), "utf8")
  .split("\n")
  .filter((l) => /^\| \d+ \|/.test(l))
  .map((l) => l.split("|").at(-2).trim());
if (!lines.length) throw new Error("no script lines found in VOICEOVER.md");

const clips = [];
for (const [i, text] of lines.entries()) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      // Neighbouring lines as context keep the delivery consistent from clip to clip.
      previous_text: lines[i - 1],
      next_text: lines[i + 1],
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    console.error(`line ${i + 1}: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  clips.push(Buffer.from(await res.arrayBuffer()));
  console.log(`line ${i + 1} ok`);
}

// Only once every line succeeded: replace the earlier takes (e.g. the Windows TTS .wav files).
for (const f of readdirSync(here("./public"))) if (/^vo-\d{2}\./.test(f)) unlinkSync(here(`./public/${f}`));
clips.forEach((b, i) => writeFileSync(here(`./public/vo-${String(i + 1).padStart(2, "0")}.mp3`), b));
console.log(`wrote ${clips.length} clips`);
