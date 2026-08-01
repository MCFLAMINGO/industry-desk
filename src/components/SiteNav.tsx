"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/industries";
import clsx from "clsx";

const LINKS = [
  { href: "/", label: "Industries" },
  { href: "/ai", label: "AI Desk" },
  { href: "/connect", label: "Connect" },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(238,247,246,0.82)] backdrop-blur-md">
      <div className="shell flex items-center justify-between gap-4 py-3.5">
        <Link href="/" className="display text-xl font-semibold text-[var(--teal-deep)]">
          {BRAND.name}
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--teal-deep)] text-[#f0fdfa]"
                    : "text-[var(--ink-soft)] hover:text-[var(--teal-deep)]"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
