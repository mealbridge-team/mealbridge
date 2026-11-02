import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY, C, DISPLAY } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.65, 0, 0.35, 1);

// Warm paper backdrop with the app's soft shapes drifting at the edges.
export const Backdrop: React.FC<{ children?: React.ReactNode; tone?: string }> = ({ children, tone = C.bg }) => {
  const frame = useCurrentFrame();
  const drift = (k: number) => Math.sin(frame / 70 + k) * 14;
  const blob = (x: number, y: number, r: number, color: string, k: number): React.CSSProperties => ({
    position: "absolute",
    left: x + drift(k),
    top: y + drift(k + 2),
    width: r,
    height: r,
    borderRadius: 999,
    background: color,
    opacity: 0.55,
  });
  return (
    <AbsoluteFill style={{ background: tone, fontFamily: BODY, color: C.ink, overflow: "hidden" }}>
      <div style={blob(-140, -160, 420, C.mint, 0)} />
      <div style={blob(1680, 820, 380, C.saffron, 1)} />
      <div style={blob(1760, -90, 180, C.coral, 2)} />
      {children}
    </AbsoluteFill>
  );
};

type Token = { w: string; hi: boolean; br?: boolean };
// "*word word*" renders in the brand green; "|" is a line break.
const parse = (text: string): Token[] => {
  let hi = false;
  return text.split(" ").map((raw) => {
    if (raw === "|") return { w: "", hi: false, br: true };
    let w = raw;
    const open = w.startsWith("*");
    if (open) w = w.slice(1);
    const close = w.endsWith("*");
    if (close) w = w.slice(0, -1);
    const t = { w, hi: hi || open };
    if (open) hi = true;
    if (close) hi = false;
    return t;
  });
};

export const Words: React.FC<{
  text: string;
  delay?: number;
  size?: number;
  weight?: number;
  stagger?: number;
  align?: "left" | "center";
  color?: string;
  hi?: string;
  maxWidth?: number;
}> = ({ text, delay = 0, size = 96, weight = 600, stagger = 3, align = "center", color = C.ink, hi = C.brand, maxWidth }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let i = 0;
  return (
    <div style={{ fontFamily: DISPLAY, fontSize: size, fontWeight: weight, letterSpacing: "-0.035em", lineHeight: 1.04, textAlign: align, maxWidth, margin: align === "center" ? "0 auto" : undefined }}>
      {parse(text).map((t, k) => {
        if (t.br) return <br key={k} />;
        const p = spring({ frame: frame - delay - i++ * stagger, fps, config: { damping: 200 }, durationInFrames: 24 });
        return (
          <span
            key={k}
            style={{
              display: "inline-block",
              marginRight: "0.24em",
              paddingBottom: "0.06em",
              opacity: p,
              transform: `translateY(${(1 - p) * 0.4}em)`,
              color: t.hi ? hi : color,
            }}
          >
            {t.w}
          </span>
        );
      })}
    </div>
  );
};

// Fades its children in at `from` and out at `to` (frames, relative to the scene).
export const Fade: React.FC<{ from?: number; to?: number; len?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  from = 0,
  to = 1e9,
  len = 12,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const o = Math.min(interpolate(frame, [from, from + len], [0, 1], clamp), interpolate(frame, [to - len, to], [1, 0], clamp));
  const y = interpolate(frame, [from, from + len], [18, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  return <div style={{ opacity: o, transform: `translateY(${y}px)`, ...style }}>{children}</div>;
};

export const Kicker: React.FC<{ children: React.ReactNode; delay?: number; color?: string }> = ({ children, delay = 0, color = C.brand }) => (
  <Fade from={delay}>
    <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color }}>{children}</div>
  </Fade>
);

export const Sub: React.FC<{ children: React.ReactNode; delay?: number; align?: "left" | "center"; size?: number; maxWidth?: number }> = ({
  children,
  delay = 0,
  align = "left",
  size = 30,
  maxWidth = 900,
}) => (
  <Fade from={delay}>
    <div style={{ fontSize: size, lineHeight: 1.45, color: C.muted, textAlign: align, maxWidth, margin: align === "center" ? "0 auto" : undefined }}>{children}</div>
  </Fade>
);

// A rounded label, like the app's badges.
export const Chip: React.FC<{ children: React.ReactNode; delay?: number; tone?: "brand" | "accent" | "plain"; size?: number; check?: boolean }> = ({
  children,
  delay = 0,
  tone = "plain",
  size = 24,
  check,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 160 } });
  const colors = {
    brand: { bg: C.brandSoft, fg: C.brand, bd: "transparent" },
    accent: { bg: C.accentSoft, fg: C.accent, bd: "transparent" },
    plain: { bg: "#fff", fg: C.ink, bd: C.line },
  }[tone];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        fontSize: size,
        fontWeight: 500,
        color: colors.fg,
        background: colors.bg,
        border: `1.5px solid ${colors.bd}`,
        borderRadius: 999,
        padding: "0.42em 0.9em",
        opacity: Math.min(1, p * 1.4),
        transform: `scale(${interpolate(p, [0, 1], [0.85, 1])})`,
        transformOrigin: "left center",
      }}
    >
      {check ? <Tick size={size * 1.05} /> : null}
      {children}
    </div>
  );
};

