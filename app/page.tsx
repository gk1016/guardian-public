import Link from "next/link";
import { Shield, Crosshair, Siren } from "lucide-react";
import { PublicNav } from "@/components/public-nav";

const capabilities = [
  "Anti-piracy interdiction and escort",
  "Combat search and rescue dispatch",
  "Strike and escort mission planning",
  "Intel board with threat context",
  "ROE, checklists, and doctrine control",
  "Command deck for live watchstanding",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.15),_transparent_35%),linear-gradient(180deg,_#0a0e14_0%,_#070b12_100%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-6 pb-20 pt-6 lg:px-10">
        <PublicNav variant="landing" />

        <section className="pt-14">
          <div className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-amber-300/20 bg-amber-300/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-amber-200">
            <Siren size={12} />
            Standalone Ops Platform
          </div>
          <h1 className="mt-5 max-w-3xl font-[family:var(--font-display)] text-4xl uppercase leading-[0.95] tracking-[0.06em] text-white sm:text-5xl lg:text-6xl">
            Mission control for pilots who hunt pirates and pull people out alive.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">
            Guardian is a standalone operations platform for a military-pilot Star Citizen org.
            Planning, rescue, dispatch, readiness, and threat tracking in one system.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center rounded-[var(--radius-md)] border border-amber-300/30 bg-amber-300 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-950 transition hover:bg-amber-200"
            >
              Sign In
            </Link>
          </div>
        </section>

        <section className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((item) => (
            <div
              key={item}
              className="rounded-[var(--radius-md)] border border-white/8 bg-white/3 px-4 py-3 text-sm text-slate-300"
            >
              {item}
            </div>
          ))}
        </section>

        <section className="mt-14 grid gap-5 md:grid-cols-3">
          <article className="rounded-[var(--radius-lg)] border border-white/8 bg-[var(--color-panel)] p-5">
            <Shield size={18} className="text-amber-300" />
            <h3 className="mt-3 font-[family:var(--font-display)] text-lg uppercase tracking-[0.08em] text-white">
              Serious Ops Tone
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              The authenticated side reads like a briefing room, not a streamer overlay.
            </p>
          </article>
          <article className="rounded-[var(--radius-lg)] border border-white/8 bg-[var(--color-panel)] p-5">
            <Crosshair size={18} className="text-cyan-300" />
            <h3 className="mt-3 font-[family:var(--font-display)] text-lg uppercase tracking-[0.08em] text-white">
              Direct Action
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Built for anti-piracy, escort, rescue, and strike with minimal ceremony.
            </p>
          </article>
          <article className="rounded-[var(--radius-lg)] border border-white/8 bg-[var(--color-panel)] p-5">
            <Siren size={18} className="text-red-300" />
            <h3 className="mt-3 font-[family:var(--font-display)] text-lg uppercase tracking-[0.08em] text-white">
              Fast Triage
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Command surfaces what matters first: active sorties, open rescue, threat changes.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
