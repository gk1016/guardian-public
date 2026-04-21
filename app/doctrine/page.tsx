import { BookCheck, Lock } from "lucide-react";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { DoctrineCreateForm } from "@/components/doctrine-create-form";
import { OpsShell } from "@/components/ops-shell";
import { requireSession } from "@/lib/auth";
import { getDoctrinePageData } from "@/lib/guardian-data";
import { canManageMissions } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function DoctrinePage() {
  const session = await requireSession("/doctrine");
  const data = await getDoctrinePageData(session.userId);
  const canManageDoctrine = canManageMissions(session.role);

  return (
    <OpsShell
      currentPath="/doctrine"
      section="Doctrine"
      title="ROE and Doctrine"
      orgName={data.orgName}
      session={session}
    >
      {data.error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">{data.error}</div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-4">
          {data.items.map((item) => (
            <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.08em] text-white">{item.title}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-slate-500">{item.code} / {item.category}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {item.isDefault ? <span className="rounded-[var(--radius-sm)] border border-emerald-400/20 bg-emerald-400/8 px-2 py-0.5 text-[10px] uppercase text-emerald-200">Default</span> : null}
                  <span className="rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/8 px-2 py-0.5 text-[10px] uppercase text-cyan-200">{item.missionCount} linked</span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{item.summary}</p>
              <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Execution Checklist</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
              </div>
              <div className="mt-3 rounded-[var(--radius-md)] border border-amber-400/20 bg-amber-400/8 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.1em] text-amber-200">Escalation</p>
                <p className="mt-2 text-sm leading-6 text-amber-100/80">{item.escalation ?? "No escalation guidance."}</p>
              </div>
            </article>
          ))}
          {data.items.length === 0 ? <p className="text-sm text-slate-500">No doctrine templates loaded.</p> : null}
        </div>

        <div className="flex flex-col gap-4">
          {canManageDoctrine ? (
            <CollapsiblePanel label="Create Doctrine" icon={<BookCheck size={16} className="text-amber-300" />}>
              <DoctrineCreateForm />
            </CollapsiblePanel>
          ) : (
            <section className="rounded-[var(--radius-lg)] border border-amber-400/20 bg-amber-400/8 p-5 text-amber-100">
              <div className="flex items-center gap-2">
                <Lock size={16} />
                <p className="text-xs font-medium uppercase tracking-[0.1em]">Read-only access</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-amber-200/70">Your role ({session.role}) can read doctrine but not create or attach.</p>
            </section>
          )}
        </div>
      </section>
    </OpsShell>
  );
}
