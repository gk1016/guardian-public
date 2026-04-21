import { HeartPulse, LifeBuoy, ShieldAlert } from "lucide-react";
import { RescueCreateForm } from "@/components/rescue-create-form";
import { RescueUpdateForm } from "@/components/rescue-update-form";
import { requireSession } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { getRescueWorkflowData } from "@/lib/ops-data";
import { canManageOperations } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function RescuesPage() {
  const session = await requireSession("/rescues");
  const data = await getRescueWorkflowData(session.userId);
  const canManage = canManageOperations(session.role);

  return (
    <OpsShell
      currentPath="/rescues"
      section="Rescue"
      title="CSAR Workflow"
      orgName={data.orgName}
      session={session}
    >
      {data.error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">{data.error}</div>
      ) : null}

      {canManage ? (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <div className="flex items-center gap-2">
            <LifeBuoy size={16} className="text-emerald-300" />
            <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.1em] text-white">Open Rescue Intake</p>
          </div>
          <div className="mt-4"><RescueCreateForm /></div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        {data.items.map((item) => (
          <article id={item.id} key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.08em] text-white">{item.survivorHandle}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-slate-500">{item.locationName ?? "Location pending"} / {item.requesterDisplay}</p>
              </div>
              <div className="text-right">
                <span className="rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/8 px-2 py-0.5 text-[10px] uppercase text-cyan-200">{item.status}</span>
                <p className="mt-1 text-[10px] uppercase text-amber-200">{item.urgency}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Threat</p>
                <p className="mt-1.5 text-sm leading-6 text-slate-400">{item.threatSummary ?? "Pending."}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Condition</p>
                <p className="mt-1.5 text-sm leading-6 text-slate-400">{item.survivorCondition ?? "Not logged."}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Operator / Outcome</p>
                <p className="mt-1.5 text-xs font-medium uppercase tracking-[0.08em] text-white">{item.operatorDisplay}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{item.outcomeSummary ?? "Not filed."}</p>
              </div>
            </div>

            <div className="mt-3 grid gap-1.5 text-[11px] text-slate-400">
              <div className="flex items-center gap-2"><ShieldAlert size={13} className="text-red-300" />{item.medicalRequired ? "Medical required" : "No medical"} / {item.escortRequired ? "Escort required" : "Escort discretionary"}</div>
              <div className="flex items-center gap-2"><HeartPulse size={13} className="text-emerald-300" />Payment: {item.offeredPayment ? `${item.offeredPayment.toLocaleString()} aUEC` : "none"}</div>
            </div>

            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-black/15 p-4">
              <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Dispatched assets</p>
              <div className="mt-2 space-y-2">
                {item.dispatches.map((d) => (
                  <div key={d.id} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/3 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase text-white">{d.qrfCallsign}</p>
                      <span className="text-[10px] uppercase text-slate-500">{d.status}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">{d.platform ?? "Platform pending"} / Tasked {d.dispatchedAtLabel}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{d.notes ?? "No notes."}</p>
                  </div>
                ))}
                {item.dispatches.length === 0 ? <p className="text-[11px] text-slate-500">No assets dispatched.</p> : null}
              </div>
            </div>

            <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Notes</p>
              <p className="mt-1.5 text-sm leading-6 text-slate-400">{item.rescueNotes ?? "None."}</p>
            </div>

            {canManage ? (
              <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-black/15 p-4">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Update rescue</p>
                <div className="mt-3"><RescueUpdateForm rescueId={item.id} operatorOptions={data.operatorOptions} initialRescue={{ status: item.status, operatorId: item.operatorId, survivorCondition: item.survivorCondition, rescueNotes: item.rescueNotes, outcomeSummary: item.outcomeSummary }} /></div>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </OpsShell>
  );
}
