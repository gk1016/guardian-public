import { useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import type { TargetItem } from "@/hooks/use-views";

interface TargetFormProps {
  editing?: TargetItem | null;
  availableActors: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

const TARGET_TYPES = [
  { value: "hvt", label: "High-Value Target" },
  { value: "hpt", label: "High-Payoff Target" },
  { value: "tsa", label: "Target System Analysis" },
];

const PRIORITY_OPTIONS = [
  { value: 1, label: "1 — Critical" },
  { value: 2, label: "2 — High" },
  { value: 3, label: "3 — Medium" },
  { value: 4, label: "4 — Low" },
  { value: 5, label: "5 — Lowest" },
];

export function TargetForm({ editing, availableActors, onClose, onSaved }: TargetFormProps) {
  const [name, setName] = useState(editing?.name ?? "");
  const [targetType, setTargetType] = useState(editing?.targetType ?? "hvt");
  const [priority, setPriority] = useState(editing?.priority ?? 3);
  const [threatActorId, setThreatActorId] = useState(editing?.threatActorId ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [gridReference, setGridReference] = useState(editing?.gridReference ?? "");
  const [lastKnownLocation, setLastKnownLocation] = useState(editing?.lastKnownLocation ?? "");
  const [starSystem, setStarSystem] = useState(editing?.starSystem ?? "");
  const [engagementGuidance, setEngagementGuidance] = useState(editing?.engagementGuidance ?? "");
  const [collateralConcerns, setCollateralConcerns] = useState(editing?.collateralConcerns ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        targetType,
        priority,
        description: description.trim() || null,
        gridReference: gridReference.trim() || null,
        lastKnownLocation: lastKnownLocation.trim() || null,
        starSystem: starSystem.trim() || null,
        engagementGuidance: engagementGuidance.trim() || null,
        collateralConcerns: collateralConcerns.trim() || null,
        threatActorId: threatActorId || null,
      };
      if (editing) {
        await api.patch(`/api/targets/${editing.id}`, payload);
      } else {
        await api.post("/api/targets", payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save target.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none";
  const labelClass = "block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-backdrop)]">
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-[var(--color-text-faint)] hover:text-[var(--color-text-strong)]"
        >
          <X size={16} />
        </button>
        <h2 className="mb-4 font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          {editing ? "Edit Target" : "Nominate Target"}
        </h2>

        {error && (
          <div className="mb-3 rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className={labelClass}>Name *</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          {/* Type + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Target Type</label>
              <select className={inputClass} value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                {TARGET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <select className={inputClass} value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Threat Actor */}
          {availableActors.length > 0 && (
            <div>
              <label className={labelClass}>Linked Threat Actor</label>
              <select className={inputClass} value={threatActorId} onChange={(e) => setThreatActorId(e.target.value)}>
                <option value="">None</option>
                {availableActors.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {/* Location row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Grid Reference</label>
              <input className={inputClass} value={gridReference} onChange={(e) => setGridReference(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Last Known Location</label>
              <input className={inputClass} value={lastKnownLocation} onChange={(e) => setLastKnownLocation(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Star System</label>
              <input className={inputClass} value={starSystem} onChange={(e) => setStarSystem(e.target.value)} />
            </div>
          </div>

          {/* Engagement Guidance */}
          <div>
            <label className={labelClass}>Engagement Guidance</label>
            <textarea className={inputClass} rows={2} value={engagementGuidance} onChange={(e) => setEngagementGuidance(e.target.value)} />
          </div>

          {/* Collateral Concerns */}
          <div>
            <label className={labelClass}>Collateral Concerns</label>
            <textarea className={inputClass} rows={2} value={collateralConcerns} onChange={(e) => setCollateralConcerns(e.target.value)} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-overlay-subtle)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-1.5 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 disabled:opacity-40"
          >
            {saving ? "Saving..." : editing ? "Update" : "Nominate"}
          </button>
        </div>
      </form>
    </div>
  );
}
