import { UserCog, Bell, Cpu, LayoutDashboard, MessageSquare, Trash2, Users, ClipboardList } from "lucide-react";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { AdminUserCreateForm } from "@/components/admin-user-create-form";
import { AlertRuleManager } from "@/components/alert-rule-manager";
import { AiConfigManager } from "@/components/ai-config-manager";
import { DiscordConfigManager } from "@/components/discord-config-manager";
import { RecruitConfigManager } from "@/components/recruit-config-manager";
import { ApplicationManager } from "@/components/application-manager";
import { FactoryResetPanel } from "@/components/factory-reset-panel";
import { AdminDashboard } from "@/components/admin-dashboard";
import { useSession } from "@/lib/auth";
import { canManageAdministration } from "@/lib/roles";

export function AdminPage() {
  const session = useSession();
  const canManage = canManageAdministration(session.role);

  if (!canManage) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-amber-400/20 bg-amber-400/8 p-5 text-sm text-amber-200">
        Your role ({session.role}) does not have admin access.
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <CollapsiblePanel label="Dashboard" icon={<LayoutDashboard size={16} className="text-[var(--color-accent)]" />} defaultOpen>
        <AdminDashboard />
      </CollapsiblePanel>

      <CollapsiblePanel label="Guardian AI" icon={<Cpu size={16} className="text-[var(--color-accent)]" />}>
        <AiConfigManager />
      </CollapsiblePanel>

      <CollapsiblePanel label="Discord Bot" icon={<MessageSquare size={16} className="text-[var(--color-accent)]" />}>
        <DiscordConfigManager />
      </CollapsiblePanel>

      <CollapsiblePanel label="Recruitment Page" icon={<Users size={16} className="text-[var(--color-accent)]" />}>
        <RecruitConfigManager />
      </CollapsiblePanel>

      <CollapsiblePanel label="Applications" icon={<ClipboardList size={16} className="text-[var(--color-accent)]" />}>
        <ApplicationManager />
      </CollapsiblePanel>

      <CollapsiblePanel label="Alert Rules" icon={<Bell size={16} className="text-[var(--color-accent)]" />}>
        <AlertRuleManager />
      </CollapsiblePanel>

      <CollapsiblePanel label="Create Member" icon={<UserCog size={16} className="text-[var(--color-accent)]" />}>
        <AdminUserCreateForm />
      </CollapsiblePanel>

      <CollapsiblePanel label="Factory Reset" icon={<Trash2 size={16} className="text-red-400" />}>
        <FactoryResetPanel />
      </CollapsiblePanel>
    </div>
  );
}
