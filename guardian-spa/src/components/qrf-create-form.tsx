import { useState } from "react";
import { AlertTriangle, LoaderCircle, Plus } from "lucide-react";

export function QrfCreateForm({ onSuccess }: { onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    callsign: "",
    platform: "",
    status: "redcon2",
    locationName: "",
    availableCrew: "1",
    notes: "",
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/qrf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, availableCrew: Number(form.availableCrew) }),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error || "QRF asset creation failed."); return; }
      setForm({ callsign: "", platform: "", status: "redcon2", locationName: "", availableCrew: "1", notes: "" });
      onSuccess?.();
    } catch { setError("QRF asset creation failed."); }
    finally { setLoading(false); }
  }

  const inputClass = "rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-cyan)]";
  const textareaClass = "w-full rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-input-bg)] px-3 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-cyan)]";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <input value={form.callsign} onChange={(e) => updateField("callsign", e.target.value)} placeholder="Callsign" className={inputClass} />
        <input value={form.platform} onChange={(e) => updateField("platform", e.target.value)} placeholder="Platform" className={inputClass} />
        <select value={form.status} onChange={(e) => updateField("status", e.target.value)} className={`${inputClass} uppercase tracking-[0.14em]`}>
          <option value="redcon1">REDCON 1</option>
          <option value="redcon2">REDCON 2</option>
          <option value="redcon3">REDCON 3</option>
          <option value="redcon4">REDCON 4</option>
        </select>
        <input value={form.availableCrew} onChange={(e) => updateField("availableCrew", e.target.value)} placeholder="Available crew" type="number" min={1} className={inputClass} />
        <input value={form.locationName} onChange={(e) => updateField("locationName", e.target.value)} placeholder="Location" className={`${inputClass} md:col-span-2`} />
      </div>
      <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Readiness notes" rows={2} className={textareaClass} />
      <button type="button" disabled={loading} onClick={handleSubmit} className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-70">
        {loading ? <LoaderCircle size={12} className="animate-spin" /> : <Plus size={12} />}
        Create QRF asset
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
