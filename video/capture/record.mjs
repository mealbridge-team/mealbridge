// Records the real app for the submission video: one guided rescue, start to finish, plus the
// landing, Donate, Sponsor and Impact pages. Run it against a freshly seeded production build
// (`npx next start --port 3100` with an empty PGLITE_DIR). Each clip is captured with Chrome's
// screencast at full quality and written to public/clips/<name>.mp4 at 30 fps.
// Usage: node capture/record.mjs [baseUrl]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3100";
const W = 1600;
const H = 1000;
const here = (p) => new URL(p, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const RAW = here("./raw/");
const OUT = here("../public/clips/");
const PHOTOS = { pickup: here("./photos/pickup.jpg"), dropoff: here("./photos/dropoff.jpg") };
mkdirSync(OUT, { recursive: true });

// A visible macOS-style arrow cursor, since headless Chrome draws none. Its tip is the hotspot; it
// stays hidden until the mouse first moves on each page.
const CURSOR = `
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.innerHTML = '<svg width="26" height="36" viewBox="0 0 17 24"><path d="M1.5 1.5 L1.5 19.2 L5.6 15.3 L8.5 22 L11.6 20.7 L8.8 14.2 L14.6 14.2 Z" fill="#000" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    c.style.cssText = "position:fixed;left:0;top:0;margin:-2px 0 0 -2px;z-index:99999;pointer-events:none;opacity:0;transform-origin:2px 2px;transition:transform .1s;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))";
    document.body.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; c.style.opacity = "1"; }, true);
    addEventListener("mousedown", () => (c.style.transform = "scale(.85)"), true);
    addEventListener("mouseup", () => (c.style.transform = ""), true);
  });`;

// Uses the installed Google Chrome.
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await context.addInitScript(CURSOR);
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
let mouse = { x: W / 2, y: H / 2 };

let frames = null;
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  frames?.push({ t: metadata.timestamp, buf: Buffer.from(data, "base64") });
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});

async function start() {
  frames = [];
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
}

// Writes the frames with their real durations and encodes a constant 30 fps clip.
async function stop(name) {
  await page.waitForTimeout(300);
  await cdp.send("Page.stopScreencast");
  const list = frames;
  frames = null;
  const dir = `${RAW}${name}/`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const lines = [];
  list.forEach((f, i) => {
    const file = `${String(i).padStart(5, "0")}.jpg`;
    writeFileSync(dir + file, f.buf);
    const dur = i + 1 < list.length ? list[i + 1].t - f.t : 0.5;
    lines.push(`file '${file}'`, `duration ${Math.max(dur, 0.001).toFixed(4)}`);
  });
  lines.push(`file '${String(list.length - 1).padStart(5, "0")}.jpg'`);
  writeFileSync(dir + "list.txt", lines.join("\n"));
  execFileSync(
    "npx",
    ["remotion", "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "list.txt", "-fps_mode", "cfr", "-r", "30", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "16", `${OUT}${name}.mp4`],
    { cwd: dir, stdio: "ignore", shell: true },
  );
  const secs = list.length ? (list.at(-1).t - list[0].t).toFixed(1) : 0;
  console.log(`${name}: ${list.length} frames, ${secs}s`);
  // Clip lengths for the video, so each scene can speed its clip up to fit the narration.
  const json = here("../src/clips.gen.json");
  const lengths = existsSync(json) ? JSON.parse(readFileSync(json, "utf8")) : {};
  lengths[name] = Number(secs);
  writeFileSync(json, JSON.stringify(lengths, null, 2) + "\n");
}

async function moveTo(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(mouse.x, mouse.y);
  await page.mouse.move(to.x, to.y, { steps: 25 });
  mouse = to;
  await page.waitForTimeout(250);
}

async function click(locator) {
  await moveTo(locator);
  await locator.click();
}

// Smooth scroll by `dy` pixels over `ms`.
async function glide(dy, ms) {
  await page.evaluate(
    ([dy, ms]) =>
      new Promise((done) => {
        const from = scrollY;
        const t0 = performance.now();
        const step = (now) => {
          const k = Math.min(1, (now - t0) / ms);
          scrollTo(0, from + dy * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2));
          k < 1 ? requestAnimationFrame(step) : done();
        };
        requestAnimationFrame(step);
      }),
    [dy, ms],
  );
}

