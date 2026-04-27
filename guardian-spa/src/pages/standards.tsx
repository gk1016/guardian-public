import { Target, LifeBuoy, ScrollText, Lock, Siren } from "lucide-react";
import { PublicShell } from "@/components/public-shell";

const standards = [
  {
    icon: Target,
    title: "Positive Control",
    body: "Role assignments, dispatch changes, and operational decisions are explicit and tracked. If leadership has to guess what happened, the system failed — not the people.",
  },
  {
    icon: LifeBuoy,
    title: "Operational Discipline",
    body: "Every operation follows a structured workflow — planning, execution, review. Guardian enforces this through mission phases, participant rosters, and doctrine binding.",
  },
  {
    icon: Siren,
    title: "After-Action Review",
    body: "Lessons learned stay attached to the event that produced them. Incident review links directly to the missions and operations that generated it, with action items that carry forward.",
  },
  {
    icon: ScrollText,
    title: "Audit Trail",
    body: "Every mutation is logged with actor, action, target, and timestamp. The audit log is filterable, exportable, and permanent. If it happened in Guardian, there is a record.",
  },
  {
    icon: Lock,
    title: "Operational Security",
    body: "MFA-protected accounts, role-scoped permissions, session revocation, and password policy enforcement. Self-hosted with zero cloud dependency — your data stays on your iron.",
  },
];

export function StandardsPage() {
  return (
    <PublicShell
      eyebrow="Standards"
      title="Structure is the point. Looking tactical is not."
      description="Guardian bakes operational standards into the workflow so discipline and review survive contact with actual operations."
    >
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {standards.map((standard) => (
          <article
            key={standard.title}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5"
          >
            <standard.icon size={18} className="text-[var(--color-text-tertiary)]" />
            <h2 className="mt-3 font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
              {standard.title}
            </h2>
            <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
              {standard.body}
            </p>
          </article>
        ))}
      </section>
    </PublicShell>
  );
}
