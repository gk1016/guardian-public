"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, Save } from "lucide-react";

type QrfStatusFormProps = {
  qrfId: string;
  initialAsset: {
    status: string;
    platform: string | null;
    locationName: string | null;
    availableCrew: number;
    notes: string | null;
  };
};

export function QrfStatusForm({ qrfId, initialAsset }: QrfStatusFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/qrf/${qrfId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            availableCrew: Number(form.availableCrew),
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "QRF update failed.");
          return;
        }
        router.refresh();
      } catch {
        setError("QRF update failed.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <select
          value={form.status}
          onChange={(event) => updateField("status", event.target.value)}
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.16em] text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        >
          <option value="redcon1">REDCON 1</option>
          <option value="redcon2">REDCON 2</option>
          <option value="redcon3">REDCON 3</option>
          <option value="redcon4">REDCON 4</option>
          <option value="tasked">Tasked</option>
          <option value="launched">Launched</option>
          <option value="rtb">RTB</option>
        </select>
        <input
          value={form.availableCrew}
          onChange={(event) => updateField("availableCrew", event.target.value)}
          type="number"
          min={1}
          placeholder="Crew"
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        />
        <input
          value={form.platform}
          onChange={(event) => updateField("platform", event.target.value)}
          placeholder="Platform"
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        />
        <input
          value={form.locationName}
          onChange={(event) => updateField("locationName", event.target.value)}
          placeholder="Location"
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        />
      </div>

      <textarea
        value={form.notes}
        onChange={(event) => updateField("notes", event.target.value)}
        rows={3}
        placeholder="Readiness notes"
        className="w-full rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-4 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
      />

      <button
        type="button"
        disabled={isPending}
        onClick={handleSubmit}
        className="inline-flex items-center gap-2 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
        Update posture
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
