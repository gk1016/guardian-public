import { Shield, Brain, Globe, Crosshair } from "lucide-react";
import { PublicShell } from "@/components/public-shell";

const sections = [
  {
    icon: Crosshair,
    title: "Why Guardian Exists",
    body: "Running an org gets complicated fast. Planning, dispatch, intel, and review end up scattered across Discord, spreadsheets, and memory. Guardian puts every operational surface in one system so leadership can focus on running ops, not chasing information.",
  },
  {
    icon: Shield,
    title: "What It Is",
    body: "A full-stack operations platform for Star Citizen organizations. Mission planning, dispatch, QRF readiness, intel tracking, AI-powered command, Discord integration, org-to-org federation, and a live tactical board — self-hosted, air-gap ready, works for any playstyle.",
  },
  {
    icon: Brain,
    title: "How It Works",
    body: "A Rust engine handles all API routes, AI orchestration, and the Discord bot. A Vite React SPA delivers the ops UI. PostgreSQL stores everything. Docker Compose deploys the whole stack. No cloud dependencies, no third-party accounts required.",
  },
  {
    icon: Globe,
    title: "Federation",
    body: "Guardian instances can peer with allied orgs over WebSocket. Share intel, coordinate joint operations, and communicate across org boundaries — each org keeps full sovereignty over their own data and infrastructure.",
  },
];

export function AboutPage() {
  return (
    <PublicShell
      eyebrow="Platform Overview"
      title="One platform for everything your org actually does."
      description="Guardian keeps planning, dispatch, intel, and review inside one system — so your leadership can focus on running ops, not reconstructing what happened from chat logs."
    >
      <section className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <article
            key={section.title}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5"
          >
            <section.icon size={18} className="text-[var(--color-text-tertiary)]" />
            <h2 className="mt-3 font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
              {section.title}
            </h2>
            <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
              {section.body}
            </p>
          </article>
        ))}
      </section>
    </PublicShell>
  );
}
