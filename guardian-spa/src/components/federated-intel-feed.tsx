import { useState, useEffect, useCallback } from "react";
import { Shield, RefreshCw } from "lucide-react";

type FederatedIntelItem = {
  id: string;
  sourceInstanceId: string;
  sourceInstanceName: string;
  remoteReportId: string;
  title: string;
  reportType: string;
  severity: number;
  description: string | null;
  starSystem: string | null;
  hostileGroup: string | null;
  receivedAt: string;
};

export function FederatedIntelFeed() {
  const [items, setItems] = useState<FederatedIntelItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntel = useCallback(async () => {
    try {
      const res = await fetch("/api/federation/intel", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } catch {
      // Network error, will retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntel();
    const interval = setInterval(fetchIntel, 30000);
    return () => clearInterval(interval);
  }, [fetchIntel]);

  function timeAgo(iso: string): string {
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return "just now";
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  }

  if (loading) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
        <p className="text-[11px] text-[var(--color-text-faint)] text-center py-4">Loading federated intel...</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-violet-500/20 bg-[var(--color-panel)] panel-elevated">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <div>
          <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
            Federated Intel
          </p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Threat reports received from allied instances
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] tabular-nums text-[var(--color-text-faint)]">
            {items.length} report{items.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={fetchIntel}
            className="rounded-[var(--radius-sm)] p-1 text-[var(--color-text-faint)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-overlay-subtle)] transition"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 px-5">
          <Shield size={24} className="mx-auto mb-2 text-[var(--color-text-faint)]" />
          <p className="text-[11px] text-[var(--color-text-faint)]">No federated intel received</p>
          <p className="text-[10px] text-[var(--color-text-faint)] mt-1">Intel shared by connected peers will appear here</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {items.map((item) => (
            <div key={item.id} className="px-5 py-3 hover:bg-[var(--color-hover)] transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.06em] text-[var(--color-text-strong)] truncate">
                      {item.title}
                    </p>
                    <span className="shrink-0 rounded-[var(--radius-sm)] border border-red-400/20 bg-red-400/8 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-red-200">
                      Sev {item.severity}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--color-text-tertiary)]">
                    <span className="uppercase tracking-[0.08em]">{item.reportType.replaceAll("_", " ")}</span>
                    <span>from</span>
                    <span className="font-semibold text-violet-300">{item.sourceInstanceName}</span>
                    <span className="tabular-nums">{timeAgo(item.receivedAt)}</span>
                  </div>
                </div>
              </div>
              {item.description && (
                <p className="mt-1.5 text-[11px] leading-snug text-[var(--color-text-secondary)] line-clamp-2">
                  {item.description}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-[var(--color-text-faint)]">
                {item.starSystem && <span>{item.starSystem}</span>}
                {item.hostileGroup && <span className="text-[var(--color-accent)]">{item.hostileGroup}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
