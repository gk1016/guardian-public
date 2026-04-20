import Link from "next/link";
import {
  AlertTriangle,
  Crosshair,
  Radar,
  Shield,
  Siren,
  Users,
} from "lucide-react";

const modules = [
  {
    name: "Mission Planning",
    description:
      "Build patrols, strike packages, escort profiles, and rescue sorties with phase-based briefs and explicit readiness gates.",
    accent: "from-amber-400/70 to-orange-500/40",
  },
  {
    name: "Threat Picture",
    description:
      "Track pirates, gankers, route hazards, and hostile org activity with confidence, recency, and area-of-operation context.",
    accent: "from-red-500/70 to-rose-500/35",
  },
  {
    name: "QRF + CSAR",
    description:
      "Standby status, dispatch boards, rescue intake, and operator assignment built for fast response instead of endless chat scrollback.",
    accent: "from-cyan-400/70 to-sky-500/35",
  },
  {
    name: "Doctrine",
    description:
      "ROE, SOPs, checklists, and briefing templates stay attached to missions so standards survive contact with chaos.",
    accent: "from-lime-300/60 to-emerald-500/30",
  },
];

const pillars = [
  {
    title: "Serious Ops Tone",
    body: "The public side is sleek and modern. The authenticated side reads like a briefing room, not a streamer overlay.",
    icon: Shield,
  },
  {
    title: "Fast Triage",
    body: "Command pages surface what matters first: active sorties, open rescue calls, threat changes, and readiness posture.",
    icon: Radar,
  },
  {
    title: "Direct Action Workflow",
    body: "Guardian is being built for anti-piracy, escort, rescue, and strike planning with minimal ceremony and clear role ownership.",
    icon: Crosshair,
  },
];

const highlights = [
  "Anti-piracy and ganker interdiction",
  "Combat search and rescue dispatch",
  "Strike and escort mission planning",
  "Intel board with target and route context",
  "ROE, checklists, and doctrine control",
  "Command deck for live watchstanding",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.2),_transparent_35%),radial-gradient(circle_at_75%_20%,_rgba(239,68,68,0.16),_transparent_30%),linear-gradient(180deg,_#091019_0%,_#070b12_45%,_#05080d_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:72px_72px] opacity-35" />

      <section className="mx-auto flex w-full max-w-7xl flex-col px-6 pb-20 pt-6 lg:px-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <div className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.32em] text-amber-300">
              Guardian
            </div>
            <p className="mt-1 text-sm uppercase tracking-[0.24em] text-slate-400">
              Operational Platform for Anti-Piracy and Rescue
            </p>
          </div>
          <nav className="hidden gap-6 text-sm uppercase tracking-[0.24em] text-slate-300 md:flex">
            <a href="#modules" className="transition hover:text-white">
              Modules
            </a>
            <a href="#ethos" className="transition hover:text-white">
              Ethos
            </a>
            <Link href="/command" className="transition hover:text-white">
              Command Deck
            </Link>
          </nav>
        </header>

        <div className="grid gap-14 pt-14 lg:grid-cols-[1.35fr_0.85fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs uppercase tracking-[0.26em] text-amber-200">
              <Siren size={14} />
              Standalone Ops System
            </div>
            <h1 className="mt-7 max-w-4xl font-[family:var(--font-display)] text-5xl uppercase leading-[0.94] tracking-[0.08em] text-white sm:text-6xl lg:text-7xl">
              Mission control for pilots who hunt pirates and pull people out alive.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
              Guardian is a new standalone platform for a military-pilot Star Citizen org. It is being
              built around planning, rescue, dispatch, readiness, and threat tracking without dragging
              Cloud Core&apos;s consumer-product baggage into the fight.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href="/command"
                className="inline-flex items-center justify-center rounded-md border border-amber-300/35 bg-amber-300 px-5 py-3 font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-amber-200"
              >
                Open Command Deck
              </Link>
              <Link
                href="/missions"
                className="inline-flex items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-300/10 px-5 py-3 font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-300/15"
              >
                Review Live Mission Board
              </Link>
              <a
                href="#modules"
                className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/5 px-5 py-3 font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
              >
                Review Modules
              </a>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {highlights.map((item) => (
                <div
                  key={item}
                  className="rounded-md border border-white/10 bg-white/4 px-4 py-3 text-sm uppercase tracking-[0.18em] text-slate-200"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.22em] text-white">
                  Watch Floor
                </p>
                <p className="mt-1 text-sm uppercase tracking-[0.18em] text-slate-400">
                  Initial Command Snapshot
                </p>
              </div>
              <AlertTriangle className="text-amber-300" size={18} />
            </div>

            <div className="mt-5 space-y-4 text-sm">
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                <div className="flex items-center justify-between uppercase tracking-[0.16em] text-red-200">
                  <span>Threat Change</span>
                  <span>Updated 4m ago</span>
                </div>
                <p className="mt-3 text-base text-white">
                  Pirate contact cluster reported along common convoy routes. Escort posture elevated in
                  the current AO.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-100">QRF</p>
                  <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
                    REDCON 2
                  </p>
                  <p className="mt-2 text-slate-200">Two pilots and one gunner available within five minutes.</p>
                </div>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">CSAR</p>
                  <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
                    1 OPEN
                  </p>
                  <p className="mt-2 text-slate-200">Priority rescue request awaiting final escort assignment.</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400">
                  <span>Current Stack</span>
                  <span>Bootstrap</span>
                </div>
                <ul className="mt-4 space-y-3 text-slate-200">
                  <li className="flex items-center justify-between">
                    <span>Public Operations Landing</span>
                    <span className="text-amber-300">Online</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Command Deck Shell</span>
                    <span className="text-amber-300">Online</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Prisma + Postgres Scaffold</span>
                    <span className="text-amber-300">Online</span>
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section id="modules" className="mx-auto grid w-full max-w-7xl gap-6 px-6 pb-24 lg:grid-cols-2 lg:px-10">
        {modules.map((module) => (
          <article
            key={module.name}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.32)]"
          >
            <div className={`h-1 w-full rounded-full bg-gradient-to-r ${module.accent}`} />
            <h2 className="mt-5 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.16em] text-white">
              {module.name}
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">{module.description}</p>
          </article>
        ))}
      </section>

      <section id="ethos" className="mx-auto w-full max-w-7xl px-6 pb-28 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Operating Assumption</p>
            <h2 className="mt-3 font-[family:var(--font-display)] text-4xl uppercase tracking-[0.14em] text-white">
              Built for operators, not tourists.
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-300">
              Guardian is meant for an org of military pilots from the USAF, USN, and USMC. The design
              language borrows from briefing cards, route overlays, kneeboards, and watchstanding
              displays instead of generic gaming UI.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {pillars.map(({ title, body, icon: Icon }) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
                <Icon size={22} className="text-amber-300" />
                <h3 className="mt-5 font-[family:var(--font-display)] text-2xl uppercase tracking-[0.12em] text-white">
                  {title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-slate-300">{body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-6 rounded-2xl border border-white/10 bg-black/30 px-6 py-7 md:flex-row md:items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Bootstrap Status</p>
            <p className="mt-2 max-w-3xl text-lg leading-8 text-white">
              Repo, landing page, command shell, Docker, Prisma, and seeded operational boards are now
              live. Next slices should wire auth, mission CRUD, and guarded mutation workflows.
            </p>
          </div>
          <Link
            href="/command"
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white px-5 py-3 font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-slate-200"
          >
            <Users size={16} />
            View Command Deck
          </Link>
        </div>
      </section>
    </main>
  );
}
