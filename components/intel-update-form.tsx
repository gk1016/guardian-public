"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-cyan-400/40 focus:outline-none";
const selectClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] focus:border-cyan-400/40 focus:outline-none";
const labelClass = "block text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)] mb-1.5";

type IntelUpdateFormProps = {
  intelId: string;
  initialSeverity: number;
  initialConfidence: string;
  isActive: boolean;
};

export function IntelUpdateForm({
  intelId,
  initialSeverity,
  initialConfidence,
  isActive,
}: IntelUpdateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    const body: Record<string, unknown> = {
      severity: Number(fd.get("severity")),
      confidence: fd.get("confidence") as string,
      isActive: fd.get("isActive") === "true",
    };

    startTransition(async () => {
      const res = await fetch(`/api/intel/${intelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to update report.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      {error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-200">{error}</div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className={labelClass}>Severity</label>
          <select name="severity" defaultValue={initialSeverity} className={selectClass}>
            <option value="5">5 - Critical</option>
            <option value="4">4 - High</option>
            <option value="3">3 - Medium</option>
            <option value="2">2 - Low</option>
            <option value="1">1 - Minimal</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Confidence</label>
          <select name="confidence" defaultValue={initialConfidence} className={selectClass}>
            <option value="confirmed">Confirmed</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select name="isActive" defaultValue={isActive ? "true" : "false"} className={selectClass}>
            <option value="true">Active</option>
            <option value="false">Resolved</option>
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-fit items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-overlay-subtle)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-strong)] transition hover:bg-[var(--color-overlay-strong)] disabled:opacity-60"
      >
        {isPending ? <LoaderCircle size={13} className="animate-spin" /> : null}
        Update Report
      </button>
    </form>
  );
}
