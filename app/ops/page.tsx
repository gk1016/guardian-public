import { PublicShell } from "@/components/public-shell";

const workflows = [
  "Mission planning with doctrine, package discipline, and sortie revision control",
  "QRF posture with dispatch tasking, route-to-target tracking, and return-to-base status",
  "CSAR intake with threat review, assignment, survivor condition, and outcome logging",
  "Incident review with lessons learned, action items, and public-summary control",
];

export default function OpsPage() {
  return (
    <PublicShell
      eyebrow="Operational Workflows"
      title="Planning, dispatch, and review are treated as one loop."
      description="Guardian is being shaped around how a military-flavored flight org actually runs operations: brief, launch, adapt, recover, and review."
    >
      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/60 p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Command Intent</p>
          <p className="mt-4 text-base leading-8 text-slate-300">
            The public side stays clean and modern. The protected side is meant to feel like a
            briefing room, kneeboard, and watch floor instead of another generic gamer app.
          </p>
        </article>
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <div key={workflow} className="rounded-2xl border border-[var(--color-border-bright)] bg-[var(--color-input-bg)] px-5 py-4 text-sm leading-8 text-slate-200">
              {workflow}
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
