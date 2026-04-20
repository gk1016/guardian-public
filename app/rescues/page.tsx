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
      description="Rescue intake, assignment, status transitions, and dispatched assets now live as an actual workflow."
      orgName={data.orgName}
      session={session}
    >
      {data.error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {data.error}
        </div>
      ) : null}

      {canManage ? (
        <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
          <div className="flex items-center gap-3">
            <LifeBuoy size={18} className="text-emerald-300" />
            <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
              Open Rescue Intake
            </p>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Intake captures the survivor, threat, condition, and escort requirement before dispatch happens.
          </p>
          <div className="mt-6">
            <RescueCreateForm />
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        {data.items.map((item) => (
          <article id={item.id} key={item.id} className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
                  {item.survivorHandle}
                </p>
                <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-400">
                  {item.locationName ?? "Location pending"} / Requester {item.requesterDisplay}
                </p>
              </div>
              <div className="text-right">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                  {item.status}
                </span>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-amber-200">{item.urgency}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Threat</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {item.threatSummary ?? "Threat summary pending."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Condition</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {item.survivorCondition ?? "Condition not yet logged."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Operator / Outcome</p>
                <p className="mt-3 text-sm uppercase tracking-[0.16em] text-white">
                  {item.operatorDisplay}
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {item.outcomeSummary ?? "Outcome not yet filed."}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <ShieldAlert size={16} className="text-red-300" />
                <span>
                  {item.medicalRequired ? "Medical support required" : "Medical support not required"} /{" "}
                  {item.escortRequired ? "Escort required" : "Escort discretionary"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <HeartPulse size={16} className="text-emerald-300" />
                <span>
                  Offered payment: {item.offeredPayment ? `${item.offeredPayment.toLocaleString()} aUEC` : "none logged"}
                </span>
              </div>
            </div>

            <section className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Dispatched assets</p>
              <div className="mt-4 space-y-3">
                {item.dispatches.map((dispatch) => (
                  <div key={dispatch.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                        {dispatch.qrfCallsign}
                      </p>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-200">
                        {dispatch.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                      {dispatch.platform ?? "Platform pending"} / Tasked {dispatch.dispatchedAtLabel}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-300">
                      {dispatch.notes ?? "No dispatch notes logged."}
                    </p>
                  </div>
                ))}
                {item.dispatches.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                    No dispatched assets linked yet.
                  </div>
                ) : null}
              </div>
            </section>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Rescue notes</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {item.rescueNotes ?? "No rescue notes logged."}
              </p>
            </div>

            {canManage ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Update rescue</p>
                <div className="mt-4">
                  <RescueUpdateForm
                    rescueId={item.id}
                    operatorOptions={data.operatorOptions}
                    initialRescue={{
                      status: item.status,
                      operatorId: item.operatorId,
                      survivorCondition: item.survivorCondition,
                      rescueNotes: item.rescueNotes,
                      outcomeSummary: item.outcomeSummary,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </OpsShell>
  );
}
