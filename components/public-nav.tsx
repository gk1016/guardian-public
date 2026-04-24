"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const navItems = [
  { href: "/about", label: "About" },
  { href: "/standards", label: "Standards" },
  { href: "/recruit", label: "Recruit" },
];

type PublicNavProps = {
  variant?: "landing" | "subpage";
};

export function PublicNav({ variant = "subpage" }: PublicNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLanding = variant === "landing";

  return (
    <header
      className={`relative flex items-center justify-between border-b pb-4 ${
        isLanding ? "border-[var(--color-border)]" : "border-[var(--color-border-bright)] pb-6"
      }`}
    >
      <div>
        <Link
          href="/"
          className={`font-[family:var(--font-display)] uppercase text-[var(--color-accent)] ${
            isLanding
              ? "text-xl tracking-[0.24em]"
              : "text-2xl tracking-[0.32em]"
          }`}
        >
          Guardian
        </Link>
        <p
          className={`mt-0.5 uppercase text-[var(--color-text-secondary)] ${
            isLanding
              ? "text-[11px] tracking-[0.16em] text-[var(--color-text-tertiary)]"
              : "mt-1 text-sm tracking-[0.24em]"
          }`}
        >
          Operational Platform
        </p>
      </div>

      {/* Desktop nav */}
      <nav
        className={`hidden gap-5 uppercase text-[var(--color-text-secondary)] md:flex ${
          isLanding
            ? "text-xs tracking-[0.16em]"
            : "text-sm tracking-[0.2em]"
        }`}
      >
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="transition hover:text-[var(--color-text-strong)]"
          >
            {item.label}
          </Link>
        ))}
        <Link href="/login" className="transition hover:text-[var(--color-text-strong)]">
          Sign In
        </Link>
      </nav>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen((v) => !v)}
        className="rounded-[var(--radius-md)] border border-[var(--color-border-bright)] p-2 text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-strong)] md:hidden"
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <nav className="absolute left-0 right-0 top-full z-50 border-b border-[var(--color-border-bright)] bg-[var(--color-bg)] px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm uppercase tracking-[0.16em] text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-strong)]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="mt-1 inline-flex w-fit items-center rounded-[var(--radius-md)] border border-amber-300/30 bg-amber-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-950 transition hover:bg-amber-200"
            >
              Sign In
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
