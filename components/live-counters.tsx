"use client";

import { useEngine } from "@/lib/engine-context";

type LiveCountersProps = {
  initialActiveMissions: number;
  initialQrfReady: number;
  initialOpenRescues: number;
  initialUnreadAlerts: number;
};

function CounterCard({
  label,
  value,
  live,
  colorClass,
}: {
  label: string;
  value: number;
  live: boolean;
  colorClass: string;
}) {
  return (
    <div className={`rounded-[var(--radius-lg)] border ${colorClass} px-4 py-3 relative`}>
      {live && (
        <span className="absolute right-2.5 top-2.5 flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">Live</span>
        </span>
      )}
      <p className="text-[10px] uppercase tracking-[0.14em] text-inherit opacity-80">{label}</p>
      <p className="mt-1 font-[family:var(--font-display)] text-2xl uppercase tracking-[0.08em] text-white tabular-nums">
        {value.toString().padStart(2, "0")}
      </p>
    </div>
  );
}

export function LiveCounters({
  initialActiveMissions,
  initialQrfReady,
  initialOpenRescues,
  initialUnreadAlerts,
}: LiveCountersProps) {
  const { opsSummary } = useEngine();
  const live = opsSummary !== null;

  const activeMissions = opsSummary?.active_missions ?? initialActiveMissions;
  const qrfReady = opsSummary?.qrf_ready ?? initialQrfReady;
  const openRescues = opsSummary?.open_rescues ?? initialOpenRescues;
  const unreadAlerts = opsSummary?.unread_alerts ?? initialUnreadAlerts;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <CounterCard
        label="Active Missions"
        value={activeMissions}
        live={live}
        colorClass="border-emerald-500/20 bg-emerald-500/8 text-emerald-200"
      />
      <CounterCard
        label="QRF Ready"
        value={qrfReady}
        live={live}
        colorClass="border-cyan-500/20 bg-cyan-500/8 text-cyan-200"
      />
      <CounterCard
        label="Open Rescue"
        value={openRescues}
        live={live}
        colorClass="border-amber-500/20 bg-amber-500/8 text-amber-200"
      />
      <CounterCard
        label="Unread Alerts"
        value={unreadAlerts}
        live={live}
        colorClass="border-red-500/20 bg-red-500/8 text-red-200"
      />
    </div>
  );
}
