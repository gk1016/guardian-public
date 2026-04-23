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
  ChevronRight,
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
      <div className="w-24 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-white/40 w-8 text-right">{pct}%</span>
      <span className="text-[10px] text-white/30">{label}</span>
    </div>
  );
}

function MetricBlock({ icon, value, label, color, pulse }: { icon: React.ReactNode; value: string | number; label: string; color: string; pulse?: boolean }) {
  return (
    <div className={`rounded border ${color} px-3 py-2 relative`}>
      {pulse && (
        <span className="absolute top-1.5 right-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
        </span>
      )}
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[9px] uppercase tracking-[0.16em] opacity-70">{label}</span>
      </div>
      <p className="font-mono text-xl tabular-nums tracking-wide">
        {typeof value === "number" ? value.toString().padStart(2, "0") : value}
      </p>
    </div>
  );
}

function EventLine({ event, idx }: { event: AlertEvent; idx: number }) {
  const severityColor = {
    critical: "text-red-400",
    warning: "text-amber-400",
    info: "text-cyan-400",
  }[event.severity] || "text-white/50";

  const categoryIcon = {
    compliance: <Shield size={10} />,
    threat: <AlertTriangle size={10} />,
    ops: <Crosshair size={10} />,
    alert_rule: <Zap size={10} />,
  }[event.category] || <Activity size={10} />;

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 text-[10px] ${severityColor} animate-fade-in`}
      style={{ animationDelay: `${idx * 50}ms` }}
    >
      {categoryIcon}
      <span className="truncate flex-1 opacity-90">{event.title}</span>
      {event.callsign && (
        <span className="font-mono text-[9px] opacity-50">{event.callsign}</span>
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

  // Clock
  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket connection
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

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: "'IBM Plex Mono', 'Courier New', monospace" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/80">Guardian</span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-white/20">Tactical Overview</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {connected ? (
              <><Wifi size={11} className="text-emerald-400" /><span className="text-[9px] uppercase tracking-wider text-emerald-400">Live</span></>
            ) : (
              <><WifiOff size={11} className="text-red-400" /><span className="text-[9px] uppercase tracking-wider text-red-400">Offline</span></>
            )}
          </div>
          <span className="text-[10px] tabular-nums text-white/30">
            {clock.toISOString().replace("T", " ").slice(0, 19)}Z
          </span>
          <span className="text-[10px] text-cyan-400/50">{session.handle}</span>
          <button onClick={toggleFullscreen} className="text-white/20 hover:text-white/60 transition-colors">
            {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-12 gap-px bg-white/[0.02] overflow-hidden">

        {/* Left column — readiness + metrics */}
        <div className="col-span-3 flex flex-col gap-px">
          {/* Readiness score */}
          <div className="bg-[#0c1018] p-4 flex-shrink-0">
            <p className="text-[9px] uppercase tracking-[0.2em] text-white/25 mb-3">Org Readiness</p>
            {summary ? (
              <>
                <div className="flex items-end gap-2 mb-4">
                  <span className={`font-mono text-5xl tabular-nums ${readinessColor(summary.readiness_score)}`}>
                    {summary.readiness_score}
                  </span>
                  <span className="text-[10px] text-white/20 mb-1">/ 100</span>
                </div>
                <div className="space-y-2">
                  <StatusIndicator value={summary.readiness.qrf_posture} max={100} label="QRF Posture" color={readinessBg(summary.readiness.qrf_posture)} />
                  <StatusIndicator value={summary.readiness.package_discipline} max={100} label="Pkg Discipline" color={readinessBg(summary.readiness.package_discipline)} />
                  <StatusIndicator value={summary.readiness.rescue_response} max={100} label="Rescue Response" color={readinessBg(summary.readiness.rescue_response)} />
                  <StatusIndicator value={summary.readiness.threat_awareness} max={100} label="Threat Aware" color={readinessBg(summary.readiness.threat_awareness)} />
                </div>
              </>
            ) : (
              <p className="text-white/10 text-xs">Awaiting data...</p>
            )}
          </div>

          {/* Metric blocks */}
          <div className="bg-[#0c1018] p-3 grid grid-cols-2 gap-2 flex-1">
            <MetricBlock
              icon={<Crosshair size={12} />}
              value={summary?.active_missions ?? "--"}
              label="Active Msn"
              color="border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
              pulse={!!summary && summary.active_missions > 0}
            />
            <MetricBlock
              icon={<Crosshair size={12} />}
              value={summary?.planning_missions ?? "--"}
              label="Planning"
              color="border-cyan-500/20 bg-cyan-500/5 text-cyan-300"
            />
            <MetricBlock
              icon={<Shield size={12} />}
              value={summary ? `${summary.qrf_ready}/${summary.qrf_total}` : "--"}
              label="QRF Ready"
              color="border-amber-500/20 bg-amber-500/5 text-amber-300"
              pulse={!!summary && summary.qrf_ready > 0}
            />
            <MetricBlock
              icon={<Radio size={12} />}
              value={summary?.open_rescues ?? "--"}
              label="Open Rescue"
              color="border-red-500/20 bg-red-500/5 text-red-300"
              pulse={!!summary && summary.open_rescues > 0}
            />
            <MetricBlock
              icon={<Eye size={12} />}
              value={summary?.active_intel ?? "--"}
              label="Active Intel"
              color="border-violet-500/20 bg-violet-500/5 text-violet-300"
            />
            <MetricBlock
              icon={<AlertTriangle size={12} />}
              value={summary?.threat_clusters ?? "--"}
              label="Threat Clusters"
              color="border-orange-500/20 bg-orange-500/5 text-orange-300"
              pulse={!!summary && summary.threat_clusters > 0}
            />
          </div>
        </div>

        {/* Center — main display area */}
        <div className="col-span-6 bg-[#080c12] flex flex-col">
          {/* Status banner */}
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${summary && summary.readiness_score >= 70 ? 'bg-emerald-400 animate-pulse' : summary ? 'bg-amber-400 animate-pulse' : 'bg-white/10'}`} />
              <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                {summary && summary.readiness_score >= 80 ? 'Condition Normal' :
                 summary && summary.readiness_score >= 50 ? 'Elevated Readiness' :
                 summary ? 'Reduced Readiness' : 'Initializing'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-white/20">
              <span>{summary?.compliance_violations ?? 0} violations</span>
              <span>{summary?.unread_alerts ?? 0} unread</span>
            </div>
          </div>

          {/* Center visualization — readiness radar */}
          <div className="flex-1 flex items-center justify-center relative">
            {summary ? (
              <div className="relative w-72 h-72">
                {/* Concentric rings */}
                {[100, 75, 50, 25].map((ring) => (
                  <div
                    key={ring}
                    className="absolute rounded-full border border-white/[0.04]"
                    style={{
                      width: `${ring}%`,
                      height: `${ring}%`,
                      left: `${(100 - ring) / 2}%`,
                      top: `${(100 - ring) / 2}%`,
                    }}
                  />
                ))}

                {/* Axis lines */}
                <div className="absolute top-0 left-1/2 w-px h-full bg-white/[0.03]" />
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/[0.03]" />

                {/* Quadrant labels */}
                <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-widest text-emerald-400/40">QRF</span>
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-widest text-cyan-400/40">Rescue</span>
                <span className="absolute top-1/2 left-2 -translate-y-1/2 text-[8px] uppercase tracking-widest text-violet-400/40">Intel</span>
                <span className="absolute top-1/2 right-2 -translate-y-1/2 text-[8px] uppercase tracking-widest text-amber-400/40">Package</span>

                {/* Data points — positioned by readiness score in each quadrant */}
                <div
                  className="absolute w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)] transition-all duration-1000"
                  style={{
                    left: '50%',
                    top: `${50 - (summary.readiness.qrf_posture / 2)}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
                <div
                  className="absolute w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)] transition-all duration-1000"
                  style={{
                    left: `${50 + (summary.readiness.package_discipline / 2)}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
                <div
                  className="absolute w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.5)] transition-all duration-1000"
                  style={{
                    left: '50%',
                    top: `${50 + (summary.readiness.rescue_response / 2)}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
                <div
                  className="absolute w-3 h-3 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.5)] transition-all duration-1000"
                  style={{
                    left: `${50 - (summary.readiness.threat_awareness / 2)}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                />

                {/* Center score */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <p className={`font-mono text-3xl tabular-nums ${readinessColor(summary.readiness_score)}`}>
                    {summary.readiness_score}
                  </p>
                  <p className="text-[8px] uppercase tracking-[0.2em] text-white/20 mt-0.5">Readiness</p>
                </div>

                {/* Sweep line animation */}
                <div
                  className="absolute top-1/2 left-1/2 w-[50%] h-px origin-left"
                  style={{
                    background: 'linear-gradient(90deg, rgba(34,211,238,0.3) 0%, transparent 100%)',
                    animation: 'sweep 8s linear infinite',
                  }}
                />
              </div>
            ) : (
              <div className="text-white/10 text-sm">Awaiting engine data...</div>
            )}
          </div>

          {/* Bottom status bar */}
          <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between text-[9px] text-white/20">
            <span>Last tick: {summary?.timestamp ? new Date(summary.timestamp).toLocaleTimeString() : '--'}</span>
            <span>30s refresh cycle</span>
          </div>
        </div>

        {/* Right column — event feed */}
        <div className="col-span-3 bg-[#0c1018] flex flex-col">
          <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/25">Event Feed</span>
            <span className="text-[9px] tabular-nums text-white/15">{events.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-[10px] text-white/10 px-3 py-4">No events yet...</p>
            ) : (
              events.map((event, i) => <EventLine key={`${i}-${event.title}`} event={event} idx={i} />)
            )}
          </div>
        </div>
      </div>

      {/* CSS animation for sweep */}
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
