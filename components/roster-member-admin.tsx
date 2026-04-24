"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, Save, Trash2, ChevronDown, ChevronRight, Shield } from "lucide-react";

type RosterMemberAdminProps = {
  userId: string;
  handle: string;
  initialMember: {
    displayName: string | null;
    role: string;
    status: string;
    rank: string;
    title: string | null;
  };
};

export function RosterMemberAdmin({ userId, handle, initialMember }: RosterMemberAdminProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  function handleUpdate() {
    setError("");
    setSuccess("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Update failed.");
          return;
        }
        setForm((current) => ({ ...current, password: "" }));
        setSuccess("Updated.");
        setTimeout(() => setSuccess(""), 3000);
        router.refresh();
      } catch {
        setError("Update failed.");
      }
    });
  }

  function handleDelete() {
    setError("");
    setSuccess("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}`, {
          method: "DELETE",
        });
        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Delete failed.");
          setConfirmDelete(false);
          return;
        }
        router.refresh();
      } catch {
        setError("Delete failed.");
        setConfirmDelete(false);
      }
    });
  }

  return (
    <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input-bg)]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-secondary)]"
      >
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Shield size={12} className="text-cyan-300" />
        <span>Admin Controls</span>
      </button>

      {isOpen ? (
        <div className="space-y-3 border-t border-[var(--color-border)] px-3 pb-3 pt-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={form.displayName}
              onChange={(e) => updateField("displayName", e.target.value)}
              placeholder="Display name"
              className="rounded-lg border border-[var(--color-border-bright)] bg-slate-950/70 px-3 py-2 text-xs text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
            />
            <input
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Roster title"
              className="rounded-lg border border-[var(--color-border-bright)] bg-slate-950/70 px-3 py-2 text-xs text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
            />
            <select
              value={form.role}
              onChange={(e) => updateField("role", e.target.value)}
              className="rounded-lg border border-[var(--color-border-bright)] bg-slate-950/70 px-3 py-2 text-xs uppercase tracking-[0.12em] text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
            >
              <option value="pilot">Pilot</option>
              <option value="rescue_coordinator">Rescue Coordinator</option>
              <option value="director">Director</option>
              <option value="admin">Admin</option>
              <option value="commander">Commander</option>
            </select>
            <select
              value={form.status}
              onChange={(e) => updateField("status", e.target.value)}
              className="rounded-lg border border-[var(--color-border-bright)] bg-slate-950/70 px-3 py-2 text-xs uppercase tracking-[0.12em] text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="disabled">Disabled</option>
            </select>
            <input
              value={form.rank}
              onChange={(e) => updateField("rank", e.target.value)}
              placeholder="Rank"
              className="rounded-lg border border-[var(--color-border-bright)] bg-slate-950/70 px-3 py-2 text-xs text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
            />
            <input
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              placeholder="Reset password"
              type="password"
              className="rounded-lg border border-[var(--color-border-bright)] bg-slate-950/70 px-3 py-2 text-xs text-[var(--color-text-strong)] outline-none transition focus:border-cyan-300/40"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleUpdate}
              className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? <LoaderCircle size={12} className="animate-spin" /> : <Save size={12} />}
              Update
            </button>

            {!confirmDelete ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Trash2 size={12} />
                Remove
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-red-300">Remove {handle}?</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isPending ? <LoaderCircle size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          ) : null}

          {success ? (
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
              {success}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
