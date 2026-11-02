import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";

// Same tokens as the app's light theme (src/app/globals.css).
export const C = {
  bg: "#fcfaf6",
  surface: "#f4efe5",
  ink: "#111412",
  muted: "#595e58",
  line: "#e5dfd3",
  brand: "#0d5a3b",
  brandSoft: "#e7f0eb",
  accent: "#c2410c",
  accentSoft: "#fbeae0",
  coral: "#f3a184",
  saffron: "#f6c867",
  mint: "#bcdcc8",
  sky: "#c9def0",
};

export const BODY = loadInter("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;
export const DISPLAY = loadInterTight("normal", { weights: ["500", "600", "700"], subsets: ["latin"] }).fontFamily;

export const FPS = 30;
export const W = 1920;
export const H = 1080;
