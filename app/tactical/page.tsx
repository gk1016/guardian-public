import { requireSession } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { getOrgForUser } from "@/lib/guardian-data";
import { TacticalBoard } from "@/components/tactical-board";

export const dynamic = "force-dynamic";

export default async function TacticalPage() {
  const session = await requireSession("/tactical");
  const org = await getOrgForUser(session.userId);
  const orgName = org?.name ?? "Guardian";

  return (
    <OpsShell
      currentPath="/tactical"
      section="Command"
      title="Tactical Overview"
      orgName={orgName}
      session={session}
    >
      <TacticalBoard />
    </OpsShell>
  );
}
