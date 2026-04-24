import { PublicShell } from "@/components/public-shell";
import { Users } from "lucide-react";

export default function RecruitPage() {
  return (
    <PublicShell
      eyebrow="Recruitment"
      title="Join the crew."
      description="This org uses Guardian to run operations. If you're interested in joining, submit an application below."
    >
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
        <div className="flex items-center gap-3">
          <Users size={18} className="text-[var(--color-text-tertiary)]" />
          <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
            Applications
          </h2>
        </div>
        <p className="mt-3 max-w-xl text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
          The recruitment page for this org has not been configured yet.
          Check back later, or contact the org directly if you have another way to reach them.
        </p>
      </div>
    </PublicShell>
  );
}
