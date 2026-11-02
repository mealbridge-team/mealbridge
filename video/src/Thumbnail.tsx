import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Logo } from "./components";
import { BODY, C, DISPLAY } from "./theme";

// YouTube thumbnail (1280x720): one bold promise, a meal changing hands, and the PayPal hook. Static,
// so it reads at the small sizes YouTube shows it.
export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: BODY, color: C.ink, overflow: "hidden" }}>
    {/* The photo fills the right side, cropped to the hands passing the meal box. */}
    <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 560, overflow: "hidden", borderTopLeftRadius: 360, borderBottomLeftRadius: 360 }}>
      <Img src={staticFile("art/handoff-photo.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "58% 64%" }} />
    </div>
    <div style={{ position: "absolute", right: 470, top: 60, width: 110, height: 110, borderRadius: 999, background: C.saffron }} />
    <div style={{ position: "absolute", right: 500, bottom: -50, width: 160, height: 160, borderRadius: 999, background: C.mint }} />
    <div style={{ position: "absolute", left: 64, top: 56, display: "flex", alignItems: "center", gap: 16 }}>
      <Logo size={58} />
      <span style={{ fontFamily: DISPLAY, fontSize: 50, fontWeight: 700, letterSpacing: "-0.04em" }}>mealbridge</span>
    </div>
    <div style={{ position: "absolute", left: 64, top: 180, width: 640 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 104, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 0.98 }}>
        Tonight&apos;s leftovers, <span style={{ color: C.brand }}>to a shelter.</span>
      </div>
      <div
        style={{
          display: "inline-block",
          marginTop: 38,
          background: C.accent,
          color: "#fff",
          fontSize: 38,
          fontWeight: 600,
          borderRadius: 999,
          padding: "14px 30px",
        }}
      >
        Drivers reimbursed with PayPal
      </div>
    </div>
  </AbsoluteFill>
);
