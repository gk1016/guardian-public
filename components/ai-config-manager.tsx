"use client";

import { useState, useEffect, useCallback } from "react";
import { ToggleLeft, ToggleRight, RefreshCw, Activity, CheckCircle, XCircle, Loader2 } from "lucide-react";

const ENGINE_BASE = "/engine";

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic (Claude)", needsKey: true, needsUrl: false },
  { value: "openai", label: "OpenAI (GPT)", needsKey: true, needsUrl: true },
  { value: "google", label: "Google (Gemini)", needsKey: true, needsUrl: false },
  { value: "ollama_cloud", label: "Ollama Cloud", needsKey: false, needsUrl: true },
  { value: "ollama_local", label: "Ollama Local", needsKey: false, needsUrl: true },
];

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  google: "gemini-2.0-flash",
  ollama_cloud: "llama3.1:70b",
  ollama_local: "llama3.1:8b",
};

const DEFAULT_URLS: Record<string, string> = {
  openai: "https://api.openai.com",
  ollama_cloud: "",
  ollama_local: "http://localhost:11434",
};

const ANALYSIS_TYPES = [
  { value: "threat_assessment", label: "Threat Assessment" },
  { value: "sitrep", label: "SITREP Summary" },
  { value: "mission_advisory", label: "Mission Advisories" },
  { value: "rescue_triage", label: "Rescue Triage" },
];

type AiConfig = {
  id: string | null;
  provider: string;
  model: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
  tickIntervalSecs: number;
};

type Analysis = {
  id: string;
  analysisType: string;
  summary: string;
  provider: string;
  model: string;
  createdAt: string;
};

