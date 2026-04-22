import Link from "next/link";
import { Rocket, ShieldAlert } from "lucide-react";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { QrfCreateForm } from "@/components/qrf-create-form";
import { QrfDispatchForm } from "@/components/qrf-dispatch-form";
import { QrfDispatchStatusForm } from "@/components/qrf-dispatch-status-form";
import { QrfStatusForm } from "@/components/qrf-status-form";
import { OpsShell } from "@/components/ops-shell";
import { requireSession } from "@/lib/auth";
import { getQrfPageData } from "@/lib/ops-data";
import { canManageOperations } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function QrfPage() {
  const session = await requireSession("/qrf");
  const data = await getQrfPageData(session.userId);
  const canManage = canManageOperations(session.role);

  return (
    <OpsShell
      currentPath="/qrf"
      section="QRF"
      title="QRF Dispatch"
      orgName={data.orgName}
      session={session}
    >
      {data.error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">{data.error}</div>
      ) : null}

      {canManage ? (
        <CollapsiblePanel label="Add QRF Asset" icon={<Rocket size={16} className="text-cyan-300" />}>
          <QrfCreateForm />
        </CollapsiblePanel>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        {data.items.map((item) => (
          <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.08em] text-[var(--color-text-strong)]">{item.callsign}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">{item.platform ?? "Platform pending"} / {item.locationName ?? "Location pending"}</p>
              </div>
              <span className="rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-cyan-200">{item.status}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">Crew {item.availableCrew} / {item.notes ?? "No readiness notes."}</p>

            {canManage ? (
              <div className="mt-4 grid gap-3">
                <CollapsiblePanel label="Update posture" variant="inline">
                  <QrfStatusForm qrfId={item.id} initialAsset={{ status: item.status, platform: item.platform, locationName: item.locationName, availableCrew: item.availableCrew, notes: item.notes }} />
                </CollapsiblePanel>
                <CollapsiblePanel label="Dispatch asset" variant="inline">
                  <QrfDispatchForm qrfId={item.id} missionOptions={data.missionOptions} rescueOptions={data.rescueOptions} />
                </CollapsiblePanel>
              </div>
            ) : null}

            <div className="mt-4">
              <CollapsiblePanel label="Dispatch history" variant="inline" icon={<ShieldAlert size={13} className="text-[var(--color-accent)]" />}>
                <div className="space-y-2">
                  {item.dispatches.map((dispatch) => (
                    <div key={dispatch.id} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {dispatch.targetHref ? (
                          <Link href={dispatch.targetHref} className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--color-text-strong)] hover:text-cyan-200">{dispatch.targetLabel}</Link>
                        ) : (
                          <p className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--color-text-strong)]">{dispatch.targetLabel}</p>
                        )}
                        <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] uppercase text-[var(--color-text-secondary)]">{dispatch.status}</span>
                      </div>
                      <p className="mt-1 text-[10px] text-[var(--color-text-tertiary)]">
                        Tasked {dispatch.dispatchedAtLabel}
                        {dispatch.arrivedAtLabel ? ` / Arrived ${dispatch.arrivedAtLabel}` : ""}
                        {dispatch.rtbAtLabel ? ` / RTB ${dispatch.rtbAtLabel}` : ""}
                      </p>
                      <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-secondary)]">{dispatch.notes ?? "No dispatch notes."}</p>
                      {canManage ? <div className="mt-2"><QrfDispatchStatusForm dispatchId={dispatch.id} initialStatus={dispatch.status} /></div> : null}
                    </div>
                  ))}
                  {item.dispatches.length === 0 ? <p className="text-[11px] text-[var(--color-text-tertiary)]">No dispatches logged.</p> : null}
                </div>
              </CollapsiblePanel>
            </div>
          </article>
        ))}
      </section>
    </OpsShell>
  );
}
