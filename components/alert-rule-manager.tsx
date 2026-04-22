"use client";

import { useState, useEffect } from "react";
import { Trash2, ToggleLeft, ToggleRight } from "lucide-react";

type AlertRule = {
  id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  severity: string;
  isEnabled: boolean;
  cooldownMinutes: number;
  lastTriggeredAt: string | null;
};

const METRICS = [
  { value: "readiness_score", label: "Readiness Score" },
  { value: "qrf_ready", label: "QRF Ready Count" },
  { value: "active_missions", label: "Active Missions" },
  { value: "open_rescues", label: "Open Rescues" },
  { value: "unread_alerts", label: "Unread Alerts" },
  { value: "compliance_violations", label: "Compliance Violations" },
  { value: "threat_clusters", label: "Threat Clusters" },
  { value: "qrf_posture", label: "QRF Posture %" },
  { value: "package_discipline", label: "Package Discipline %" },
  { value: "rescue_response", label: "Rescue Response %" },
  { value: "threat_awareness", label: "Threat Awareness %" },
];

const OPERATORS = [
  { value: "lt", label: "<" },
  { value: "lte", label: "\u2264" },
  { value: "gt", label: ">" },
  { value: "gte", label: "\u2265" },
  { value: "eq", label: "=" },
];

const SEVERITIES = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

const severityTone: Record<string, string> = {
  info: "border-cyan-400/20 bg-cyan-400/8 text-cyan-200",
  warning: "border-amber-400/20 bg-amber-400/8 text-amber-200",
  critical: "border-red-500/20 bg-red-500/8 text-red-200",
};

export function AlertRuleManager() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    metric: "readiness_score",
    operator: "lt",
    threshold: "50",
    severity: "warning",
    cooldownMinutes: "60",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRules();
  }, []);

  async function fetchRules() {
    try {
      const res = await fetch("/api/alert-rules");
      const data = await res.json();
      setRules(data.rules ?? []);
    } catch {
      setError("Failed to load alert rules.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/alert-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create rule.");
        return;
      }
      setFormData({ name: "", metric: "readiness_score", operator: "lt", threshold: "50", severity: "warning", cooldownMinutes: "60" });
      setShowForm(false);
      await fetchRules();
    } catch {
      setError("Failed to create rule.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(rule: AlertRule) {
    try {
      await fetch(`/api/alert-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !rule.isEnabled }),
      });
      await fetchRules();
    } catch {
      setError("Failed to toggle rule.");
    }
  }

  async function handleDelete(ruleId: string) {
    try {
      await fetch(`/api/alert-rules/${ruleId}`, { method: "DELETE" });
      await fetchRules();
    } catch {
      setError("Failed to delete rule.");
    }
  }

  const opLabel = (op: string) => OPERATORS.find((o) => o.value === op)?.label ?? op;
  const metricLabel = (m: string) => METRICS.find((x) => x.value === m)?.label ?? m;

  if (loading) return <p className="text-sm text-[var(--color-text-tertiary)]">Loading alert rules...</p>;

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-[var(--radius-sm)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-200">{error}</div> : null}

      <button onClick={() => setShowForm(!showForm)} className="rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/8 px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-cyan-200 transition hover:bg-cyan-400/15">
        {showForm ? "Cancel" : "+ New Rule"}
      </button>

      {showForm ? (
        <form onSubmit={handleCreate} className="rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-input-bg)] p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Rule Name</span>
              <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-cyan-400/40 focus:outline-none"
                placeholder="e.g. Low QRF coverage" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Metric</span>
              <select value={formData.metric} onChange={(e) => setFormData({ ...formData, metric: e.target.value })}
                className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] focus:border-cyan-400/40 focus:outline-none">
                {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Operator</span>
              <select value={formData.operator} onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] focus:border-cyan-400/40 focus:outline-none">
                {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Threshold</span>
              <input type="number" required step="any" value={formData.threshold} onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] focus:border-cyan-400/40 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Severity</span>
              <select value={formData.severity} onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] focus:border-cyan-400/40 focus:outline-none">
                {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Cooldown (minutes)</span>
              <input type="number" required min="1" value={formData.cooldownMinutes} onChange={(e) => setFormData({ ...formData, cooldownMinutes: e.target.value })}
                className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] focus:border-cyan-400/40 focus:outline-none" />
            </label>
          </div>
          <button type="submit" disabled={submitting}
            className="rounded-[var(--radius-sm)] border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-[11px] uppercase tracking-[0.1em] text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50">
            {submitting ? "Creating..." : "Create Rule"}
          </button>
        </form>
      ) : null}

      {rules.length === 0 ? (
        <p className="text-sm text-[var(--color-text-tertiary)]">No alert rules configured. Create one to get proactive engine alerts.</p>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className={`rounded-[var(--radius-md)] border bg-[var(--color-input-bg)] p-4 ${rule.isEnabled ? "border-[var(--color-border-bright)]" : "border-[var(--color-border)] opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-[var(--color-text-strong)]">{rule.name}</p>
                  <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                    When <span className="text-[var(--color-text-strong)]">{metricLabel(rule.metric)}</span>{" "}
                    <span className="text-cyan-300">{opLabel(rule.operator)}</span>{" "}
                    <span className="text-[var(--color-text-strong)]">{rule.threshold}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] uppercase ${severityTone[rule.severity] ?? severityTone.info}`}>
                    {rule.severity}
                  </span>
                  <button onClick={() => handleToggle(rule)} className="text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-strong)]" title={rule.isEnabled ? "Disable" : "Enable"}>
                    {rule.isEnabled ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} />}
                  </button>
                  <button onClick={() => handleDelete(rule.id)} className="text-[var(--color-text-tertiary)] transition hover:text-red-400" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-4 text-[10px] text-[var(--color-text-tertiary)]">
                <span>Cooldown: {rule.cooldownMinutes}m</span>
                {rule.lastTriggeredAt ? <span>Last fired: {new Date(rule.lastTriggeredAt).toLocaleString()}</span> : <span>Never triggered</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
