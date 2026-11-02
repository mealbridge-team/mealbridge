import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Browser, Chip, clamp, DemoScene, Fade, Kicker, Logo, Sub, Tick, Words } from "./components";
import { C, DISPLAY } from "./theme";
import { FRAMES } from "./timing";

// A photo in a circle with the app's coloured rings, as on the site's page headers.
const Art: React.FC<{ src: string; size: number; ring: string; delay?: number }> = ({ src, size, ring, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 90 } });
  return (
    <div style={{ width: size, height: size, borderRadius: 999, background: ring, padding: size * 0.045, transform: `scale(${0.8 + 0.2 * p}) rotate(${(1 - p) * -8}deg)`, opacity: p }}>
      <Img src={staticFile(`art/${src}`)} style={{ width: "100%", height: "100%", borderRadius: 999, objectFit: "cover", display: "block" }} />
    </div>
  );
};

// 1. Good food in the bin, a hungry shelter nearby.
export const Hook: React.FC = () => (
  <Backdrop>
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 140px", gap: 80 }}>
      <div style={{ flex: 1 }}>
        <Words text="Every night, good food is thrown away." size={104} align="left" />
        <div style={{ height: 34 }} />
        <Words text="*A few miles from a shelter short of dinner.*" size={104} align="left" delay={70} />
      </div>
      <Art src="mealbox.webp" size={560} ring={C.coral} delay={10} />
    </AbsoluteFill>
  </Backdrop>
);

const QUESTIONS = [
  { q: "Is it safe to eat?", who: "Someone has to check" },
  { q: "Which shelter can use it tonight?", who: "Someone has to decide" },
  { q: "Who pays for the fuel?", who: "Usually the volunteer", hot: true },
];

// 2. The last mile.
export const Problem: React.FC = () => (
  <Backdrop>
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 150px", gap: 70 }}>
      <Words text="The food isn't the problem. | *The last mile is.*" size={100} align="left" />
      <div style={{ display: "flex", gap: 32 }}>
        {QUESTIONS.map(({ q, who, hot }, i) => (
          <Fade key={q} from={110 + i * 55} style={{ flex: 1 }}>
            <div style={{ background: hot ? C.accentSoft : "#fff", border: `1.5px solid ${hot ? C.coral : C.line}`, borderRadius: 24, padding: "36px 38px", height: 230 }}>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: hot ? C.accent : C.muted }}>{who}</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 52, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.08, marginTop: 18 }}>{q}</div>
            </div>
          </Fade>
        ))}
      </div>
    </AbsoluteFill>
  </Backdrop>
);

// 3. MealBridge, then the real site.
export const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [105, 130], [0, 1], clamp);
  return (
    <Backdrop>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - out, transform: `translateY(${-out * 60}px)` }}>
        <Fade from={2}>
          <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
            <Logo size={150} />
            <div style={{ fontFamily: DISPLAY, fontSize: 170, fontWeight: 700, letterSpacing: "-0.05em" }}>mealbridge</div>
          </div>
        </Fade>
        <div style={{ height: 30 }} />
        <Sub delay={30} align="center" size={42}>
          Tonight&apos;s surplus food, to tonight&apos;s shelter meals.
        </Sub>
      </AbsoluteFill>
      {frame >= 100 ? (
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
          <Browser parts={[{ src: "landing", from: 0, to: 8.4 }]} frames={FRAMES.reveal} width={1500} enter={108} />
        </AbsoluteFill>
      ) : null}
    </Backdrop>
  );
};

// 4. Try the demo, start the guided rescue.
export const Start: React.FC = () => (
  <DemoScene
    kicker="Try it yourself"
    title="One guided rescue, four steps."
    frames={FRAMES.start}
    parts={[{ src: "start", from: 0, to: 5.6 }]}
    chips={[
      { text: "1  Restaurant posts", at: 40 },
      { text: "2  Driver delivers", at: 52 },
      { text: "3  Shelter confirms", at: 64 },
      { text: "4  PayPal pays the driver", at: 76, tone: "brand" },
    ]}
  />
);