export function AiConfigManager() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    apiKey: "",
    baseUrl: "",
    maxTokens: "2048",
    temperature: "0.3",
    tickIntervalSecs: "300",
    enabled: false,
  });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${ENGINE_BASE}/api/ai/config`);
      const data = await res.json();
      if (data.config) {
        setConfig(data.config);
        setForm({
          provider: data.config.provider,
          model: data.config.model,
          apiKey: "",
          baseUrl: data.config.baseUrl || "",
          maxTokens: String(data.config.maxTokens),
          temperature: String(data.config.temperature),
          tickIntervalSecs: String(data.config.tickIntervalSecs),
          enabled: data.config.enabled,
        });
      }
    } catch {
      setError("Failed to load AI configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnalyses = useCallback(async () => {
    try {
      const res = await fetch(`${ENGINE_BASE}/api/ai/analyses`);
      const data = await res.json();
      setAnalyses(data.analyses ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchAnalyses();
  }, [fetchConfig, fetchAnalyses]);

  function handleProviderChange(provider: string) {
    setForm({
      ...form,
      provider,
      model: DEFAULT_MODELS[provider] || "",
      baseUrl: DEFAULT_URLS[provider] || "",
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setTestResult(null);
    try {
      const body: Record<string, unknown> = {
        provider: form.provider,
        model: form.model,
        max_tokens: parseInt(form.maxTokens) || 2048,
        temperature: parseFloat(form.temperature) || 0.3,
        tick_interval_secs: parseInt(form.tickIntervalSecs) || 300,
        enabled: form.enabled,
      };
      if (form.apiKey) body.api_key = form.apiKey;
      if (form.baseUrl) body.base_url = form.baseUrl;

      const res = await fetch(`${ENGINE_BASE}/api/ai/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save configuration.");
        return;
      }
      await fetchConfig();
      setShowForm(false);
    } catch {
      setError("Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${ENGINE_BASE}/api/ai/test`, { method: "POST" });
      const data = await res.json();
      setTestResult({
        ok: data.ok === true,
        message: data.ok ? `Connected: ${data.provider} / ${data.model}` : (data.error || "Connection failed"),
      });
    } catch {
      setTestResult({ ok: false, message: "Failed to reach engine" });
    } finally {
      setTesting(false);
    }
  }

  async function handleAnalyze(type: string) {
    setAnalyzing(type);
    try {
      const res = await fetch(`${ENGINE_BASE}/api/ai/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        setTimeout(() => fetchAnalyses(), 2000);
      } else {
        const data = await res.json();
        setError(data.error || "Analysis failed.");
      }
    } catch {
      setError("Failed to trigger analysis.");
    } finally {
      setAnalyzing(null);
    }
  }

  const providerInfo = PROVIDERS.find(p => p.value === form.provider);

  if (loading) return <p className="text-sm text-[var(--color-text-tertiary)]">Loading AI configuration...</p>;

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-[var(--radius-sm)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-200">{error}</div> : null}

      {/* Status Banner */}
      {config ? (
        <div className={`rounded-[var(--radius-md)] border p-4 ${config.enabled ? "border-emerald-400/20 bg-emerald-400/8" : "border-amber-400/20 bg-amber-400/8"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-strong)]">
                {config.enabled ? "Guardian AI Active" : "Guardian AI Configured (Disabled)"}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
                {config.provider} / {config.model} &mdash; tick every {config.tickIntervalSecs}s
              </p>
            </div>
            <div className="flex items-center gap-2">
              {config.enabled && (
                <button onClick={handleTest} disabled={testing}
                  className="rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-cyan-200 transition hover:bg-cyan-400/15 disabled:opacity-50">
                  {testing ? "Testing..." : "Test Connection"}
                </button>
              )}
              <button onClick={() => setShowForm(!showForm)}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border-bright)] bg-[var(--color-overlay-subtle)] px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-strong)]">
                {showForm ? "Cancel" : "Edit"}
              </button>
            </div>
          </div>
          {testResult && (
            <div className={`mt-3 flex items-center gap-2 text-xs ${testResult.ok ? "text-emerald-300" : "text-red-300"}`}>
              {testResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {testResult.message}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">No AI provider configured.</p>
          <button onClick={() => setShowForm(true)}
            className="mt-2 rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/8 px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-cyan-200 transition hover:bg-cyan-400/15">
            + Configure AI
          </button>
        </div>
      )}

      {/* Config Form */}
      {showForm && (
        <form onSubmit={handleSave} className="rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-input-bg)] p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Provider</span>
              <select value={form.provider} onChange={(e) => handleProviderChange(e.target.value)}
                className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] focus:border-cyan-400/40 focus:outline-none">
                {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Model</span>
              <input type="text" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
                className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-cyan-400/40 focus:outline-none"
                placeholder="e.g. claude-sonnet-4-20250514" />
            </label>

            {providerInfo?.needsKey !== false && (
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                  API Key {config?.hasApiKey && <span className="text-emerald-400">(configured)</span>}
                </span>
                <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-cyan-400/40 focus:outline-none"
                  placeholder={config?.hasApiKey ? "Leave blank to keep current" : "sk-..."} />
              </label>
            )}

            {providerInfo?.needsUrl && (
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Base URL</span>
                <input type="text" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-cyan-400/40 focus:outline-none"
                  placeholder={DEFAULT_URLS[form.provider] || "https://..."} />
              </label>
            )}

            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Max Tokens</span>
              <input type="number" value={form.maxTokens} onChange={(e) => setForm({ ...form, maxTokens: e.target.value })}
                min="256" max="8192"
                className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] focus:border-cyan-400/40 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Temperature</span>
              <input type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] focus:border-cyan-400/40 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Tick Interval (seconds)</span>
              <input type="number" min="60" max="3600" value={form.tickIntervalSecs} onChange={(e) => setForm({ ...form, tickIntervalSecs: e.target.value })}
                className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] focus:border-cyan-400/40 focus:outline-none" />
            </label>
            <label className="flex items-center gap-3 pt-5">
              <button type="button" onClick={() => setForm({ ...form, enabled: !form.enabled })} className="text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-strong)]">
                {form.enabled ? <ToggleRight size={24} className="text-emerald-400" /> : <ToggleLeft size={24} />}
              </button>
              <span className="text-sm text-[var(--color-text-secondary)]">{form.enabled ? "Enabled" : "Disabled"}</span>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="rounded-[var(--radius-sm)] border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-[11px] uppercase tracking-[0.1em] text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50">
              {saving ? "Saving..." : "Save Configuration"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-secondary)]">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Analysis Controls */}
      {config?.enabled && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-4">
          <p className="mb-3 text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">On-Demand Analysis</p>
          <div className="flex flex-wrap gap-2">
            {ANALYSIS_TYPES.map(t => (
              <button key={t.value} onClick={() => handleAnalyze(t.value)} disabled={analyzing !== null}
                className="rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-cyan-200 transition hover:bg-cyan-400/15 disabled:opacity-50">
                {analyzing === t.value ? (
                  <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Running...</span>
                ) : t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Analyses */}
      {analyses.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Recent Analyses</p>
            <button onClick={fetchAnalyses} className="text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-secondary)]">
              <RefreshCw size={12} />
            </button>
          </div>
          {analyses.slice(0, 10).map(a => (
            <details key={a.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input-bg)]">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Activity size={14} className="text-cyan-400" />
                  <span className="text-xs font-medium text-[var(--color-text-strong)]">{a.analysisType.replace(/_/g, " ").toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-tertiary)]">
                  <span>{a.provider}/{a.model}</span>
                  <span>{new Date(a.createdAt).toLocaleString()}</span>
                </div>
              </summary>
              <div className="border-t border-[var(--color-border)] px-4 py-3">
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--color-text-secondary)]">{a.summary}</pre>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
