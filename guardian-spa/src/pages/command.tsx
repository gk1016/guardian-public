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

function severityLabel(n: number): string {
  if (n >= 9) return "critical";
  if (n >= 7) return "high";
  if (n >= 4) return "medium";
  return "low";
}

function severityColor(n: number): string {
  if (n >= 9) return "red";
  if (n >= 7) return "amber";
  if (n >= 4) return "yellow";
  return "slate";
}

const statusTone: Record<string, string> = {
  planning: "slate",
  ready: "amber",
  active: "emerald",
  launched: "emerald",
  complete: "sky",
  cancelled: "red",
};

function statusBorderClass(status: string) {
  const tone = statusTone[status] ?? "slate";
  return `border-${tone}-400/40 bg-${tone}-400/10 text-${tone}-300`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function MissionCard({ m }: { m: MissionSummary }) {
  const disc = m.packageDiscipline;

  return (
    <article className="rounded-2xl border border-white/10 bg-white/4 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.14em] text-white">
            {m.callsign}
          </p>
          <p className="mt-1 text-sm uppercase tracking-[0.16em] text-slate-400">
            {m.missionType}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-200">
          {m.status}
        </span>
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-300">{m.title}</p>
      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
        {m.packageSummary.readyOrLaunched}/{m.participantCount} ready or launched / AO {m.areaOfOperation ?? "pending"}
      </p>
      {disc.warnings.length > 0 ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-200">
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
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-4 py-3">
      <div>
        <p className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.14em] text-white">
          {q.callsign}
        </p>
        <p className="text-sm text-slate-400">
          {q.platform ?? "Platform pending"} / Crew {q.availableCrew}
        </p>
      </div>
      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
        {q.status}
      </span>
    </div>
  );
}

function IntelCard({ item }: { item: IntelSummary }) {
  return (
    <li className="rounded-xl border border-red-500/15 bg-red-500/8 px-4 py-3 text-sm leading-7 text-slate-200">
      <div className="font-semibold text-white">{item.title}</div>
      <div className="mt-1 text-slate-300">
        {item.locationName ?? "Unknown location"} / {item.hostileGroup ?? "Unconfirmed hostile"}
      </div>
    </li>
  );
}

function RescueCard({ r }: { r: RescueSummary }) {
  return (
    <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.12em] text-white">
          {r.survivorHandle}
        </p>
        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-amber-100">
          {r.urgency}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-300">{r.locationName ?? "Location pending"}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
        {r.status} / {r.escortRequired ? "Escort required" : "Escort discretionary"}
      </p>
    </article>
  );
}

function NotificationCard({ n }: { n: Notification }) {
  return (
    <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
          {n.title}
        </p>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
          {n.severity}
        </span>
      </div>
      {n.href ? (
        <Link
          to={n.href}
          className="mt-3 inline-flex text-xs uppercase tracking-[0.16em] text-cyan-100 transition hover:text-white"
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

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Stat counters */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Active Missions</p>
          <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
            {String(data.activeMissionCount).padStart(2, "0")}
          </p>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">QRF Posture</p>
          <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
            {String(data.qrfReadyCount).padStart(2, "0")}
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-100">Open Rescue</p>
          <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
            {String(data.openRescueCount).padStart(2, "0")}
          </p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-red-100">Unread Alerts</p>
          <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
            {String(data.unreadNotificationCount).padStart(2, "0")}
          </p>
        </div>
      </div>

      {/* Main grid: missions left, qrf+intel right */}
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {/* Mission Board */}
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.18em] text-white">
                Mission Board
              </p>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
                Current stack and status gates
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {data.missions.map((m) => (
              <MissionCard key={m.id} m={m} />
            ))}
            {data.missions.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                No active missions
              </p>
            ) : null}
          </div>
        </div>

        {/* Right column: QRF + Intel */}
        <div className="grid gap-6">
          {/* QRF Board */}
          <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <Siren className="text-cyan-300" size={20} />
              <div>
                <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.18em] text-white">
                  QRF Board
                </p>
                <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
                  Availability and launch posture
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {data.qrf.map((q) => (
                <QrfCard key={q.id} q={q} />
              ))}
              {data.qrf.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  No QRF elements
                </p>
              ) : null}
            </div>
          </section>

          {/* Threat Summary */}
          <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <Crosshair className="text-red-300" size={20} />
              <div>
                <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.18em] text-white">
                  Threat Summary
                </p>
                <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
                  Intelligence queue
                </p>
              </div>
            </div>
            <ul className="mt-5 space-y-3">
              {data.intel.map((item) => (
                <IntelCard key={item.id} item={item} />
              ))}
              {data.intel.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  No active intel
                </p>
              ) : null}
            </ul>
          </section>
        </div>
      </section>

      {/* Three info panels */}
      <section className="grid gap-6 md:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
          <div className="flex items-center gap-3">
            <Activity size={18} className="text-amber-300" />
            <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
              Live Modules
            </p>
          </div>
          <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
            <li>
              <Link to="/missions" className="transition hover:text-white">Mission board</Link>
            </li>
            <li>
              <Link to="/qrf" className="transition hover:text-white">QRF dispatch</Link>
            </li>
            <li>
              <Link to="/intel" className="transition hover:text-white">Threat picture</Link>
            </li>
            <li>
              <Link to="/rescues" className="transition hover:text-white">Rescue board</Link>
            </li>
            <li>
              <Link to="/incidents" className="transition hover:text-white">Incident review</Link>
            </li>
            <li>
              <Link to="/doctrine" className="transition hover:text-white">ROE and doctrine</Link>
            </li>
          </ul>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
          <div className="flex items-center gap-3">
            <Clock3 size={18} className="text-cyan-300" />
            <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
              Dispatch Notes
            </p>
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-300">
            QRF dispatch, CSAR intake, incident review, and the public ops pages are now online alongside mission control. The shape is here; now the job is hardening and refinement.
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
          <div className="flex items-center gap-3">
            <BookCheck size={18} className="text-lime-300" />
            <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
              Doctrine
            </p>
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-300">
            Doctrine templates now exist as reusable org assets. ROE and execution guidance can be attached directly to sorties instead of dying in mission briefs or chat fragments.
          </p>
        </article>
      </section>

      {/* Ops Alerts / Notifications */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-red-300" />
            <div>
              <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                Ops Alerts
              </p>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Persisted notification feed</p>
            </div>
          </div>
          <Link
            to="/notifications"
            className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
          >
            Open alerts
          </Link>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {data.notifications.map((n) => (
            <NotificationCard key={n.id} n={n} />
          ))}
          {data.notifications.length === 0 ? (
            <p className="col-span-3 py-6 text-center text-xs text-slate-400">
              No alerts
            </p>
          ) : null}
        </div>
      </section>

      {/* Rescue Queue */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center gap-3">
          <Siren size={18} className="text-amber-300" />
          <div>
            <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
              Rescue Queue
            </p>
            <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Current active requests</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {data.rescues.map((r) => (
            <RescueCard key={r.id} r={r} />
          ))}
          {data.rescues.length === 0 ? (
            <p className="col-span-3 py-6 text-center text-xs text-slate-400">
              No open rescues
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
