"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, Save } from "lucide-react";

type AdminMemberUpdateFormProps = {
  userId: string;
  initialMember: {
    displayName: string | null;
    role: string;
    status: string;
    rank: string;
    title: string | null;
  };
};

export function AdminMemberUpdateForm({
  userId,
  initialMember,
}: AdminMemberUpdateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    displayName: initialMember.displayName ?? "",
    role: initialMember.role,
    status: initialMember.status,
    rank: initialMember.rank,
    title: initialMember.title ?? "",
    password: "",
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Member update failed.");
          return;
        }

        setForm((current) => ({ ...current, password: "" }));
        router.refresh();
      } catch {
        setError("Member update failed.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <input
          value={form.displayName}
          onChange={(event) => updateField("displayName", event.target.value)}
          placeholder="Display name"
          className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
        />
        <input
          value={form.title}
          onChange={(event) => updateField("title", event.target.value)}
          placeholder="Roster title"
          className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
        />
        <select
          value={form.role}
          onChange={(event) => updateField("role", event.target.value)}
          className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.16em] text-white outline-none transition focus:border-cyan-300/40"
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
          className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.16em] text-white outline-none transition focus:border-cyan-300/40"
        >
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="disabled">Disabled</option>
        </select>
        <input
          value={form.rank}
          onChange={(event) => updateField("rank", event.target.value)}
          placeholder="Membership rank"
          className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
        />
        <input
          value={form.password}
          onChange={(event) => updateField("password", event.target.value)}
          placeholder="Reset password"
          type="password"
          className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
        />
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={handleSubmit}
        className="inline-flex items-center gap-2 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
        Update member
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
