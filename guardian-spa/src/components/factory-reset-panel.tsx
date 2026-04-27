import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

const ENGINE_BASE = "/engine";

export function FactoryResetPanel() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleReset() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${ENGINE_BASE}/api/admin/factory-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirm: "RESET" }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ ok: true, message: `Factory reset complete. ${data.tables_cleared} tables cleared.` });
        setShowConfirm(false);
        setConfirmText("");
      } else {
        setResult({ ok: false, message: data.error || "Reset failed." });
      }
    } catch {
      setResult({ ok: false, message: "Failed to reach engine." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-200">Factory Reset</p>
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              Permanently deletes all operational data: missions, intel, QRF, rescues, incidents,
              notifications, alert rules, AI analyses, audit logs, federation data, and Discord configuration.
              Preserves your organization, user accounts, manual entries, and doctrine.
            </p>
          </div>
        </div>
      </div>

      {result && (
        <div className={`rounded-[var(--radius-sm)] border px-3 py-2 text-xs ${
          result.ok
            ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-200"
            : "border-red-500/20 bg-red-500/8 text-red-200"
        }`}>
          {result.message}
        </div>
      )}

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="rounded-[var(--radius-sm)] border border-red-500/20 bg-red-500/8 px-4 py-2 text-[11px] uppercase tracking-[0.1em] text-red-200 transition hover:bg-red-500/15"
        >
          <Trash2 size={12} className="mr-1.5 inline" />
          Reset Operational Data
        </button>
      ) : (
        <div className="space-y-3 rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-xs text-red-200">
            Type <span className="font-mono font-bold">RESET</span> to confirm.
            This action cannot be undone.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="block w-full rounded-[var(--radius-sm)] border border-red-500/30 bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-red-400/50 focus:outline-none"
            placeholder="Type RESET"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              disabled={confirmText !== "RESET" || loading}
              className="rounded-[var(--radius-sm)] border border-red-500/30 bg-red-600 px-4 py-2 text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-red-500 disabled:opacity-40"
            >
              {loading ? "Resetting..." : "Confirm Factory Reset"}
            </button>
            <button
              onClick={() => { setShowConfirm(false); setConfirmText(""); }}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-secondary)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
