import { requireSession } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { FleetDashboard } from "@/components/fleet-dashboard";
import { getOrgForUser } from "@/lib/guardian-data";

export const dynamic = "force-dynamic";

export default async function FleetPage() {
  const session = await requireSession("/fleet");
  const org = await getOrgForUser(session.userId);

  return (
    <OpsShell
      currentPath="/fleet"
      section="Org"
      title="Fleet Readiness"
      orgName={org?.name ?? "Unknown"}
      session={session}
    >
      <FleetDashboard isAdmin={session.role === "commander" || session.role === "director"} />
    </OpsShell>
  );
}
