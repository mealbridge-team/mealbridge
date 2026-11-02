import type { CSSProperties } from "react";

// A flat illustration that sits on top of the footer: a volunteer rides a meal box from the
// restaurant to the shelter, drops it off (a heart pops), and rides back for the next one. Pure SVG
// and CSS (see globals.css, "Delivery scene"), so it costs no JavaScript and stops for reduced motion.

const W = 1200;
const H = 202;
const START = 250;
const DISTANCE = 690;

export function DeliveryScene() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-labelledby="ds-title">
      <title id="ds-title">A volunteer cyclist carries a meal box from a restaurant to a shelter, then rides back for the next one.</title>

      <circle cx={980} cy={62} r={30} fill="var(--shape-saffron)" opacity={0.8} />
      <Cloud className="ds-cloud" y={46} scale={1} />
      <Cloud className="ds-cloud-slow" y={86} scale={0.7} />

      <path
        d="M0 202 C 140 150, 300 148, 430 190 C 540 160, 690 138, 830 186 C 930 158, 1080 146, 1200 176 V202 H0Z"
        fill="var(--shape-mint)"
        opacity={0.55}
      />
      <Tree x={300} h={56} />
      <Tree x={612} h={44} />
      <Tree x={880} h={60} />

      {/* Restaurant: striped awning, a window with a warm light, a door. */}
      <g transform="translate(70 92)">
        <rect x={0} y={20} width={150} height={90} fill="var(--shape-coral)" />
        <rect x={-6} y={8} width={162} height={14} rx={3} fill="var(--ink)" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M${i * 27} 22 h27 v14 a13.5 13.5 0 0 1 -27 0z`} fill={i % 2 ? "var(--bg)" : "var(--accent)"} />
        ))}
        <rect x={16} y={56} width={58} height={34} rx={3} fill="var(--shape-saffron)" />
        <rect x={98} y={58} width={34} height={52} rx={3} fill="var(--ink)" opacity={0.85} />
      </g>

      {/* Shelter: a house with a green roof and a heart over the door. */}
      <g transform="translate(980 84)">
        <path d="M-10 46 L80 -2 L170 46 Z" fill="var(--shape-green)" />
        <rect x={6} y={44} width={148} height={74} fill="var(--shape-sky)" />
        <rect x={64} y={70} width={34} height={48} rx={3} fill="var(--ink)" opacity={0.85} />
        <rect x={20} y={62} width={30} height={26} rx={3} fill="var(--bg)" />
        <rect x={112} y={62} width={30} height={26} rx={3} fill="var(--bg)" />
        <path d={heart(81, 54, 7)} fill="var(--accent)" />
      </g>
      <path className="ds-heart" d={heart(1061, 70, 11)} fill="var(--accent)" />

      <g transform={`translate(${START} ${H})`}>
        <g className="ds-rider" style={{ "--ds-distance": `${DISTANCE}px` } as CSSProperties}>
          <Rider />
        </g>
      </g>
    </svg>
  );
}

function heart(cx: number, cy: number, r: number) {
  return `M${cx} ${cy + r} C ${cx - 2 * r} ${cy - 0.2 * r}, ${cx - r} ${cy - 1.6 * r}, ${cx} ${cy - 0.6 * r} C ${cx + r} ${cy - 1.6 * r}, ${cx + 2 * r} ${cy - 0.2 * r}, ${cx} ${cy + r} Z`;
}

function Cloud({ className, y, scale }: { className: string; y: number; scale: number }) {
  return (
    <g className={className}>
      <g transform={`translate(0 ${y}) scale(${scale})`} fill="var(--surface)">
        <ellipse cx={0} cy={10} rx={58} ry={16} />
        <circle cx={-18} cy={2} r={20} />
        <circle cx={14} cy={-4} r={26} />
      </g>
    </g>
  );
}

function Tree({ x, h }: { x: number; h: number }) {
  return (
    <g transform={`translate(${x} ${H})`}>
      <rect x={-3} y={-h * 0.45} width={6} height={h * 0.45} fill="var(--muted)" opacity={0.6} />
      <circle cx={0} cy={-h * 0.62} r={h * 0.32} fill="var(--shape-green)" opacity={0.75} />
    </g>
  );
}

// Drawn facing right around x = 0, with the ground at y = 0, so the ride back is a simple mirror.
function Rider() {
  return (
    <g className="ds-bob">
      {[-34, 34].map((x) => (
        <g key={x} transform={`translate(${x} -22)`}>
          <g className="ds-wheel">
            <circle r={20} fill="none" stroke="var(--ink)" strokeWidth={3.5} />
            <path d="M-19 0H19M0-19V19M-13.4-13.4L13.4 13.4M-13.4 13.4L13.4-13.4" stroke="var(--muted)" strokeWidth={1.2} />
          </g>
        </g>
      ))}
      <path d="M-34 -22 L-8 -22 L14 -50 L-16 -50 Z M-8 -22 L-19 -58 M14 -50 L34 -22 M14 -50 L18 -64" fill="none" stroke="var(--brand)" strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
      <path d="M17 -64 L27 -66" stroke="var(--ink)" strokeWidth={3.5} strokeLinecap="round" />
      <path d="M-26 -59 H-12" stroke="var(--ink)" strokeWidth={4.5} strokeLinecap="round" />
      <path d="M-34 -22 L-44 -52 H-22" fill="none" stroke="var(--ink)" strokeWidth={2.5} strokeLinejoin="round" />
      <g className="ds-box">
        <rect x={-60} y={-84} width={40} height={32} rx={4} fill="var(--shape-green)" />
        <rect x={-60} y={-76} width={40} height={4} fill="var(--bg)" opacity={0.5} />
      </g>
      <path d="M-17 -60 L0 -40 L-7 -22" fill="none" stroke="var(--ink)" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-16 -62 L2 -90" stroke="var(--shape-saffron)" strokeWidth={13} strokeLinecap="round" />
      <path d="M0 -86 L22 -66" stroke="var(--shape-saffron)" strokeWidth={6} strokeLinecap="round" />
      <circle cx={7} cy={-102} r={9} fill="#c58b66" />
      <path d="M-3 -104 a10.5 10.5 0 0 1 21 0 z" fill="var(--ink)" />
    </g>
  );
}
