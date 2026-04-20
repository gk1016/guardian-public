import { BookCheck, Lock, Shield } from "lucide-react";
import { DoctrineCreateForm } from "@/components/doctrine-create-form";
import { OpsShell } from "@/components/ops-shell";
import { requireSession } from "@/lib/auth";
import { getDoctrinePageData } from "@/lib/guardian-data";
import { canManageMissions } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function DoctrinePage() {
  const session = await requireSession("/doctrine");
  const data = await getDoctrinePageData(session.userId);
  const canManageDoctrine = canManageMissions(session.role);

  return (
    <OpsShell
      currentPath="/doctrine"
      section="Doctrine"
      title="ROE and Doctrine"
      description="Mission doctrine now lives as a first-class org asset instead of getting buried in brief text."
      orgName={data.orgName}
      session={session}
    >
      {data.error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {data.error}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          {data.items.map((item) => (
            <article key={item.id} className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.14em] text-white">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-400">
                    {item.code} / {item.category}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.isDefault ? (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-emerald-100">
                      Default
                    </span>
                  ) : null}
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                    {item.missionCount} linked missions
                  </span>
                </div>
              </div>

              <p className="mt-5 text-sm leading-7 text-slate-300">{item.summary}</p>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Execution Checklist</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.body}</p>
              </div>

              <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-amber-100">Escalation Guidance</p>
                <p className="mt-3 text-sm leading-7 text-amber-50">
                  {item.escalation ?? "No escalation guidance attached."}
                </p>
              </div>
            </article>
          ))}

          {data.items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-300">
              No doctrine templates loaded yet.
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          {canManageDoctrine ? (
            <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
              <div className="flex items-center gap-3">
                <BookCheck size={18} className="text-amber-300" />
                <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                  Create Doctrine
                </p>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Build reusable briefing doctrine once, then attach it directly to sorties as ROE and execution guidance.
              </p>
              <div className="mt-6">
                <DoctrineCreateForm />
              </div>
            </section>
          ) : (
            <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-8 text-amber-100">
              <div className="flex items-center gap-3">
                <Lock size={18} />
                <p className="font-semibold uppercase tracking-[0.18em]">Read-only doctrine access</p>
              </div>
              <p className="mt-4 text-sm leading-7 text-amber-50">
                Your current role is <span className="font-semibold uppercase">{session.role}</span>. You can read doctrine, but creating or attaching ROE packages remains restricted to command authority.
              </p>
            </section>
          )}

          <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
            <div className="flex items-center gap-3">
              <Shield size={18} className="text-cyan-300" />
              <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                Why This Matters
              </p>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Mission briefs change every sortie. Doctrine should not. This keeps escalation rules, engagement posture, and execution checklists attached to the mission record instead of rotting in chat history.
            </p>
          </section>
        </div>
      </section>
    </OpsShell>
  );
}
