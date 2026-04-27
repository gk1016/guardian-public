import { Link } from "react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { useSession } from "@/lib/auth";
import { canManageMissions } from "@/lib/roles";
import { MissionCreateForm } from "@/components/mission-create-form";

export function MissionsNewPage() {
  const session = useSession();
  const canCreateMission = canManageMissions(session.role);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-4 py-2.5">
        <span className="text-sm text-[var(--color-text-secondary)]">New sortie creation</span>
        <Link
          to="/missions"
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-overlay-subtle)] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-strong)] transition hover:bg-[var(--color-overlay-medium)]"
        >
          <ArrowLeft size={13} />Board
        </Link>
      </div>

      {canCreateMission ? (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <MissionCreateForm />
        </section>
      ) : (
        <section className="rounded-[var(--radius-lg)] border border-red-500/20 bg-red-500/8 p-5 text-red-200">
          <div className="flex items-center gap-2">
            <Lock size={15} />
            <p className="text-xs font-medium uppercase tracking-[0.1em]">Command authority required</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-red-300">Your role ({session.role}) cannot create missions.</p>
        </section>
      )}
    </div>
  );
}