export const Tick: React.FC<{ size: number; color?: string }> = ({ size, color = C.brand }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="11" fill={color} />
    <path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Logo: React.FC<{ size: number }> = ({ size }) => <Img src={staticFile("art/logo.svg")} style={{ width: size, height: size, display: "block" }} />;

type Part = { src: string; from: number; to: number };

// Real footage of the app (recorded at 1600x1000) in a browser window. The parts play back to back,
// timed to fill `frames`, with an optional slow camera push in.
export const Browser: React.FC<{
  parts: Part[];
  frames: number;
  width: number;
  enter?: number;
  url?: string;
  zoom?: { f: number; z: number; x: number; y: number }[];
}> = ({ parts, frames, width, enter = 0, url = "mealbridge-6py5.onrender.com", zoom }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - enter, fps, config: { damping: 200 }, durationInFrames: 40 });
  const bar = 44;
  const height = (width * 1000) / 1600;
  const total = parts.reduce((n, s) => n + (s.to - s.from), 0);
  // A couple of frames over, so the last clip never runs out before the scene ends.
  const play = frames - enter + 2;
  // Fit the footage to the scene exactly (a little slower or faster than real time).
  const rate = (total * fps) / play;
  let at = enter;
  const z = zoom ? interpolate(frame, zoom.map((k) => k.f), zoom.map((k) => k.z), { ...clamp, easing: ease }) : 1;
  const zx = zoom ? interpolate(frame, zoom.map((k) => k.f), zoom.map((k) => k.x), { ...clamp, easing: ease }) : 50;
  const zy = zoom ? interpolate(frame, zoom.map((k) => k.f), zoom.map((k) => k.y), { ...clamp, easing: ease }) : 50;
  return (
    <div
      style={{
        width,
        height: height + bar,
        borderRadius: 18,
        overflow: "hidden",
        background: "#fff",
        border: `1px solid ${C.line}`,
        boxShadow: "0 40px 100px rgba(40,30,10,0.16), 0 6px 18px rgba(40,30,10,0.08)",
        opacity: p,
        transform: `translateY(${(1 - p) * 80}px) scale(${1 - (1 - p) * 0.04})`,
      }}
    >
      <div style={{ height: bar, display: "flex", alignItems: "center", gap: 9, padding: "0 18px", background: C.surface, borderBottom: `1px solid ${C.line}` }}>
        {["#e8a597", "#ecd08e", "#a9cfb4"].map((c) => (
          <span key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c }} />
        ))}
        <span style={{ marginLeft: 18, flex: 1, maxWidth: 520, height: 28, borderRadius: 8, background: "#fff", color: C.muted, fontSize: 16, display: "flex", alignItems: "center", padding: "0 14px" }}>
          {url}
        </span>
      </div>
      <div style={{ position: "relative", width, height, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, transform: `scale(${z})`, transformOrigin: `${zx}% ${zy}%` }}>
          {parts.map((s, i) => {
            const len = Math.round(((s.to - s.from) * fps) / rate);
            const start = at;
            at += len;
            const last = i === parts.length - 1;
            return (
              <Sequence key={i} from={start} durationInFrames={last ? frames - start : len} layout="none">
                <OffthreadVideo
                  src={staticFile(`clips/${s.src}.mp4`)}
                  startFrom={Math.round(s.from * fps)}
                  endAt={Math.round(s.to * fps)}
                  playbackRate={rate}
                  muted
                  style={{ position: "absolute", inset: 0, width, height }}
                />
              </Sequence>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// The standard demo layout: a caption column on the left, the app on the right.
export const DemoScene: React.FC<{
  kicker: string;
  title: string;
  chips: { text: string; at: number; tone?: "brand" | "accent" | "plain"; check?: boolean }[];
  parts: Part[];
  frames: number;
  zoom?: { f: number; z: number; x: number; y: number }[];
}> = ({ kicker, title, chips, parts, frames, zoom }) => (
  <Backdrop>
    <div style={{ position: "absolute", left: 80, top: 0, bottom: 0, width: 400, display: "flex", flexDirection: "column", justifyContent: "center", gap: 26 }}>
      <Kicker delay={4}>{kicker}</Kicker>
      <Words text={title} size={64} align="left" delay={8} stagger={2} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14, marginTop: 10 }}>
        {chips.map((c) => (
          <Chip key={c.text} delay={c.at} tone={c.tone} check={c.check}>
            {c.text}
          </Chip>
        ))}
      </div>
    </div>
    <div style={{ position: "absolute", right: 60, top: 92 }}>
      <Browser parts={parts} frames={frames} width={1340} enter={6} zoom={zoom} />
    </div>
  </Backdrop>
);
