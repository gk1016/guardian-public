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
      description="Commander-only mission launch path for rapid tasking and immediate board population."
      orgName={orgName}
      session={session}
    >
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
        <div className="text-sm text-slate-300">
          Mission creation now writes straight to Postgres through the authenticated API surface.
        </div>
        <Link
          href="/missions"
          className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
        >
          <ArrowLeft size={14} />
          Back to board
        </Link>
      </div>

      {canCreateMission ? (
        <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
          <MissionCreateForm />
        </section>
      ) : (
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-100">
          <div className="flex items-center gap-3">
            <Lock size={18} />
            <p className="font-semibold uppercase tracking-[0.18em]">
              Mission creation requires command authority
            </p>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-red-50">
            Your current role is <span className="font-semibold uppercase">{session.role}</span>. Pilot-grade
            access can read mission boards, but mission launch authority is restricted to commander,
            director, or admin roles.
          </p>
        </section>
      )}
    </OpsShell>
  );
}
