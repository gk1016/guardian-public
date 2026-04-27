import { Link } from "react-router";
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
  MessageSquare,
  Globe,
  Map,
  Lock,
  ScrollText,
  Sparkles,
  MonitorDot,
  Cog,
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
    title: "Search & Rescue",
    desc: "Dedicated SAR dispatch with survivor tracking, escort coordination, triage flags, and real-time rescue status updates.",
  },
  {
    icon: Zap,
    title: "QRF Readiness & Dispatch",
    desc: "Quick Reaction Force board with readiness status, asset tracking, and one-click dispatch tied to active missions or rescue ops.",
  },
  {
    icon: Shield,
    title: "Doctrine & ROE Control",
    desc: "Templated doctrine with escalation rules that bind directly to mission packages. Define your rules of engagement, enforce them in the field.",
  },
  {
    icon: Radar,
    title: "Intel Board",
    desc: "Intelligence reports with severity scoring, group tracking, confidence ratings, and direct linkage to missions and incidents.",
  },
  {
    icon: Siren,
    title: "Incident Review",
    desc: "After-action incident tracking with lessons learned, action items, and linkage to the missions and operations that generated them.",
  },
  {
    icon: Map,
    title: "Live Tactical Board",
    desc: "Full-screen common operating picture with real-time mission status, active operations, QRF readiness, and org-wide alerts.",
  },
  {
    icon: Radio,
    title: "Command Deck",
    desc: "Live watchstanding view with active missions, open operations, QRF status, and intel changes surfaced in priority order.",
  },
];

const aiFeatures = [
  {
    icon: Sparkles,
    title: "AI Command Panel",
    desc: "Natural language interface to your entire ops database. Query missions, intel, members, and manuals — or execute admin actions — by typing plain English.",
  },
  {
    icon: MonitorDot,
    title: "Dynamic Model Registry",
    desc: "Live model discovery from OpenAI, Anthropic, and Ollama. Auto-refresh available models, select per-task, swap providers without touching config files.",
  },
  {
    icon: Brain,
    title: "Intel Pattern Analysis",
    desc: "AI-driven analysis of intelligence reports to identify recurring patterns, operational trends, and risk factors across your area of operations.",
  },
  {
    icon: Crosshair,
    title: "Mission Risk Scoring",
    desc: "Automated risk assessment factoring current intel picture, asset availability, route history, and operational tempo.",
  },
];

const federationFeatures = [
  {
    icon: Globe,
    title: "Org-to-Org Peering",
    desc: "WebSocket-based federation between Guardian instances. Establish mutual trust, share operational tempo, and coordinate across org boundaries.",
  },
  {
    icon: MessageSquare,
    title: "Cross-Org Chat",
    desc: "Encrypted real-time messaging between federated orgs. Coordinate joint ops, share intel, and maintain inter-org comms without third-party tools.",
  },
  {
    icon: Radar,
    title: "Shared Intel Feed",
    desc: "Federated intel board where allied orgs push and receive intelligence reports, sightings, and area assessments in real time.",
  },
];

const discordFeatures = [
  {
    icon: MessageSquare,
    title: "Slash Commands",
    desc: "Full command suite — /status, /missions, /intel, /qrf, /roster — operational queries without leaving Discord.",
  },
  {
    icon: Bell,
    title: "Live Event Feeds",
    desc: "Real-time event bridge pushes mission launches, dispatch alerts, QRF activations, and intel updates to configured Discord channels.",
  },
  {
    icon: Brain,
    title: "AI SITREP",
    desc: "On-demand AI-generated situation reports summarizing current ops tempo, active intel, and resource posture — delivered straight to Discord.",
  },
];

const platformFeatures = [
  {
    icon: Lock,
    title: "MFA / TOTP",
    desc: "Time-based one-time password support with QR enrollment, backup codes, and admin-initiated TOTP reset for locked-out members.",
  },
  {
    icon: ScrollText,
    title: "Audit Logging",
    desc: "Every mutation logged with actor, action, target, and timestamp. Filterable audit trail with CSV export for compliance and review.",
  },
  {
    icon: Users,
    title: "Role-Based Access",
    desc: "Configurable roles with scoped permissions across all operational surfaces. Force-logout, session revocation, and password policy enforcement.",
  },
  {
    icon: BookOpen,
    title: "Manual Center",
    desc: "Operational manual with document upload, inline viewing, markdown rendering, and searchable reference library.",
  },
  {
    icon: Cog,
    title: "Setup Wizard",
    desc: "First-run configuration flow creates your org, seeds the first admin, and configures all services. Factory reset available for clean redeploys.",
  },
  {
    icon: Bell,
    title: "Notification System",
    desc: "Severity-tiered alerts for dispatch events, incident escalation, status changes, and intel updates.",
  },
];

