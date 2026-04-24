"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Crosshair,
  Radio,
  Shield,
  AlertTriangle,
  Eye,
  Zap,
  Activity,
  Wifi,
  WifiOff,
  Maximize,
  Minimize,
} from "lucide-react";

type OpsSummary = {
  active_missions: number;
  planning_missions: number;
  qrf_ready: number;
  qrf_total: number;
  open_rescues: number;
  unread_alerts: number;
  active_intel: number;
  threat_clusters: number;
  compliance_violations: number;
  readiness_score: number;
  readiness: {
    qrf_posture: number;
    package_discipline: number;
    rescue_response: number;
    threat_awareness: number;
  };
  timestamp: string;
};

type AlertEvent = {
  type: string;
  category: string;
  severity: string;
  title: string;
  callsign?: string;
  field?: string;
};

type SessionInfo = {
  handle: string;
  role: string;
};

/* ── Stoplight indicator ── */
function Stoplight({ value, thresholds }: { value: number; thresholds?: [number, number] }) {
  const [amber, green] = thresholds ?? [40, 70];
  const color = value >= green ? "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.6)]" :
                value >= amber ? "bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.6)]" :
                "bg-red-500 shadow-[0_0_8px_rgba(248,113,113,0.6)]";
  return <span className={`inline-block h-3 w-3 rounded-full ${color}`} />;
}

function StoplightLabel({ value, thresholds }: { value: number; thresholds?: [number, number] }) {
  const [amber, green] = thresholds ?? [40, 70];
  if (value >= green) return <span className="text-emerald-400 font-semibold">GREEN</span>;
  if (value >= amber) return <span className="text-amber-400 font-semibold">AMBER</span>;
  return <span className="text-red-400 font-semibold">RED</span>;
}

/* ── Readiness Condition Banner ── */
function ReadconBanner({ score }: { score: number }) {
  let readcon: string, label: string, color: string, bgColor: string;
  if (score >= 90) {
    readcon = "READCON 1"; label = "FULL READINESS"; color = "text-emerald-300"; bgColor = "bg-emerald-500/10 border-emerald-500/30";
  } else if (score >= 70) {
    readcon = "READCON 2"; label = "SUBSTANTIAL READINESS"; color = "text-emerald-400"; bgColor = "bg-emerald-500/5 border-emerald-500/20";
  } else if (score >= 50) {
    readcon = "READCON 3"; label = "REDUCED READINESS"; color = "text-amber-400"; bgColor = "bg-amber-500/5 border-amber-500/20";
  } else if (score >= 30) {
    readcon = "READCON 4"; label = "MINIMAL READINESS"; color = "text-orange-400"; bgColor = "bg-orange-500/5 border-orange-500/20";
  } else {
    readcon = "READCON 5"; label = "NON-MISSION CAPABLE"; color = "text-red-400"; bgColor = "bg-red-500/5 border-red-500/20";
  }
  return (
    <div className={`flex items-center justify-between px-5 py-3 border-b ${bgColor}`}>
      <div className="flex items-center gap-4">
        <span className={`font-mono text-lg font-bold tracking-wide ${color}`}>{readcon}</span>
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-semibold">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-white/30">Composite</span>
        <span className={`font-mono text-xl font-bold tabular-nums ${color}`}>{score}</span>
      </div>
    </div>
  );
}

/* ── Status Matrix Row ── */
function StatusRow({ label, value, detail, thresholds }: {
  label: string;
  value: number;
  detail: string;
  thresholds?: [number, number];
}) {
  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02]">
      <td className="py-2.5 px-4 w-8">
        <Stoplight value={value} thresholds={thresholds} />
      </td>
      <td className="py-2.5 px-2 text-[11px] uppercase tracking-wider text-white/70 font-semibold w-40">
        {label}
      </td>
      <td className="py-2.5 px-2 font-mono text-sm font-bold tabular-nums text-white/90 w-16 text-right">
        {value}%
      </td>
      <td className="py-2.5 px-2">
        <StoplightLabel value={value} thresholds={thresholds} />
      </td>
      <td className="py-2.5 px-4 text-[11px] text-white/40">
        {detail}
      </td>
    </tr>
  );
}

