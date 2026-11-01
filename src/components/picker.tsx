import Link from "next/link";

// Stand-in for sign-in during the hackathon: pick which restaurant, driver or shelter you are.
export function Picker({
  label,
  items,
  selectedId,
  param,
  path,
}: {
  label: string;
  items: { id: string; name: string }[];
  selectedId: string;
  param: string;
  path: string;
}) {
  const selected = items.find((i) => i.id === selectedId);
  return (
    <details className="group relative mb-5 inline-block text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-dashed border-line bg-paper px-3 py-1.5 text-muted hover:text-ink">
        <span className="text-xs uppercase tracking-wider">{label}</span>
        <span className="font-semibold text-ink">{selected?.name}</span>
        <span aria-hidden className="transition group-open:rotate-180">▾</span>
      </summary>
      <ul className="absolute z-[1000] mt-2 min-w-64 overflow-hidden rounded-2xl border border-line bg-paper py-1 shadow-card">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`${path}?${param}=${item.id}`}
              className={`block px-4 py-2 hover:bg-cream ${item.id === selectedId ? "font-semibold text-leaf" : ""}`}
            >
              {item.name}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
