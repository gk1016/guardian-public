import { Shield, UserCog } from "lucide-react";
import { AdminMemberUpdateForm } from "@/components/admin-member-update-form";
import { AdminUserCreateForm } from "@/components/admin-user-create-form";
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
      <OpsShell
        currentPath="/admin"
        section="Admin"
        title="Administration Restricted"
        description="Role and access management is reserved for command authority."
        orgName="Guardian"
        session={session}
      >
        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-8 text-amber-50">
          Your current role is `{session.role}`. That is enough to operate, not enough to manage org access.
        </section>
      </OpsShell>
    );
  }

  const data = await getAdminPageData(session.userId);

  return (
    <OpsShell
      currentPath="/admin"
      section="Admin"
      title="Org Administration"
      description="User access, role control, member status, and credential resets now live inside the protected shell."
      orgName={data.orgName}
      session={session}
    >
      {data.error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {data.error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
        <div className="flex items-center gap-3">
          <UserCog size={18} className="text-amber-300" />
          <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
            Create Member
          </p>
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          This creates the user, sets the initial password, and attaches them to the current organization in one move.
        </p>
        <div className="mt-6">
          <AdminUserCreateForm />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {data.items.map((member) => (
          <article key={member.membershipId} className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-[family:var(--font-display)] text-3xl uppercase tracking-[0.14em] text-white">
                  {member.displayName ?? member.handle}
                </p>
                <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-400">
                  {member.handle} / {member.email}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                  {member.role}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-200">
                  {member.status}
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Rank / Title</p>
                <p className="mt-3 text-sm uppercase tracking-[0.16em] text-white">
                  {member.rank} / {member.title ?? "No title"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Joined</p>
                <p className="mt-3 text-sm uppercase tracking-[0.16em] text-white">
                  {member.joinedAtLabel}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center gap-3">
                <Shield size={16} className="text-cyan-300" />
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Access control</p>
              </div>
              <div className="mt-4">
                <AdminMemberUpdateForm
                  userId={member.userId}
                  initialMember={{
                    displayName: member.displayName,
                    role: member.role,
                    status: member.status,
                    rank: member.rank,
                    title: member.title,
                  }}
                />
              </div>
            </div>
          </article>
        ))}
      </section>
    </OpsShell>
  );
}