const hold = (ms) => page.waitForTimeout(ms);
const bar = () => page.getByRole("complementary", { name: "Guided rescue" });

// 1. Landing page.
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await hold(800);
await start();
await hold(1500);
await glide(900, 5000);
await hold(1200);
await stop("landing");

// 2. Try the demo, start the guided rescue.
await page.goto(BASE + "/demo", { waitUntil: "networkidle" });
await start();
await hold(1200);
await click(page.getByRole("button", { name: "Start the guided rescue" }));
await page.waitForURL("**/restaurant");
await page.waitForLoadState("networkidle");
await hold(2500);
await stop("start");

// 3. The restaurant posts tonight's surplus; Gemini reads it and a shelter is matched.
await start();
await hold(600);
await click(page.getByRole("button", { name: "About 40 portions of veg biryani" }));
await hold(900);
await click(page.getByRole("button", { name: "Post surplus" }));
await page.getByText(/Passed food-safety rules|coordinator checks|Can't be rescued/).waitFor({ timeout: 90_000 });
await hold(500);
await glide(420, 1800);
await hold(4000);
await stop("restaurant");

// 4. The driver: simulated drive, pickup photo, drop-off photo at the shelter.
await start();
await click(bar().getByRole("button", { name: /Continue as/ }));
await page.waitForURL("**/driver");
await page.waitForLoadState("networkidle");
await hold(2500);
await click(page.getByRole("button", { name: "Demo: simulate the drive" }));
await hold(3500);
await page.locator('input[type="file"]').first().setInputFiles(PHOTOS.pickup);
await hold(1200);
await click(page.getByRole("button", { name: "I've picked it up" }));
await page.getByRole("button", { name: "Delivered" }).waitFor({ timeout: 60_000 });
await hold(1500);
const sim = page.getByRole("button", { name: "Demo: simulate the drive" });
if (await sim.isVisible()) await click(sim);
else await click(page.getByRole("button", { name: "Demo: I'm at the shelter" }));
await hold(3500);
await page.locator('input[type="file"]').first().setInputFiles(PHOTOS.dropoff);
await hold(1200);
await click(page.getByRole("button", { name: "Delivered" }));
await bar().getByText(/Next up|step 3|safeguard/i).first().waitFor({ timeout: 90_000 });
await hold(3000);
await stop("driver");

// 5. The shelter confirms; PayPal Payouts reimburses the driver.
await start();
await click(bar().getByRole("button", { name: /Continue as/ }));
await page.waitForURL("**/shelter");
await page.waitForLoadState("networkidle");
await hold(2500);
await click(page.getByRole("button", { name: "Received" }).first());
await bar().getByText(/Rescue complete/).waitFor({ timeout: 90_000 });
await hold(5000);
await stop("shelter");

// 6. Impact: the delivery on the map, who pays, AG Studio charts.
await click(bar().getByRole("link", { name: "See it on Impact" }));
await page.waitForURL("**/impact");
await page.waitForLoadState("networkidle");
await start();
await hold(2500);
await glide(700, 3500);
await hold(3500);
await glide(800, 3500);
await hold(3000);
await glide(900, 3500);
await hold(3500);
await stop("impact");

// 7. Where else the money comes from: donors and sponsors.
await page.goto(BASE + "/donate", { waitUntil: "networkidle" });
await start();
await hold(2500);
await glide(500, 2500);
await hold(2500);
await stop("donate");

await page.goto(BASE + "/sponsor", { waitUntil: "networkidle" });
const signIn = page.getByRole("button", { name: /Bayshore City Food Recovery Grant/ }).first();
if (await signIn.isVisible().catch(() => false)) {
  await signIn.click();
  await page.waitForLoadState("networkidle");
}
await start();
await hold(2500);
await glide(500, 2500);
await hold(2500);
await stop("sponsor");

await browser.close();
