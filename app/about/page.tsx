import { Shield, Brain, Globe, Crosshair } from "lucide-react";
import { PublicShell } from "@/components/public-shell";

const sections = [
  {
    icon: Crosshair,
    title: "Why Guardian Exists",
    body: "Serious anti-piracy and rescue work falls apart when planning, dispatch, and review are scattered across Discord, screenshots, and memory. Guardian puts every operational surface in one system so command never has to reconstruct the fight from scraps.",
  },
  {
    icon: Shield,
    title: "What It Is",
    body: "A full-stack operations platform for military-pilot Star Citizen orgs. Mission planning, CSAR dispatch, QRF readiness, intel fusion, AI-powered command, Discord integration, org-to-org federation, and a live tactical board — self-hosted, air-gap ready.",
  },
  {
    icon: Brain,
    title: "How It Works",
    body: "A Rust engine handles all API routes, AI orchestration, and the Discord bot. A Next.js frontend delivers the ops UI. PostgreSQL stores everything. Docker Compose deploys the whole stack. No cloud dependencies, no third-party accounts required.",
  },
  {
    icon: Globe,
    title: "Federation",
    body: "Guardian instances can peer with allied orgs over WebSocket. Share intel, coordinate joint operations, and communicate across org boundaries — each org keeps full sovereignty over their own data and infrastructure.",
  },
];

export default function AboutPage() {
  return (
    <PublicShell
      eyebrow="Platform Overview"
      title="Built for operators who would rather fly than babysit bad tooling."
      description="Guardian keeps planning, dispatch, rescue, and review inside one system so command can focus on the fight."
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
