import { Shield, UserCog, Bell, Cpu } from "lucide-react";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { AdminMemberUpdateForm } from "@/components/admin-member-update-form";
import { AdminUserCreateForm } from "@/components/admin-user-create-form";
import { AlertRuleManager } from "@/components/alert-rule-manager";
import { AiConfigManager } from "@/components/ai-config-manager";
import { OpsShell } from "@/components/ops-shell";
import { requireSession } from "@/lib/auth";
import { getAdminPageData } from "@/lib/ops-data";
import { canManageAdministration } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireSession("/admin");
  const canManage = canManageAdministration(session.role);

  if (!canManage) {
    return (
      <OpsShell currentPath="/admin" section="Admin" title="Restricted" orgName="Guardian" session={session}>
        <section className="rounded-[var(--radius-lg)] border border-amber-400/20 bg-amber-400/8 p-5 text-sm text-amber-200">
          Your role ({session.role}) does not have admin access.
        </section>
      </OpsShell>
    );
  }

  const data = await getAdminPageData(session.userId);

  return (
    <OpsShell currentPath="/admin" section="Admin" title="Org Administration" orgName={data.orgName} session={session}>
      {data.error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">{data.error}</div>
      ) : null}

      <CollapsiblePanel label="Guardian AI" icon={<Cpu size={16} className="text-[var(--color-accent)]" />} defaultOpen>
        <AiConfigManager />
      </CollapsiblePanel>

      <CollapsiblePanel label="Alert Rules" icon={<Bell size={16} className="text-[var(--color-accent)]" />}>
        <AlertRuleManager />
      </CollapsiblePanel>

      <CollapsiblePanel label="Create Member" icon={<UserCog size={16} className="text-[var(--color-accent)]" />}>
        <AdminUserCreateForm />
      </CollapsiblePanel>

      <section className="grid gap-4 xl:grid-cols-2">
        {data.items.map((member) => (
          <article key={member.membershipId} className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.08em] text-[var(--color-text-strong)]">{member.displayName ?? member.handle}</p>
                <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">{member.handle} / {member.email}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/8 px-2 py-0.5 text-[10px] uppercase text-cyan-200">{member.role}</span>
                <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] uppercase text-[var(--color-text-secondary)]">{member.status}</span>
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-[11px] md:grid-cols-2">
              <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/3 px-3 py-2">
                <span className="text-[var(--color-text-tertiary)]">Rank/Title:</span> <span className="text-[var(--color-text-strong)]">{member.rank} / {member.title ?? "None"}</span>
              </div>
              <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/3 px-3 py-2">
                <span className="text-[var(--color-text-tertiary)]">Joined:</span> <span className="text-[var(--color-text-strong)]">{member.joinedAtLabel}</span>
              </div>
            </div>
            <div className="mt-4">
              <CollapsiblePanel label="Access control" variant="inline" icon={<Shield size={13} className="text-cyan-300" />}>
                <AdminMemberUpdateForm userId={member.userId} initialMember={{ displayName: member.displayName, role: member.role, status: member.status, rank: member.rank, title: member.title }} />
              </CollapsiblePanel>
            </div>
          </article>
        ))}
      </section>
    </OpsShell>
  );
}
