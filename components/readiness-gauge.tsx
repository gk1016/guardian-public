"use client";

import { useEngine } from "@/lib/engine-context";

const scoreColor = (score: number) => {
  if (score >= 75) return { text: "text-emerald-400", bg: "bg-emerald-400", border: "border-emerald-400/20", fill: "#34d399" };
  if (score >= 50) return { text: "text-amber-400", bg: "bg-amber-400", border: "border-amber-400/20", fill: "#fbbf24" };
  return { text: "text-red-500", bg: "bg-red-500", border: "border-red-500/20", fill: "#ef4444" };
};

const subScoreBar = (label: string, value: number, weight: string) => {
  const colors = scoreColor(value);
  return (
    <div key={label} className="flex items-center gap-3">
      <div className="w-24 flex-shrink-0">
        <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">{label}</p>
        <p className="text-[9px] text-[var(--color-text-faint)]">{weight}</p>
      </div>
      <div className="flex-1">
        <div className="h-1.5 rounded-full bg-[var(--color-overlay-subtle)]">
          <div
            className={`h-1.5 rounded-full ${colors.bg} transition-all duration-700`}
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
      <span className={`w-8 text-right font-[family:var(--font-display)] text-xs ${colors.text}`}>
        {value}
      </span>
    </div>
  );
};

type ReadinessGaugeProps = {
  initialScore?: number;
};

export function ReadinessGauge({ initialScore }: ReadinessGaugeProps) {
  const { opsSummary } = useEngine();

  const score = opsSummary?.readiness_score ?? initialScore ?? 0;
  const breakdown = opsSummary?.readiness;
  const live = opsSummary !== null;
  const colors = scoreColor(score);

  // SVG arc for the gauge
  const radius = 52;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference - (score / 100) * circumference;

  const statusLabel =
    score >= 85 ? "OPTIMAL" :
    score >= 75 ? "READY" :
    score >= 50 ? "DEGRADED" :
    score >= 25 ? "IMPAIRED" :
    "CRITICAL";

  return (
    <div className={`rounded-[var(--radius-lg)] border ${colors.border} bg-[var(--color-panel)] p-5 panel-elevated`}>
      <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-6">
        <div className="relative flex-shrink-0">
          <svg width="130" height="75" viewBox="0 0 130 75" className="overflow-visible">
            {/* Background arc */}
            <path
              d="M 10 70 A 52 52 0 0 1 120 70"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Score arc */}
            <path
              d="M 10 70 A 52 52 0 0 1 120 70"
              fill="none"
              stroke={colors.fill}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={`${offset}`}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <p className={`font-[family:var(--font-display)] text-3xl tracking-[0.06em] ${colors.text}`}>
              {score}
            </p>
          </div>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.12em] text-[var(--color-text-strong)]">
              Readiness: {statusLabel}
            </p>
            {live ? (
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">Live</span>
              </span>
            ) : null}
          </div>
          {breakdown ? (
            <div className="mt-3 flex flex-col gap-2">
              {subScoreBar("QRF Posture", breakdown.qrf_posture, "30% weight")}
              {subScoreBar("Discipline", breakdown.package_discipline, "25% weight")}
              {subScoreBar("Rescue", breakdown.rescue_response, "20% weight")}
              {subScoreBar("Awareness", breakdown.threat_awareness, "25% weight")}
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-[var(--color-text-tertiary)]">Waiting for engine tick...</p>
          )}
        </div>
      </div>
    </div>
  );
}
