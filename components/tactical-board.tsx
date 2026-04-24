"use client";

import { useState, useEffect } from "react";
import { useEngine } from "@/lib/engine-context";
import {
  Crosshair,
  Radio,
  Shield,
  AlertTriangle,
  Eye,
  Zap,
  Activity,
} from "lucide-react";

type AlertEvent = {
  type: string;
  category: string;
  severity: string;
  title: string;
  callsign?: string;
  field?: string;
};

/* ── Stoplight ── */
function Stoplight({ value, thresholds }: { value: number; thresholds?: [number, number] }) {
  const [amber, green] = thresholds ?? [40, 70];
  const color = value >= green
    ? "bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
    : value >= amber
    ? "bg-amber-500 shadow-[0_0_6px_rgba(251,191,36,0.5)]"
    : "bg-red-500 shadow-[0_0_6px_rgba(248,113,113,0.5)]";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

function StoplightTag({ value, thresholds }: { value: number; thresholds?: [number, number] }) {
  const [amber, green] = thresholds ?? [40, 70];
  if (value >= green)
    return <span className="rounded-[var(--radius-sm)] border border-emerald-500/20 bg-emerald-500/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-emerald-300">Green</span>;
  if (value >= amber)
    return <span className="rounded-[var(--radius-sm)] border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-amber-300">Amber</span>;
  return <span className="rounded-[var(--radius-sm)] border border-red-500/20 bg-red-500/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-red-300">Red</span>;
}

/* ── READCON Banner ── */
function ReadconBanner({ score }: { score: number }) {
  let readcon: string, label: string, colorClass: string, borderClass: string;
  if (score >= 90) {
    readcon = "READCON 1"; label = "Full Readiness"; colorClass = "text-emerald-400"; borderClass = "border-emerald-500/20 bg-emerald-500/5";
  } else if (score >= 70) {
    readcon = "READCON 2"; label = "Substantial Readiness"; colorClass = "text-emerald-400"; borderClass = "border-emerald-500/15 bg-emerald-500/3";
  } else if (score >= 50) {
    readcon = "READCON 3"; label = "Reduced Readiness"; colorClass = "text-amber-400"; borderClass = "border-amber-500/20 bg-amber-500/5";
  } else if (score >= 30) {
    readcon = "READCON 4"; label = "Minimal Readiness"; colorClass = "text-orange-400"; borderClass = "border-orange-500/20 bg-orange-500/5";
  } else {
    readcon = "READCON 5"; label = "Non-Mission Capable"; colorClass = "text-red-400"; borderClass = "border-red-500/20 bg-red-500/5";
  }
  return (
    <div className={`rounded-[var(--radius-lg)] border ${borderClass} px-5 py-4 flex items-center justify-between`}>
      <div className="flex items-center gap-4">
        <span className={`font-[family:var(--font-display)] text-xl uppercase tracking-[0.1em] ${colorClass}`}>{readcon}</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">Composite</span>
        <span className={`font-[family:var(--font-display)] text-2xl tracking-[0.06em] ${colorClass}`}>{score}</span>
      </div>
    </div>
  );
}

/* ── Phase Block ── */
function PhaseBlock({ count, phase, icon, colorClass }: {
  count: number; phase: string; icon: React.ReactNode; colorClass: string;
}) {
  return (
    <div className={`flex-1 rounded-[var(--radius-md)] border ${colorClass} px-4 py-3`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[9px] uppercase tracking-[0.14em] font-semibold opacity-70">{phase}</span>
      </div>
      <p className="font-[family:var(--font-display)] text-3xl tracking-[0.06em] tabular-nums text-[var(--color-text-strong)]">
        {count.toString().padStart(2, "0")}
      </p>
    </div>
  );
}

/* ── Status Matrix Row ── */
function StatusRow({ label, value, detail, thresholds }: {
  label: string; value: number; detail: string; thresholds?: [number, number];
}) {
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-hover)] transition-colors">
      <td className="py-2.5 px-4 w-8"><Stoplight value={value} thresholds={thresholds} /></td>
      <td className="py-2.5 px-2 text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)] font-semibold w-40">{label}</td>
      <td className="py-2.5 px-2 font-[family:var(--font-display)] text-sm tracking-[0.06em] text-[var(--color-text-strong)] w-16 text-right tabular-nums">{value}%</td>
      <td className="py-2.5 px-3"><StoplightTag value={value} thresholds={thresholds} /></td>
      <td className="py-2.5 px-4 text-[11px] text-[var(--color-text-tertiary)]">{detail}</td>
    </tr>
  );
}

