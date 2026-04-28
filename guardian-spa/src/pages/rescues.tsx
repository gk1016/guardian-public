import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, HeartPulse, LifeBuoy, Radio, ShieldAlert } from "lucide-react";
import { Link } from "react-router";
import { useSession } from "@/lib/auth";
import { canManageOperations } from "@/lib/roles";
import { api } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, error } = useQuery<RescueView>({
    queryKey: ["views", "rescues"],
    queryFn: () => api.get<RescueView>("/api/views/rescues"),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["views", "rescues"] });
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {error.message}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {canManage ? (
        <section className={`rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] panel-elevated transition-all ${createOpen ? "p-6" : "px-5 py-3"}`}>
          <button
            type="button"
            onClick={() => setCreateOpen(!createOpen)}
            className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-3">
              <LifeBuoy size={16} className="text-emerald-400" />
              <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.16em] text-[var(--color-text-strong)]">
                Open Rescue Intake
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
                Intake captures the survivor, threat, condition, and escort requirement before dispatch happens.
              </p>
              <RescueCreateForm onSuccess={invalidate} />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-2">
        {data.items.map((item) => (
          <CollapsibleCard
            key={item.id}
            id={item.id}
            expanded={expanded.has(item.id)}
            onToggle={() => toggle(item.id)}
            header={(isOpen) => (
              <div className="flex items-center gap-3">
                <p className={`font-[family:var(--font-display)] uppercase tracking-[0.12em] text-[var(--color-text-strong)] ${
                  isOpen ? "text-2xl" : "text-sm"
                }`}>
                  {item.survivorHandle}
                </p>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-cyan-300">
                  {item.status}
                </span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-amber-300">
                  {item.urgency}
                </span>
                {!isOpen ? (
                  <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    {item.locationName ?? "Location pending"}
                  </span>
                ) : null}
              </div>
            )}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
              {item.locationName ?? "Location pending"} / Requester {item.requesterDisplay}
            </p>

            {item.channelId ? (
              <Link to={`/comms?channel=${item.channelId}`} className="mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[var(--color-cyan)] transition hover:brightness-125">
                <Radio size={13} />
                Open comms channel
              </Link>
            ) : null}

            <div className="mt-5 grid gap-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Threat</p>
                <p className="mt-2 text-xs leading-6 text-[var(--color-text-secondary)]">
                  {item.threatSummary ?? "Threat summary pending."}
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Condition</p>
                <p className="mt-2 text-xs leading-6 text-[var(--color-text-secondary)]">
                  {item.survivorCondition ?? "Condition not yet logged."}
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Operator / Outcome</p>
                <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[var(--color-text-strong)]">
                  {item.operatorDisplay}
                </p>
                <p className="mt-2 text-xs leading-6 text-[var(--color-text-secondary)]">
                  {item.outcomeSummary ?? "Outcome not yet filed."}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 text-xs text-[var(--color-text-secondary)]">
              <div className="flex items-center gap-2">
                <ShieldAlert size={14} className="text-red-400" />
                <span>
                  {item.medicalRequired ? "Medical support required" : "Medical support not required"} /{" "}
                  {item.escortRequired ? "Escort required" : "Escort discretionary"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <HeartPulse size={14} className="text-emerald-400" />
                <span>
                  Offered payment: {item.offeredPayment ? `${item.offeredPayment.toLocaleString()} aUEC` : "none logged"}
                </span>
              </div>
            </div>

            <section className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-medium)] p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Dispatched assets</p>
              <div className="mt-3 space-y-2">
                {item.dispatches.map((dispatch) => (
                  <div key={dispatch.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-strong)]">
                        {dispatch.qrfCallsign}
                      </p>
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                        {dispatch.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      {dispatch.platform ?? "Platform pending"} / Tasked {dispatch.dispatchedAtLabel}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-[var(--color-text-secondary)]">
                      {dispatch.notes ?? "No dispatch notes logged."}
                    </p>
                  </div>
                ))}
                {item.dispatches.length === 0 ? (
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-3 text-xs text-[var(--color-text-secondary)]">
                    No dispatched assets linked yet.
                  </div>
                ) : null}
              </div>
            </section>

            <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Rescue notes</p>
              <p className="mt-2 text-xs leading-6 text-[var(--color-text-secondary)]">
                {item.rescueNotes ?? "No rescue notes logged."}
              </p>
            </div>

            {canManage ? (
              <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-medium)] p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Update rescue</p>
                <div className="mt-3">
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
          </CollapsibleCard>
        ))}
      </section>
    </div>
  );
}
