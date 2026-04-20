import { Activity, AlertTriangle, ArrowRight, Clock3, Crosshair, Shield, Siren } from "lucide-react";

const activeMissions = [
  {
    callsign: "REAPER 11",
    type: "Escort",
    status: "Ready",
    summary: "Convoy escort package staged with two fighters and one support ship.",
  },
  {
    callsign: "GUARD 21",
    type: "CSAR",
    status: "Active",
    summary: "Priority rescue package preparing escort assignment and route confirmation.",
  },
  {
    callsign: "LANCER 06",
    type: "Recon",
    status: "Planning",
    summary: "Threat reconnaissance flight tasked to verify hostile contact corridor.",
  },
];

const intelItems = [
  "Hostile interdiction reports continue to cluster along common cargo transit lanes.",
  "Recent rescue traffic suggests at least one organized pirate group is baiting solo responders.",
  "Weather, route, and mass event overlays will be added in the next implementation slice.",
];

const qrfBoard = [
  { callsign: "SABER 1", status: "REDCON 2", platform: "F7A Mk II" },
  { callsign: "VIKING 2", status: "REDCON 3", platform: "Cutlass Red" },
  { callsign: "HAWK 5", status: "REDCON 2", platform: "Ares Inferno" },
];

export default function CommandPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-6 py-8 text-[var(--color-text)] lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.26em] text-slate-400">Guardian / Command Deck</p>
            <h1 className="mt-3 font-[family:var(--font-display)] text-5xl uppercase tracking-[0.14em] text-white">
              Watch Floor
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-8 text-slate-300">
              First-slice command surface for monitoring missions, rescue posture, and threat activity.
              Live data wiring comes next. This page is the design baseline for the authenticated ops
              side.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Active Missions</p>
              <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
                03
              </p>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">QRF Posture</p>
              <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
                REDCON 2
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-100">Open Rescue</p>
              <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
                01
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <Shield className="text-amber-300" size={20} />
                <div>
                  <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.18em] text-white">
                    Mission Board
                  </p>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
                    Current stack and status gates
                  </p>
                </div>
              </div>
              <ArrowRight className="text-slate-500" size={18} />
            </div>

            <div className="mt-5 space-y-4">
              {activeMissions.map((mission) => (
                <article
                  key={mission.callsign}
                  className="rounded-xl border border-white/10 bg-white/4 px-5 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.14em] text-white">
                        {mission.callsign}
                      </p>
                      <p className="mt-1 text-sm uppercase tracking-[0.16em] text-slate-400">
                        {mission.type}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-200">
                      {mission.status}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{mission.summary}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <Siren className="text-cyan-300" size={20} />
                <div>
                  <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.18em] text-white">
                    QRF Board
                  </p>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
                    Availability and launch posture
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {qrfBoard.map((entry) => (
                  <div
                    key={entry.callsign}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-4 py-3"
                  >
                    <div>
                      <p className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.14em] text-white">
                        {entry.callsign}
                      </p>
                      <p className="text-sm text-slate-400">{entry.platform}</p>
                    </div>
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                      {entry.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <Crosshair className="text-red-300" size={20} />
                <div>
                  <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.18em] text-white">
                    Threat Summary
                  </p>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
                    Intelligence queue
                  </p>
                </div>
              </div>
              <ul className="mt-5 space-y-3">
                {intelItems.map((item) => (
                  <li
                    key={item}
                    className="rounded-xl border border-red-500/15 bg-red-500/8 px-4 py-3 text-sm leading-7 text-slate-200"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <div className="flex items-center gap-3">
              <Activity size={18} className="text-amber-300" />
              <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                Pending Actions
              </p>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
              <li>Wire mission CRUD and briefing forms.</li>
              <li>Add auth and role-gated command access.</li>
              <li>Connect Prisma models to live mission, intel, and rescue boards.</li>
            </ul>
          </article>

          <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <div className="flex items-center gap-3">
              <Clock3 size={18} className="text-cyan-300" />
              <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                Dispatch Notes
              </p>
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-300">
              The ops shell is intentionally dense, map-first, and briefing-room oriented. Future pages
              should preserve this tone instead of collapsing into generic dashboard furniture.
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-300" />
              <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                Warning
              </p>
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-300">
              This is a bootstrap slice, not a fake finished product. Auth, persistence, mission edits,
              and real-time sync are the next implementation steps.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
