"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  Filter,
  CheckCheck,
  Check,
  Radio,
  AlertTriangle,
  Info,
  AlertOctagon,
  LoaderCircle,
} from "lucide-react";
import { useEngine } from "@/lib/engine-context";

type NotificationItem = {
  id: string;
  category: string;
  severity: string;
  title: string;
  body: string;
  href: string | null;
  status: string;
  createdAt: string;
  acknowledgedAt: string | null;
};

type Stats = {
  total: number;
  unread: number;
  acknowledged: number;
  bySeverity: {
    info: number;
    warning: number;
    critical: number;
  };
};

type NotificationCenterProps = {
  initialItems: NotificationItem[];
  initialStats: Stats;
  canCreate: boolean;
};

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

const severityBadge: Record<string, string> = {
  info: "border-cyan-400/20 bg-cyan-400/8 text-cyan-200",
  warning: "border-amber-400/20 bg-amber-400/8 text-amber-200",
  critical: "border-red-500/20 bg-red-500/8 text-red-200",
};

const SeverityIcon = ({ severity }: { severity: string }) => {
  if (severity === "critical") return <AlertOctagon size={13} className="text-red-400" />;
  if (severity === "warning") return <AlertTriangle size={13} className="text-amber-400" />;
  return <Info size={13} className="text-cyan-400" />;
};

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type CategoryFilter = "all" | "ops" | "intel" | "admin" | "rescue" | "rule" | "maintenance";
type SeverityFilter = "all" | "info" | "warning" | "critical";
type StatusFilter = "all" | "unread" | "acknowledged";

