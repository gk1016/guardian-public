import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock3,
  Crosshair,
  Shield,
  Siren,
} from "lucide-react";
import { getCommandOverview } from "@/lib/guardian-data";

export const dynamic = "force-dynamic";

export default async function CommandPage() {
  const data = await getCommandOverview();

  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-6 py-8 text-[var(--color-text)] lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.26em] text-slate-400">{data.orgName} / Command Deck</p>
            <h1 className="mt-3 font-[family:var(--font-display)] text-5xl uppercase tracking-[0.14em] text-white">
              Watch Floor
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-8 text-slate-300">
              Guardian is now reading seeded operational data from Postgres. This is still pre-auth, but
              the command surface is no longer a fake static mock.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Active Missions</p>
              <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
                {data.activeMissionCount.toString().padStart(2, "0")}
              </p>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">QRF Posture</p>
              <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
                {data.qrfReadyCount.toString().padStart(2, "0")}
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-100">Open Rescue</p>
              <p className="mt-2 font-[family:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-white">
                {data.openRescueCount.toString().padStart(2, "0")}
              </p>
            </div>
          </div>
        </header>

        {data.error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            {data.error}
          </div>
        ) : null}

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
              <Link href="/missions" className="text-slate-500 transition hover:text-white">
                <ArrowRight size={18} />
              </Link>
            </div>

            <div className="mt-5 space-y-4">
              {data.missions.map((mission) => (
                <article
                  key={mission.id}
                  className="rounded-xl border border-white/10 bg-white/4 px-5 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.14em] text-white">
                        {mission.callsign}
                      </p>
                      <p className="mt-1 text-sm uppercase tracking-[0.16em] text-slate-400">
                        {mission.missionType}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-200">
                      {mission.status}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{mission.title}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                    {mission.participantCount} assigned / AO {mission.areaOfOperation ?? "pending"}
                  </p>
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
                {data.qrf.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-4 py-3"
                  >
                    <div>
                      <p className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.14em] text-white">
                        {entry.callsign}
                      </p>
                      <p className="text-sm text-slate-400">
                        {entry.platform ?? "Platform pending"} / Crew {entry.availableCrew}
                      </p>
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
                {data.intel.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-red-500/15 bg-red-500/8 px-4 py-3 text-sm leading-7 text-slate-200"
                  >
                    <div className="font-semibold text-white">{item.title}</div>
                    <div className="mt-1 text-slate-300">
                      {item.locationName ?? "Unknown location"} / {item.hostileGroup ?? "Unconfirmed hostile"}
                    </div>
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
                Live Modules
              </p>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
              <li>
                <Link href="/missions" className="transition hover:text-white">Mission board</Link>
              </li>
              <li>
                <Link href="/intel" className="transition hover:text-white">Threat picture</Link>
              </li>
              <li>
                <Link href="/rescues" className="transition hover:text-white">Rescue board</Link>
              </li>
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
              Seed data is now flowing through Prisma into the ops UI. The next meaningful correction is
              adding auth, role gates, and write flows without wrecking the current visual direction.
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
              This is still pre-auth. Do not mistake seeded demo data for a completed control plane.
              Persistence is real; permissions and operational mutation flow are not done yet.
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <Siren size={18} className="text-amber-300" />
            <div>
              <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                Rescue Queue
              </p>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Current active requests</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {data.rescues.map((rescue) => (
              <article key={rescue.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.12em] text-white">
                    {rescue.survivorHandle}
                  </p>
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-amber-100">
                    {rescue.urgency}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-300">{rescue.locationName ?? "Location pending"}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                  {rescue.status} / {rescue.escortRequired ? "Escort required" : "Escort discretionary"}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
