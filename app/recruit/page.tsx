import Link from "next/link";
import { Users, Crosshair, Radio, BookOpen } from "lucide-react";
import { PublicShell } from "@/components/public-shell";

const traits = [
  {
    icon: Crosshair,
    title: "Mission Pilots",
    body: "Pilots who can execute a brief instead of improvising chaos. You fly the package, hold the geometry, and stick to the ROE.",
  },
  {
    icon: Users,
    title: "Rescue Crews",
    body: "Operators who treat survivor recovery like a mission, not content. CSAR is disciplined work — triage, escort, extraction, debrief.",
  },
  {
    icon: Radio,
    title: "Comm Discipline",
    body: "People who can hold comm discipline under pressure. Clear, concise, on-frequency. If you need to narrate your gameplay, wrong org.",
  },
  {
    icon: BookOpen,
    title: "Review Mindset",
    body: "Operators who can learn from after-action review without ego getting in the way. The debrief is where you get better.",
  },
];

export default function RecruitPage() {
  return (
    <PublicShell
      eyebrow="Recruitment"
      title="Looking for disciplined pilots, rescue crews, and watch-floor minds."
      description="Guardian Flight is built around anti-piracy, escort, and rescue work. The expectation is professional conduct, direct communication, and actual follow-through."
    >
      <section className="grid gap-4 sm:grid-cols-2">
        {traits.map((trait) => (
          <article
            key={trait.title}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5"
          >
            <trait.icon size={18} className="text-[var(--color-text-tertiary)]" />
            <h3 className="mt-3 font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
              {trait.title}
            </h3>
            <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
              {trait.body}
            </p>
          </article>
        ))}
      </section>

      <div className="mt-10 rounded-[var(--radius-lg)] border border-amber-300/15 bg-amber-300/5 p-6">
        <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
          Fit Check
        </h2>
        <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
          If you want noise, ego, or vague \u201cvibes,\u201d this is the wrong org. If you want structure,
          mission ownership, and a serious crew around you, this is the lane.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex items-center rounded-[var(--radius-md)] border border-amber-300/25 bg-amber-300/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200 transition hover:border-amber-300/40 hover:bg-amber-300/15 hover:text-amber-100"
        >
          Request Access
        </Link>
      </div>
    </PublicShell>
  );
}
