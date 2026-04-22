"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-cyan-400/40 focus:outline-none";
const selectClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] focus:border-cyan-400/40 focus:outline-none";
const labelClass = "block text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)] mb-1.5";

export function NotificationCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    const body = {
      category: fd.get("category") as string,
      severity: fd.get("severity") as string,
      title: fd.get("title") as string,
      body: fd.get("body") as string,
      href: (fd.get("href") as string) || undefined,
    };

    startTransition(async () => {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to create alert.");
        return;
      }
      (e.target as HTMLFormElement).reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      {error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-200">{error}</div>
      ) : null}
      <div>
        <label className={labelClass}>Title</label>
        <input name="title" required minLength={3} maxLength={200} placeholder="Alert heading..." className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Body</label>
        <textarea name="body" required rows={3} minLength={3} maxLength={1000} placeholder="Details of the alert..." className={inputClass} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className={labelClass}>Category</label>
          <select name="category" required className={selectClass}>
            <option value="ops">Ops</option>
            <option value="intel">Intel</option>
            <option value="rescue">Rescue</option>
            <option value="admin">Admin</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Severity</label>
          <select name="severity" required className={selectClass}>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Link (optional)</label>
          <input name="href" maxLength={200} placeholder="/missions or /intel" className={inputClass} />
        </div>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-fit items-center gap-2 rounded-[var(--radius-md)] border border-amber-300/30 bg-amber-300 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-amber-200 disabled:opacity-60"
      >
        {isPending ? <LoaderCircle size={14} className="animate-spin" /> : null}
        Send Alert
      </button>
    </form>
  );
}
