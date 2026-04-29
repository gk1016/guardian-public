import { useState } from "react";
import { api } from "@/lib/api";
import type { IntelSummary, ThreatActorSummary } from "@/hooks/use-views";

const ASSESSMENT_TYPES = [
  { value: "intsum", label: "Intelligence Summary (INTSUM)" },
  { value: "threat_assessment", label: "Threat Assessment" },
  { value: "pattern_analysis", label: "Pattern Analysis" },
  { value: "coa_prediction", label: "COA Prediction" },
];

interface AnalysisRequestFormProps {
  availableIntel?: { id: string; title: string; severity: number }[];
  availableActors?: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

export function AnalysisRequestForm({
  availableIntel = [],
  availableActors = [],
  onClose,
  onSaved,
}: AnalysisRequestFormProps) {
  const [assessmentType, setAssessmentType] = useState("intsum");
  const [selectedIntel, setSelectedIntel] = useState<Set<string>>(new Set());
  const [threatActorId, setThreatActorId] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleIntel(id: string) {
    setSelectedIntel((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post("/api/intel/analyze", {
        assessmentType,
        sourceIntelIds: selectedIntel.size > 0 ? Array.from(selectedIntel) : undefined,
        threatActorId: threatActorId || undefined,
        additionalContext: additionalContext.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || "Analysis generation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 pt-16 pb-8">
      <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-6 shadow-xl">
        <h2 className="mb-4 font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          Generate AI Analysis
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Assessment Type */}
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              Analysis Type
            </label>
            <select
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value)}
              className={inputClass}
            >
              {ASSESSMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Source Intel */}
          {availableIntel.length > 0 && (
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                Source Intel ({selectedIntel.size} selected, leave empty for latest 20)
              </label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                {availableIntel.map((intel) => (
                  <label
                    key={intel.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-[var(--color-overlay-subtle)]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIntel.has(intel.id)}
                      onChange={() => toggleIntel(intel.id)}
                      className="h-3 w-3 rounded border-[var(--color-border)] accent-[var(--color-accent)]"
                    />
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        intel.severity >= 8
                          ? "bg-red-400"
                          : intel.severity >= 5
                            ? "bg-amber-400"
                            : "bg-slate-400"
                      }`}
                    />
                    <span className="text-[var(--color-text-secondary)]">{intel.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Threat Actor */}
          {(assessmentType === "threat_assessment" || availableActors.length > 0) && (
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                Threat Actor {assessmentType === "threat_assessment" ? "(recommended)" : "(optional)"}
              </label>
              <select
                value={threatActorId}
                onChange={(e) => setThreatActorId(e.target.value)}
                className={inputClass}
              >
                <option value="">-- None --</option>
                {availableActors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Additional Context */}
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              Additional Context (optional)
            </label>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={3}
              placeholder="Provide any additional context or specific questions for the analysis..."
              className={inputClass + " resize-none"}
            />
          </div>

          {error && (
            <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-text-tertiary)] hover:bg-[var(--color-border)]/20"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-2 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 disabled:opacity-40"
            >
              {submitting ? "Generating analysis..." : "Generate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