export function NotificationCenter({ initialItems, initialStats, canCreate }: NotificationCenterProps) {
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [timeLabels, setTimeLabels] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [ackingIds, setAckingIds] = useState<Set<string>>(new Set());
  const { subscribeAlerts, connectionState } = useEngine();

  // Relative timestamps
  useEffect(() => {
    function updateLabels() {
      const labels: Record<string, string> = {};
      for (const item of items) {
        labels[item.id] = formatEventTime(item.createdAt);
      }
      setTimeLabels(labels);
    }
    updateLabels();
    const interval = setInterval(updateLabels, 15000);
    return () => clearInterval(interval);
  }, [items]);

  // Real-time WS alerts
  const handleAlert = useCallback((event: Record<string, unknown>) => {
    const type = event.type as string;
    if (type === "notification" || type === "alert") {
      const newItem: NotificationItem = {
        id: (event.id as string) ?? `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: (event.category as string) ?? "ops",
        severity: (event.severity as string) ?? "info",
        title: (event.title as string) ?? type,
        body: (event.body as string) ?? (event.message as string) ?? "",
        href: (event.href as string) ?? null,
        status: "unread",
        createdAt: new Date().toISOString(),
        acknowledgedAt: null,
      };
      setItems((prev) => [newItem, ...prev].slice(0, 100));
      setStats((prev) => ({
        ...prev,
        total: prev.total + 1,
        unread: prev.unread + 1,
        bySeverity: {
          ...prev.bySeverity,
          [newItem.severity]: (prev.bySeverity[newItem.severity as keyof typeof prev.bySeverity] ?? 0) + 1,
        },
      }));
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeAlerts(handleAlert);
    return unsub;
  }, [subscribeAlerts, handleAlert]);

  // Acknowledge single
  function handleAck(id: string) {
    setAckingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "acknowledged" }),
      });
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: "acknowledged", acknowledgedAt: new Date().toISOString() }
            : item,
        ),
      );
      setStats((prev) => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
        acknowledged: prev.acknowledged + 1,
      }));
      setAckingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }

  // Bulk acknowledge
  function handleBulkAck() {
    const unreadIds = filtered.filter((i) => i.status === "unread").map((i) => i.id);
    if (unreadIds.length === 0) return;
    startTransition(async () => {
      await fetch("/api/notifications/bulk-acknowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds }),
      });
      setItems((prev) =>
        prev.map((item) =>
          unreadIds.includes(item.id)
            ? { ...item, status: "acknowledged", acknowledgedAt: new Date().toISOString() }
            : item,
        ),
      );
      setStats((prev) => ({
        ...prev,
        unread: Math.max(0, prev.unread - unreadIds.length),
        acknowledged: prev.acknowledged + unreadIds.length,
      }));
    });
  }

  // Filtered view
  const filtered = items.filter((item) => {
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (severityFilter !== "all" && item.severity !== severityFilter) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    return true;
  });

  const unreadInView = filtered.filter((i) => i.status === "unread").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Total</p>
          <p className="text-lg font-semibold text-[var(--color-text-strong)]">{stats.total}</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-amber-400/15 bg-amber-400/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Unread</p>
          <p className="text-lg font-semibold text-[var(--color-accent)]">{stats.unread}</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-red-500/15 bg-red-500/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Critical</p>
          <p className="text-lg font-semibold text-red-400">{stats.bySeverity.critical}</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-amber-400/15 bg-amber-400/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Warning</p>
          <p className="text-lg font-semibold text-[var(--color-accent)]">{stats.bySeverity.warning}</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-cyan-400/15 bg-cyan-400/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Info</p>
          <p className="text-lg font-semibold text-cyan-300">{stats.bySeverity.info}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <Radio size={14} className={connectionState === "connected" ? "text-emerald-400" : "text-[var(--color-text-faint)]"} />
            <span>{filtered.length} alerts</span>
            {connectionState === "connected" ? (
              <span className="rounded-[var(--radius-sm)] border border-emerald-400/20 bg-emerald-400/8 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-emerald-300">Live</span>
            ) : null}
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1">
            <Filter size={12} className="text-[var(--color-text-tertiary)]" />
            {(["all", "ops", "intel", "rule", "rescue", "admin"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setCategoryFilter(f)}
                className={`rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] transition ${
                  categoryFilter === f
                    ? "bg-[var(--color-overlay-strong)] text-[var(--color-text-strong)]"
                    : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-strong)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Severity filter */}
          <div className="flex items-center gap-1">
            {(["all", "critical", "warning", "info"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSeverityFilter(f)}
                className={`rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] transition ${
                  severityFilter === f
                    ? "bg-[var(--color-overlay-strong)] text-[var(--color-text-strong)]"
                    : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-strong)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1">
            {(["all", "unread", "acknowledged"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] transition ${
                  statusFilter === f
                    ? "bg-[var(--color-overlay-strong)] text-[var(--color-text-strong)]"
                    : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-strong)]"
                }`}
              >
                {f === "acknowledged" ? "ack" : f}
              </button>
            ))}
          </div>

          {/* Bulk acknowledge */}
          {unreadInView > 0 ? (
            <button
              onClick={handleBulkAck}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-amber-400/20 bg-amber-400/8 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-amber-200 transition hover:bg-amber-400/15 disabled:opacity-50"
            >
              {isPending ? <LoaderCircle size={12} className="animate-spin" /> : <CheckCheck size={12} />}
              Ack all ({unreadInView})
            </button>
          ) : null}
        </div>
      </div>

      {/* Notification list */}
      <div className="space-y-1.5">
        {filtered.map((item) => (
          <div
            key={item.id}
            className={`group flex items-start gap-3 rounded-[var(--radius-md)] border bg-white/2 px-4 py-3 transition hover:bg-[var(--color-overlay-subtle)] ${
              severityBorder[item.severity] ?? "border-[var(--color-border)]"
            } ${item.status === "acknowledged" ? "opacity-60" : ""}`}
          >
            <div className="mt-1.5 flex-shrink-0">
              <div className={`h-2 w-2 rounded-full ${severityIndicator[item.severity] ?? "bg-slate-500"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityIcon severity={item.severity} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-200">
                  {item.category}
                </span>
                <span className={`rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] ${severityBadge[item.severity] ?? severityBadge.info}`}>
                  {item.severity}
                </span>
                {item.status === "unread" ? (
                  <span className="rounded-[var(--radius-sm)] border border-amber-400/20 bg-amber-400/8 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-amber-200">unread</span>
                ) : (
                  <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">ack</span>
                )}
                <span className="ml-auto text-[10px] text-[var(--color-text-faint)]">
                  {timeLabels[item.id] ?? formatEventTime(item.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-[var(--color-text-strong)]">{item.title}</p>
              <p className="mt-0.5 text-sm leading-6 text-[var(--color-text-secondary)]">{item.body}</p>
              {item.acknowledgedAt ? (
                <span className="mt-1 inline-block text-[10px] text-[var(--color-text-faint)]">
                  Acknowledged {formatEventTime(item.acknowledgedAt)}
                </span>
              ) : null}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5 pt-1">
              {item.href ? (
                <Link
                  href={item.href}
                  className="rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/8 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-cyan-200 opacity-0 transition group-hover:opacity-100 hover:bg-cyan-400/15"
                >
                  Open
                </Link>
              ) : null}
              {item.status === "unread" ? (
                <button
                  onClick={() => handleAck(item.id)}
                  disabled={ackingIds.has(item.id)}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border-bright)] bg-[var(--color-overlay-subtle)] p-1.5 text-[var(--color-text-secondary)] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--color-overlay-strong)] hover:text-[var(--color-text-strong)] disabled:opacity-50"
                  title="Acknowledge"
                >
                  {ackingIds.has(item.id) ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-4 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
            No alerts match the current filters.
          </div>
        ) : null}
      </div>
    </div>
  );
}
