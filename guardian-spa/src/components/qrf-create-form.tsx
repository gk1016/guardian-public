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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <input value={form.callsign} onChange={(e) => updateField("callsign", e.target.value)} placeholder="Callsign" className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40" />
        <input value={form.platform} onChange={(e) => updateField("platform", e.target.value)} placeholder="Platform" className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40" />
        <select value={form.status} onChange={(e) => updateField("status", e.target.value)} className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.16em] text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40">
          <option value="redcon1">REDCON 1</option>
          <option value="redcon2">REDCON 2</option>
          <option value="redcon3">REDCON 3</option>
          <option value="redcon4">REDCON 4</option>
        </select>
        <input value={form.availableCrew} onChange={(e) => updateField("availableCrew", e.target.value)} placeholder="Available crew" type="number" min={1} className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40" />
        <input value={form.locationName} onChange={(e) => updateField("locationName", e.target.value)} placeholder="Location" className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40 md:col-span-2" />
      </div>
      <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Readiness notes" rows={3} className="w-full rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-4 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40" />
      <button type="button" disabled={loading} onClick={handleSubmit} className="inline-flex items-center gap-2 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-70">
        {loading ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
        Create QRF asset
      </button>
      {error ? <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100"><AlertTriangle size={16} /><span>{error}</span></div> : null}
    </div>
  );
}
