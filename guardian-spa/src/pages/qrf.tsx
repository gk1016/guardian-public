import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { ChevronDown, ChevronUp, Rocket, ShieldAlert, Radio } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { canManageOperations } from "@/lib/roles";
import { CollapsibleCard } from "@/components/collapsible-card";
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery<QrfView>({
    queryKey: ["views", "qrf"],
    queryFn: () => api("/api/views/qrf"),
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["views", "qrf"] });

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isLoading) {
    return <p className="py-8 text-center text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">Loading QRF data...</p>;
  }

  return (
    <>
      {data?.error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {data.error}
        </div>
      ) : null}

      {canManage ? (
        <section className={`rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] panel-elevated transition-all ${createOpen ? "p-6" : "px-5 py-3"}`}>
          <button
            type="button"
            onClick={() => setCreateOpen(!createOpen)}
            className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-3">
              <Rocket size={16} className="text-[var(--color-cyan)]" />
              <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.16em] text-[var(--color-text-strong)]">
                Add QRF Asset
              </p>
            </div>
            {createOpen ? (
              <ChevronUp size={14} className="text-[var(--color-text-faint)]" />
            ) : (
              <ChevronDown size={14} className="text-[var(--color-text-faint)]" />
            )}
          </button>
          {createOpen ? (
            <div className="mt-4">
              <p className="mb-4 text-xs leading-6 text-[var(--color-text-secondary)]">
                This creates a real readiness entry that can be tasked against sorties or rescue calls.
              </p>
              <QrfCreateForm onSuccess={refetch} />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-2">
        {(data?.items ?? []).map((item) => (
          <CollapsibleCard
            key={item.id}
            expanded={expanded.has(item.id)}
            onToggle={() => toggle(item.id)}
            header={(isOpen) => (
              <div className="flex items-center gap-3">
                <p className={`font-[family:var(--font-display)] uppercase tracking-[0.12em] text-[var(--color-text-strong)] ${
                  isOpen ? "text-2xl" : "text-sm"
                }`}>
                  {item.callsign}
                </p>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-cyan-300">
                  {item.status}
                </span>
                {!isOpen ? (
                  <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    {item.platform ?? "Platform pending"} / {item.locationName ?? "Location pending"}
                  </span>
                ) : null}
              </div>
            )}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
              {item.platform ?? "Platform pending"} / {item.locationName ?? "Location pending"}
            </p>
            <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
              Crew {item.availableCrew} / {item.notes ?? "No readiness notes logged."}
            </p>

            {item.channelId ? (
              <Link to={`/comms?channel=${item.channelId}`} className="mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[var(--color-cyan)] transition hover:brightness-125">
                <Radio size={13} />
                Open comms channel
              </Link>
            ) : null}

            {canManage ? (
              <div className="mt-5 grid gap-5">
                <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Update posture</p>
                  <div className="mt-3">
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

                <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Dispatch asset</p>
                  <div className="mt-3">
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

            <section className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-medium)] p-4">
              <div className="flex items-center gap-2">
                <ShieldAlert size={14} className="text-amber-300" />
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Dispatch history</p>
              </div>
              <div className="mt-3 space-y-3">
                {item.dispatches.map((dispatch) => (
                  <div key={dispatch.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {dispatch.targetHref ? (
                        <Link to={dispatch.targetHref} className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-strong)] transition hover:text-[var(--color-cyan)]">
                          {dispatch.targetLabel}
                        </Link>
                      ) : (
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-strong)]">
                          {dispatch.targetLabel}
                        </p>
                      )}
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                        {dispatch.status}
                      </span>
                    </div>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Tasked {dispatch.dispatchedAtLabel}
                      {dispatch.arrivedAtLabel ? ` / Arrived ${dispatch.arrivedAtLabel}` : ""}
                      {dispatch.rtbAtLabel ? ` / RTB ${dispatch.rtbAtLabel}` : ""}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-[var(--color-text-secondary)]">
                      {dispatch.notes ?? "No dispatch notes logged."}
                    </p>
                    {canManage ? (
                      <div className="mt-3">
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
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-3 text-xs text-[var(--color-text-secondary)]">
                    No dispatches logged for this asset yet.
                  </div>
                ) : null}
              </div>
            </section>
          </CollapsibleCard>
        ))}
      </section>
    </>
  );
}
