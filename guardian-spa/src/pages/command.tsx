import { useState } from "react";
import { Link } from "react-router";
import {
  Activity,
  AlertTriangle,
  Bell,
  BookCheck,
  Clock3,
  Crosshair,
  Siren,
} from "lucide-react";
import { useCommandOverview } from "@/hooks/use-views";
import type {
  MissionSummary,
  QrfSummary,
  IntelSummary,
  RescueSummary,
  Notification,
} from "@/hooks/use-views";
import { CollapsibleCard } from "@/components/collapsible-card";

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Loading...</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
      {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function MissionCard({ m }: { m: MissionSummary }) {
  const disc = m.packageDiscipline;

  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.14em] text-[var(--color-text-strong)]">
            {m.callsign}
          </p>
          <p className="mt-1 text-sm uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
            {m.missionType}
          </p>
        </div>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-medium)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-200">
          {m.status}
        </span>
      </div>
      <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)]">{m.title}</p>
      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
        {m.packageSummary.readyOrLaunched}/{m.participantCount} ready or launched / AO {m.areaOfOperation ?? "pending"}
      </p>
      {disc.warnings.length > 0 ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
            <AlertTriangle size={14} />
            Package alert
          </div>
          <p className="mt-2 leading-7">{disc.warnings[0]}</p>
        </div>
      ) : null}
    </article>
  );
}

function QrfCard({ q }: { q: QrfSummary }) {
  return (
    <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-4 py-3">
      <div>
        <p className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.14em] text-[var(--color-text-strong)]">
          {q.callsign}
        </p>
        <p className="text-sm text-[var(--color-text-tertiary)]">
          {q.platform ?? "Platform pending"} / Crew {q.availableCrew}
        </p>
      </div>
      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--color-cyan)]">
        {q.status}
      </span>
    </div>
  );
}

function IntelCard({ item }: { item: IntelSummary }) {
  return (
    <li className="rounded-[var(--radius-md)] border border-red-500/15 bg-red-500/8 px-4 py-3 text-sm leading-7 text-[var(--color-text-secondary)]">
      <div className="font-semibold text-[var(--color-text-strong)]">{item.title}</div>
      <div className="mt-1 text-[var(--color-text-secondary)]">
        {item.locationName ?? "Unknown location"} / {item.hostileGroup ?? "Unconfirmed hostile"}
      </div>
    </li>
  );
}

function RescueCard({ r }: { r: RescueSummary }) {
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-4 panel-elevated">
      <div className="flex items-start justify-between gap-3">
        <p className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.12em] text-[var(--color-text-strong)]">
          {r.survivorHandle}
        </p>
        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-amber-200">
          {r.urgency}
        </span>
      </div>
      <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{r.locationName ?? "Location pending"}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
        {r.status} / {r.escortRequired ? "Escort required" : "Escort discretionary"}
      </p>
    </article>
  );
}

