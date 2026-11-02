import Image from "next/image";

// People and food on flat colour shapes: the site's illustration language. A cut-out stands on a
// large circle with smaller shapes drifting around it; a photo sits inside the circle instead.

type Tone = "coral" | "saffron" | "mint" | "sky" | "green";

const BG: Record<Tone, string> = {
  coral: "bg-shape-coral",
  saffron: "bg-shape-saffron",
  mint: "bg-shape-mint",
  sky: "bg-shape-sky",
  green: "bg-shape-green",
};

export function ShapeArt({
  src,
  alt,
  kind = "cutout",
  tones = ["mint", "coral", "saffron"],
  priority,
  sizes = "(min-width: 768px) 40vw, 90vw",
  className = "",
}: {
  src: string;
  alt: string;
  kind?: "cutout" | "photo";
  /** Big circle, small circle, accent half-pill. */
  tones?: readonly [Tone, Tone, Tone];
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const [big, small, accent] = tones;
  return (
    <div className={`relative isolate ${className}`}>
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className={`absolute bottom-0 left-1/2 aspect-square h-[92%] -translate-x-1/2 rounded-full ${BG[big]}`} />
        <div className={`shape-float absolute right-[4%] top-[6%] aspect-square w-[18%] rounded-full ${BG[small]}`} />
        <div className={`shape-float-slow absolute bottom-[14%] left-[2%] h-[26%] w-[11%] rounded-r-full ${BG[accent]}`} />
        <div
          className="shape-float-slow absolute left-[10%] top-[10%] h-[18%] w-[16%] opacity-50"
          style={{ backgroundImage: "radial-gradient(var(--ink) 1.4px, transparent 1.6px)", backgroundSize: "12px 12px" }}
        />
      </div>
      {kind === "cutout" ? (
        <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="shape-subject object-contain object-bottom" />
      ) : (
        <div className="absolute bottom-[4%] left-1/2 aspect-square h-[84%] -translate-x-1/2">
          <div className="shape-subject relative h-full w-full overflow-hidden rounded-full border-[6px] border-bg">
            <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="object-cover" />
          </div>
        </div>
      )}
    </div>
  );
}
