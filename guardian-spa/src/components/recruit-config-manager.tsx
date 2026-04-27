import { useState, useEffect } from "react";
import { Save, Plus, X, Loader2, ToggleLeft, ToggleRight } from "lucide-react";

export function RecruitConfigManager() {
  const [headline, setHeadline] = useState("Join the crew.");
  const [description, setDescription] = useState(
    "We're looking for new members. Submit an application below."
  );
  const [values, setValues] = useState<string[]>([]);
  const [newValue, setNewValue] = useState("");
  const [ctaText, setCtaText] = useState("Submit Application");
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/admin/recruit/config", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setHeadline(data.headline);
          setDescription(data.description);
          setValues(Array.isArray(data.values) ? data.values : []);
          setCtaText(data.ctaText);
          setIsEnabled(data.isEnabled);
        }
      })
      .catch(() => setStatus("Failed to load config."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch("/api/admin/recruit/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ headline, description, values, ctaText, isEnabled }),
      });
      const data = await res.json();
      setStatus(data.ok ? "Saved." : data.error || "Failed to save.");
    } catch {
      setStatus("Network error.");
    } finally {
      setSaving(false);
    }
  }

  function addValue() {
    const v = newValue.trim();
    if (v && !values.includes(v)) {
      setValues([...values, v]);
      setNewValue("");
    }
  }

  function removeValue(i: number) {
    setValues(values.filter((_, idx) => idx !== i));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
        <Loader2 size={14} className="animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[var(--color-text-strong)]">Recruitment Page</p>
          <p className="text-[11px] text-[var(--color-text-tertiary)]">
            When enabled, the public /recruit page shows your content and accepts applications.
          </p>
        </div>
        <button
          onClick={() => setIsEnabled(!isEnabled)}
          className="text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-strong)]"
        >
          {isEnabled ? (
            <ToggleRight size={28} className="text-emerald-400" />
          ) : (
            <ToggleLeft size={28} />
          )}
        </button>
      </div>

      <div>
        <label className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Headline</label>
        <input
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          maxLength={200}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-amber-400/40 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-amber-400/40 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Values / Tags</label>
        <div className="mb-2 flex flex-wrap gap-2">
          {values.map((v, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-amber-300/20 bg-amber-300/8 px-2.5 py-1 text-xs text-amber-200"
            >
              {v}
              <button onClick={() => removeValue(i)} className="text-amber-300/60 hover:text-amber-200">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Add a value..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addValue();
              }
            }}
            className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-amber-400/40 focus:outline-none"
          />
          <button
            onClick={addValue}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition hover:bg-[var(--color-overlay-subtle)]"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Button Text</label>
        <input
          type="text"
          value={ctaText}
          onChange={(e) => setCtaText(e.target.value)}
          maxLength={50}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-amber-400/40 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-amber-300/30 bg-amber-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-950 transition hover:bg-amber-200 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save
        </button>
        {status && (
          <span className={`text-xs ${status === "Saved." ? "text-emerald-400" : "text-red-400"}`}>
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
