import { requireSession } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { getOrgForUser } from "@/lib/guardian-data";
import { FederationPanel } from "@/components/federation-panel";

export const dynamic = "force-dynamic";

export default async function FederationPage() {
  const session = await requireSession("/federation");
  const org = await getOrgForUser(session.userId);
  const orgName = org?.name ?? "Guardian";

  return (
    <OpsShell
      currentPath="/federation"
      section="Command"
      title="Federation"
      orgName={orgName}
      session={session}
    >
      <FederationPanel session={session} />
    </OpsShell>
  );
}
