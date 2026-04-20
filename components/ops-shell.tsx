import Link from "next/link";
import type { ReactNode } from "react";
import { Shield, Siren, Users } from "lucide-react";
import type { GuardianSession } from "@/lib/auth";

type OpsShellProps = {
  currentPath: "/command" | "/missions" | "/intel" | "/rescues" | "/doctrine";
  section: string;
  title: string;
  description: string;
  orgName: string;
  session: GuardianSession;
  children: ReactNode;
};

const navItems: Array<{
  href: OpsShellProps["currentPath"];
  label: string;
}> = [
  { href: "/command", label: "Command" },
  { href: "/missions", label: "Missions" },
  { href: "/intel", label: "Intel" },
  { href: "/doctrine", label: "Doctrine" },
  { href: "/rescues", label: "Rescue" },
];

export function OpsShell({
  currentPath,
  section,
  title,
  description,
  orgName,
  session,
  children,
}: OpsShellProps) {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-6 py-8 text-[var(--color-text)] lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.26em] text-slate-400">
                {orgName} / {section}
              </p>
              <h1 className="mt-3 font-[family:var(--font-display)] text-5xl uppercase tracking-[0.14em] text-white">
                {title}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-8 text-slate-300">
                {description}
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300 md:min-w-80">
              <div className="flex items-center gap-3">
                <Shield size={16} className="text-amber-300" />
                <span className="font-semibold text-white">
                  {session.displayName || session.handle}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Users size={16} className="text-cyan-300" />
                <span className="uppercase tracking-[0.16em]">
                  {session.role}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Siren size={16} className="text-emerald-300" />
                <span>{session.email}</span>
              </div>
              <form action="/api/auth/logout" method="post" className="pt-2">
                <button
                  type="submit"
                  className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>

          <nav className="flex flex-wrap gap-3">
            {navItems.map((item) => {
              const active = item.href === currentPath;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                    active
                      ? "border-amber-300/30 bg-amber-300 text-slate-950"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        {children}
      </div>
    </main>
  );
}