// 5. The restaurant posts tonight's surplus.
export const Restaurant: React.FC = () => (
  <DemoScene
    kicker="Step 1 · Restaurant"
    title="Post tonight's surplus."
    frames={FRAMES.restaurant}
    parts={[{ src: "restaurant", from: 10.8, to: 23.8 }]}
    zoom={[
      { f: 0, z: 1, x: 30, y: 50 },
      { f: 300, z: 1, x: 30, y: 50 },
      { f: 380, z: 1.35, x: 32, y: 8 },
    ]}
    chips={[
      { text: "Read by Gemini", at: 120, tone: "brand", check: true },
      { text: "Food-safety rules in code", at: 200, check: true },
      { text: "Shelter matched tonight", at: 290, check: true },
    ]}
  />
);

const TIERS = [
  { who: "Restaurant's compliance plan", how: "PayPal Subscriptions", color: C.brand },
  { who: "Local donors", how: "PayPal Checkout", color: "#1d5a9e" },
  { who: "Sponsors and city grants", how: "PayPal Invoicing", color: C.accent },
  { who: "General fund", how: "Whatever is left", color: C.muted },
];

// 6. The money is reserved before anyone moves.
export const Funding: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reserved = spring({ frame: frame - 330, fps, config: { damping: 14 } });
  return (
    <Backdrop>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 130px", gap: 90 }}>
        <div style={{ width: 640 }}>
          <Kicker delay={4}>Funded first</Kicker>
          <div style={{ height: 22 }} />
          <Words text="The fuel money is reserved *before anyone moves.*" size={80} align="left" delay={8} stagger={2} />
          <div style={{ height: 40 }} />
          <Chip delay={110} tone="accent" size={30}>
            Restaurants pay $0 per pickup
          </Chip>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
          <Fade from={150}>
            <div style={{ fontSize: 24, color: C.muted, marginBottom: 6 }}>Each trip is paid from the first that can cover it:</div>
          </Fade>
          {TIERS.map((t, i) => (
            <Fade key={t.who} from={170 + i * 30}>
              <div style={{ display: "flex", alignItems: "center", gap: 24, background: "#fff", border: `1.5px solid ${C.line}`, borderRadius: 20, padding: "22px 28px" }}>
                <span style={{ width: 46, height: 46, borderRadius: 99, background: t.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 24, fontWeight: 600 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 32, fontWeight: 600 }}>{t.who}</span>
                <span style={{ fontSize: 24, color: t.color, fontWeight: 600 }}>{t.how}</span>
              </div>
            </Fade>
          ))}
          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 18,
              background: C.brand,
              color: "#fff",
              borderRadius: 20,
              padding: "24px 28px",
              opacity: Math.min(1, reserved * 1.4),
              transform: `scale(${interpolate(reserved, [0, 1], [0.9, 1])})`,
            }}
          >
            <Tick size={36} color="#fff" />
            <span style={{ fontSize: 32, fontWeight: 600 }}>$4.00 reserved for Maya, the driver</span>
          </div>
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// 7. The volunteer driver.
export const Driver: React.FC = () => (
  <DemoScene
    kicker="Step 2 · Driver"
    title="Maya drives it over."
    frames={FRAMES.driver}
    parts={[{ src: "driver", from: 23.4, to: 47.6 }]}
    chips={[
      { text: "$4.00 shown up front", at: 40, tone: "brand", check: true },
      { text: "Photo at pickup", at: 150, check: true },
      { text: "Photo at the shelter", at: 270, check: true },
      { text: "Reused photos get flagged", at: 360, tone: "accent" },
    ]}
  />
);

