// Lists the voiceover clips (vo-01, vo-02, …) and music track in public/ so the video can mix in
// whatever has been recorded so far, with each clip's length so its scene can make room for it.
// Runs before every render; writes src/audio.gen.json.
import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pub = fileURLToPath(new URL("./public/", import.meta.url));
const files = readdirSync(pub);
const audio = /\.(wav|mp3|m4a|aac|ogg)$/i;
const vo = {};
const durations = {};
for (const f of files) {
  const m = /^vo-(\d{2})\./i.exec(f);
  if (!m || !audio.test(f)) continue;
  vo[Number(m[1])] = f;
  const out = execFileSync("npx", ["remotion", "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", `"${pub}${f}"`], {
    shell: true,
    encoding: "utf8",
  });
  durations[Number(m[1])] = Number(out.trim());
}
const music = files.find((f) => /^music\./i.test(f) && audio.test(f)) ?? null;
writeFileSync(new URL("./src/audio.gen.json", import.meta.url), JSON.stringify({ vo, durations, music }, null, 2) + "\n");
console.log(`voiceover clips: ${Object.keys(vo).length}, music: ${music ?? "none"}`);
