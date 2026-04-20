import Link from "next/link";
import type { ReactNode } from "react";

type PublicShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

const navItems = [
  { href: "/about", label: "About" },
  { href: "/ops", label: "Ops" },
  { href: "/standards", label: "Standards" },
  { href: "/recruit", label: "Recruit" },
  { href: "/aar", label: "AAR" },
];

export function PublicShell({
  eyebrow,
  title,
  description,
  children,
}: PublicShellProps) {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(244,182,60,0.12),_transparent_26%),linear-gradient(180deg,_#08111a_0%,_#05080d_100%)]" />
      <div className="mx-auto flex w-full max-w-7xl flex-col px-6 pb-24 pt-6 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/"
              className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.32em] text-amber-300"
            >
              Guardian
            </Link>
            <p className="mt-1 text-sm uppercase tracking-[0.24em] text-slate-400">
              Operational Platform for Anti-Piracy and Rescue
            </p>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm uppercase tracking-[0.2em] text-slate-300">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-white">
                {item.label}
              </Link>
            ))}
            <Link href="/login" className="transition hover:text-white">
              Sign In
            </Link>
          </nav>
        </header>

        <section className="grid gap-8 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-cyan-200">{eyebrow}</p>
            <h1 className="mt-5 font-[family:var(--font-display)] text-5xl uppercase leading-[0.94] tracking-[0.08em] text-white sm:text-6xl">
              {title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">{description}</p>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-slate-950/60 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Operating Idea</p>
            <p className="mt-4 text-sm leading-8 text-slate-300">
              Guardian is designed like a watch floor and briefing room. Public pages explain intent.
              The protected side carries the actual workflow.
            </p>
          </aside>
        </section>

        <div className="mt-12">{children}</div>
      </div>
    </main>
  );
}
