"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Crosshair,
  Radio,
  AlertTriangle,
  Bell,
  Eye,
  ShieldCheck,
  RefreshCw,
  LogOut,
  KeyRound,
  Download,
} from "lucide-react";

type Stats = {
  ok: boolean;
  org: { id: string; name: string; tag: string };
  users: { active: number; pending: number; disabled: number; total: number; totpEnabled: number };
  missions: Record<string, number>;
  intel: { active: number };
  rescues: { open: number };
  incidents: { open: number };
  notifications: { unread: number };
  recentActivity: { action: string; targetType: string; actor: string; at: string }[];
};

function StatCard({
  label,
  value,
  icon,
  colorClass,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  colorClass: string;
  sub?: string;
}) {
  return (
    <div className={`rounded-[var(--radius-lg)] border ${colorClass} px-4 py-3`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.14em] text-inherit opacity-80">{label}</p>
        <span className="opacity-60">{icon}</span>
      </div>
      <p className="mt-1 font-[family:var(--font-display)] text-2xl uppercase tracking-[0.08em] text-[var(--color-text-strong)] tabular-nums">
        {typeof value === "number" ? value.toString().padStart(2, "0") : value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] opacity-60">{sub}</p>}
    </div>
  );
}

function ActionLabel({ action }: { action: string }) {
  const colors: Record<string, string> = {
    login: "text-emerald-300",
    login_totp: "text-emerald-300",
    create: "text-cyan-300",
    update: "text-amber-300",
    delete: "text-red-300",
    revoke_sessions: "text-red-300",
    admin_reset_totp: "text-amber-300",
    totp_enabled: "text-emerald-300",
    totp_disabled: "text-amber-300",
    export_audit_logs: "text-cyan-300",
  };
  return (
    <span className={`font-mono text-[11px] ${colors[action] ?? "text-[var(--color-text-secondary)]"}`}>
      {action}
    </span>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-[var(--color-text-tertiary)]">
        Loading dashboard...
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
        Failed to load dashboard: {error}
      </div>
    );
  }

  if (!stats) return null;

  const totalMissions = Object.values(stats.missions).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
            {stats.org.tag} / {stats.org.name}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Personnel"
          value={stats.users.total}
          icon={<Users size={14} />}
          colorClass="border-cyan-500/20 bg-cyan-500/8 text-cyan-200"
          sub={`${stats.users.active} active, ${stats.users.pending} pending, ${stats.users.disabled} disabled`}
        />
        <StatCard
          label="Missions"
          value={totalMissions}
          icon={<Crosshair size={14} />}
          colorClass="border-emerald-500/20 bg-emerald-500/8 text-emerald-200"
          sub={Object.entries(stats.missions).map(([k, v]) => `${v} ${k}`).join(", ")}
        />
        <StatCard
          label="Open Rescues"
          value={stats.rescues.open}
          icon={<Radio size={14} />}
          colorClass="border-amber-500/20 bg-amber-500/8 text-amber-200"
        />
        <StatCard
          label="Open Incidents"
          value={stats.incidents.open}
          icon={<AlertTriangle size={14} />}
          colorClass="border-red-500/20 bg-red-500/8 text-red-200"
        />
      </div>

      {/* Secondary stats row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Active Intel"
          value={stats.intel.active}
          icon={<Eye size={14} />}
          colorClass="border-violet-500/20 bg-violet-500/8 text-violet-200"
        />
        <StatCard
          label="Unread Alerts"
          value={stats.notifications.unread}
          icon={<Bell size={14} />}
          colorClass="border-orange-500/20 bg-orange-500/8 text-orange-200"
        />
        <StatCard
          label="MFA Enabled"
          value={`${stats.users.totpEnabled} / ${stats.users.total}`}
          icon={<ShieldCheck size={14} />}
          colorClass="border-emerald-500/20 bg-emerald-500/8 text-emerald-200"
          sub={stats.users.totpEnabled === stats.users.total ? "All users protected" : `${stats.users.total - stats.users.totpEnabled} without MFA`}
        />
      </div>

      {/* Bottom row: activity + quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <div className="lg:col-span-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4">
          <p className="mb-3 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Recent Activity</p>
          <div className="space-y-1.5">
            {stats.recentActivity.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[11px] hover:bg-white/3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ActionLabel action={a.action} />
                  <span className="text-[var(--color-text-secondary)] truncate">{a.targetType}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[10px] text-cyan-300/70">{a.actor}</span>
                  <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                    {new Date(a.at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4">
          <p className="mb-3 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Quick Actions</p>
          <div className="space-y-2">
            <a
              href="/api/admin/audit-logs/export?format=csv"
              className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/3 px-3 py-2 text-[11px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text-strong)]"
            >
              <Download size={13} /> Export Audit Logs (CSV)
            </a>
            <a
              href="/api/admin/audit-logs/export?format=json"
              className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/3 px-3 py-2 text-[11px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text-strong)]"
            >
              <Download size={13} /> Export Audit Logs (JSON)
            </a>
            <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5 text-[10px] text-[var(--color-text-tertiary)]">
              <p className="flex items-center gap-1.5"><LogOut size={11} /> Force-logout &amp; TOTP reset available per-user below</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
