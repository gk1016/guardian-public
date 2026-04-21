import { requireSession } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { SitrepFeed } from "@/components/sitrep-feed";
import { getSitrepData } from "@/lib/sitrep-data";

export const dynamic = "force-dynamic";

export default async function SitrepPage() {
  const session = await requireSession("/sitrep");
  const data = await getSitrepData(session.userId);

  return (
    <OpsShell
      currentPath="/sitrep"
      section="Review"
      title="SITREP"
      orgName={data.orgName}
      session={session}
    >
      {data.error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
          {data.error}
        </div>
      ) : null}

      <SitrepFeed initialEvents={data.events} />
    </OpsShell>
  );
}
