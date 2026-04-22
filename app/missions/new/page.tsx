import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { OpsShell } from "@/components/ops-shell";
import { MissionCreateForm } from "@/components/mission-create-form";
import { requireSession } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { canManageMissions } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function NewMissionPage() {
  const session = await requireSession("/missions/new");
  const org = await getOrgForUser(session.userId);
  const orgName = org?.name ?? "Guardian";
  const canCreateMission = canManageMissions(session.role);

  return (
    <OpsShell
      currentPath="/missions"
      section="Missions"
      title="Create Mission"
      orgName={orgName}
      session={session}
    >
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-4 py-2.5">
        <span className="text-sm text-[var(--color-text-secondary)]">New sortie creation</span>
        <Link
          href="/missions"
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
    </OpsShell>
  );
}
