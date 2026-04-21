import Link from "next/link";
import { AlertTriangle, ArrowLeft, BookCheck, ClipboardList, Crosshair, FileCheck2, NotebookText, Radar, RotateCcw, Shield, Users } from "lucide-react";
import { MissionCloseoutForm } from "@/components/mission-closeout-form";
import { MissionDoctrineForm } from "@/components/mission-doctrine-form";
import { MissionEditForm } from "@/components/mission-edit-form";
import { MissionIntelLinkForm } from "@/components/mission-intel-link-form";
import { MissionLogForm } from "@/components/mission-log-form";
import { MissionReopenForm } from "@/components/mission-reopen-form";
import { OpsShell } from "@/components/ops-shell";
import { ParticipantAssignForm } from "@/components/participant-assign-form";
import { LinkedIntelManager } from "@/components/linked-intel-manager";
import { ParticipantRosterManager } from "@/components/participant-roster-manager";
import { requireSession } from "@/lib/auth";
import { getMissionDetailPageData } from "@/lib/guardian-data";
import { canManageMissions } from "@/lib/roles";

export const dynamic = "force-dynamic";

type MissionDetailPageProps = {
  params: Promise<{
    missionId: string;
  }>;
};

export default async function MissionDetailPage({ params }: MissionDetailPageProps) {
  const session = await requireSession("/missions");
  const { missionId } = await params;
  const data = await getMissionDetailPageData(session.userId, missionId);
  const canManageMission = canManageMissions(session.role);
  const isClosedMission = data.mission?.status === "complete" || data.mission?.status === "aborted";

  if (!data.mission) {
    return (
      <OpsShell
        currentPath="/missions"
        section="Missions"
        title="Mission Not Found"
        orgName={data.orgName}
        session={session}
      >
        <section className="rounded-[var(--radius-lg)] border border-red-500/20 bg-red-500/8 p-5 text-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <p className="text-xs font-medium uppercase tracking-[0.1em]">Mission record unavailable</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-red-300">
            {data.error || "That mission ID is not available in the current org scope."}
          </p>
          <Link
            href="/missions"
            className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-white transition hover:bg-white/12"
          >
            <ArrowLeft size={13} />Back to board
          </Link>
        </section>
      </OpsShell>
    );
  }

  const mission = data.mission;

  return (
    <OpsShell
      currentPath="/missions"
      section="Missions"
      title={`${mission.callsign} / ${mission.title}`}
      orgName={data.orgName}
      session={session}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-4 py-2.5">
        <span className="text-sm text-slate-400">Sortie detail and package control</span>
        <Link
          href="/missions"
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-white transition hover:bg-white/8"
        >
          <ArrowLeft size={13} />Board
        </Link>
      </div>

      {data.error ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">{data.error}</div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-5">
          <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Status</p>
                <p className="mt-1 font-[family:var(--font-display)] text-base uppercase tracking-[0.08em] text-white">{mission.status}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Priority</p>
                <p className="mt-1 font-[family:var(--font-display)] text-base uppercase tracking-[0.08em] text-white">{mission.priority}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Rev / Lead</p>
                <p className="mt-1 font-[family:var(--font-display)] text-base uppercase tracking-[0.08em] text-white">Rev {mission.revisionNumber}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{mission.leadDisplay}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Readiness</p>
                <p className="mt-1 font-[family:var(--font-display)] text-base uppercase tracking-[0.08em] text-white">{mission.packageSummary.readinessLabel}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{mission.packageSummary.readyOrLaunched}/{mission.packageSummary.total} ready</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Type / AO</p>
                <p className="mt-1 text-xs text-white">{mission.missionType} / {mission.areaOfOperation ?? "Pending"}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Timeline</p>
                <p className="mt-1 text-xs text-white">Updated {mission.updatedAtLabel}</p>
                {mission.completedAtLabel ? <p className="mt-0.5 text-[10px] text-emerald-300">Closed {mission.completedAtLabel}</p> : null}
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Package</p>
                <p className="mt-1 text-xs text-white">A{mission.packageSummary.assigned} / R{mission.packageSummary.ready} / L{mission.packageSummary.launched} / RTB{mission.packageSummary.rtb}</p>
              </div>
            </div>

            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-black/15 p-4">
              <div className="flex items-center gap-2">
                <ClipboardList size={15} className="text-amber-300" />
                <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">Mission Brief</p>
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-400">{mission.missionBrief ?? "Not yet recorded."}</p>
            </div>
          </article>

          <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-300" />
              <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">Package Discipline</p>
            </div>
            <div className="mt-3 grid gap-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Profile</p>
                <p className="mt-1 font-[family:var(--font-display)] text-sm uppercase text-white">{mission.packageDiscipline.profileLabel}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">Coverage {mission.packageDiscipline.coverageLabel}</p>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {mission.packageDiscipline.roleChecks.map((rc) => (
                  <div key={rc.key} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-white">{rc.label}</p>
                      <span className={`rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] uppercase ${rc.shortfall === 0 ? "border-emerald-400/20 bg-emerald-400/8 text-emerald-200" : "border-red-500/20 bg-red-500/8 text-red-200"}`}>{rc.matchedCount}/{rc.requiredCount}</span>
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-slate-400">{[...rc.matchedHandles, ...rc.openHandles].join(", ") || "No match."}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {mission.packageDiscipline.warnings.length > 0 ? mission.packageDiscipline.warnings.map((w) => (
                  <div key={w} className="rounded-[var(--radius-sm)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-200">{w}</div>
                )) : (
                  <div className="rounded-[var(--radius-sm)] border border-emerald-400/20 bg-emerald-400/8 px-3 py-2 text-sm text-emerald-200">Package roles covered.</div>
                )}
              </div>
            </div>
          </article>

          <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
            <div className="flex items-center gap-2">
              <FileCheck2 size={15} className="text-emerald-300" />
              <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">Closeout</p>
            </div>
            <div className="mt-3 grid gap-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Summary</p>
                <p className="mt-1.5 text-sm leading-6 text-slate-400">{mission.closeoutSummary ?? "Not filed."}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">AAR</p>
                <p className="mt-1.5 text-sm leading-6 text-slate-400">{mission.aarSummary ?? "Not filed."}</p>
              </div>
            </div>
          </article>

          <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
            <div className="flex items-center gap-2">
              <BookCheck size={15} className="text-lime-300" />
              <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">Doctrine</p>
            </div>
            <div className="mt-3 grid gap-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">ROE Code</p>
                <p className="mt-1 text-xs uppercase text-white">{mission.roeCode ?? "No ROE attached"}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Attached Doctrine</p>
                {mission.doctrineTemplate ? (
                  <>
                    <p className="mt-1 font-[family:var(--font-display)] text-sm uppercase text-white">{mission.doctrineTemplate.title}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{mission.doctrineTemplate.code} / {mission.doctrineTemplate.category}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{mission.doctrineTemplate.summary}</p>
                    <div className="mt-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-black/15 px-3 py-2">
                      <p className="text-[10px] uppercase text-slate-500">Execution</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{mission.doctrineTemplate.body}</p>
                    </div>
                    <div className="mt-2 rounded-[var(--radius-sm)] border border-amber-400/20 bg-amber-400/8 px-3 py-2">
                      <p className="text-[10px] uppercase text-amber-200">Escalation</p>
                      <p className="mt-1 text-sm leading-6 text-amber-100/80">{mission.doctrineTemplate.escalation ?? "None."}</p>
                    </div>
                  </>
                ) : <p className="mt-1 text-sm text-slate-500">No doctrine attached.</p>}
              </div>
            </div>
          </article>

          <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
            <div className="flex items-center gap-2">
              <Radar size={15} className="text-red-300" />
              <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">Linked Intel</p>
            </div>
            <div className="mt-3">
              {canManageMission ? (
                <LinkedIntelManager missionId={mission.id} intelLinks={mission.linkedIntel} />
              ) : (
                <div className="space-y-2">
                  {mission.linkedIntel.map((item) => (
                    <div key={item.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                      <p className="text-xs font-medium text-white">{item.title}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{item.reportType.replaceAll("_", " ")} / Sev {item.severity}</p>
                      <p className="mt-1 text-sm text-slate-400">{item.locationName ?? "Unknown"} / {item.hostileGroup ?? "Unconfirmed"}</p>
                    </div>
                  ))}
                  {mission.linkedIntel.length === 0 ? <p className="text-[11px] text-slate-500">No linked intel.</p> : null}
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-cyan-300" />
              <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">Assigned Package</p>
            </div>
            <div className="mt-3">
              {canManageMission ? (
                <ParticipantRosterManager missionId={mission.id} participants={mission.participants} availableCrew={mission.availableCrew} />
              ) : (
                <div className="space-y-2">
                  {mission.participants.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                      <div>
                        <p className="text-xs font-medium text-white">{p.handle}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{p.role} / {p.platform ?? "Platform pending"}</p>
                        {p.notes ? <p className="mt-1 text-sm text-slate-400">{p.notes}</p> : null}
                      </div>
                      <span className="rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/8 px-2 py-0.5 text-[10px] uppercase text-cyan-200">{p.status}</span>
                    </div>
                  ))}
                  {mission.participants.length === 0 ? <p className="text-[11px] text-slate-500">No package assigned.</p> : null}
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
            <div className="flex items-center gap-2">
              <NotebookText size={15} className="text-amber-300" />
              <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">Timeline</p>
            </div>
            <div className="mt-3 space-y-2">
              {mission.logs.map((log) => (
                <div key={log.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-200">{log.entryType}</p>
                    <p className="text-[10px] text-slate-500">{log.authorDisplay} / {log.createdAtLabel}</p>
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-slate-400">{log.message}</p>
                </div>
              ))}
              {mission.logs.length === 0 ? <p className="text-[11px] text-slate-500">No timeline entries.</p> : null}
            </div>
          </article>
        </div>

        <div className="flex flex-col gap-5">
          {canManageMission ? (
            <>
              {!isClosedMission ? (
                <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
                  <div className="flex items-center gap-2">
                    <Crosshair size={15} className="text-amber-300" />
                    <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">Update Mission</p>
                  </div>
                  <div className="mt-4">
                    <MissionEditForm
                      missionId={mission.id}
                      initialMission={{
                        callsign: mission.callsign,
                        title: mission.title,
                        missionType: mission.missionType,
                        status: mission.status,
                        priority: mission.priority,
                        areaOfOperation: mission.areaOfOperation,
                        missionBrief: mission.missionBrief,
                      }}
                    />
                  </div>
                </section>
              ) : (
                <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
                  <div className="flex items-center gap-2">
                    <RotateCcw size={15} className="text-cyan-300" />
                    <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">Reopen Mission</p>
                  </div>
                  <div className="mt-4"><MissionReopenForm missionId={mission.id} /></div>
                </section>
              )}

              <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
                <div className="flex items-center gap-2">
                  <BookCheck size={15} className="text-lime-300" />
                  <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">Attach Doctrine</p>
                </div>
                <div className="mt-4">
                  <MissionDoctrineForm
                    missionId={mission.id}
                    selectedDoctrineTemplateId={mission.doctrineTemplate?.id ?? null}
                    availableDoctrineTemplates={mission.availableDoctrineTemplates}
                  />
                </div>
              </section>

              <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
                <div className="flex items-center gap-2">
                  <Radar size={15} className="text-red-300" />
                  <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">Link Threat Report</p>
                </div>
                <div className="mt-4">
                  <MissionIntelLinkForm missionId={mission.id} availableIntel={mission.availableIntel} />
                </div>
              </section>

              <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-cyan-300" />
                  <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">Assign Package</p>
                </div>
                <div className="mt-4"><ParticipantAssignForm missionId={mission.id} /></div>
              </section>

              <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
                <div className="flex items-center gap-2">
                  <NotebookText size={15} className="text-amber-300" />
                  <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">Log Entry</p>
                </div>
                <div className="mt-4"><MissionLogForm missionId={mission.id} /></div>
              </section>

              {!isClosedMission ? (
                <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
                  <div className="flex items-center gap-2">
                    <FileCheck2 size={15} className="text-emerald-300" />
                    <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">Close Mission</p>
                  </div>
                  <div className="mt-4">
                    <MissionCloseoutForm
                      missionId={mission.id}
                      initialFinalStatus={mission.status === "aborted" ? "aborted" : "complete"}
                      initialCloseoutSummary={mission.closeoutSummary ?? ""}
                      initialAarSummary={mission.aarSummary ?? ""}
                    />
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <section className="rounded-[var(--radius-lg)] border border-amber-400/20 bg-amber-400/8 p-5 text-amber-200">
              <div className="flex items-center gap-2">
                <Shield size={15} />
                <p className="text-xs font-medium uppercase tracking-[0.1em]">Read-only view</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-amber-200/70">Your role ({session.role}) can view sorties but not modify.</p>
            </section>
          )}
        </div>
      </section>
    </OpsShell>
  );
}
