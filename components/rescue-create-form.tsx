"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, Plus } from "lucide-react";

export function RescueCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    survivorHandle: "",
    locationName: "",
    urgency: "urgent",
    threatSummary: "",
    rescueNotes: "",
    survivorCondition: "",
    escortRequired: true,
    medicalRequired: true,
    offeredPayment: "",
  });

  function updateField(field: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/rescues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            offeredPayment: form.offeredPayment ? Number(form.offeredPayment) : undefined,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Rescue intake failed.");
          return;
        }
        setForm({
          survivorHandle: "",
          locationName: "",
          urgency: "urgent",
          threatSummary: "",
          rescueNotes: "",
          survivorCondition: "",
          escortRequired: true,
          medicalRequired: true,
          offeredPayment: "",
        });
        router.refresh();
      } catch {
        setError("Rescue intake failed.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <input
          value={form.survivorHandle}
          onChange={(event) => updateField("survivorHandle", event.target.value)}
          placeholder="Survivor handle"
          className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
        />
        <input
          value={form.locationName}
          onChange={(event) => updateField("locationName", event.target.value)}
          placeholder="Location"
          className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
        />
        <select
          value={form.urgency}
          onChange={(event) => updateField("urgency", event.target.value)}
          className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.16em] text-white outline-none transition focus:border-cyan-300/40"
        >
          <option value="flash">Flash</option>
          <option value="urgent">Urgent</option>
          <option value="priority">Priority</option>
          <option value="routine">Routine</option>
        </select>
        <input
          value={form.offeredPayment}
          onChange={(event) => updateField("offeredPayment", event.target.value)}
          placeholder="Offered payment"
          type="number"
          min={0}
          className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
        />
      </div>

      <textarea
        value={form.threatSummary}
        onChange={(event) => updateField("threatSummary", event.target.value)}
        rows={2}
        placeholder="Threat summary"
        className="w-full rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm text-white outline-none transition focus:border-cyan-300/40"
      />
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

      <div className="flex flex-wrap items-center gap-6 text-sm text-slate-300">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.escortRequired}
            onChange={(event) => updateField("escortRequired", event.target.checked)}
          />
          Escort required
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.medicalRequired}
            onChange={(event) => updateField("medicalRequired", event.target.checked)}
          />
          Medical required
        </label>
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={handleSubmit}
        className="inline-flex items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
        Open rescue
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
