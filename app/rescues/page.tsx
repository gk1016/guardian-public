import Link from "next/link";
import { ArrowLeft, HeartPulse, ShieldAlert } from "lucide-react";
import { getRescuePageData } from "@/lib/guardian-data";

export const dynamic = "force-dynamic";

export default async function RescuesPage() {
  const data = await getRescuePageData();

  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-6 py-8 text-[var(--color-text)] lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6">
          <Link href="/command" className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-slate-400 transition hover:text-white">
            <ArrowLeft size={16} />
            Back to Command
          </Link>
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{data.orgName} / Rescue</p>
            <h1 className="font-[family:var(--font-display)] text-5xl uppercase tracking-[0.14em] text-white">
              Rescue Board
            </h1>
          </div>
        </header>

        {data.error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            {data.error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          {data.items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.12em] text-white">
                    {item.survivorHandle}
                  </p>
                  <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-400">{item.locationName ?? "Location pending"}</p>
                </div>
                <div className="text-right">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                    {item.status}
                  </span>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-amber-200">{item.urgency}</p>
                </div>
              </div>

              <p className="mt-5 text-sm leading-7 text-slate-300">{item.rescueNotes ?? "No rescue notes logged."}</p>

              <div className="mt-6 grid gap-3 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <ShieldAlert size={16} className="text-red-300" />
                  <span>{item.threatSummary ?? "Threat summary pending."}</span>
                </div>
                <div className="flex items-center gap-3">
                  <HeartPulse size={16} className="text-emerald-300" />
                  <span>
                    {item.medicalRequired ? "Medical support required" : "Medical support not required"} /{" "}
                    {item.escortRequired ? "Escort required" : "Escort discretionary"}
                  </span>
                </div>
              </div>

              <div className="mt-5 text-xs uppercase tracking-[0.18em] text-slate-400">
                Offered payment: {item.offeredPayment ? `${item.offeredPayment.toLocaleString()} aUEC` : "none logged"}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
