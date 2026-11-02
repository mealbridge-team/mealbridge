import { ShapeArt } from "@/components/shape-art";

// One illustration per audience, standing on the page header's bottom rule.
const ART = {
  restaurant: { src: "/cutouts/chef.webp", alt: "A chef holding out a stack of sealed meal containers", kind: "cutout", tones: ["saffron", "coral", "mint"] },
  driver: { src: "/cutouts/rider.webp", alt: "A volunteer rider with a delivery box on his bicycle", kind: "cutout", tones: ["mint", "saffron", "coral"] },
  shelter: { src: "/cutouts/handoff.webp", alt: "A meal box being handed from one person to another", kind: "photo", tones: ["sky", "coral", "saffron"] },
  sponsor: { src: "/cutouts/sponsor.webp", alt: "A smiling man carrying a crate of bread, oranges and greens", kind: "cutout", tones: ["sky", "saffron", "mint"] },
  donate: { src: "/cutouts/mealbox.webp", alt: "An open takeaway box of rice, curry and broccoli", kind: "photo", tones: ["coral", "mint", "saffron"] },
  impact: { src: "/cutouts/volunteers.webp", alt: "Three volunteers in aprons laughing together, each carrying a box of food", kind: "cutout", tones: ["mint", "coral", "saffron"] },
} as const;

export function PageArt({ page }: { page: keyof typeof ART }) {
  const a = ART[page];
  return <ShapeArt src={a.src} alt={a.alt} kind={a.kind} tones={a.tones} priority className="h-52 sm:h-64 md:h-80" />;
}
