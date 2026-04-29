import { useState } from "react";
import { BookCheck, Lock, Pencil, Trash2, X, Save, LoaderCircle, Plus, AlertTriangle } from "lucide-react";
import { useSession } from "@/lib/auth";
import { useDoctrine } from "@/hooks/use-views";
import { canManageAdministration } from "@/lib/roles";
import type { DoctrineItem } from "@/hooks/use-views";
import { useQueryClient } from "@tanstack/react-query";

/* ------------------------------------------------------------------ */
/*  Shared                                                             */
/* ------------------------------------------------------------------ */

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Loading...</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
      {message}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-[var(--color-border-bright)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)]";

const textareaClass =
  "w-full rounded-lg border border-[var(--color-border-bright)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)]";

/* ------------------------------------------------------------------ */
/*  Inline Edit Form                                                   */
/* ------------------------------------------------------------------ */

function DoctrineEditForm({
  item,
  onCancel,
  onSaved,
}: {
  item: DoctrineItem;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(item.code);
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState(item.category);
  const [summary, setSummary] = useState(item.summary);
  const [body, setBody] = useState(item.body);
  const [escalation, setEscalation] = useState(item.escalation ?? "");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    setIsPending(true);
    try {
      const res = await fetch(`/api/doctrine/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code, title, category, summary, body, escalation: escalation || null }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || "Update failed.");
        return;
      }
      onSaved();
    } catch {
      setError("Update failed.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-amber-300/30 bg-[var(--color-panel)] p-5 panel-elevated space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-amber-300">
          Edit Doctrine
        </span>
        <button onClick={onCancel} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-strong)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Code</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Category</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="space-y-1">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </label>
      <label className="space-y-1">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Summary</span>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className={textareaClass} />
      </label>
      <label className="space-y-1">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Execution</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={textareaClass} />
      </label>
      <label className="space-y-1">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Escalation</span>
        <textarea value={escalation} onChange={(e) => setEscalation(e.target.value)} rows={2} className={textareaClass} />
      </label>
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-300">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/35 bg-amber-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-bg)] hover:bg-amber-200 disabled:opacity-70"
        >
          {isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-[var(--color-border-bright)] px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-[var(--color-text-secondary)] hover:text-[var(--color-text-strong)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Doctrine Card                                                      */
/* ------------------------------------------------------------------ */

function DoctrineCard({
  item,
  isAdmin,
  onEdit,
  onDelete,
}: {
  item: DoctrineItem;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/doctrine/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) onDelete();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <BookCheck className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
        <span className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          {item.code}
        </span>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
          {item.category}
        </span>
        {item.isDefault && (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-emerald-300">
            Default
          </span>
        )}
        <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">
          {item.missionCount} mission{item.missionCount !== 1 ? "s" : ""}
        </span>
        {isAdmin && (
          <div className="flex gap-1">
            <button onClick={onEdit} className="rounded p-1 text-[var(--color-text-tertiary)] hover:text-amber-300 hover:bg-amber-300/10">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded p-1 text-[var(--color-text-tertiary)] hover:text-red-400 hover:bg-red-400/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Title + summary */}
      <p className="mb-1 text-sm font-medium text-[var(--color-text-strong)]">{item.title}</p>
      {item.summary && (
        <p className="mb-3 text-xs text-[var(--color-text-secondary)]">{item.summary}</p>
      )}

      {/* Execution body */}
      {item.body && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Execution
          </p>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--color-text-secondary)]">
            {item.body}
          </p>
        </div>
      )}

      {/* Escalation */}
      {item.escalation && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Escalation
          </p>
          <p className="text-xs text-amber-300/80">{item.escalation}</p>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2">
          <span className="text-xs text-red-200">Delete this doctrine?</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md bg-red-600 px-2 py-1 text-[10px] font-semibold uppercase text-[var(--color-text-strong)] hover:bg-red-500 disabled:opacity-70"
          >
            {deleting ? "Deleting..." : "Confirm"}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-[10px] uppercase text-[var(--color-text-tertiary)] hover:text-[var(--color-text-strong)]"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Form (inline)                                               */
/* ------------------------------------------------------------------ */

function DoctrineCreateForm({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [escalation, setEscalation] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !title.trim()) {
      setError("Code and title are required.");
      return;
    }
    setError("");
    setIsPending(true);
    try {
      const res = await fetch("/api/doctrine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code, title, category: category || "general", summary, body, escalation: escalation || null }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || "Creation failed.");
        return;
      }
      setCode(""); setTitle(""); setCategory(""); setSummary(""); setBody(""); setEscalation("");
      onSuccess();
    } catch {
      setError("Creation failed.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Code</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="weapons_hold" className={inputClass} />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Category</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="general" className={inputClass} />
        </label>
      </div>
      <label className="space-y-1">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weapons Hold / Visual PID Required" className={inputClass} />
      </label>
      <label className="space-y-1">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Summary</span>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="Brief description..." className={textareaClass} />
      </label>
      <label className="space-y-1">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Execution</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Step-by-step execution checklist..." className={textareaClass} />
      </label>
      <label className="space-y-1">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Escalation</span>
        <textarea value={escalation} onChange={(e) => setEscalation(e.target.value)} rows={2} placeholder="Escalation guidance..." className={textareaClass} />
      </label>
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-300">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </div>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/35 bg-amber-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-bg)] hover:bg-amber-200 disabled:opacity-70"
      >
        {isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Create Doctrine
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function DoctrinePage() {
  const session = useSession();
  const { data, isLoading, error } = useDoctrine();
  const isAdmin = canManageAdministration(session.role);
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["views", "doctrine"] });
  }

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          Doctrine
        </h1>
        {isAdmin && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-amber-300 hover:bg-amber-300/20"
          >
            <Plus className="h-3.5 w-3.5" />
            New Doctrine
          </button>
        )}
      </div>

      {/* Create form */}
      {isAdmin && showCreate && (
        <div className="rounded-[var(--radius-lg)] border border-amber-300/30 bg-[var(--color-panel)] p-5 panel-elevated">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookCheck className="h-4 w-4 text-amber-300" />
              <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
                New Doctrine
              </h2>
            </div>
            <button onClick={() => setShowCreate(false)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-strong)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <DoctrineCreateForm
            onSuccess={() => {
              setShowCreate(false);
              refresh();
            }}
          />
        </div>
      )}

      {/* Doctrine list */}
      <div className="space-y-4">
        {data.items.map((item) =>
          editingId === item.id ? (
            <DoctrineEditForm
              key={item.id}
              item={item}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null);
                refresh();
              }}
            />
          ) : (
            <DoctrineCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              onEdit={() => setEditingId(item.id)}
              onDelete={refresh}
            />
          ),
        )}
        {data.items.length === 0 && !showCreate && (
          <p className="py-12 text-center text-xs text-[var(--color-text-tertiary)]">
            No doctrine templates defined
          </p>
        )}
      </div>

      {/* Non-admin notice */}
      {!isAdmin && (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
          <Lock className="h-3.5 w-3.5" />
          Read-only &mdash; administration permissions required to create or edit doctrine
        </div>
      )}
    </div>
  );
}
