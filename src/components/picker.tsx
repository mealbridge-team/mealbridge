import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";

// Stand-in for sign-in during the hackathon: choose which restaurant, driver, shelter or sponsor
// you are. Kept small and labelled so it reads as a demo control, not part of the product.
export function Picker({
  items,
  selectedId,
  param,
  path,
}: {
  items: { id: string; name: string }[];
  selectedId: string;
  param: string;
  path: string;
}) {
  const selected = items.find((i) => i.id === selectedId);
  return (
    <details className="group relative inline-block text-sm">
      <summary className="flex min-h-11 list-none items-center gap-2 rounded-lg border border-line bg-bg px-3.5 hover:bg-surface [&::-webkit-details-marker]:hidden">
        <span className="text-muted">Viewing as</span>
        <span className="max-w-[14rem] truncate font-semibold">{selected?.name}</span>
        <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="absolute right-0 z-[1000] mt-2 max-h-80 w-72 overflow-auto rounded-xl border border-line bg-bg p-1 shadow-lg">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`${path}?${param}=${item.id}`}
              className="flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 hover:bg-surface"
              aria-current={item.id === selectedId ? "true" : undefined}
            >
              <span className={item.id === selectedId ? "font-semibold" : ""}>{item.name}</span>
              {item.id === selectedId && <Check className="h-4 w-4 text-brand" aria-hidden />}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