function NotificationCard({ n }: { n: Notification }) {
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-4 panel-elevated">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-text-strong)]">
          {n.title}
        </p>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
          {n.severity}
        </span>
      </div>
      {n.href ? (
        <Link
          to={n.href}
          className="mt-3 inline-flex text-xs uppercase tracking-[0.16em] text-[var(--color-cyan)] transition hover:brightness-125"
        >
          Open source
        </Link>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function CommandPage() {
  const { data, isLoading, error } = useCommandOverview();
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(["missions", "qrf", "intel", "alerts", "rescues"])
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Stat counters */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">Active Missions</p>
          <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-[var(--color-text-strong)]">
            {String(data.activeMissionCount).padStart(2, "0")}
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">QRF Posture</p>
          <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-[var(--color-text-strong)]">
            {String(data.qrfReadyCount).padStart(2, "0")}
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-200">Open Rescue</p>
          <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-[var(--color-text-strong)]">
            {String(data.openRescueCount).padStart(2, "0")}
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-red-500/20 bg-red-500/10 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-red-200">Unread Alerts</p>
          <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-[var(--color-text-strong)]">
            {String(data.unreadNotificationCount).padStart(2, "0")}
          </p>
        </div>
      </div>

      {/* Main grid: missions left, qrf+intel right */}
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {/* Mission Board */}
        <CollapsibleCard
          id="missions"
          expanded={expanded.has("missions")}
          onToggle={() => toggle("missions")}
          header={(isOpen) => (
            <div>
              <p className={`font-[family:var(--font-display)] uppercase tracking-[0.18em] text-[var(--color-text-strong)] ${
                isOpen ? "text-2xl" : "text-sm"
              }`}>
                Mission Board
              </p>
              {isOpen ? (
                <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                  Current stack and status gates
                </p>
              ) : (
                <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  {data.missions.length} missions
                </span>
              )}
            </div>
          )}
        >
          <div className="space-y-4">
            {data.missions.map((m) => (
              <MissionCard key={m.id} m={m} />
            ))}
            {data.missions.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--color-text-tertiary)]">
                No active missions
              </p>
            ) : null}
          </div>
        </CollapsibleCard>

        {/* Right column: QRF + Intel */}
        <div className="grid gap-6">
          {/* QRF Board */}
          <CollapsibleCard
            id="qrf"
            expanded={expanded.has("qrf")}
            onToggle={() => toggle("qrf")}
            header={(isOpen) => (
              <div className="flex items-center gap-3">
                <Siren className="text-[var(--color-cyan)]" size={isOpen ? 20 : 16} />
                <div>
                  <p className={`font-[family:var(--font-display)] uppercase tracking-[0.18em] text-[var(--color-text-strong)] ${
                    isOpen ? "text-2xl" : "text-sm"
                  }`}>
                    QRF Board
                  </p>
                  {isOpen ? (
                    <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                      Availability and launch posture
                    </p>
                  ) : (
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      {data.qrf.length} assets
                    </span>
                  )}
                </div>
              </div>
            )}
          >
            <div className="space-y-3">
              {data.qrf.map((q) => (
                <QrfCard key={q.id} q={q} />
              ))}
              {data.qrf.length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--color-text-tertiary)]">
                  No QRF elements
                </p>
              ) : null}
            </div>
          </CollapsibleCard>

          {/* Threat Summary */}
          <CollapsibleCard
            id="intel"
            expanded={expanded.has("intel")}
            onToggle={() => toggle("intel")}
            header={(isOpen) => (
              <div className="flex items-center gap-3">
                <Crosshair className="text-red-400" size={isOpen ? 20 : 16} />
                <div>
                  <p className={`font-[family:var(--font-display)] uppercase tracking-[0.18em] text-[var(--color-text-strong)] ${
                    isOpen ? "text-2xl" : "text-sm"
                  }`}>
                    Threat Summary
                  </p>
                  {isOpen ? (
                    <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                      Intelligence queue
                    </p>
                  ) : (
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      {data.intel.length} reports
                    </span>
                  )}
                </div>
              </div>
            )}
          >
            <ul className="space-y-3">
              {data.intel.map((item) => (
                <IntelCard key={item.id} item={item} />
              ))}
              {data.intel.length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--color-text-tertiary)]">
                  No active intel
                </p>
              ) : null}
            </ul>
          </CollapsibleCard>
        </div>
      </section>

      {/* Three info panels */}
      <section className="grid gap-6 md:grid-cols-3">
        <article className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-6 panel-elevated">
          <div className="flex items-center gap-3">
            <Activity size={18} className="text-amber-300" />
            <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-[var(--color-text-strong)]">
              Live Modules
            </p>
          </div>
          <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--color-text-secondary)]">
            <li>
              <Link to="/missions" className="transition hover:text-[var(--color-text-strong)]">Mission board</Link>
            </li>
            <li>
              <Link to="/qrf" className="transition hover:text-[var(--color-text-strong)]">QRF dispatch</Link>
            </li>
            <li>
              <Link to="/intel" className="transition hover:text-[var(--color-text-strong)]">Threat picture</Link>
            </li>
            <li>
              <Link to="/rescues" className="transition hover:text-[var(--color-text-strong)]">Rescue board</Link>
            </li>
            <li>
              <Link to="/incidents" className="transition hover:text-[var(--color-text-strong)]">Incident review</Link>
            </li>
            <li>
              <Link to="/doctrine" className="transition hover:text-[var(--color-text-strong)]">ROE and doctrine</Link>
            </li>
          </ul>
        </article>

        <article className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-6 panel-elevated">
          <div className="flex items-center gap-3">
            <Clock3 size={18} className="text-[var(--color-cyan)]" />
            <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-[var(--color-text-strong)]">
              Dispatch Notes
            </p>
          </div>
          <p className="mt-5 text-sm leading-7 text-[var(--color-text-secondary)]">
            QRF dispatch, CSAR intake, incident review, and the public ops pages are now online alongside mission control. The shape is here; now the job is hardening and refinement.
          </p>
        </article>

        <article className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-6 panel-elevated">
          <div className="flex items-center gap-3">
            <BookCheck size={18} className="text-lime-300" />
            <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-[var(--color-text-strong)]">
              Doctrine
            </p>
          </div>
          <p className="mt-5 text-sm leading-7 text-[var(--color-text-secondary)]">
            Doctrine templates now exist as reusable org assets. ROE and execution guidance can be attached directly to sorties instead of dying in mission briefs or chat fragments.
          </p>
        </article>
      </section>

      {/* Ops Alerts / Notifications */}
      <CollapsibleCard
        id="alerts"
        expanded={expanded.has("alerts")}
        onToggle={() => toggle("alerts")}
        header={(isOpen) => (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Bell size={18} className="text-red-400" />
              <div>
                <p className={`font-[family:var(--font-display)] uppercase tracking-[0.16em] text-[var(--color-text-strong)] ${
                  isOpen ? "text-2xl" : "text-sm"
                }`}>
                  Ops Alerts
                </p>
                {isOpen ? (
                  <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Persisted notification feed</p>
                ) : (
                  <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    {data.notifications.length} alerts
                  </span>
                )}
              </div>
            </div>
            {isOpen ? (
              <Link
                to="/notifications"
                onClick={(e) => e.stopPropagation()}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-strong)] transition hover:bg-[var(--color-overlay-medium)]"
              >
                Open alerts
              </Link>
            ) : null}
          </div>
        )}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {data.notifications.map((n) => (
            <NotificationCard key={n.id} n={n} />
          ))}
          {data.notifications.length === 0 ? (
            <p className="col-span-3 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
              No alerts
            </p>
          ) : null}
        </div>
      </CollapsibleCard>

      {/* Rescue Queue */}
      <CollapsibleCard
        id="rescues"
        expanded={expanded.has("rescues")}
        onToggle={() => toggle("rescues")}
        header={(isOpen) => (
          <div className="flex items-center gap-3">
            <Siren size={18} className="text-amber-300" />
            <div>
              <p className={`font-[family:var(--font-display)] uppercase tracking-[0.16em] text-[var(--color-text-strong)] ${
                isOpen ? "text-2xl" : "text-sm"
              }`}>
                Rescue Queue
              </p>
              {isOpen ? (
                <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Current active requests</p>
              ) : (
                <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  {data.rescues.length} requests
                </span>
              )}
            </div>
          </div>
        )}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {data.rescues.map((r) => (
            <RescueCard key={r.id} r={r} />
          ))}
          {data.rescues.length === 0 ? (
            <p className="col-span-3 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
              No open rescues
            </p>
          ) : null}
        </div>
      </CollapsibleCard>
    </div>
  );
}
