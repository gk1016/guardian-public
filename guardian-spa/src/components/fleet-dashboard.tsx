import { useState, useEffect, useCallback } from "react";
import {
  Anchor,
  RefreshCw,
  Plus,
  Trash2,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

type ShipSpec = {
  id: string;
  name: string;
  manufacturer: string;
  classification: string;
  focus: string | null;
  crewMin: number;
  crewMax: number;
  cargo: number;
  imageUrl: string | null;
  inGame?: boolean;
};

type FleetShip = {
  id: string;
  shipName: string | null;
  status: string;
  notes: string | null;
  shipSpec: ShipSpec;
  user: { handle: string; displayName: string | null };
};

type ReadinessData = {
  totalShips: number;
  uniqueTypes: number;
  uniqueOwners: number;
  memberCount: number;
  crewCapacity: { min: number; max: number };
  totalCargo: number;
  crewSufficiency: "full" | "minimum" | "undermanned";
  byClassification: Record<
    string,
    {
      count: number;
      crewRequired: number;
      crewMinimum: number;
      ships: { name: string; owner: string; crewMax: number; shipName: string | null }[];
    }
  >;
};

import {
  Crosshair,
  Truck,
  Globe,
  Wrench,
  Shield,
  Layers,
  Gamepad2,
} from "lucide-react";

const CLASS_META: Record<string, { icon: any; color: string; label: string }> = {
  combat: { icon: Crosshair, color: "text-red-300 border-red-400/20 bg-red-400/8", label: "Combat" },
  transport: { icon: Truck, color: "text-amber-300 border-amber-400/20 bg-amber-400/8", label: "Transport" },
  exploration: { icon: Globe, color: "text-cyan-300 border-cyan-400/20 bg-cyan-400/8", label: "Exploration" },
  industrial: { icon: Wrench, color: "text-orange-300 border-orange-400/20 bg-orange-400/8", label: "Industrial" },
  support: { icon: Shield, color: "text-emerald-300 border-emerald-400/20 bg-emerald-400/8", label: "Support" },
  multi: { icon: Layers, color: "text-purple-300 border-purple-400/20 bg-purple-400/8", label: "Multi-Role" },
  competition: { icon: Gamepad2, color: "text-pink-300 border-pink-400/20 bg-pink-400/8", label: "Competition" },
  ground: { icon: Truck, color: "text-yellow-300 border-yellow-400/20 bg-yellow-400/8", label: "Ground" },
};

function classInfo(cls: string) {
  return CLASS_META[cls] ?? { icon: Anchor, color: "text-[var(--color-text-tertiary)]", label: cls };
}

export function FleetDashboard({ isAdmin }: { isAdmin: boolean }) {
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [ships, setShips] = useState<FleetShip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddShip, setShowAddShip] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [rRes, sRes] = await Promise.all([
        fetch("/api/fleet/readiness", { credentials: "include" }),
        fetch("/api/fleet/ships", { credentials: "include" }),
      ]);
      const rData = await rRes.json();
      const sData = await sRes.json();
      setReadiness(rData.readiness ?? null);
      setShips(sData.ships ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/fleet/sync-specs", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult({ ok: true, message: `${data.synced} ship specs synced from Fleetyards` });
      } else {
        setSyncResult({ ok: false, message: data.error || "Sync failed" });
      }
    } catch {
      setSyncResult({ ok: false, message: "Failed to reach server" });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 6000);
    }
  }

  async function handleRemoveShip(shipId: string) {
    try {
      const res = await fetch(`/api/fleet/ships/${shipId}`, { method: "DELETE", credentials: "include" });
      if (res.ok) await fetchData();
    } catch { /* silent */ }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--color-text-tertiary)]">
        <Loader2 size={16} className="animate-spin" /> Loading fleet data...
      </div>
    );
  }

  const suffColor = readiness?.crewSufficiency === "full"
    ? "text-emerald-300 border-emerald-400/20 bg-emerald-400/8"
    : readiness?.crewSufficiency === "minimum"
      ? "text-amber-300 border-amber-400/20 bg-amber-400/8"
      : "text-red-300 border-red-400/20 bg-red-400/8";

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="rounded-[var(--radius-sm)] border border-purple-400/20 bg-purple-400/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-purple-200 transition hover:bg-purple-400/15 disabled:opacity-50">
            <span className="flex items-center gap-1.5">
              <RefreshCw size={10} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync Ship Database"}
            </span>
          </button>
          {syncResult && (
            <span className={`flex items-center gap-1.5 text-[10px] ${syncResult.ok ? "text-emerald-300" : "text-red-300"}`}>
              {syncResult.ok ? <CheckCircle size={10} /> : <XCircle size={10} />}
              {syncResult.message}
            </span>
          )}
        </div>
      )}

      {readiness && readiness.totalShips > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Ships" value={readiness.totalShips} sub={`${readiness.uniqueTypes} types`} />
            <StatCard label="Ship Owners" value={readiness.uniqueOwners} sub={`of ${readiness.memberCount} members`} />
            <StatCard label="Crew Capacity" value={`${readiness.crewCapacity.min}-${readiness.crewCapacity.max}`} sub={
              <span className={`inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-1.5 py-0 text-[8px] uppercase tracking-[0.1em] ${suffColor}`}>
                {readiness.crewSufficiency}
              </span>
            } />
            <StatCard label="Cargo Capacity" value={readiness.totalCargo.toLocaleString()} sub="SCU" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(readiness.byClassification)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([cls, data]) => {
                const meta = classInfo(cls);
                const Icon = meta.icon;
                return (
                  <div key={cls} className={`rounded-[var(--radius-md)] border p-3 ${meta.color}`}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em]">
                        <Icon size={14} /> {meta.label}
                      </span>
                      <span className="text-lg font-bold">{data.count}</span>
                    </div>
                    <div className="mt-1 text-[10px] opacity-70">
                      Crew: {data.crewMinimum}-{data.crewRequired}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {data.ships.map((s, i) => (
                        <span key={i} className="rounded-[var(--radius-sm)] border border-current/10 bg-current/5 px-1.5 py-0.5 text-[9px]">
                          {s.name} <span className="opacity-60">({s.owner})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-center">
          <Anchor size={32} className="mx-auto mb-2 text-[var(--color-text-faint)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">No ships registered yet.</p>
          <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
            {isAdmin ? "Sync the ship database first, then add ships." : "Ask an admin to sync the ship database, then add your ships."}
          </p>
        </div>
      )}

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Ship Registry</p>
          <button onClick={() => setShowAddShip(!showAddShip)}
            className="rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-cyan-200 transition hover:bg-cyan-400/15">
            <span className="flex items-center gap-1.5">
              <Plus size={10} /> Add Ship
            </span>
          </button>
        </div>

        {showAddShip && (
          <AddShipForm onAdded={() => { setShowAddShip(false); fetchData(); }} />
        )}

        {ships.length > 0 ? (
          <div className="space-y-1">
            {ships.map((s) => {
              const meta = classInfo(s.shipSpec.classification);
              return (
                <div key={s.id} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2">
                  <div className="flex items-center gap-3">
                    {s.shipSpec.imageUrl ? (
                      <img src={s.shipSpec.imageUrl} alt={s.shipSpec.name} className="h-8 w-12 rounded-[var(--radius-sm)] object-cover bg-black/20" />
                    ) : (
                      <div className="flex h-8 w-12 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-overlay-subtle)]">
                        <Anchor size={14} className="text-[var(--color-text-faint)]" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-[var(--color-text-strong)]">
                        {s.shipSpec.name}
                        {s.shipName ? <span className="ml-1.5 text-[var(--color-text-tertiary)]">"{s.shipName}"</span> : null}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">
                        {s.shipSpec.manufacturer} · {s.user.handle} · crew {s.shipSpec.crewMin}-{s.shipSpec.crewMax}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-[var(--radius-sm)] border px-1.5 py-0 text-[8px] uppercase tracking-[0.1em] ${meta.color}`}>
                      {meta.label}
                    </span>
                    <button onClick={() => handleRemoveShip(s.id)} title="Remove"
                      className="text-[var(--color-text-faint)] transition hover:text-red-300">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : !showAddShip ? (
          <p className="py-4 text-center text-xs text-[var(--color-text-tertiary)]">No ships in registry.</p>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-3">
      <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--color-text-strong)]">{value}</p>
      <div className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">{sub}</div>
    </div>
  );
}

function AddShipForm({ onAdded }: { onAdded: () => void }) {
  const [search, setSearch] = useState("");
  const [specs, setSpecs] = useState<ShipSpec[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ShipSpec | null>(null);
  const [shipName, setShipName] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleSearch(q: string) {
    setSearch(q);
    if (q.length < 2) { setSpecs([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/fleet/specs?q=${encodeURIComponent(q)}`, { credentials: "include" });
      const data = await res.json();
      setSpecs(data.specs ?? []);
    } catch { setSpecs([]); }
    finally { setSearching(false); }
  }

  async function handleAdd() {
    if (!selected) return;
    setAdding(true);
    try {
      const res = await fetch("/api/fleet/ships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          shipSpecId: selected.id,
          shipName: shipName.trim() || undefined,
        }),
      });
      if (res.ok) onAdded();
    } catch { /* silent */ }
    finally { setAdding(false); }
  }

  return (
    <div className="mb-3 rounded-[var(--radius-md)] border border-cyan-400/20 bg-cyan-400/5 p-3 space-y-2">
      {!selected ? (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
            <input
              autoFocus
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder='Search ships... (e.g. Gladius, Hammerhead)'
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-cyan-400/40 focus:outline-none"
            />
          </div>
          {searching && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
              <Loader2 size={12} className="animate-spin" /> Searching...
            </div>
          )}
          {specs.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {specs.map((sp) => {
                const meta = classInfo(sp.classification);
                return (
                  <button key={sp.id} type="button" onClick={() => setSelected(sp)}
                    className="flex w-full items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-left transition hover:border-cyan-400/30 hover:bg-cyan-400/5">
                    <div className="flex items-center gap-3">
                      {sp.imageUrl ? (
                        <img src={sp.imageUrl} alt={sp.name} className="h-7 w-10 rounded object-cover bg-black/20" />
                      ) : null}
                      <div>
                        <p className="text-xs font-medium text-[var(--color-text-strong)]">{sp.name}</p>
                        <p className="text-[10px] text-[var(--color-text-tertiary)]">{sp.manufacturer} · crew {sp.crewMin}-{sp.crewMax} · {sp.cargo} SCU</p>
                      </div>
                    </div>
                    <span className={`rounded-[var(--radius-sm)] border px-1.5 py-0 text-[8px] uppercase tracking-[0.1em] ${meta.color}`}>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {selected.imageUrl ? (
              <img src={selected.imageUrl} alt={selected.name} className="h-10 w-14 rounded object-cover bg-black/20" />
            ) : null}
            <div>
              <p className="text-sm font-medium text-[var(--color-text-strong)]">{selected.name}</p>
              <p className="text-[10px] text-[var(--color-text-tertiary)]">{selected.manufacturer} · crew {selected.crewMin}-{selected.crewMax}</p>
            </div>
            <button onClick={() => { setSelected(null); setSearch(""); }}
              className="ml-auto text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
              Change
            </button>
          </div>
          <input value={shipName} onChange={(e) => setShipName(e.target.value)} placeholder='Ship name (optional)'
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-cyan-400/40 focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={adding}
              className="rounded-[var(--radius-sm)] border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-[11px] uppercase tracking-[0.1em] text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50">
              {adding ? "Adding..." : "Add to Fleet"}
            </button>
            <button onClick={() => { setSelected(null); setSearch(""); }}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-secondary)]">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