/* ── Mission Phase Tracker ── */
function PhaseBlock({ count, phase, icon, color }: {
  count: number;
  phase: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`flex-1 border ${color} rounded px-4 py-3`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[9px] uppercase tracking-[0.16em] font-semibold opacity-70">{phase}</span>
      </div>
      <p className="font-mono text-3xl font-bold tabular-nums">{count.toString().padStart(2, "0")}</p>
    </div>
  );
}

/* ── SIGACT Event Line ── */
function SigactLine({ event, idx }: { event: AlertEvent; idx: number }) {
  const severityColor = {
    critical: "text-red-300 border-l-red-500",
    warning: "text-amber-300 border-l-amber-500",
    info: "text-cyan-300 border-l-cyan-500",
  }[event.severity] || "text-white/60 border-l-white/20";

  const categoryTag = {
    compliance: "CMPL",
    threat: "THRT",
    ops: "OPS",
    alert_rule: "ALRT",
  }[event.category] || "INFO";

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2 text-[11px] ${severityColor} border-l-2 mx-2 mb-0.5 animate-fade-in`}
      style={{ animationDelay: `${idx * 40}ms` }}
    >
      <span className="font-mono text-[9px] bg-white/5 px-1.5 py-0.5 rounded font-semibold shrink-0 mt-px">
        {categoryTag}
      </span>
      <span className="flex-1 leading-snug">{event.title}</span>
      {event.callsign && (
        <span className="font-mono text-[10px] opacity-50 shrink-0">{event.callsign}</span>
      )}
    </div>
  );
}

/* ── Main Board ── */
export function TacticalBoard({ session }: { session: SessionInfo }) {
  const [summary, setSummary] = useState<OpsSummary | null>(null);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setClock(new Date());
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "ops_summary") {
          setSummary(data as OpsSummary);
        } else if (data.type && data.title) {
          setEvents((prev) => [data as AlertEvent, ...prev].slice(0, 80));
        }
      } catch {}
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const s = summary;

  return (
    <div className="h-full flex flex-col bg-[#060a10]" style={{ fontFamily: "'IBM Plex Mono', 'Courier New', monospace" }}>
      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-5 py-2 border-b border-white/10 bg-[#0d1520] shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-xs uppercase tracking-[0.2em] text-cyan-400 font-bold">Guardian</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/30">Joint Operations Center</span>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            {connected ? (
              <><Wifi size={12} className="text-emerald-400" /><span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Live</span></>
            ) : (
              <><WifiOff size={12} className="text-red-400" /><span className="text-[10px] uppercase tracking-wider text-red-400 font-bold">Offline</span></>
            )}
          </div>
          <span className="text-[11px] tabular-nums text-white/40 font-mono" suppressHydrationWarning>
            {clock ? clock.toISOString().replace("T", " ").slice(0, 19) + "Z" : "--"}
          </span>
          <span className="text-[11px] text-cyan-400/80 font-semibold">{session.handle}</span>
          <button onClick={toggleFullscreen} className="text-white/30 hover:text-white/60 transition-colors">
            {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 grid grid-cols-12 gap-px overflow-hidden">

        {/* ──────── LEFT: STATUS BOARD (8 cols) ──────── */}
        <div className="col-span-8 flex flex-col overflow-y-auto">

          {/* READCON Banner */}
          {s && <ReadconBanner score={s.readiness_score} />}

          {/* Mission Phase Tracker */}
          <div className="px-4 pt-4 pb-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-3 px-1">Current Operations</p>
            <div className="flex gap-2">
              <PhaseBlock
                count={s?.active_missions ?? 0}
                phase="Active"
                icon={<Crosshair size={12} />}
                color="border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
              />
              <PhaseBlock
                count={s?.planning_missions ?? 0}
                phase="Planning"
                icon={<Crosshair size={12} />}
                color="border-cyan-500/30 bg-cyan-500/5 text-cyan-400"
              />
              <PhaseBlock
                count={s?.open_rescues ?? 0}
                phase="Open Rescues"
                icon={<Radio size={12} />}
                color="border-red-500/30 bg-red-500/5 text-red-400"
              />
              <PhaseBlock
                count={s?.active_intel ?? 0}
                phase="Intel Reports"
                icon={<Eye size={12} />}
                color="border-violet-500/30 bg-violet-500/5 text-violet-400"
              />
            </div>
          </div>

          {/* Readiness Status Matrix */}
          <div className="px-4 pb-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-2 px-1">Readiness Status Matrix</p>
            <div className="border border-white/[0.06] rounded overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                    <th className="py-2 px-4 text-[9px] uppercase tracking-widest text-white/30 font-semibold"></th>
                    <th className="py-2 px-2 text-[9px] uppercase tracking-widest text-white/30 font-semibold">Function</th>
                    <th className="py-2 px-2 text-[9px] uppercase tracking-widest text-white/30 font-semibold text-right">Score</th>
                    <th className="py-2 px-2 text-[9px] uppercase tracking-widest text-white/30 font-semibold">Status</th>
                    <th className="py-2 px-4 text-[9px] uppercase tracking-widest text-white/30 font-semibold">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  <StatusRow
                    label="QRF Posture"
                    value={s?.readiness.qrf_posture ?? 0}
                    detail={s ? `${s.qrf_ready} of ${s.qrf_total} teams ready to deploy` : "--"}
                  />
                  <StatusRow
                    label="Pkg Discipline"
                    value={s?.readiness.package_discipline ?? 0}
                    detail={s ? `${s.compliance_violations} active violations across missions` : "--"}
                  />
                  <StatusRow
                    label="Rescue Response"
                    value={s?.readiness.rescue_response ?? 0}
                    detail={s ? `${s.open_rescues} open rescues requiring response` : "--"}
                  />
                  <StatusRow
                    label="Threat Awareness"
                    value={s?.readiness.threat_awareness ?? 0}
                    detail={s ? `${s.active_intel} intel reports, ${s.threat_clusters} threat clusters` : "--"}
                  />
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Indicators */}
          <div className="px-4 pb-4">
            <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-2 px-1">Key Indicators</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="border border-white/[0.06] rounded px-4 py-3">
                <p className="text-[9px] uppercase tracking-wider text-white/30 mb-1">QRF Availability</p>
                <p className="font-mono text-lg font-bold tabular-nums text-white/80">
                  {s ? `${s.qrf_ready}/${s.qrf_total}` : "--"}
                  {s && s.qrf_total > 0 && (
                    <span className="text-xs text-white/30 ml-2">
                      ({Math.round((s.qrf_ready / s.qrf_total) * 100)}%)
                    </span>
                  )}
                </p>
              </div>
              <div className="border border-white/[0.06] rounded px-4 py-3">
                <p className="text-[9px] uppercase tracking-wider text-white/30 mb-1">Unread Alerts</p>
                <p className={`font-mono text-lg font-bold tabular-nums ${s && s.unread_alerts > 10 ? 'text-amber-400' : 'text-white/80'}`}>
                  {s?.unread_alerts ?? "--"}
                </p>
              </div>
              <div className="border border-white/[0.06] rounded px-4 py-3">
                <p className="text-[9px] uppercase tracking-wider text-white/30 mb-1">Compliance</p>
                <p className={`font-mono text-lg font-bold tabular-nums ${s && s.compliance_violations > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {s ? (s.compliance_violations === 0 ? "CLEAR" : `${s.compliance_violations} VIOL`) : "--"}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom status bar */}
          <div className="mt-auto px-5 py-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-white/25 shrink-0">
            <span suppressHydrationWarning>Last update: {s?.timestamp ? new Date(s.timestamp).toLocaleTimeString() : '--'}</span>
            <span>30s refresh cycle</span>
            <span>Engine: guardian-engine:3420</span>
          </div>
        </div>

        {/* ──────── RIGHT: SIGACT FEED (4 cols) ──────── */}
        <div className="col-span-4 bg-[#0b1018] border-l border-white/[0.06] flex flex-col">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-semibold">SIGACT Log</span>
            <span className="text-[10px] tabular-nums text-white/20 font-mono">{events.length} events</span>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {events.length === 0 ? (
              <p className="text-[11px] text-white/15 px-4 py-8 text-center">No significant activity</p>
            ) : (
              events.map((event, i) => <SigactLine key={`${i}-${event.title}`} event={event} idx={i} />)
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
