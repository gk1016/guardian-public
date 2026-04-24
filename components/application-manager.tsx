"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";

type Application = {
  id: string;
  handle: string;
  name: string;
  email: string | null;
  message: string;
  status: string;
  notes: string | null;
  createdAt: string;
};

export function ApplicationManager() {
  const [apps, setApps] = useState<Application[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [updating, setUpdating] = useState<string | null>(null);

  async function loadApps(status?: string) {
    setLoading(true);
    try {
      const url = status
        ? `/api/admin/applications?status=${status}`
        : "/api/admin/applications";
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) {
        setApps(data.items);
        setPendingCount(data.pendingCount);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  useEffect(() => {
    loadApps(filter === "all" ? undefined : filter);
  }, [filter]);

  async function updateApp(id: string, status: string) {
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.ok) {
        await loadApps(filter === "all" ? undefined : filter);
      }
    } catch {
      /* ignore */
    }
    setUpdating(null);
  }

  const statusIcon = (s: string) => {
    if (s === "approved")
      return <CheckCircle size={13} className="text-emerald-400" />;
    if (s === "rejected")
      return <XCircle size={13} className="text-red-400" />;
    return <Clock size={13} className="text-amber-400" />;
  };

  return (
    <div className="space-y-4">
      {/* Filter + count */}
      <div className="flex items-center justify-between">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-text)] focus:outline-none"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
            {pendingCount} pending
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-[var(--color-text-tertiary)]">
          <Loader2 size={14} className="animate-spin" />
          Loading applications...
        </div>
      ) : apps.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--color-text-tertiary)]">
          No applications found.
        </p>
      ) : (
        <div className="space-y-2">
          {apps.map((app) => (
            <div
              key={app.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {statusIcon(app.status)}
                    <span className="text-sm font-medium text-[var(--color-text-strong)]">
                      {app.handle}
                    </span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      {app.name}
                    </span>
                  </div>
                  {app.email && (
                    <p className="mt-1 text-[11px] text-[var(--color-text-faint)]">
                      {app.email}
                    </p>
                  )}
                  {app.message && (
                    <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                      {app.message}
                    </p>
                  )}
                  <p className="mt-2 text-[10px] text-[var(--color-text-faint)]">
                    {new Date(app.createdAt).toLocaleDateString()}{" "}
                    {new Date(app.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                {app.status === "pending" && (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => updateApp(app.id, "approved")}
                      disabled={updating === app.id}
                      className="rounded-[var(--radius-md)] border border-emerald-500/30 px-3 py-1.5 text-[11px] font-medium text-emerald-400 transition hover:bg-emerald-500/10 disabled:opacity-50"
                    >
                      {updating === app.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        "Approve"
                      )}
                    </button>
                    <button
                      onClick={() => updateApp(app.id, "rejected")}
                      disabled={updating === app.id}
                      className="rounded-[var(--radius-md)] border border-red-500/30 px-3 py-1.5 text-[11px] font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
