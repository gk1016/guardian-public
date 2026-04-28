import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { Rocket, ShieldAlert, Radio } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { canManageOperations } from "@/lib/roles";
import { QrfCreateForm } from "@/components/qrf-create-form";
import { QrfStatusForm } from "@/components/qrf-status-form";
import { QrfDispatchForm } from "@/components/qrf-dispatch-form";
import { QrfDispatchStatusForm } from "@/components/qrf-dispatch-status-form";

interface QrfDispatch {
  id: string;
  status: string;
  targetLabel: string;
  targetHref: string | null;
  notes: string | null;
  dispatchedAtLabel: string;
  arrivedAtLabel: string | null;
  rtbAtLabel: string | null;
}

interface QrfItem {
  id: string;
  callsign: string;
  status: string;
  platform: string | null;
  locationName: string | null;
  availableCrew: number;
  notes: string | null;
  dispatches: QrfDispatch[];
  channelId: string | null;
}

interface SelectOption { id: string; label: string; detail?: string | null }

interface QrfView {
  items: QrfItem[];
  missionOptions: SelectOption[];
  rescueOptions: SelectOption[];
  error?: string;
}

export function QrfPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const canManage = canManageOperations(session.role);

  const { data, isLoading } = useQuery<QrfView>({
    queryKey: ["views", "qrf"],
    queryFn: () => api("/api/views/qrf"),
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["views", "qrf"] });

  if (isLoading) {
    return <p className="py-8 text-center text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">Loading QRF data...</p>;
  }

  return (
    <>
      {data?.error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {data.error}
        </div>
      ) : null}

      {canManage ? (
        <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
          <div className="flex items-center gap-3">
            <Rocket size={18} className="text-cyan-300" />
            <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
              Add QRF Asset
            </p>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            This creates a real readiness entry that can be tasked against sorties or rescue calls.
          </p>
          <div className="mt-6">
            <QrfCreateForm onSuccess={refetch} />
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        {(data?.items ?? []).map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-[family:var(--font-display)] text-3xl uppercase tracking-[0.14em] text-white">
                  {item.callsign}
                </p>
                <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-400">
                  {item.platform ?? "Platform pending"} / {item.locationName ?? "Location pending"}
                </p>
              </div>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                {item.status}
              </span>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              Crew {item.availableCrew} / {item.notes ?? "No readiness notes logged."}
            </p>

            {/* Comms channel link — only deviation from original */}
            {item.channelId ? (
              <Link to={`/comms?channel=${item.channelId}`} className="mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-cyan-300 transition hover:text-cyan-100">
                <Radio size={13} />
                Open comms channel
              </Link>
            ) : null}

            {canManage ? (
              <div className="mt-6 grid gap-6">
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Update posture</p>
                  <div className="mt-4">
                    <QrfStatusForm
                      qrfId={item.id}
                      initialAsset={{
                        status: item.status,
                        platform: item.platform,
                        locationName: item.locationName,
                        availableCrew: item.availableCrew,
                        notes: item.notes,
                      }}
                      onSuccess={refetch}
                    />
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Dispatch asset</p>
                  <div className="mt-4">
                    <QrfDispatchForm
                      qrfId={item.id}
                      missionOptions={data?.missionOptions ?? []}
                      rescueOptions={data?.rescueOptions ?? []}
                      onSuccess={refetch}
                    />
                  </div>
                </section>
              </div>
            ) : null}

            <section className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center gap-3">
                <ShieldAlert size={16} className="text-amber-300" />
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Dispatch history</p>
              </div>
              <div className="mt-4 space-y-4">
                {item.dispatches.map((dispatch) => (
                  <div key={dispatch.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {dispatch.targetHref ? (
                        <Link to={dispatch.targetHref} className="text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:text-cyan-100">
                          {dispatch.targetLabel}
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                          {dispatch.targetLabel}
                        </p>
                      )}
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-200">
                        {dispatch.status}
                      </span>
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                      Tasked {dispatch.dispatchedAtLabel}
                      {dispatch.arrivedAtLabel ? ` / Arrived ${dispatch.arrivedAtLabel}` : ""}
                      {dispatch.rtbAtLabel ? ` / RTB ${dispatch.rtbAtLabel}` : ""}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {dispatch.notes ?? "No dispatch notes logged."}
                    </p>
                    {canManage ? (
                      <div className="mt-4">
                        <QrfDispatchStatusForm
                          dispatchId={dispatch.id}
                          initialStatus={dispatch.status}
                          onSuccess={refetch}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}

                {item.dispatches.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                    No dispatches logged for this asset yet.
                  </div>
                ) : null}
              </div>
            </section>
          </article>
        ))}
      </section>
    </>
  );
}