/* ── SIGACT Line ── */
function SigactLine({ event }: { event: AlertEvent }) {
  const severityBorder = {
    critical: "border-l-red-500",
    warning: "border-l-amber-500",
    info: "border-l-[var(--color-cyan)]",
  }[event.severity] || "border-l-[var(--color-border)]";

  const severityText = {
    critical: "text-red-300",
    warning: "text-amber-300",
    info: "text-[var(--color-text-secondary)]",
  }[event.severity] || "text-[var(--color-text-tertiary)]";

  const categoryTag = {
    compliance: "CMPL",
    threat: "THRT",
    ops: "OPS",
    alert_rule: "ALRT",
  }[event.category] || "INFO";

  return (
    <div className={`flex items-start gap-2 px-3 py-2 text-[11px] ${severityText} border-l-2 ${severityBorder} hover:bg-[var(--color-hover)] transition-colors`}>
      <span className="rounded-[var(--radius-sm)] bg-[var(--color-overlay-subtle)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] shrink-0 mt-px">
        {categoryTag}
      </span>
      <span className="flex-1 leading-snug">{event.title}</span>
      {event.callsign && (
        <span className="text-[10px] text-[var(--color-text-faint)] shrink-0">{event.callsign}</span>
      )}
    </div>
  );
}

/* ── Main Board ── */
export function TacticalBoard() {
  const { opsSummary, connectionState, subscribeAlerts } = useEngine();
  const [events, setEvents] = useState<AlertEvent[]>([]);

  // Subscribe to alert events from the engine context
  useEffect(() => {
    const unsub = subscribeAlerts((event) => {
      setEvents((prev) => [
        {
          type: event.type,
          category: event.category,
          severity: event.severity,
          title: event.title,
          callsign: event.callsign,
          field: event.field,
        },
        ...prev,
      ].slice(0, 80));
    });
    return unsub;
  }, [subscribeAlerts]);

  const s = opsSummary;
  const live = s !== null;

  return (
    <div className="flex flex-col gap-4">
      {/* Connection status */}
      {connectionState !== "connected" && (
        <div className="rounded-[var(--radius-md)] border border-amber-500/20 bg-amber-500/8 px-4 py-2.5 text-[11px] text-amber-200 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          {connectionState === "connecting" ? "Connecting to engine..." : "Engine disconnected. Reconnecting..."}
        </div>
      )}

      {/* READCON */}
      {s && <ReadconBanner score={s.readiness_score} />}

      {/* Current Ops + SIGACT side by side */}
      <div className="grid gap-4 xl:grid-cols-[1fr_0.6fr]">
        {/* Left: Status Board */}
        <div className="flex flex-col gap-4">
          {/* Mission Phases */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
            <div className="border-b border-[var(--color-border)] pb-3 mb-4">
              <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Current Operations</p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Mission phases and force posture</p>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <PhaseBlock count={s?.active_missions ?? 0} phase="Active" icon={<Crosshair size={13} />} colorClass="border-emerald-500/20 bg-emerald-500/8 text-emerald-300" />
              <PhaseBlock count={s?.planning_missions ?? 0} phase="Planning" icon={<Crosshair size={13} />} colorClass="border-[var(--color-cyan)]/20 bg-[var(--color-cyan)]/8 text-[var(--color-cyan)]" />
              <PhaseBlock count={s?.open_rescues ?? 0} phase="Open Rescues" icon={<Radio size={13} />} colorClass="border-red-500/20 bg-red-500/8 text-red-300" />
              <PhaseBlock count={s?.active_intel ?? 0} phase="Intel Reports" icon={<Eye size={13} />} colorClass="border-violet-500/20 bg-violet-500/8 text-violet-300" />
            </div>
          </div>

          {/* Readiness Status Matrix */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
            <div className="border-b border-[var(--color-border)] pb-3 mb-4">
              <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Readiness Status Matrix</p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Stoplight assessment by warfighting function</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-overlay-subtle)]">
                    <th className="py-2 px-4 text-[9px] uppercase tracking-widest text-[var(--color-text-faint)]"></th>
                    <th className="py-2 px-2 text-[9px] uppercase tracking-widest text-[var(--color-text-faint)]">Function</th>
                    <th className="py-2 px-2 text-[9px] uppercase tracking-widest text-[var(--color-text-faint)] text-right">Score</th>
                    <th className="py-2 px-3 text-[9px] uppercase tracking-widest text-[var(--color-text-faint)]">Status</th>
                    <th className="py-2 px-4 text-[9px] uppercase tracking-widest text-[var(--color-text-faint)]">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  <StatusRow label="QRF Posture" value={s?.readiness.qrf_posture ?? 0} detail={s ? `${s.qrf_ready} of ${s.qrf_total} teams ready` : "--"} />
                  <StatusRow label="Pkg Discipline" value={s?.readiness.package_discipline ?? 0} detail={s ? `${s.compliance_violations} violations across missions` : "--"} />
                  <StatusRow label="Rescue Response" value={s?.readiness.rescue_response ?? 0} detail={s ? `${s.open_rescues} open rescues pending` : "--"} />
                  <StatusRow label="Threat Awareness" value={s?.readiness.threat_awareness ?? 0} detail={s ? `${s.active_intel} reports, ${s.threat_clusters} clusters` : "--"} />
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Indicators */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] px-5 py-4 panel-elevated">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] mb-1">QRF Availability</p>
              <p className="font-[family:var(--font-display)] text-xl tracking-[0.06em] text-[var(--color-text-strong)] tabular-nums">
                {s ? `${s.qrf_ready}/${s.qrf_total}` : "--"}
                {s && s.qrf_total > 0 && (
                  <span className="text-sm text-[var(--color-text-faint)] ml-2">({Math.round((s.qrf_ready / s.qrf_total) * 100)}%)</span>
                )}
              </p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] px-5 py-4 panel-elevated">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] mb-1">Unread Alerts</p>
              <p className={`font-[family:var(--font-display)] text-xl tracking-[0.06em] tabular-nums ${s && s.unread_alerts > 10 ? 'text-amber-400' : 'text-[var(--color-text-strong)]'}`}>
                {s?.unread_alerts ?? "--"}
              </p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] px-5 py-4 panel-elevated">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] mb-1">Compliance</p>
              <p className={`font-[family:var(--font-display)] text-xl tracking-[0.06em] ${s && s.compliance_violations > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {s ? (s.compliance_violations === 0 ? "CLEAR" : `${s.compliance_violations} VIOL`) : "--"}
              </p>
            </div>
          </div>
        </div>

        {/* Right: SIGACT Feed */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] panel-elevated flex flex-col max-h-[700px]">
          <div className="px-5 py-4 border-b border-[var(--color-border)] shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.1em] text-[var(--color-text-strong)]">SIGACT Log</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Significant activity</p>
              </div>
              <span className="text-[10px] tabular-nums text-[var(--color-text-faint)]">{events.length} events</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {events.length === 0 ? (
              <p className="text-[11px] text-[var(--color-text-faint)] px-5 py-8 text-center">No significant activity</p>
            ) : (
              events.map((event, i) => <SigactLine key={`${i}-${event.title}`} event={event} />)
            )}
          </div>
          {live && (
            <div className="px-5 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-faint)] flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
              <span>30s refresh</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
