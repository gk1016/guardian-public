import { requireSession } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { getOrgForUser } from "@/lib/guardian-data";
import { AiCommandPanel } from "@/components/ai-command-panel";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  const session = await requireSession("/ai");
  const org = await getOrgForUser(session.userId);
  const orgName = org?.name ?? "Guardian";

  return (
    <OpsShell
      currentPath="/ai"
      section="Command"
      title="AI"
      session={session}
      orgName={orgName}
    >
      <div className="flex h-[calc(100vh-10rem)] flex-col">
        <AiCommandPanel />
      </div>
    </OpsShell>
  );
}
