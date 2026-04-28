import { useState } from "react";
import { AlertTriangle, LoaderCircle, Save } from "lucide-react";

type SelectOption = {
  id: string;
  label: string;
  detail?: string | null;
};

type RescueUpdateFormProps = {
  rescueId: string;
  initialRescue: {
    status: string;
    operatorId: string;
    survivorCondition: string | null;
    rescueNotes: string | null;
    outcomeSummary: string | null;
  };
  operatorOptions: SelectOption[];
  onSuccess?: () => void;
};

export function RescueUpdateForm({
  rescueId,
  initialRescue,
  operatorOptions,
  onSuccess,
}: RescueUpdateFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    status: initialRescue.status,
    operatorId: initialRescue.operatorId,
    survivorCondition: initialRescue.survivorCondition ?? "",
    rescueNotes: initialRescue.rescueNotes ?? "",
    outcomeSummary: initialRescue.outcomeSummary ?? "",
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/rescues/${rescueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Rescue update failed.");
        return;
      }
      onSuccess?.();
    } catch {
      setError("Rescue update failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <select
          value={form.status}
          onChange={(event) => updateField("status", event.target.value)}
          className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.16em] text-white outline-none transition focus:border-cyan-300/40"
        >
          <option value="open">Open</option>
          <option value="dispatching">Dispatching</option>
          <option value="en_route">En Route</option>
          <option value="on_scene">On Scene</option>
          <option value="recovered">Recovered</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={form.operatorId}
          onChange={(event) => updateField("operatorId", event.target.value)}
          className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
        >
          <option value="">Unassigned</option>
          {operatorOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={form.survivorCondition}
        onChange={(event) => updateField("survivorCondition", event.target.value)}
        rows={2}
        placeholder="Survivor condition"
        className="w-full rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm text-white outline-none transition focus:border-cyan-300/40"
      />
      <textarea
        value={form.rescueNotes}
        onChange={(event) => updateField("rescueNotes", event.target.value)}
        rows={3}
        placeholder="Rescue notes"
        className="w-full rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm text-white outline-none transition focus:border-cyan-300/40"
      />
      <textarea
        value={form.outcomeSummary}
        onChange={(event) => updateField("outcomeSummary", event.target.value)}
        rows={3}
        placeholder="Outcome summary"
        className="w-full rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm text-white outline-none transition focus:border-cyan-300/40"
      />

      <button
        type="button"
        disabled={loading}
        onClick={handleSubmit}
        className="inline-flex items-center gap-2 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
        Update rescue
      </button>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
