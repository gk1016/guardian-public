import { Target, LifeBuoy, ScrollText, Lock, Siren } from "lucide-react";
import { PublicShell } from "@/components/public-shell";

const standards = [
  {
    icon: Target,
    title: "Positive Control",
    body: "Package geometry, role ownership, and dispatch changes are explicit. If command has to guess, command is already behind. Guardian enforces this through structured mission phases, callsign assignment, and doctrine binding.",
  },
  {
    icon: LifeBuoy,
    title: "Rescue Discipline",
    body: "Distress traffic is not trusted blindly. Rescue launches are reviewed against the current threat picture before assets are committed. CSAR workflow enforces triage, escort coordination, and status tracking.",
  },
  {
    icon: Siren,
    title: "After-Action Honesty",
    body: "Lessons learned stay attached to the event that produced them, not buried in chat. Incident review links directly to the missions and rescues that generated it, with action items that carry forward.",
  },
  {
    icon: ScrollText,
    title: "Audit Trail",
    body: "Every mutation is logged with actor, action, target, and timestamp. The audit log is filterable, exportable, and permanent. If it happened in Guardian, there is a record of who did what and when.",
  },
  {
    icon: Lock,
    title: "Operational Security",
    body: "MFA-protected accounts, role-scoped permissions, session revocation, and password policy enforcement. The platform is designed to self-host with zero cloud dependency — your data stays on your iron.",
  },
];

export default function StandardsPage() {
  return (
    <PublicShell
      eyebrow="Standards"
      title="The point is not looking tactical. The point is being disciplined."
      description="Guardian bakes standards into the workflow so doctrine and review survive contact with actual operations."
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
