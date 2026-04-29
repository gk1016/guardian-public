/**
 * Threat Actor create / edit form.
 *
 * Capability, Intent, and Opportunity ratings on a 1-10 scale.
 * Threat level classification: low, medium, high, critical.
 */
import { useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import type { ThreatActorItem } from "@/hooks/use-views";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ACTOR_TYPES = [
  { value: "pirate", label: "Pirate" },
  { value: "vanduul", label: "Vanduul" },
  { value: "criminal_org", label: "Criminal Org" },
  { value: "rogue_uee", label: "Rogue UEE" },
  { value: "mercenary", label: "Mercenary" },
  { value: "unknown", label: "Unknown" },
];

const THREAT_LEVELS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ThreatActorForm({
  existing,
  onClose,
  onSaved,
}: {
  existing?: ThreatActorItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [actorType, setActorType] = useState(existing?.actorType ?? "unknown");
  const [capabilityRating, setCapabilityRating] = useState(existing?.capabilityRating ?? 1);
  const [intentRating, setIntentRating] = useState(existing?.intentRating ?? 1);
  const [opportunityRating, setOpportunityRating] = useState(existing?.opportunityRating ?? 1);
  const [threatLevel, setThreatLevel] = useState(existing?.threatLevel ?? "low");
  const [aliasesStr, setAliasesStr] = useState((existing?.aliases ?? []).join(", "));
  const [ttpsStr, setTtpsStr] = useState((existing?.knownTtps ?? []).join(", "));
  const [assetsStr, setAssetsStr] = useState((existing?.knownAssets ?? []).join(", "));
  const [aooStr, setAooStr] = useState((existing?.areaOfOperations ?? []).join(", "));
  const [lastKnownLocation, setLastKnownLocation] = useState(existing?.lastKnownLocation ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function splitComma(s: string): string[] {
    return s.split(",").map((t) => t.trim()).filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    setSubmitting(true);
    setError("");

    const payload = {
      name: name.trim(),
      actorType,
      capabilityRating,
      intentRating,
      opportunityRating,
      threatLevel,
      aliases: splitComma(aliasesStr),
      knownTtps: splitComma(ttpsStr),
      knownAssets: splitComma(assetsStr),
      areaOfOperations: splitComma(aooStr),
      lastKnownLocation: lastKnownLocation.trim() || undefined,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      if (isEdit) {
        await api.patch(`/api/threat-actors/${existing!.id}`, payload);
      } else {
        await api.post("/api/threat-actors", payload);
      }
      onSaved();
      onClose();
    } catch {
      setError(isEdit ? "Update failed." : "Failed to create threat actor.");
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
            {isEdit ? "Edit Threat Actor" : "New Threat Actor"}
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Name + Actor Type */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={labelClass}>Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="CRIMSON WOLVES" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Actor Type</label>
              <select value={actorType} onChange={(e) => setActorType(e.target.value)} className={selectClass}>
                {ACTOR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Ratings */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className={labelClass}>Capability (1-10)</label>
              <input type="number" min={1} max={10} value={capabilityRating} onChange={(e) => setCapabilityRating(Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Intent (1-10)</label>
              <input type="number" min={1} max={10} value={intentRating} onChange={(e) => setIntentRating(Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Opportunity (1-10)</label>
              <input type="number" min={1} max={10} value={opportunityRating} onChange={(e) => setOpportunityRating(Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Threat Level</label>
              <select value={threatLevel} onChange={(e) => setThreatLevel(e.target.value)} className={selectClass}>
                {THREAT_LEVELS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row 3: Aliases + Last Known Location */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Aliases (comma-separated)</label>
              <input type="text" value={aliasesStr} onChange={(e) => setAliasesStr(e.target.value)} placeholder="Red Wolves, RW" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Last Known Location</label>
              <input type="text" value={lastKnownLocation} onChange={(e) => setLastKnownLocation(e.target.value)} placeholder="Pyro, Ruin Station" className={inputClass} />
            </div>
          </div>

          {/* Row 4: TTPs + Assets */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Known TTPs (comma-separated)</label>
              <input type="text" value={ttpsStr} onChange={(e) => setTtpsStr(e.target.value)} placeholder="ambush, interdiction, pad-ramming" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Known Assets (comma-separated)</label>
              <input type="text" value={assetsStr} onChange={(e) => setAssetsStr(e.target.value)} placeholder="Cutlass Black, Mantis" className={inputClass} />
            </div>
          </div>

          {/* Area of Operations */}
          <div>
            <label className={labelClass}>Area of Operations (comma-separated)</label>
            <input type="text" value={aooStr} onChange={(e) => setAooStr(e.target.value)} placeholder="Stanton, Pyro, Nyx" className={inputClass} />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Known pirate group operating out of Pyro..." className={inputClass + " resize-none"} />
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Internal analyst notes..." className={inputClass + " resize-none"} />
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
            <button type="submit" disabled={!name.trim() || submitting} className="rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-2 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 disabled:opacity-40">
              {submitting ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save Changes" : "Create Actor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
