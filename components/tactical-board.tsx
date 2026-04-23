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

function StatusIndicator({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-28 h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-semibold tabular-nums text-white/70 w-10 text-right">{pct}%</span>
      <span className="text-[11px] text-white/50">{label}</span>
    </div>
  );
}

function MetricBlock({ icon, value, label, color, pulse }: { icon: React.ReactNode; value: string | number; label: string; color: string; pulse?: boolean }) {
  return (
    <div className={`rounded-lg border-2 ${color} px-4 py-3 relative`}>
      {pulse && (
        <span className="absolute top-2 right-2">
          <span className="inline-block h-2 w-2 rounded-full bg-current animate-pulse" />
        </span>
      )}
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.14em] font-semibold opacity-80">{label}</span>
      </div>
      <p className="font-mono text-2xl font-bold tabular-nums tracking-wide">
        {typeof value === "number" ? value.toString().padStart(2, "0") : value}
      </p>
    </div>
  );
}

function EventLine({ event, idx }: { event: AlertEvent; idx: number }) {
  const severityColor = {
    critical: "text-red-300 bg-red-500/10",
    warning: "text-amber-300 bg-amber-500/10",
    info: "text-cyan-300 bg-cyan-500/10",
  }[event.severity] || "text-white/60 bg-white/5";

  const categoryIcon = {
    compliance: <Shield size={11} />,
    threat: <AlertTriangle size={11} />,
    ops: <Crosshair size={11} />,
    alert_rule: <Zap size={11} />,
  }[event.category] || <Activity size={11} />;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 text-[11px] ${severityColor} rounded mx-1 mb-0.5 animate-fade-in`}
      style={{ animationDelay: `${idx * 50}ms` }}
    >
      {categoryIcon}
      <span className="truncate flex-1">{event.title}</span>
      {event.callsign && (
        <span className="font-mono text-[10px] opacity-60">{event.callsign}</span>
      )}
    </div>
  );
}

export function TacticalBoard({ session }: { session: SessionInfo }) {
  const [summary, setSummary] = useState<OpsSummary | null>(null);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clock, setClock] = useState(new Date());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port = window.location.port || (proto === "wss:" ? "443" : "80");
    const ws = new WebSocket(`${proto}//${host}:${port}/engine/ws`);
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
          setEvents((prev) => [data as AlertEvent, ...prev].slice(0, 50));
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

  const readinessColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 50) return "text-amber-400";
    return "text-red-400";
  };

  const readinessBg = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  const readinessGlow = (score: number) => {
    if (score >= 80) return "shadow-[0_0_20px_rgba(52,211,153,0.4)]";
    if (score >= 50) return "shadow-[0_0_20px_rgba(251,191,36,0.4)]";
    return "shadow-[0_0_20px_rgba(248,113,113,0.4)]";
  };

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: "'IBM Plex Mono', 'Courier New', monospace" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-cyan-500/20 bg-[#0d1520]">
        <div className="flex items-center gap-4">
          <span className="text-xs uppercase tracking-[0.2em] text-cyan-400 font-bold">Guardian</span>
          <span className="text-xs uppercase tracking-[0.16em] text-white/40">Tactical Overview</span>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            {connected ? (
              <><Wifi size={13} className="text-emerald-400" /><span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Live</span></>
            ) : (
              <><WifiOff size={13} className="text-red-400" /><span className="text-[10px] uppercase tracking-wider text-red-400 font-bold">Offline</span></>
            )}
          </div>
          <span className="text-xs tabular-nums text-white/50 font-mono">
            {clock.toISOString().replace("T", " ").slice(0, 19)}Z
          </span>
          <span className="text-xs text-cyan-400 font-semibold">{session.handle}</span>
          <button onClick={toggleFullscreen} className="text-white/40 hover:text-white/80 transition-colors">
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-12 gap-1 bg-[#060a10] p-1 overflow-hidden">

        {/* Left column */}
        <div className="col-span-3 flex flex-col gap-1">
          {/* Readiness score */}
          <div className="bg-[#0d1520] border border-white/10 rounded-lg p-5 flex-shrink-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/60 font-semibold mb-3">Org Readiness</p>
            {summary ? (
              <>
                <div className="flex items-end gap-2 mb-5">
                  <span className={`font-mono text-6xl font-bold tabular-nums ${readinessColor(summary.readiness_score)} ${readinessGlow(summary.readiness_score)}`}>
                    {summary.readiness_score}
                  </span>
                  <span className="text-sm text-white/30 mb-2">/ 100</span>
                </div>
                <div className="space-y-2.5">
                  <StatusIndicator value={summary.readiness.qrf_posture} max={100} label="QRF Posture" color={readinessBg(summary.readiness.qrf_posture)} />
                  <StatusIndicator value={summary.readiness.package_discipline} max={100} label="Pkg Discipline" color={readinessBg(summary.readiness.package_discipline)} />
                  <StatusIndicator value={summary.readiness.rescue_response} max={100} label="Rescue Response" color={readinessBg(summary.readiness.rescue_response)} />
                  <StatusIndicator value={summary.readiness.threat_awareness} max={100} label="Threat Aware" color={readinessBg(summary.readiness.threat_awareness)} />
                </div>
              </>
            ) : (
              <p className="text-white/30 text-sm">Awaiting data...</p>
            )}
          </div>

          {/* Metric blocks */}
          <div className="bg-[#0d1520] border border-white/10 rounded-lg p-3 grid grid-cols-2 gap-2 flex-1">
            <MetricBlock
              icon={<Crosshair size={14} />}
              value={summary?.active_missions ?? "--"}
              label="Active Msn"
              color="border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              pulse={!!summary && summary.active_missions > 0}
            />
            <MetricBlock
              icon={<Crosshair size={14} />}
              value={summary?.planning_missions ?? "--"}
              label="Planning"
              color="border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
            />
            <MetricBlock
              icon={<Shield size={14} />}
              value={summary ? `${summary.qrf_ready}/${summary.qrf_total}` : "--"}
              label="QRF Ready"
              color="border-amber-500/40 bg-amber-500/10 text-amber-300"
              pulse={!!summary && summary.qrf_ready > 0}
            />
            <MetricBlock
              icon={<Radio size={14} />}
              value={summary?.open_rescues ?? "--"}
              label="Open Rescue"
              color="border-red-500/40 bg-red-500/10 text-red-300"
              pulse={!!summary && summary.open_rescues > 0}
            />
            <MetricBlock
              icon={<Eye size={14} />}
              value={summary?.active_intel ?? "--"}
              label="Active Intel"
              color="border-violet-500/40 bg-violet-500/10 text-violet-300"
            />
            <MetricBlock
              icon={<AlertTriangle size={14} />}
              value={summary?.threat_clusters ?? "--"}
              label="Threats"
              color="border-orange-500/40 bg-orange-500/10 text-orange-300"
              pulse={!!summary && summary.threat_clusters > 0}
            />
          </div>
        </div>

        {/* Center */}
        <div className="col-span-6 bg-[#0a1018] border border-white/10 rounded-lg flex flex-col">
          {/* Status banner */}
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${summary && summary.readiness_score >= 70 ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]' : summary ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-white/20'}`} />
              <span className="text-xs uppercase tracking-[0.14em] text-white/60 font-semibold">
                {summary && summary.readiness_score >= 80 ? 'Condition Normal' :
                 summary && summary.readiness_score >= 50 ? 'Elevated Readiness' :
                 summary ? 'Reduced Readiness' : 'Initializing'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/40">
              <span className={summary && summary.compliance_violations > 0 ? 'text-amber-400 font-semibold' : ''}>
                {summary?.compliance_violations ?? 0} violations
              </span>
              <span className={summary && summary.unread_alerts > 0 ? 'text-cyan-400 font-semibold' : ''}>
                {summary?.unread_alerts ?? 0} unread
              </span>
            </div>
          </div>

          {/* Center visualization */}
          <div className="flex-1 flex items-center justify-center relative">
            {summary ? (
              <div className="relative w-80 h-80">
                {/* Concentric rings */}
                {[100, 75, 50, 25].map((ring) => (
                  <div
                    key={ring}
                    className="absolute rounded-full border border-white/[0.08]"
                    style={{
                      width: `${ring}%`,
                      height: `${ring}%`,
                      left: `${(100 - ring) / 2}%`,
                      top: `${(100 - ring) / 2}%`,
                    }}
                  />
                ))}

                {/* Axis lines */}
                <div className="absolute top-0 left-1/2 w-px h-full bg-white/[0.06]" />
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/[0.06]" />

                {/* Quadrant labels */}
                <span className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-emerald-400/70 font-semibold">QRF</span>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-cyan-400/70 font-semibold">Rescue</span>
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-[10px] uppercase tracking-widest text-violet-400/70 font-semibold">Intel</span>
                <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[10px] uppercase tracking-widest text-amber-400/70 font-semibold">Package</span>

                {/* Data points */}
                <div
                  className="absolute w-4 h-4 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.6)] transition-all duration-1000"
                  style={{ left: '50%', top: `${50 - (summary.readiness.qrf_posture / 2)}%`, transform: 'translate(-50%, -50%)' }}
                />
                <div
                  className="absolute w-4 h-4 rounded-full bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.6)] transition-all duration-1000"
                  style={{ left: `${50 + (summary.readiness.package_discipline / 2)}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                />
                <div
                  className="absolute w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.6)] transition-all duration-1000"
                  style={{ left: '50%', top: `${50 + (summary.readiness.rescue_response / 2)}%`, transform: 'translate(-50%, -50%)' }}
                />
                <div
                  className="absolute w-4 h-4 rounded-full bg-violet-400 shadow-[0_0_16px_rgba(167,139,250,0.6)] transition-all duration-1000"
                  style={{ left: `${50 - (summary.readiness.threat_awareness / 2)}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                />

                {/* Center score */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <p className={`font-mono text-4xl font-bold tabular-nums ${readinessColor(summary.readiness_score)} ${readinessGlow(summary.readiness_score)}`}>
                    {summary.readiness_score}
                  </p>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 mt-1 font-semibold">Readiness</p>
                </div>

                {/* Sweep line */}
                <div
                  className="absolute top-1/2 left-1/2 w-[50%] h-px origin-left"
                  style={{
                    background: 'linear-gradient(90deg, rgba(34,211,238,0.4) 0%, transparent 100%)',
                    animation: 'sweep 8s linear infinite',
                  }}
                />
              </div>
            ) : (
              <div className="text-white/30 text-sm">Awaiting engine data...</div>
            )}
          </div>

          {/* Bottom status */}
          <div className="px-5 py-2 border-t border-white/10 flex items-center justify-between text-[10px] text-white/40">
            <span>Last tick: {summary?.timestamp ? new Date(summary.timestamp).toLocaleTimeString() : '--'}</span>
            <span>30s refresh cycle</span>
          </div>
        </div>

        {/* Right column — event feed */}
        <div className="col-span-3 bg-[#0d1520] border border-white/10 rounded-lg flex flex-col">
          <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/60 font-semibold">Event Feed</span>
            <span className="text-[10px] tabular-nums text-white/30 font-mono">{events.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {events.length === 0 ? (
              <p className="text-xs text-white/20 px-4 py-6">No events yet...</p>
            ) : (
              events.map((event, i) => <EventLine key={`${i}-${event.title}`} event={event} idx={i} />)
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
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
