import { requireSession } from "@/lib/auth";
import { getRosterPageData } from "@/lib/guardian-data";
import { OpsShell } from "@/components/ops-shell";
import { RosterGrid } from "@/components/roster-grid";
import { canManageAdministration } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function RosterPage() {
  const session = await requireSession("/roster");
  const data = await getRosterPageData(session.userId);
  const isAdmin = canManageAdministration(session.role);

  return (
    <OpsShell
      currentPath="/roster"
      section="Roster"
      title="Crew Availability"
      orgName={data.orgName}
      session={session}
    >
      {data.error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">{data.error}</div>
      ) : null}

      <RosterGrid items={data.items} isAdmin={isAdmin} />
    </OpsShell>
  );
}
