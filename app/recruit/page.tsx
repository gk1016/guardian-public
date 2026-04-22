import Link from "next/link";
import { PublicShell } from "@/components/public-shell";

const traits = [
  "Pilots who can execute a brief instead of improvising chaos",
  "Rescue crews who treat survivor recovery like a mission, not content",
  "Operators who can hold comm discipline under pressure",
  "People who can learn from review without ego getting in the way",
];

export default function RecruitPage() {
  return (
    <PublicShell
      eyebrow="Recruitment"
      title="Looking for disciplined pilots, rescue crews, and watch-floor minds."
      description="Guardian Flight is built around anti-piracy, escort, and rescue work. The expectation is professional conduct, direct communication, and actual follow-through."
    >
      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="grid gap-4">
          {traits.map((trait) => (
            <div key={trait} className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/60 px-5 py-4 text-sm leading-8 text-slate-200">
              {trait}
            </div>
          ))}
        </div>
        <article className="rounded-3xl border border-[var(--color-border-bright)] bg-[var(--color-input-bg)] p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Fit Check</p>
          <p className="mt-4 text-base leading-8 text-slate-300">
            If you want noise, ego, or vague “vibes,” this is the wrong org. If you want structure,
            mission ownership, and a serious crew around you, this is the lane.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-md border border-amber-300/30 bg-amber-300 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-amber-200"
          >
            Request Access
          </Link>
        </article>
      </section>
    </PublicShell>
  );
}
