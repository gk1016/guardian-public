import type { ReactNode } from "react";
import { PublicNav } from "@/components/public-nav";
import { Siren } from "lucide-react";

type PublicShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function PublicShell({
  eyebrow,
  title,
  description,
  children,
}: PublicShellProps) {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.15),_transparent_35%),linear-gradient(180deg,_#0a0e14_0%,_#070b12_100%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-6 pb-20 pt-6 lg:px-10">
        <PublicNav variant="subpage" />

        <section className="pt-14">
          <div className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-amber-300/20 bg-amber-300/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-amber-200">
            <Siren size={12} />
            {eyebrow}
          </div>
          <h1 className="mt-5 max-w-3xl font-[family:var(--font-display)] text-3xl uppercase leading-[0.95] tracking-[0.06em] text-[var(--color-text-strong)] sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)]">
            {description}
          </p>
        </section>

        <div className="mt-14">{children}</div>
      </div>
    </main>
  );
}
