"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, Plus } from "lucide-react";

export function AdminUserCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    handle: "",
    displayName: "",
    password: "",
    role: "pilot",
    status: "active",
    rank: "member",
    title: "",
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "User creation failed.");
          return;
        }

        setForm({
          email: "",
          handle: "",
          displayName: "",
          password: "",
          role: "pilot",
          status: "active",
          rank: "member",
          title: "",
        });
        router.refresh();
      } catch {
        setError("User creation failed.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <input
          value={form.email}
          onChange={(event) => updateField("email", event.target.value)}
          placeholder="Email"
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        />
        <input
          value={form.handle}
          onChange={(event) => updateField("handle", event.target.value)}
          placeholder="Handle"
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        />
        <input
          value={form.displayName}
          onChange={(event) => updateField("displayName", event.target.value)}
          placeholder="Display name"
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        />
        <input
          value={form.password}
          onChange={(event) => updateField("password", event.target.value)}
          placeholder="Initial password"
          type="password"
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        />
        <select
          value={form.role}
          onChange={(event) => updateField("role", event.target.value)}
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.16em] text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        >
          <option value="pilot">Pilot</option>
          <option value="rescue_coordinator">Rescue Coordinator</option>
          <option value="director">Director</option>
          <option value="admin">Admin</option>
          <option value="commander">Commander</option>
        </select>
        <select
          value={form.status}
          onChange={(event) => updateField("status", event.target.value)}
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.16em] text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        >
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="disabled">Disabled</option>
        </select>
        <input
          value={form.rank}
          onChange={(event) => updateField("rank", event.target.value)}
          placeholder="Membership rank"
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        />
        <input
          value={form.title}
          onChange={(event) => updateField("title", event.target.value)}
          placeholder="Roster title"
          className="rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
        />
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={handleSubmit}
        className="inline-flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
        Create member
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
