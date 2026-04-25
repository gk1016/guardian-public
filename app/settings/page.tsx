import { requireSession } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { OpsShell } from "@/components/ops-shell";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession("/settings");
  const org = await getOrgForUser(session.userId);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      handle: true,
      displayName: true,
      role: true,
      status: true,
      totpEnabled: true,
      createdAt: true,
    },
  });

  const orgName = org?.name ?? "Guardian";

  return (
    <OpsShell
      currentPath="/settings"
      section="Org"
      title="Settings"
      orgName={orgName}
      session={session}
    >
      {user ? (
        <ProfileSettingsForm
          profile={{
            handle: user.handle,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            status: user.status,
            totpEnabled: user.totpEnabled,
            memberSince: user.createdAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
          }}
        />
      ) : (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-xs text-red-200">
          Failed to load profile data.
        </div>
      )}
    </OpsShell>
  );
}
