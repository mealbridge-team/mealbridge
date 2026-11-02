import audio from "./audio.gen.json";

// Scene lengths in frames (30 fps). Each scene is at least as long as its voiceover line plus a beat,
// so a longer take stretches its scene instead of overrunning the next one.
const BASE = {
  hook: 330,
  problem: 480,
  reveal: 390,
  start: 360,
  restaurant: 510,
  funding: 480,
  driver: 480,
  shelter: 540,
  money: 450,
  paypal: 330,
  impact: 480,
  outro: 300,
};

export type SceneId = keyof typeof BASE;
export const ORDER = Object.keys(BASE) as SceneId[];

const durs = (audio as { durations?: Record<string, number> }).durations ?? {};
export const FRAMES = Object.fromEntries(
  ORDER.map((id, i) => [id, Math.max(BASE[id], Math.ceil(((durs[i + 1] ?? 0) + 1.3) * 30))]),
) as Record<SceneId, number>;
