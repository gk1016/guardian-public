import { Bell } from "lucide-react";
import { useSession } from "@/lib/auth";
import { canManageOperations } from "@/lib/roles";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { NotificationCreateForm } from "@/components/notification-create-form";
import { NotificationCenter } from "@/components/notification-center";

export function NotificationsPage() {
  const session = useSession();
  const canCreate = canManageOperations(session.role);

  return (
    <>
      {canCreate ? (
        <CollapsiblePanel label="Send Alert" icon={<Bell size={16} className="text-[var(--color-accent)]" />}>
          <NotificationCreateForm />
        </CollapsiblePanel>
      ) : null}
      <NotificationCenter canCreate={canCreate} />
    </>
  );
}
