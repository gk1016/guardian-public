import { HeartPulse, ShieldAlert } from "lucide-react";
import { getRescuePageData } from "@/lib/guardian-data";
import { requireSession } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";

export const dynamic = "force-dynamic";

export default async function RescuesPage() {
  const session = await requireSession("/rescues");
  const data = await getRescuePageData(session.userId);

  return (
    <OpsShell
      currentPath="/rescues"
      section="Rescue"
      title="Rescue Board"
      description="Active rescues now require authenticated access and carry the operator identity into the protected shell."
      orgName={data.orgName}
      session={session}
    >

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
    </OpsShell>
  );
}
