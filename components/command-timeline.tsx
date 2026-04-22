"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Radio, ArrowUpRight } from "lucide-react";
import { useEngine } from "@/lib/engine-context";

type TimelineEvent = {
  id: string;
  category: string;
  severity: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
};

type CommandTimelineProps = {
  initialEvents: TimelineEvent[];
};

const severityDot: Record<string, string> = {
  info: "bg-cyan-400",
  warning: "bg-amber-400",
  critical: "bg-red-500",
};

const severityText: Record<string, string> = {
  info: "text-cyan-300",
  warning: "text-[var(--color-accent)]",
  critical: "text-red-400",
};

const categoryAbbrev: Record<string, string> = {
  ops: "OPS",
  intel: "INTEL",
  mission: "MSN",
  rescue: "CSAR",
  qrf: "QRF",
  admin: "ADMIN",
  rule: "RULE",
  incident: "INC",
  maintenance: "MAINT",
};

function formatCompactTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CommandTimeline({ initialEvents }: CommandTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents);
  const [timeLabels, setTimeLabels] = useState<Record<string, string>>({});
  const { subscribeAlerts, connectionState } = useEngine();

  useEffect(() => {
    function updateLabels() {
      const labels: Record<string, string> = {};
      for (const ev of events) {
        labels[ev.id] = formatCompactTime(ev.createdAt);
      }
      setTimeLabels(labels);
    }
    updateLabels();
    const interval = setInterval(updateLabels, 15000);
    return () => clearInterval(interval);
  }, [events]);

  const handleAlert = useCallback((event: Record<string, unknown>) => {
    const type = event.type as string;
    if (!type) return;
    if (type === "notification" || type === "alert" || type === "mission_status") {
      const newEvent: TimelineEvent = {
        id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: (event.category as string) ?? (type === "mission_status" ? "mission" : "ops"),
        severity: (event.severity as string) ?? "info",
        title: (event.title as string) ?? (event.message as string) ?? type,
        body: (event.body as string) ?? "",
        href: (event.href as string) ?? null,
        createdAt: new Date().toISOString(),
      };
      setEvents((prev) => [newEvent, ...prev].slice(0, 20));
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeAlerts(handleAlert);
    return unsub;
  }, [subscribeAlerts, handleAlert]);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-4 panel-elevated">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2.5">
        <div className="flex items-center gap-2">
          <Radio size={14} className={connectionState === "connected" ? "text-emerald-400" : "text-[var(--color-text-faint)]"} />
          <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Command Log</p>
          {connectionState === "connected" ? (
            <span className="rounded-[var(--radius-sm)] border border-emerald-400/20 bg-emerald-400/8 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-emerald-300">Live</span>
          ) : null}
        </div>
        <Link
          href="/notifications"
          className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-strong)]"
        >
          View all
        </Link>
      </div>

      <div className="mt-2.5 space-y-0.5">
        {events.map((event) => (
          <div
            key={event.id}
            className="group flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 transition hover:bg-[var(--color-overlay-subtle)]"
          >
            <div className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${severityDot[event.severity] ?? "bg-slate-500"}`} />
            <span className="w-7 flex-shrink-0 text-right text-[10px] tabular-nums text-[var(--color-text-faint)]">
              {timeLabels[event.id] ?? formatCompactTime(event.createdAt)}
            </span>
            <span className={`w-14 flex-shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] ${severityText[event.severity] ?? "text-[var(--color-text-secondary)]"}`}>
              {categoryAbbrev[event.category] ?? event.category.toUpperCase().slice(0, 5)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-slate-300">
              {event.title}
            </span>
            {event.href ? (
              <Link
                href={event.href}
                className="flex-shrink-0 text-[var(--color-text-faint)] opacity-0 transition group-hover:opacity-100 hover:text-[var(--color-text-strong)]"
              >
                <ArrowUpRight size={12} />
              </Link>
            ) : null}
          </div>
        ))}
        {events.length === 0 ? (
          <p className="py-3 text-center text-[11px] text-[var(--color-text-faint)]">No recent activity.</p>
        ) : null}
      </div>
    </div>
  );
}
