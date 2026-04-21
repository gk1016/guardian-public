"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Radio, Filter, ArrowUpRight } from "lucide-react";
import { useEngine } from "@/lib/engine-context";
import type { SitrepEvent } from "@/lib/sitrep-data";

const severityIndicator: Record<string, string> = {
  info: "bg-cyan-400",
  warning: "bg-amber-400",
  critical: "bg-red-500",
};

const severityBorder: Record<string, string> = {
  info: "border-cyan-400/15",
  warning: "border-amber-400/15",
  critical: "border-red-500/20",
};

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type SitrepFeedProps = {
  initialEvents: SitrepEvent[];
};

export function SitrepFeed({ initialEvents }: SitrepFeedProps) {
  const [events, setEvents] = useState<SitrepEvent[]>(initialEvents);
  const [filter, setFilter] = useState<"all" | "mission" | "alert">("all");
  const [timeLabels, setTimeLabels] = useState<Record<string, string>>({});
  const { subscribeAlerts, connectionState } = useEngine();

  // Update relative timestamps every 15s
  useEffect(() => {
    function updateLabels() {
      const labels: Record<string, string> = {};
      for (const ev of events) {
        labels[ev.id] = formatEventTime(ev.timestamp);
      }
      setTimeLabels(labels);
    }
    updateLabels();
    const interval = setInterval(updateLabels, 15000);
    return () => clearInterval(interval);
  }, [events]);

  // Subscribe to live WS events and prepend to feed
  const handleAlert = useCallback((event: Record<string, unknown>) => {
    const type = event.type as string;
    if (!type) return;

    // Convert WS alert events into SITREP events
    if (type === "notification" || type === "alert") {
      const newEvent: SitrepEvent = {
        id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source: "alert",
        timestamp: new Date().toISOString(),
        title: (event.title as string) ?? type,
        body: (event.body as string) ?? (event.message as string) ?? "",
        severity: (event.severity as "info" | "warning" | "critical") ?? "info",
        category: (event.category as string) ?? "ops",
        href: (event.href as string) ?? null,
        missionCallsign: null,
        authorDisplay: "engine",
      };
      setEvents((prev) => [newEvent, ...prev].slice(0, 60));
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeAlerts(handleAlert);
    return unsub;
  }, [subscribeAlerts, handleAlert]);

  const filtered = filter === "all" ? events : events.filter((e) => e.source === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Radio size={14} className={connectionState === "connected" ? "text-emerald-400" : "text-slate-600"} />
          <span>{filtered.length} events</span>
          {connectionState === "connected" ? (
            <span className="rounded-[var(--radius-sm)] border border-emerald-400/20 bg-emerald-400/8 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-emerald-300">Live</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Filter size={12} className="text-slate-500" />
          {(["all", "mission", "alert"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] transition ${
                filter === f
                  ? "bg-white/10 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {filtered.map((event) => (
          <div
            key={event.id}
            className={`group flex items-start gap-3 rounded-[var(--radius-md)] border bg-white/2 px-4 py-3 transition hover:bg-white/4 ${severityBorder[event.severity] ?? "border-[var(--color-border)]"}`}
          >
            <div className="mt-1.5 flex-shrink-0">
              <div className={`h-2 w-2 rounded-full ${severityIndicator[event.severity] ?? "bg-slate-500"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-200">
                  {event.source === "mission" ? event.missionCallsign ?? "MISSION" : event.category}
                </span>
                <span className="text-[10px] uppercase tracking-[0.1em] text-slate-600">{event.category}</span>
                <span className="ml-auto text-[10px] text-slate-600">
                  {timeLabels[event.id] ?? formatEventTime(event.timestamp)}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-white">{event.title}</p>
              <p className="mt-0.5 text-sm leading-6 text-slate-400">{event.body}</p>
              {event.authorDisplay ? (
                <span className="mt-1 inline-block text-[10px] text-slate-600">{event.authorDisplay}</span>
              ) : null}
            </div>
            {event.href ? (
              <Link
                href={event.href}
                className="mt-1 flex-shrink-0 rounded-[var(--radius-sm)] p-1 text-slate-600 opacity-0 transition group-hover:opacity-100 hover:text-white"
              >
                <ArrowUpRight size={14} />
              </Link>
            ) : null}
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-4 py-6 text-center text-sm text-slate-500">
            No events match the current filter.
          </div>
        ) : null}
      </div>
    </div>
  );
}
