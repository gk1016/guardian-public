import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartPulse, LifeBuoy, Radio, ShieldAlert } from "lucide-react";
import { Link } from "react-router";
import { useSession } from "@/lib/auth";
import { canManageOperations } from "@/lib/roles";
import { api } from "@/lib/api";
import { RescueCreateForm } from "@/components/rescue-create-form";
import { RescueUpdateForm } from "@/components/rescue-update-form";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RescueDispatch {
  id: string;
  qrfCallsign: string;
  status: string;
  platform: string | null;
  dispatchedAtLabel: string;
  notes: string | null;
}

interface SelectOption {
  id: string;
  label: string;
  detail?: string | null;
}

interface RescueItem {
  id: string;
  survivorHandle: string;
  locationName: string | null;
  status: string;
  urgency: string;
  threatSummary: string | null;
  rescueNotes: string | null;
  survivorCondition: string | null;
  outcomeSummary: string | null;
  escortRequired: boolean;
  medicalRequired: boolean;
  offeredPayment: number | null;
  requesterDisplay: string;
  operatorId: string;
  operatorDisplay: string;
  channelId: string | null;
  dispatches: RescueDispatch[];
}

interface RescueView {
  orgName: string;
  operatorOptions: SelectOption[];
  items: RescueItem[];
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function RescuesPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const canManage = canManageOperations(session.role);

  const { data, isLoading, error } = useQuery<RescueView>({
    queryKey: ["views", "rescues"],
    queryFn: () => api.get<RescueView>("/api/views/rescues"),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["views", "rescues"] });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
        {error.message}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
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
            <RescueCreateForm onSuccess={invalidate} />
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

            {/* Comms channel link — only deviation from original */}
            {item.channelId ? (
              <Link to={`/comms?channel=${item.channelId}`} className="mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-cyan-300 transition hover:text-cyan-100">
                <Radio size={13} />
                Open comms channel
              </Link>
            ) : null}

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
                    onSuccess={invalidate}
                  />
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