// 8. The shelter confirms; three signals agree; PayPal Payouts.
export const Shelter: React.FC = () => (
  <DemoScene
      kicker="Step 3 · Shelter"
      title="One tap, and PayPal pays."
      frames={FRAMES.shelter}
      parts={[{ src: "shelter", from: 35.0, to: 46.6 }]}
      zoom={[
        { f: 0, z: 1, x: 50, y: 100 },
        { f: 330, z: 1, x: 50, y: 100 },
        { f: 400, z: 1.5, x: 40, y: 100 },
      ]}
      chips={[
        { text: "Photo checked by Gemini", at: 130, check: true },
        { text: "GPS at the shelter", at: 175, check: true },
        { text: "Shelter tapped Received", at: 220, check: true },
        { text: "Paid by PayPal Payouts", at: 330, tone: "brand" },
      ]}
    />
);

// 9. Donors and sponsors.
export const Money: React.FC = () => (
  <DemoScene
    kicker="No plan? No problem"
    title="Neighbours and sponsors fill the gap."
    frames={FRAMES.money}
    parts={[
      { src: "donate", from: 0.3, to: 7.6 },
      { src: "sponsor", from: 1.2, to: 5.2 },
    ]}
    chips={[
      { text: "Donors: PayPal Checkout", at: 90, tone: "brand" },
      { text: "Sponsors: PayPal invoices", at: 200, tone: "brand" },
      { text: "Nudge agent drafts reminders", at: 300 },
    ]}
  />
);

const PRODUCTS = [
  { name: "Subscriptions", role: "Restaurant compliance plans" },
  { name: "Checkout", role: "Donors fund a waiting trip" },
  { name: "Invoicing", role: "Sponsors and city grants" },
  { name: "Payouts", role: "Drivers reimbursed, PayPal or Venmo" },
];

// 10. Four PayPal products, one loop.
export const PayPal: React.FC = () => (
  <Backdrop>
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 140px", gap: 64 }}>
      <Words text="Four PayPal products, *one loop.*" size={96} align="left" />
      <div style={{ display: "flex", gap: 26 }}>
        {PRODUCTS.map((p, i) => (
          <Fade key={p.name} from={50 + i * 22} style={{ flex: 1 }}>
            <div style={{ background: i === 3 ? C.brand : "#fff", color: i === 3 ? "#fff" : C.ink, border: `1.5px solid ${i === 3 ? C.brand : C.line}`, borderRadius: 24, padding: "34px 32px", height: 220 }}>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7 }}>PayPal</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 50, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 8 }}>{p.name}</div>
              <div style={{ fontSize: 24, marginTop: 14, opacity: 0.8 }}>{p.role}</div>
            </div>
          </Fade>
        ))}
      </div>
      <Sub delay={190} size={36}>
        AI reads the food and explains the numbers. Plain code moves every dollar.
      </Sub>
    </AbsoluteFill>
  </Backdrop>
);

// 11. Public impact.
export const Impact: React.FC = () => (
  <DemoScene
    kicker="Step 4 · Public impact"
    title="Every meal, mile and dollar."
    frames={FRAMES.impact}
    parts={[{ src: "impact", from: 0.5, to: 24 }]}
    chips={[
      { text: "Real delivery routes", at: 90, check: true },
      { text: "Charts by AG Studio", at: 230, check: true },
      { text: "Insights agent on the live ledger", at: 330, check: true },
    ]}
  />
);

// 12. Close.
export const Outro: React.FC = () => (
  <Backdrop>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 34 }}>
      <Fade from={2}>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <Logo size={120} />
          <div style={{ fontFamily: DISPLAY, fontSize: 140, fontWeight: 700, letterSpacing: "-0.05em" }}>mealbridge</div>
        </div>
      </Fade>
      <Words text="Tonight's surplus, on a shelter's table. | *No volunteer out of pocket.*" size={64} delay={20} stagger={2} />
      <Fade from={80}>
        <div style={{ display: "flex", gap: 18, marginTop: 20 }}>
          <Chip tone="brand" size={28}>
            mealbridge-6py5.onrender.com
          </Chip>
          <Chip size={28}>Built for the PayPal AI Hackathon</Chip>
        </div>
      </Fade>
    </AbsoluteFill>
  </Backdrop>
);
