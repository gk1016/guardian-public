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
            className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-overlay-medium)] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-strong)] transition hover:bg-white/12"
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
        <span className="text-sm text-[var(--color-text-secondary)]">Sortie detail and package control</span>
        <Link
          href="/missions"
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border-bright)] bg-[var(--color-overlay-subtle)] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-strong)] transition hover:bg-[var(--color-overlay-medium)]"
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
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Status</p>
                <p className="mt-1 font-[family:var(--font-display)] text-base uppercase tracking-[0.08em] text-[var(--color-text-strong)]">{mission.status}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Priority</p>
                <p className="mt-1 font-[family:var(--font-display)] text-base uppercase tracking-[0.08em] text-[var(--color-text-strong)]">{mission.priority}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Rev / Lead</p>
                <p className="mt-1 font-[family:var(--font-display)] text-base uppercase tracking-[0.08em] text-[var(--color-text-strong)]">Rev {mission.revisionNumber}</p>
                <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">{mission.leadDisplay}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Readiness</p>
                <p className="mt-1 font-[family:var(--font-display)] text-base uppercase tracking-[0.08em] text-[var(--color-text-strong)]">{mission.packageSummary.readinessLabel}</p>
                <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">{mission.packageSummary.readyOrLaunched}/{mission.packageSummary.total} ready</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Type / AO</p>
                <p className="mt-1 text-xs text-[var(--color-text-strong)]">{mission.missionType} / {mission.areaOfOperation ?? "Pending"}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Timeline</p>
                <p className="mt-1 text-xs text-[var(--color-text-strong)]">Updated {mission.updatedAtLabel}</p>
                {mission.completedAtLabel ? <p className="mt-0.5 text-[10px] text-emerald-300">Closed {mission.completedAtLabel}</p> : null}
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Package</p>
                <p className="mt-1 text-xs text-[var(--color-text-strong)]">A{mission.packageSummary.assigned} / R{mission.packageSummary.ready} / L{mission.packageSummary.launched} / RTB{mission.packageSummary.rtb}</p>
              </div>
            </div>

            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4">
              <div className="flex items-center gap-2">
                <ClipboardList size={15} className="text-[var(--color-accent)]" />
                <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Mission Brief</p>
              </div>
              <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">{mission.missionBrief ?? "Not yet recorded."}</p>
            </div>
          </article>

          <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-[var(--color-accent)]" />
              <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Package Discipline</p>
            </div>
            <div className="mt-3 grid gap-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Profile</p>
                <p className="mt-1 font-[family:var(--font-display)] text-sm uppercase text-[var(--color-text-strong)]">{mission.packageDiscipline.profileLabel}</p>
                <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">Coverage {mission.packageDiscipline.coverageLabel}</p>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {mission.packageDiscipline.roleChecks.map((rc) => (
                  <div key={rc.key} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-[var(--color-text-strong)]">{rc.label}</p>
                      <span className={`rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] uppercase ${rc.shortfall === 0 ? "border-emerald-400/20 bg-emerald-400/8 text-emerald-200" : "border-red-500/20 bg-red-500/8 text-red-200"}`}>{rc.matchedCount}/{rc.requiredCount}</span>
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-secondary)]">{[...rc.matchedHandles, ...rc.openHandles].join(", ") || "No match."}</p>
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
              <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Closeout</p>
            </div>
            <div className="mt-3 grid gap-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Summary</p>
                <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-secondary)]">{mission.closeoutSummary ?? "Not filed."}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">AAR</p>
                <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-secondary)]">{mission.aarSummary ?? "Not filed."}</p>
              </div>
            </div>
          </article>

          <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
            <div className="flex items-center gap-2">
              <BookCheck size={15} className="text-lime-300" />
              <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Doctrine</p>
            </div>
            <div className="mt-3 grid gap-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">ROE Code</p>
                <p className="mt-1 text-xs uppercase text-[var(--color-text-strong)]">{mission.roeCode ?? "No ROE attached"}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">Attached Doctrine</p>
                {mission.doctrineTemplate ? (
                  <>
                    <p className="mt-1 font-[family:var(--font-display)] text-sm uppercase text-[var(--color-text-strong)]">{mission.doctrineTemplate.title}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">{mission.doctrineTemplate.code} / {mission.doctrineTemplate.category}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{mission.doctrineTemplate.summary}</p>
                    <div className="mt-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2">
                      <p className="text-[10px] uppercase text-[var(--color-text-tertiary)]">Execution</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{mission.doctrineTemplate.body}</p>
                    </div>
                    <div className="mt-2 rounded-[var(--radius-sm)] border border-amber-400/20 bg-amber-400/8 px-3 py-2">
                      <p className="text-[10px] uppercase text-amber-200">Escalation</p>
                      <p className="mt-1 text-sm leading-6 text-amber-100/80">{mission.doctrineTemplate.escalation ?? "None."}</p>
                    </div>
                  </>
                ) : <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">No doctrine attached.</p>}
              </div>
            </div>
          </article>

          <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
            <div className="flex items-center gap-2">
              <Radar size={15} className="text-red-300" />
              <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Linked Intel</p>
            </div>
            <div className="mt-3">
              {canManageMission ? (
                <LinkedIntelManager missionId={mission.id} intelLinks={mission.linkedIntel} />
              ) : (
                <div className="space-y-2">
                  {mission.linkedIntel.map((item) => (
                    <div key={item.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                      <p className="text-xs font-medium text-[var(--color-text-strong)]">{item.title}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">{item.reportType.replaceAll("_", " ")} / Sev {item.severity}</p>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.locationName ?? "Unknown"} / {item.hostileGroup ?? "Unconfirmed"}</p>
                    </div>
                  ))}
                  {mission.linkedIntel.length === 0 ? <p className="text-[11px] text-[var(--color-text-tertiary)]">No linked intel.</p> : null}
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-cyan-300" />
              <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Assigned Package</p>
            </div>
            <div className="mt-3">
              {canManageMission ? (
                <ParticipantRosterManager missionId={mission.id} participants={mission.participants} availableCrew={mission.availableCrew} />
              ) : (
                <div className="space-y-2">
                  {mission.participants.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                      <div>
                        <p className="text-xs font-medium text-[var(--color-text-strong)]">{p.handle}</p>
                        <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">{p.role} / {p.platform ?? "Platform pending"}</p>
                        {p.notes ? <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{p.notes}</p> : null}
                      </div>
                      <span className="rounded-[var(--radius-sm)] border border-cyan-400/20 bg-cyan-400/8 px-2 py-0.5 text-[10px] uppercase text-cyan-200">{p.status}</span>
                    </div>
                  ))}
                  {mission.participants.length === 0 ? <p className="text-[11px] text-[var(--color-text-tertiary)]">No package assigned.</p> : null}
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
            <div className="flex items-center gap-2">
              <NotebookText size={15} className="text-[var(--color-accent)]" />
              <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Timeline</p>
            </div>
            <div className="mt-3 space-y-2">
              {mission.logs.map((log) => (
                <div key={log.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-200">{log.entryType}</p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">{log.authorDisplay} / {log.createdAtLabel}</p>
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-secondary)]">{log.message}</p>
                </div>
              ))}
              {mission.logs.length === 0 ? <p className="text-[11px] text-[var(--color-text-tertiary)]">No timeline entries.</p> : null}
            </div>
          </article>
        </div>

        <div className="flex flex-col gap-5">
          {canManageMission ? (
            <>
              {!isClosedMission ? (
                <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
                  <div className="flex items-center gap-2">
                    <Crosshair size={15} className="text-[var(--color-accent)]" />
                    <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Update Mission</p>
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
                    <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Reopen Mission</p>
                  </div>
                  <div className="mt-4"><MissionReopenForm missionId={mission.id} /></div>
                </section>
              )}

              <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
                <div className="flex items-center gap-2">
                  <BookCheck size={15} className="text-lime-300" />
                  <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Attach Doctrine</p>
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
                  <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Link Threat Report</p>
                </div>
                <div className="mt-4">
                  <MissionIntelLinkForm missionId={mission.id} availableIntel={mission.availableIntel} />
                </div>
              </section>

              <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-cyan-300" />
                  <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Assign Package</p>
                </div>
                <div className="mt-4"><ParticipantAssignForm missionId={mission.id} /></div>
              </section>

              <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
                <div className="flex items-center gap-2">
                  <NotebookText size={15} className="text-[var(--color-accent)]" />
                  <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Log Entry</p>
                </div>
                <div className="mt-4"><MissionLogForm missionId={mission.id} /></div>
              </section>

              {!isClosedMission ? (
                <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
                  <div className="flex items-center gap-2">
                    <FileCheck2 size={15} className="text-emerald-300" />
                    <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Close Mission</p>
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
