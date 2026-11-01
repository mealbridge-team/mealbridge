import Link from "next/link";

// Stand-in for sign-in during the hackathon: choose which restaurant/driver/shelter you are.
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
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">{label}</span>
      {items.map((item) => (
        <Link
          key={item.id}
          href={`${path}?${param}=${item.id}`}
          className={`rounded-full border px-3 py-1 ${
            item.id === selectedId ? "border-leaf bg-leaf text-white" : "border-line bg-paper hover:bg-leaf-soft"
          }`}
        >
          {item.name}
        </Link>
      ))}
    </div>
  );
}
