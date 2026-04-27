import { useState } from "react";
import { AlertTriangle, LoaderCircle, Shield } from "lucide-react";

type MissionDoctrineFormProps = {
  missionId: string;
  selectedDoctrineTemplateId: string | null;
  availableDoctrineTemplates: {
    id: string;
    code: string;
    title: string;
    category: string;
    summary: string;
  }[];
  onSuccess?: () => void;
};

export function MissionDoctrineForm({
  missionId,
  selectedDoctrineTemplateId,
  availableDoctrineTemplates,
  onSuccess,
}: MissionDoctrineFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [doctrineTemplateId, setDoctrineTemplateId] = useState(selectedDoctrineTemplateId ?? "");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    try {
      const response = await fetch(`/api/missions/${missionId}/doctrine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          doctrineTemplateId: doctrineTemplateId || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Doctrine assignment failed.");
        return;
      }

      onSuccess?.();
    } catch {
      setError("Doctrine assignment failed.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Mission Doctrine</span>
        <select
          value={doctrineTemplateId}
          onChange={(event) => setDoctrineTemplateId(event.target.value)}
          className="w-full rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-[var(--color-text-strong)] outline-none transition focus:border-amber-300/40"
        >
          <option value="">No doctrine attached</option>
          {availableDoctrineTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.code} / {template.title}
            </option>
          ))}
        </select>
      </label>

      {doctrineTemplateId ? (
        <div className="rounded-2xl border border-[var(--color-border-bright)] bg-[var(--color-overlay-subtle)] px-4 py-4 text-sm text-slate-300">
          {availableDoctrineTemplates.find((template) => template.id === doctrineTemplateId)?.summary}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-300 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Shield size={16} />}
        {isPending ? "Updating doctrine" : "Update doctrine"}
      </button>
    </form>
  );
}
