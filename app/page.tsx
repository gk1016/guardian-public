import Link from "next/link";
import {
  Shield,
  Crosshair,
  Siren,
  Radio,
  Brain,
  Target,
  BookOpen,
  Bell,
  Users,
  Radar,
  LifeBuoy,
  Zap,
} from "lucide-react";
import { PublicNav } from "@/components/public-nav";

const operationsFeatures = [
  {
    icon: Target,
    title: "Mission Planning",
    desc: "Multi-phase mission builder with callsign assignment, doctrine binding, participant rosters, and phase-by-phase execution tracking.",
  },
  {
    icon: LifeBuoy,
    title: "Combat Search & Rescue",
    desc: "Dedicated CSAR dispatch with survivor tracking, escort coordination, medical triage flags, and real-time rescue status.",
  },
  {
    icon: Zap,
    title: "QRF Readiness & Dispatch",
    desc: "Quick Reaction Force board with REDCON status, platform tracking, and one-click dispatch tied to active missions or rescue ops.",
  },
  {
    icon: Shield,
    title: "Doctrine & ROE Control",
    desc: "Weapons Hold, Weapons Tight, Weapons Free — templated doctrine with escalation rules that bind directly to mission packages.",
  },
  {
    icon: Radar,
    title: "Intel Board",
    desc: "Threat reports with severity scoring, hostile group tracking, confidence ratings, and direct linkage to missions and incidents.",
  },
  {
    icon: Siren,
    title: "Incident Review",
    desc: "After-action incident tracking with lessons learned, action items, and linkage to the missions and rescues that generated them.",
  },
];

const aiFeatures = [
  {
    title: "Multi-Provider AI Engine",
    desc: "Pluggable architecture supporting OpenAI, Anthropic, and local Ollama models. Configure per-analysis-type, swap providers without code changes.",
  },
  {
    title: "Threat Pattern Analysis",
    desc: "AI-driven analysis of intel reports to identify recurring hostile patterns, bait-beacon tactics, and interdiction geometry across your AO.",
  },
  {
    title: "Mission Risk Scoring",
    desc: "Automated risk assessment that factors in current threat picture, escort availability, route history, and hostile contact density.",
  },
  {
    title: "Operational Recommendations",
    desc: "Context-aware suggestions for ROE posture, escort composition, and route selection based on live intel and historical incident data.",
  },
];

const platformFeatures = [
  {
    icon: Radio,
    title: "Command Deck",
    desc: "Live watchstanding view with active missions, open rescues, QRF status, and threat changes surfaced in priority order.",
  },
  {
    icon: BookOpen,
    title: "Manual Center",
    desc: "Full operational manual with document upload, inline viewing, GitHub-style markdown rendering, and searchable reference library.",
  },
  {
    icon: Bell,
    title: "Notification System",
    desc: "Severity-tiered alerts for QRF dispatch, incident escalation, rescue status changes, and threat board updates.",
  },
  {
    icon: Users,
    title: "Role-Based Access",
    desc: "Commander, pilot, rescue coordinator, and admin roles with scoped permissions across all operational surfaces.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.15),_transparent_35%),linear-gradient(180deg,_#0a0e14_0%,_#070b12_100%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-6 pb-20 pt-6 lg:px-10">
        <PublicNav variant="landing" />

        {/* Hero */}
        <section className="pt-14">
          <div className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-amber-300/20 bg-amber-300/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-amber-200">
            <Siren size={12} />
            Standalone Ops Platform
          </div>
          <h1 className="mt-5 max-w-3xl font-[family:var(--font-display)] text-4xl uppercase leading-[0.95] tracking-[0.06em] text-[var(--color-text-strong)] sm:text-5xl lg:text-6xl">
            Mission control for pilots who hunt pirates and pull people out alive.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)]">
            Guardian is a full-stack operations platform built for a military-pilot Star Citizen org.
            Mission planning, CSAR dispatch, QRF readiness, intel fusion, doctrine enforcement,
            AI-powered threat analysis, and incident review — one system, zero cloud dependency.
          </p>

          <div className="mt-7 flex gap-3">
            <Link
              href="/login"
              className="inline-flex items-center rounded-[var(--radius-md)] border border-amber-300/25 bg-amber-300/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200 transition hover:border-amber-300/40 hover:bg-amber-300/15 hover:text-amber-100"
            >
              Sign In
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-border-bright)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)] transition hover:border-[var(--color-text-tertiary)] hover:text-[var(--color-text-strong)]"
            >
              Learn More
            </Link>
          </div>
        </section>

        {/* Operations */}
        <section className="mt-20">
          <div className="flex items-center gap-3">
            <Crosshair size={16} className="text-cyan-300" />
            <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.2em] text-cyan-300">
              Operations
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-tertiary)]">
            Every operational surface a combat org needs — from mission planning through incident review.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {operationsFeatures.map((f) => (
              <article
                key={f.title}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5"
              >
                <f.icon size={18} className="text-[var(--color-text-tertiary)]" />
                <h3 className="mt-3 font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
                  {f.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                  {f.desc}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* AI Engine */}
        <section className="mt-20">
          <div className="flex items-center gap-3">
            <Brain size={16} className="text-violet-400" />
            <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.2em] text-violet-400">
              AI Engine
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-tertiary)]">
            Integrated AI analysis powered by a Rust engine with pluggable provider support.
            Runs local with Ollama or connects to OpenAI and Anthropic — your choice, your data.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {aiFeatures.map((f) => (
              <article
                key={f.title}
                className="rounded-[var(--radius-lg)] border border-violet-500/15 bg-violet-500/5 p-5"
              >
                <h3 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
                  {f.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                  {f.desc}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Platform */}
        <section className="mt-20">
          <div className="flex items-center gap-3">
            <Shield size={16} className="text-[var(--color-accent)]" />
            <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.2em] text-[var(--color-accent)]">
              Platform
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-tertiary)]">
            Self-hosted, air-gap ready. Next.js frontend, Rust analysis engine, PostgreSQL — all in one Docker Compose stack.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {platformFeatures.map((f) => (
              <article
                key={f.title}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5"
              >
                <f.icon size={18} className="text-[var(--color-text-tertiary)]" />
                <h3 className="mt-3 font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
                  {f.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                  {f.desc}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Architecture strip */}
        <section className="mt-20 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-6 py-5">
          <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.2em] text-[var(--color-text-strong)]">
            Architecture
          </h2>
          <div className="mt-3 grid gap-x-8 gap-y-2 text-[13px] leading-6 text-[var(--color-text-secondary)] sm:grid-cols-2 lg:grid-cols-4">
            <div><span className="text-[var(--color-text-tertiary)]">Frontend</span> — Next.js 16, React 19, Tailwind 4</div>
            <div><span className="text-[var(--color-text-tertiary)]">AI Engine</span> — Rust, multi-provider (OpenAI / Anthropic / Ollama)</div>
            <div><span className="text-[var(--color-text-tertiary)]">Database</span> — PostgreSQL + Prisma ORM</div>
            <div><span className="text-[var(--color-text-tertiary)]">Deploy</span> — Docker Compose, Caddy reverse proxy, self-hosted</div>
          </div>
        </section>
      </div>
    </main>
  );
}
