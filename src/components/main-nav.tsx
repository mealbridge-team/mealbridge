"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { buttonClass } from "./ui";

type NavItem = { href: string; label: string };

export function MainNav({ links }: { links: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Close the mobile menu after navigating, and on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <nav aria-label="Main" className="ml-auto hidden items-center gap-1 lg:flex">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${isActive(l.href) ? "font-semibold text-ink" : "text-muted hover:text-ink"}`}
          >
            {l.label}
          </Link>
        ))}
        <Link href="/donate" className={`${buttonClass.donate} ml-3 min-h-10`}>
          Donate
        </Link>
      </nav>

      <div className="ml-auto flex items-center gap-2 lg:hidden">
        <Link href="/donate" className={`${buttonClass.donate} min-h-10`}>
          Donate
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid h-11 w-11 place-items-center rounded-lg border border-line"
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label="Main" className="absolute inset-x-0 top-16 border-b border-line bg-bg shadow-lg lg:hidden">
          <ul className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
            {[...links, { href: "/coordinator", label: "Coordinator console" }].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={`flex min-h-12 items-center border-b border-line text-base last:border-0 ${isActive(l.href) ? "font-semibold" : ""}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
