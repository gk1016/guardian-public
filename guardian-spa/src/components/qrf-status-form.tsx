import { useState } from "react";
import { AlertTriangle, LoaderCircle, Save } from "lucide-react";

type QrfStatusFormProps = {
  qrfId: string;
  initialAsset: { status: string; platform: string | null; locationName: string | null; availableCrew: number; notes: string | null };
  onSuccess?: () => void;
};

export function QrfStatusForm({ qrfId, initialAsset, onSuccess }: QrfStatusFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    status: initialAsset.status,
    platform: initialAsset.platform ?? "",
    locationName: initialAsset.locationName ?? "",
    availableCrew: String(initialAsset.availableCrew),
    notes: initialAsset.notes ?? "",
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/qrf/${qrfId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, availableCrew: Number(form.availableCrew) }),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error || "QRF update failed."); return; }
      onSuccess?.();
    } catch { setError("QRF update failed."); }
    finally { setLoading(false); }
  }

  const inputClass = "rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-cyan)]";
  const textareaClass = "w-full rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-input-bg)] px-3 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-cyan)]";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <select value={form.status} onChange={(e) => updateField("status", e.target.value)} className={`${inputClass} uppercase tracking-[0.14em]`}>
          <option value="redcon1">REDCON 1</option>
          <option value="redcon2">REDCON 2</option>
          <option value="redcon3">REDCON 3</option>
          <option value="redcon4">REDCON 4</option>
          <option value="tasked">Tasked</option>
          <option value="launched">Launched</option>
          <option value="rtb">RTB</option>
        </select>
        <input value={form.availableCrew} onChange={(e) => updateField("availableCrew", e.target.value)} type="number" min={1} placeholder="Crew" className={inputClass} />
        <input value={form.platform} onChange={(e) => updateField("platform", e.target.value)} placeholder="Platform" className={inputClass} />
        <input value={form.locationName} onChange={(e) => updateField("locationName", e.target.value)} placeholder="Location" className={inputClass} />
      </div>
      <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} rows={2} placeholder="Readiness notes" className={textareaClass} />
      <button type="button" disabled={loading} onClick={handleSubmit} className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-70">
        {loading ? <LoaderCircle size={12} className="animate-spin" /> : <Save size={12} />}
        Update posture
      </button>
      {error ? (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
