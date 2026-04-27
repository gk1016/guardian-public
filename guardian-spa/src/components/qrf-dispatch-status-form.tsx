import { useState } from "react";
import { AlertTriangle, LoaderCircle, Save } from "lucide-react";

type QrfDispatchStatusFormProps = { dispatchId: string; initialStatus: string; onSuccess?: () => void };

export function QrfDispatchStatusForm({ dispatchId, initialStatus, onSuccess }: QrfDispatchStatusFormProps) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/qrf/dispatches/${dispatchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error || "Dispatch status update failed."); return; }
      onSuccess?.();
    } catch { setError("Dispatch status update failed."); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-[var(--color-border-bright)] bg-slate-950/70 px-3 py-2 text-xs uppercase tracking-[0.16em] text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40">
          <option value="tasked">Tasked</option>
          <option value="en_route">En Route</option>
          <option value="on_scene">On Scene</option>
          <option value="rtb">RTB</option>
          <option value="complete">Complete</option>
          <option value="aborted">Aborted</option>
        </select>
        <button type="button" disabled={loading} onClick={handleSubmit} className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border-bright)] bg-[var(--color-overlay-subtle)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-strong)] transition hover:bg-[var(--color-overlay-strong)] disabled:cursor-not-allowed disabled:opacity-70">
          {loading ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
          Update dispatch
        </button>
      </div>
      {error ? <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100"><AlertTriangle size={16} /><span>{error}</span></div> : null}
    </div>
  );
}
