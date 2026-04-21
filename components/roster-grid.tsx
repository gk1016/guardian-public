"use client";

import { useState } from "react";
import Link from "next/link";
import { Radar, ArrowUpDown, Activity } from "lucide-react";

type RosterCrewItem = {
  handle: string;
  displayName: string | null;
  orgRole: string;
  membershipTitle: string | null;
  qrfStatus: string | null;
  suggestedPlatform: string | null;
  sourceLabel: string;
  notes: string | null;
  commitments: {
    missionId: string;
    callsign: string;
    missionStatus: string;
    assignmentStatus: string;
    role: string;
  }[];
  availabilityLabel: "available" | "tasked" | "engaged";
  activityScore: number;
  activityTier: "active" | "moderate" | "dormant" | "dark";
  lastActiveLabel: string | null;
  missionCount: number;
  logCount: number;
};

const availabilityTone: Record<string, string> = {
  available: "border-emerald-400/20 bg-emerald-400/8 text-emerald-200",
  tasked: "border-amber-400/20 bg-amber-400/8 text-amber-200",
  engaged: "border-red-500/20 bg-red-500/8 text-red-200",
};

const tierTone: Record<string, { label: string; color: string; bar: string }> = {
  active: { label: "ACTIVE", color: "text-emerald-300", bar: "bg-emerald-400" },
  moderate: { label: "MODERATE", color: "text-amber-300", bar: "bg-amber-400" },
  dormant: { label: "DORMANT", color: "text-orange-400", bar: "bg-orange-500" },
  dark: { label: "DARK", color: "text-red-400", bar: "bg-red-500" },
};

type SortMode = "activity" | "alpha" | "availability";

export function RosterGrid({ items }: { items: RosterCrewItem[] }) {
  const [sortMode, setSortMode] = useState<SortMode>("activity");

  const sorted = [...items].sort((a, b) => {
    if (sortMode === "activity") return b.activityScore - a.activityScore;
    if (sortMode === "availability") {
      const order: Record<string, number> = { available: 0, tasked: 1, engaged: 2 };
      return (order[a.availabilityLabel] ?? 3) - (order[b.availabilityLabel] ?? 3);
    }
    return a.handle.localeCompare(b.handle);
  });

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <ArrowUpDown size={13} className="text-slate-500" />
        <span className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Sort:</span>
        {(["activity", "alpha", "availability"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            className={`rounded-[var(--radius-sm)] border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition ${
              sortMode === mode
                ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                : "border-[var(--color-border)] bg-white/3 text-slate-500 hover:text-slate-300"
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {sorted.map((crew) => {
          const tier = tierTone[crew.activityTier];
          return (
            <article key={crew.handle} className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.08em] text-white">{crew.displayName ?? crew.handle}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-slate-500">{crew.handle} / {crew.orgRole}</p>
                </div>
                <span className={`rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${availabilityTone[crew.availabilityLabel]}`}>{crew.availabilityLabel}</span>
              </div>

              <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-black/15 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={12} className={tier.color} />
                    <span className={`text-[10px] uppercase tracking-[0.1em] font-medium ${tier.color}`}>{tier.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>{crew.missionCount} msn</span>
                    <span>{crew.logCount} log</span>
                    {crew.lastActiveLabel ? <span>{crew.lastActiveLabel}</span> : null}
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${tier.bar}`}
                    style={{ width: `${crew.activityScore}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-[11px]">
                <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/3 px-3 py-2">
                  <span className="text-slate-500">Source:</span> <span className="text-white">{crew.sourceLabel}</span>
                </div>
                <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/3 px-3 py-2">
                  <span className="text-slate-500">QRF:</span> <span className="text-white">{crew.qrfStatus ?? "None"}</span> / <span className="text-slate-500">Platform:</span> <span className="text-white">{crew.suggestedPlatform ?? "Pending"}</span>
                </div>
              </div>

              <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-black/15 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Radar size={13} className="text-cyan-300" />
                  <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Commitments</p>
                </div>
                <div className="mt-2 space-y-1.5">
                  {crew.commitments.length > 0 ? crew.commitments.map((c) => (
                    <Link key={`${crew.handle}-${c.missionId}`} href={`/missions/${c.missionId}`} className="block rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/3 px-3 py-2 transition hover:bg-white/5">
                      <p className="text-xs font-medium text-white">{c.callsign}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{c.assignmentStatus} / {c.role}</p>
                    </Link>
                  )) : (
                    <p className="text-[11px] text-emerald-300">No active commitments.</p>
                  )}
                </div>
              </div>

              {crew.notes ? <p className="mt-2 text-sm leading-6 text-slate-400">{crew.notes}</p> : null}
            </article>
          );
        })}
        {sorted.length === 0 ? <p className="text-sm text-slate-500">No crew loaded.</p> : null}
      </section>
    </>
  );
}
