/**
 * Intel Requirement create / edit form.
 *
 * Supports PIR, IR, and RFI requirement types.
 */
import { useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import type { IntelRequirementItem } from "@/hooks/use-views";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const REQUIREMENT_TYPES = [
  { value: "pir", label: "PIR (Priority Intel Requirement)" },
  { value: "ir", label: "IR (Intel Requirement)" },
  { value: "rfi", label: "RFI (Request for Information)" },
];

const PRIORITIES = [
  { value: 1, label: "1 - Highest" },
  { value: 2, label: "2 - High" },
  { value: 3, label: "3 - Medium" },
  { value: 4, label: "4 - Low" },
  { value: 5, label: "5 - Lowest" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function IntelReqForm({
  existing,
  pirOptions,
  onClose,
  onSaved,
}: {
  existing?: IntelRequirementItem;
  pirOptions?: { id: string; title: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!existing;

  const [requirementType, setRequirementType] = useState(existing?.requirementType ?? "ir");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [priority, setPriority] = useState(existing?.priority ?? 3);
  const [parentId, setParentId] = useState(existing?.parentId ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [collectionGuidance, setCollectionGuidance] = useState(existing?.collectionGuidance ?? "");
  const [indicatorsStr, setIndicatorsStr] = useState((existing?.indicators ?? []).join(", "));
  const [ltiov, setLtiov] = useState(existing?.ltiov ?? "");
  const [linkedActorId, setLinkedActorId] = useState(existing?.linkedActorId ?? "");
  const [linkedIntelId, setLinkedIntelId] = useState(existing?.linkedIntelId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function splitComma(s: string): string[] {
    return s.split(",").map((t) => t.trim()).filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setSubmitting(true);
    setError("");

    const payload: Record<string, unknown> = {
      requirementType,
      title: title.trim(),
      priority,
      description: description.trim() || undefined,
      collectionGuidance: collectionGuidance.trim() || undefined,
      indicators: splitComma(indicatorsStr),
      ltiov: ltiov || undefined,
      linkedActorId: linkedActorId.trim() || undefined,
      linkedIntelId: linkedIntelId.trim() || undefined,
    };

    if (requirementType === "ir" && parentId) {
      payload.parentId = parentId;
    }

    try {
      if (isEdit) {
        await api.patch(`/api/intel-reqs/${existing!.id}`, payload);
      } else {
        await api.post("/api/intel-reqs", payload);
      }
      onSaved();
      onClose();
    } catch {
      setError(isEdit ? "Update failed." : "Failed to create requirement.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none";
  const labelClass =
    "mb-1 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]";
  const selectClass =
    "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-strong)] focus:border-[var(--color-accent)] focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 pt-16 pb-8">
      <div className="w-full max-w-2xl rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
            {isEdit ? "Edit Requirement" : "New Requirement"}
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Type + Priority */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Requirement Type</label>
              <select value={requirementType} onChange={(e) => setRequirementType(e.target.value)} className={selectClass}>
                {REQUIREMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., IDENTIFY HOSTILE STAGING AREAS IN PYRO" className={inputClass} />
            </div>
          </div>

          {/* Row 2: Priority + Parent PIR (for IR type) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Priority</label>
              <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} className={selectClass}>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            {requirementType === "ir" && pirOptions && pirOptions.length > 0 && (
              <div>
                <label className={labelClass}>Parent PIR</label>
                <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={selectClass}>
                  <option value="">-- None --</option>
                  {pirOptions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What intelligence is needed and why..." className={inputClass + " resize-none"} />
          </div>

          {/* Collection Guidance */}
          <div>
            <label className={labelClass}>Collection Guidance</label>
            <textarea value={collectionGuidance} onChange={(e) => setCollectionGuidance(e.target.value)} rows={2} placeholder="How/where to collect this intelligence..." className={inputClass + " resize-none"} />
          </div>

          {/* Indicators + LTIOV */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Indicators (comma-separated)</label>
              <input type="text" value={indicatorsStr} onChange={(e) => setIndicatorsStr(e.target.value)} placeholder="ship movement, comm chatter, staging" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>LTIOV (Latest Time Info of Value)</label>
              <input type="datetime-local" value={ltiov} onChange={(e) => setLtiov(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Linked Actor + Linked Intel */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Linked Threat Actor ID</label>
              <input type="text" value={linkedActorId} onChange={(e) => setLinkedActorId(e.target.value)} placeholder="Optional actor ID" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Linked Intel Report ID</label>
              <input type="text" value={linkedIntelId} onChange={(e) => setLinkedIntelId(e.target.value)} placeholder="Optional intel report ID" className={inputClass} />
            </div>
          </div>

          {/* Error + Buttons */}
          {error && (
            <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-text-tertiary)] hover:bg-[var(--color-border)]/20">
              Cancel
            </button>
            <button type="submit" disabled={!title.trim() || submitting} className="rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-2 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 disabled:opacity-40">
              {submitting ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save Changes" : "Create Requirement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