export function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.15),_transparent_35%),linear-gradient(180deg,_#0a0e14_0%,_#070b12_100%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-6 pb-20 pt-6 lg:px-10">
        <PublicNav variant="landing" />

        {/* Hero */}
        <section className="pt-14">
          <div className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-amber-300/20 bg-amber-300/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-amber-200">
            <Siren size={12} />
            Self-Hosted Ops Platform
          </div>
          <h1 className="mt-5 max-w-3xl font-[family:var(--font-display)] text-4xl uppercase leading-[0.95] tracking-[0.06em] text-[var(--color-text-strong)] sm:text-5xl lg:text-6xl">
            Your org. Your ops. Your infrastructure. No compromises.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)]">
            Guardian is a full-stack operations platform for Star Citizen organizations.
            Mission planning, dispatch, QRF readiness, intel fusion, AI-powered command,
            Discord integration, org-to-org federation, and a live tactical board — one
            system, zero cloud dependency. Works for any org, any playstyle.
          </p>

          <div className="mt-7 flex gap-3">
            <Link
              to="/login"
              className="inline-flex items-center rounded-[var(--radius-md)] border border-amber-300/25 bg-amber-300/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200 transition hover:border-amber-300/40 hover:bg-amber-300/15 hover:text-amber-100"
            >
              Sign In
            </Link>
            <Link
              to="/about"
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
            Every operational surface an org needs — from mission planning through
            incident review, with a full-screen tactical board for real-time situational awareness.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            Rust-powered AI engine with a natural language command interface.
            Query your entire ops database, run intel analysis, or execute admin actions
            by typing plain English. Runs local with Ollama or connects to OpenAI and Anthropic.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {aiFeatures.map((f) => (
              <article
                key={f.title}
                className="rounded-[var(--radius-lg)] border border-violet-500/15 bg-violet-500/5 p-5"
              >
                <f.icon size={18} className="text-violet-400/70" />
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

        {/* Federation */}
        <section className="mt-20">
          <div className="flex items-center gap-3">
            <Globe size={16} className="text-emerald-400" />
            <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.2em] text-emerald-400">
              Federation
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-tertiary)]">
            Connect Guardian instances across orgs. Federated peering lets allied organizations
            share intel, coordinate joint operations, and communicate in real time — each org
            keeps full sovereignty over their own data.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {federationFeatures.map((f) => (
              <article
                key={f.title}
                className="rounded-[var(--radius-lg)] border border-emerald-500/15 bg-emerald-500/5 p-5"
              >
                <f.icon size={18} className="text-emerald-400/70" />
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

        {/* Discord */}
        <section className="mt-20">
          <div className="flex items-center gap-3">
            <MessageSquare size={16} className="text-indigo-400" />
            <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.2em] text-indigo-400">
              Discord Integration
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-tertiary)]">
            Bring your ops board into Discord. Configure your bot token through the admin panel,
            bind channels to event types, and your org gets live operational feeds alongside
            full slash-command access to Guardian data.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {discordFeatures.map((f) => (
              <article
                key={f.title}
                className="rounded-[var(--radius-lg)] border border-indigo-500/15 bg-indigo-500/5 p-5"
              >
                <f.icon size={18} className="text-indigo-400/70" />
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

        {/* Platform & Security */}
        <section className="mt-20">
          <div className="flex items-center gap-3">
            <Shield size={16} className="text-[var(--color-accent)]" />
            <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.2em] text-[var(--color-accent)]">
              Platform & Security
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-tertiary)]">
            Self-hosted, air-gap ready. MFA-protected accounts, full audit trail, role-scoped
            permissions, and a first-run setup wizard that gets you operational in minutes.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <div><span className="text-[var(--color-text-tertiary)]">Frontend</span> — Vite, React 19, Tailwind 4, TanStack Query</div>
            <div><span className="text-[var(--color-text-tertiary)]">Engine</span> — Rust (Axum), all API routes, AI orchestration, Discord bot</div>
            <div><span className="text-[var(--color-text-tertiary)]">Database</span> — PostgreSQL + sqlx, nightly backups</div>
            <div><span className="text-[var(--color-text-tertiary)]">Deploy</span> — Docker Compose, self-hosted, air-gap ready</div>
          </div>
        </section>
      </div>
    </main>
  );
}
