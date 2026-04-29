/**
 * Intel Report create / edit form.
 *
 * NATO source reliability (A-F) and information credibility (1-6) ratings.
 * Report phase tracking: raw -> processed -> analyzed.
 */
import { useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import type { IntelItem } from "@/hooks/use-views";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const REPORT_TYPES = [
  { value: "sighting", label: "Sighting" },
  { value: "contact_report", label: "Contact Report" },
  { value: "sigint", label: "SIGINT" },
  { value: "osint", label: "OSINT" },
  { value: "humint", label: "HUMINT" },
  { value: "bda", label: "BDA" },
  { value: "pattern_analysis", label: "Pattern Analysis" },
  { value: "threat_warning", label: "Threat Warning" },
];

const CONFIDENCE_LEVELS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "probable", label: "Probable" },
  { value: "possible", label: "Possible" },
  { value: "doubtful", label: "Doubtful" },
];

const SOURCE_RELIABILITY = [
  { value: "A", label: "A - Completely reliable" },
  { value: "B", label: "B - Usually reliable" },
  { value: "C", label: "C - Fairly reliable" },
  { value: "D", label: "D - Not usually reliable" },
  { value: "E", label: "E - Unreliable" },
  { value: "F", label: "F - Cannot be judged" },
];

const INFO_CREDIBILITY = [
  { value: 1, label: "1 - Confirmed" },
  { value: 2, label: "2 - Probably true" },
  { value: 3, label: "3 - Possibly true" },
  { value: 4, label: "4 - Doubtfully true" },
  { value: 5, label: "5 - Improbable" },
  { value: 6, label: "6 - Cannot be judged" },
];

const REPORT_PHASES = [
  { value: "raw", label: "Raw" },
  { value: "processed", label: "Processed" },
  { value: "analyzed", label: "Analyzed" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function IntelForm({
  existing,
  onClose,
  onSaved,
}: {
  existing?: IntelItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!existing;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [reportType, setReportType] = useState(existing?.reportType ?? "sighting");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [severity, setSeverity] = useState(existing?.severity ?? 3);
  const [locationName, setLocationName] = useState(existing?.locationName ?? "");
  const [starSystem, setStarSystem] = useState(existing?.starSystem ?? "");
  const [hostileGroup, setHostileGroup] = useState(existing?.hostileGroup ?? "");
  const [confidence, setConfidence] = useState(existing?.confidence ?? "possible");
  const [tagsStr, setTagsStr] = useState((existing?.tags ?? []).join(", "));
  const [sourceReliability, setSourceReliability] = useState(existing?.sourceReliability ?? "F");
  const [infoCredibility, setInfoCredibility] = useState(existing?.infoCredibility ?? 6);
  const [reportPhase, setReportPhase] = useState(existing?.reportPhase ?? "raw");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setSubmitting(true);
    setError("");

    const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);

    try {
      if (isEdit) {
        await api.patch(`/api/intel/${existing!.id}`, {
          title: title.trim(),
          reportType,
          description: description.trim() || undefined,
          severity,
          locationName: locationName.trim() || undefined,
          starSystem: starSystem.trim() || undefined,
          hostileGroup: hostileGroup.trim() || undefined,
          confidence,
          tags,
          sourceReliability,
          infoCredibility,
          reportPhase,
        });
      } else {
        await api.post("/api/intel", {
          title: title.trim(),
          reportType,
          description: description.trim() || undefined,
          severity,
          locationName: locationName.trim() || undefined,
          starSystem: starSystem.trim() || undefined,
          hostileGroup: hostileGroup.trim() || undefined,
          confidence,
          tags,
          sourceReliability,
          infoCredibility,
        });
      }
      onSaved();
      onClose();
    } catch {
      setError(isEdit ? "Update failed." : "Failed to create report.");
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
            {isEdit ? "Edit Intel Report" : "New Intel Report"}
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Title + Report Type */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={labelClass}>Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="HOSTILE CONTACT AT CRU-L1" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Report Type</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)} className={selectClass}>
                {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Severity + Confidence + Phase */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Severity (1-10)</label>
              <input type="number" min={1} max={10} value={severity} onChange={(e) => setSeverity(Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Confidence</label>
              <select value={confidence} onChange={(e) => setConfidence(e.target.value)} className={selectClass}>
                {CONFIDENCE_LEVELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {isEdit && (
              <div>
                <label className={labelClass}>Report Phase</label>
                <select value={reportPhase} onChange={(e) => setReportPhase(e.target.value)} className={selectClass}>
                  {REPORT_PHASES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Row 3: NATO ratings */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Source Reliability (NATO)</label>
              <select value={sourceReliability} onChange={(e) => setSourceReliability(e.target.value)} className={selectClass}>
                {SOURCE_RELIABILITY.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Info Credibility (NATO)</label>
              <select value={infoCredibility} onChange={(e) => setInfoCredibility(Number(e.target.value))} className={selectClass}>
                {INFO_CREDIBILITY.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row 4: Location + System + Hostile */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Location</label>
              <input type="text" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="CRU-L1, Grim HEX" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Star System</label>
              <input type="text" value={starSystem} onChange={(e) => setStarSystem(e.target.value)} placeholder="Stanton, Pyro" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Hostile Group</label>
              <input type="text" value={hostileGroup} onChange={(e) => setHostileGroup(e.target.value)} placeholder="Group or org name" className={inputClass} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Detailed account of the intelligence observation..." className={inputClass + " resize-none"} />
          </div>

          {/* Tags */}
          <div>
            <label className={labelClass}>Tags (comma-separated)</label>
            <input type="text" value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="piracy, interdiction, mining-lane" className={inputClass} />
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
              {submitting ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save Changes" : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
