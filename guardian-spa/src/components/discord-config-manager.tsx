import { useState, useEffect, useCallback } from "react";
import { ToggleLeft, ToggleRight, CheckCircle, XCircle, Hash } from "lucide-react";

const ENGINE_BASE = "/engine";

type DiscordConfig = {
  id: string | null;
  hasBotToken: boolean;
  guildId: string | null;
  enabled: boolean;
  mainChannelId: string | null;
  alertChannelId: string | null;
  intelChannelId: string | null;
  missionChannelId: string | null;
};

export function DiscordConfigManager() {
  const [config, setConfig] = useState<DiscordConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    botToken: "",
    guildId: "",
    enabled: false,
    mainChannelId: "",
    alertChannelId: "",
    intelChannelId: "",
    missionChannelId: "",
  });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${ENGINE_BASE}/api/discord/config`, { credentials: "include" });
      const data = await res.json();
      if (data.config) {
        setConfig(data.config);
        setForm({
          botToken: "",
          guildId: data.config.guildId || "",
          enabled: data.config.enabled,
          mainChannelId: data.config.mainChannelId || "",
          alertChannelId: data.config.alertChannelId || "",
          intelChannelId: data.config.intelChannelId || "",
          missionChannelId: data.config.missionChannelId || "",
        });
      }
    } catch {
      setError("Failed to load Discord configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setTestResult(null);
    try {
      const body: Record<string, unknown> = {
        guild_id: form.guildId || undefined,
        enabled: form.enabled,
        main_channel_id: form.mainChannelId || undefined,
        alert_channel_id: form.alertChannelId || undefined,
        intel_channel_id: form.intelChannelId || undefined,
        mission_channel_id: form.missionChannelId || undefined,
      };
      if (form.botToken) body.bot_token = form.botToken;

      const res = await fetch(`${ENGINE_BASE}/api/discord/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save configuration.");
        return;
      }
      const result = await res.json();
      if (result.bot_restarted === false) {
        setError("Config saved but bot failed to start -- check engine logs.");
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
      const res = await fetch(`${ENGINE_BASE}/api/discord/test`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        const parts = [];
        if (data.username) parts.push(`Bot: ${data.username}`);
        if (data.guild_name) parts.push(`Server: ${data.guild_name}`);
        setTestResult({ ok: true, message: parts.join(" | ") || "Connected" });
      } else {
        setTestResult({ ok: false, message: data.error || "Connection failed" });
      }
    } catch {
      setTestResult({ ok: false, message: "Failed to reach engine" });
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <p className="text-sm text-[var(--color-text-tertiary)]">Loading Discord configuration...</p>;

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-[var(--radius-sm)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-200">{error}</div> : null}

      {config ? (
        <div className={`rounded-[var(--radius-md)] border p-4 ${config.enabled ? "border-indigo-400/20 bg-indigo-400/8" : "border-amber-400/20 bg-amber-400/8"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-strong)]">
                {config.enabled ? "Discord Bot Active" : "Discord Bot Configured (Disabled)"}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
                Guild: {config.guildId ?? "Not set"}
                {config.mainChannelId ? ` | Main: #${config.mainChannelId}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleTest} disabled={testing || !config.hasBotToken}
                className="rounded-[var(--radius-sm)] border border-indigo-400/20 bg-indigo-400/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-indigo-200 transition hover:bg-indigo-400/15 disabled:opacity-50">
                {testing ? "Testing..." : "Test Connection"}
              </button>
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
          <p className="text-sm text-[var(--color-text-secondary)]">No Discord bot configured.</p>
          <button onClick={() => setShowForm(true)}
            className="mt-2 rounded-[var(--radius-sm)] border border-indigo-400/20 bg-indigo-400/8 px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-indigo-200 transition hover:bg-indigo-400/15">
            + Configure Discord
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-input-bg)] p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                Bot Token {config?.hasBotToken && <span className="text-emerald-400">(configured)</span>}
              </span>
              <input type="password" value={form.botToken} onChange={(e) => setForm({ ...form, botToken: e.target.value })}
                className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-indigo-400/40 focus:outline-none"
                placeholder={config?.hasBotToken ? "Leave blank to keep current" : "Bot token from Discord Developer Portal"} />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Guild (Server) ID</span>
              <input type="text" value={form.guildId} onChange={(e) => setForm({ ...form, guildId: e.target.value })}
                className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-indigo-400/40 focus:outline-none"
                placeholder="Right-click server > Copy Server ID" />
            </label>
          </div>

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Channel Mappings</p>
            <div className="grid gap-3 md:grid-cols-2">
              <ChannelField label="Main Channel" sublabel="Default for all events" value={form.mainChannelId}
                onChange={(v) => setForm({ ...form, mainChannelId: v })} required />
              <ChannelField label="Alerts Channel" sublabel="QRF, rescues, alert triggers" value={form.alertChannelId}
                onChange={(v) => setForm({ ...form, alertChannelId: v })} />
              <ChannelField label="Intel Channel" sublabel="Intel reports, threat updates" value={form.intelChannelId}
                onChange={(v) => setForm({ ...form, intelChannelId: v })} />
              <ChannelField label="Missions Channel" sublabel="Mission status changes" value={form.missionChannelId}
                onChange={(v) => setForm({ ...form, missionChannelId: v })} />
            </div>
            <p className="mt-2 text-[10px] text-[var(--color-text-faint)]">
              Unset channels fall back to Main. Right-click any Discord channel and Copy Channel ID.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
            <label className="flex items-center gap-3">
              <button type="button" onClick={() => setForm({ ...form, enabled: !form.enabled })} className="text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-strong)]">
                {form.enabled ? <ToggleRight size={24} className="text-indigo-400" /> : <ToggleLeft size={24} />}
              </button>
              <span className="text-sm text-[var(--color-text-secondary)]">{form.enabled ? "Bot Enabled" : "Bot Disabled"}</span>
            </label>
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
          </div>
        </form>
      )}
    </div>
  );
}

function ChannelField({ label, sublabel, value, onChange, required }: {
  label: string;
  sublabel?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
        <Hash size={10} className="text-indigo-400/60" />
        {label}
        {required && <span className="text-red-400">*</span>}
      </span>
      {sublabel && <span className="text-[9px] text-[var(--color-text-faint)]">{sublabel}</span>}
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-indigo-400/40 focus:outline-none"
        placeholder="Channel ID" required={required} />
    </label>
  );
}
