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

/** Convert a score (0-100) on a given axis to SVG coordinates.
 *  Axes: 0=top(QRF), 1=right(Package), 2=bottom(Rescue), 3=left(Intel) */
function scoreToPoint(axisIndex: number, score: number, cx: number, cy: number, radius: number): [number, number] {
  // Angles: top=-90, right=0, bottom=90, left=180
  const angles = [-90, 0, 90, 180];
  const rad = (angles[axisIndex] * Math.PI) / 180;
  const r = (score / 100) * radius;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function ReadinessRadar({ readiness, score }: { readiness: OpsSummary["readiness"]; score: number }) {
  const cx = 150, cy = 150, maxR = 120;
  const scores = [
    readiness.qrf_posture,
    readiness.package_discipline,
    readiness.rescue_response,
    readiness.threat_awareness,
  ];
  const labels = ["QRF", "PKG", "RESCUE", "INTEL"];
  const colors = ["#34d399", "#fbbf24", "#22d3ee", "#a78bfa"];

  // Build polygon points
  const polyPoints = scores.map((s, i) => scoreToPoint(i, s, cx, cy, maxR));
  const polyStr = polyPoints.map(([x, y]) => `${x},${y}`).join(" ");

  // Grid ring percentages
  const rings = [25, 50, 75, 100];

  const scoreColor = score >= 80 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171";

  return (
    <svg viewBox="0 0 300 300" className="w-72 h-72">
      {/* Grid rings */}
      {rings.map((pct) => (
        <circle
          key={pct}
          cx={cx}
          cy={cy}
          r={(pct / 100) * maxR}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}

      {/* Ring labels */}
      {rings.map((pct) => (
        <text
          key={`lbl-${pct}`}
          x={cx + 4}
          y={cy - (pct / 100) * maxR + 3}
          fill="rgba(255,255,255,0.2)"
          fontSize="8"
          fontFamily="monospace"
        >
          {pct}
        </text>
      ))}

      {/* Axis lines */}
      <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

      {/* Filled polygon */}
      <polygon
        points={polyStr}
        fill="rgba(34,211,238,0.12)"
        stroke="rgba(34,211,238,0.6)"
        strokeWidth="2"
        className="transition-all duration-1000"
      />

      {/* Score dots on each axis */}
      {polyPoints.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5" fill={colors[i]} opacity="0.9" />
          <circle cx={x} cy={y} r="5" fill="none" stroke={colors[i]} strokeWidth="1" opacity="0.4">
            <animate attributeName="r" from="5" to="14" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
          </circle>
        </g>
      ))}

      {/* Axis labels + score values */}
      {[
        { x: cx, y: 16, anchor: "middle", label: labels[0], score: scores[0], color: colors[0] },
        { x: 290, y: cy + 4, anchor: "end", label: labels[1], score: scores[1], color: colors[1] },
        { x: cx, y: 294, anchor: "middle", label: labels[2], score: scores[2], color: colors[2] },
        { x: 10, y: cy + 4, anchor: "start", label: labels[3], score: scores[3], color: colors[3] },
      ].map((a, i) => (
        <g key={`axis-${i}`}>
          <text
            x={a.x}
            y={a.y}
            textAnchor={a.anchor}
            fill={a.color}
            fontSize="10"
            fontFamily="monospace"
            fontWeight="600"
            letterSpacing="0.1em"
            opacity="0.8"
          >
            {a.label}
          </text>
          <text
            x={a.x}
            y={a.y + 12}
            textAnchor={a.anchor}
            fill={a.color}
            fontSize="9"
            fontFamily="monospace"
            opacity="0.5"
          >
            {a.score}%
          </text>
        </g>
      ))}

      {/* Center score */}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fill={scoreColor}
        fontSize="28"
        fontFamily="monospace"
        fontWeight="bold"
      >
        {score}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        fill="rgba(255,255,255,0.3)"
        fontSize="8"
        fontFamily="monospace"
        letterSpacing="0.2em"
      >
        READINESS
      </text>

      {/* Sweep line */}
      <line
        x1={cx}
        y1={cy}
        x2={cx + maxR}
        y2={cy}
        stroke="rgba(34,211,238,0.3)"
        strokeWidth="1"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from={`0 ${cx} ${cy}`}
          to={`360 ${cx} ${cy}`}
          dur="8s"
          repeatCount="indefinite"
        />
      </line>
    </svg>
  );
}

export function TacticalBoard({ session }: { session: SessionInfo }) {
  const [summary, setSummary] = useState<OpsSummary | null>(null);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set clock on mount to avoid hydration mismatch
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
          <span className="text-xs tabular-nums text-white/50 font-mono" suppressHydrationWarning>
            {clock ? clock.toISOString().replace("T", " ").slice(0, 19) + "Z" : "--"}
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

          {/* Center visualization — spider/radar chart */}
          <div className="flex-1 flex items-center justify-center relative">
            {summary ? (
              <ReadinessRadar readiness={summary.readiness} score={summary.readiness_score} />
            ) : (
              <div className="text-white/30 text-sm">Awaiting engine data...</div>
            )}
          </div>

          {/* Bottom status */}
          <div className="px-5 py-2 border-t border-white/10 flex items-center justify-between text-[10px] text-white/40">
            <span suppressHydrationWarning>Last tick: {summary?.timestamp ? new Date(summary.timestamp).toLocaleTimeString() : '--'}</span>
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
