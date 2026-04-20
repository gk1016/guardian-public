import Link from "next/link";
import { AlertTriangle, ArrowLeft, ClipboardList, Crosshair, FileCheck2, NotebookText, Radar, Shield, Users } from "lucide-react";
import { MissionCloseoutForm } from "@/components/mission-closeout-form";
import { MissionEditForm } from "@/components/mission-edit-form";
import { MissionIntelLinkForm } from "@/components/mission-intel-link-form";
import { MissionLogForm } from "@/components/mission-log-form";
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

  if (!data.mission) {
    return (
      <OpsShell
        currentPath="/missions"
        section="Missions"
        title="Mission Not Found"
        description="The requested sortie does not exist in the operator's organization scope."
        orgName={data.orgName}
        session={session}
      >
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-100">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} />
            <p className="font-semibold uppercase tracking-[0.18em]">Mission record unavailable</p>
          </div>
          <p className="mt-4 text-sm leading-7 text-red-50">
            {data.error || "That mission ID is not available in the current org scope."}
          </p>
          <Link
            href="/missions"
            className="mt-6 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white/15"
          >
            <ArrowLeft size={14} />
            Back to board
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
      description="Mission detail, update path, and participant assignment now live inside the protected ops surface."
      orgName={data.orgName}
      session={session}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
        <div className="text-sm text-slate-300">
          Sortie detail page is now the control point for board updates and package assignment.
        </div>
        <Link
          href="/missions"
          className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
        >
          <ArrowLeft size={14} />
          Back to board
        </Link>
      </div>

      {data.error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {data.error}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <article className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Status</p>
                <p className="mt-2 font-[family:var(--font-display)] text-2xl uppercase tracking-[0.14em] text-white">
                  {mission.status}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Priority</p>
                <p className="mt-2 font-[family:var(--font-display)] text-2xl uppercase tracking-[0.14em] text-white">
                  {mission.priority}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Lead</p>
                <p className="mt-2 font-[family:var(--font-display)] text-2xl uppercase tracking-[0.14em] text-white">
                  {mission.leadDisplay}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Participants</p>
                <p className="mt-2 font-[family:var(--font-display)] text-2xl uppercase tracking-[0.14em] text-white">
                  {mission.participants.length.toString().padStart(2, "0")}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Type / AO</p>
                <p className="mt-2 text-sm uppercase tracking-[0.16em] text-white">
                  {mission.missionType} / {mission.areaOfOperation ?? "AO pending"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Timeline</p>
                <p className="mt-2 text-sm uppercase tracking-[0.16em] text-white">
                  Updated {mission.updatedAtLabel}
                </p>
                {mission.completedAtLabel ? (
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-emerald-200">
                    Closed {mission.completedAtLabel}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center gap-3">
                <ClipboardList size={18} className="text-amber-300" />
                <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                  Mission Brief
                </p>
              </div>
              <p className="mt-4 text-sm leading-8 text-slate-300">
                {mission.missionBrief ?? "Mission brief not yet recorded."}
              </p>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
            <div className="flex items-center gap-3">
              <FileCheck2 size={18} className="text-emerald-300" />
              <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                Closeout Package
              </p>
            </div>
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Closeout Summary</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {mission.closeoutSummary ?? "Mission closeout not yet filed."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">AAR Package</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {mission.aarSummary ?? "AAR package not yet filed."}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
            <div className="flex items-center gap-3">
              <Radar size={18} className="text-red-300" />
              <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                Linked Intel
              </p>
            </div>
            <div className="mt-5">
              {canManageMission ? (
                <LinkedIntelManager
                  missionId={mission.id}
                  intelLinks={mission.linkedIntel}
                />
              ) : (
                <div className="space-y-3">
                  {mission.linkedIntel.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                    >
                      <p className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.14em] text-white">
                        {item.title}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                        {item.reportType.replaceAll("_", " ")} / Severity {item.severity}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        {(item.locationName ?? "Unknown location")} / {item.hostileGroup ?? "Unconfirmed hostile group"}
                      </p>
                    </div>
                  ))}

                  {mission.linkedIntel.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                      No linked intel for this sortie yet.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
            <div className="flex items-center gap-3">
              <Users size={18} className="text-cyan-300" />
              <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                Assigned Package
              </p>
            </div>
            <div className="mt-5">
              {canManageMission ? (
                <ParticipantRosterManager
                  missionId={mission.id}
                  participants={mission.participants}
                />
              ) : (
                <div className="space-y-3">
                  {mission.participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                    >
                      <div>
                        <p className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.14em] text-white">
                          {participant.handle}
                        </p>
                        <p className="mt-1 text-sm uppercase tracking-[0.14em] text-slate-400">
                          {participant.role} / {participant.platform ?? "Platform pending"}
                        </p>
                        <p className="mt-2 text-sm text-slate-300">
                          {participant.notes ?? "No notes logged."}
                        </p>
                      </div>
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                        {participant.status}
                      </span>
                    </div>
                  ))}

                  {mission.participants.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                      No package assigned yet.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
            <div className="flex items-center gap-3">
              <NotebookText size={18} className="text-amber-300" />
              <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                Mission Timeline
              </p>
            </div>
            <div className="mt-5 space-y-3">
              {mission.logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                      {log.entryType}
                    </p>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                      {log.authorDisplay} / {log.createdAtLabel}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {log.message}
                  </p>
                </div>
              ))}

              {mission.logs.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                  No mission timeline entries logged yet.
                </div>
              ) : null}
            </div>
          </article>
        </div>

        <div className="space-y-6">
          {canManageMission ? (
            <>
              <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
                <div className="flex items-center gap-3">
                  <Crosshair size={18} className="text-amber-300" />
                  <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                    Update Mission
                  </p>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  This is the smallest useful command path: update the sortie without leaving the board loop.
                </p>
                <div className="mt-6">
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

              <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
                <div className="flex items-center gap-3">
                  <Radar size={18} className="text-red-300" />
                  <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                    Link Threat Report
                  </p>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Attach existing intel directly to the sortie so the threat picture follows the mission.
                </p>
                <div className="mt-6">
                  <MissionIntelLinkForm
                    missionId={mission.id}
                    availableIntel={mission.availableIntel}
                  />
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
                <div className="flex items-center gap-3">
                  <Users size={18} className="text-cyan-300" />
                  <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                    Assign Package
                  </p>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Add pilots and escorts directly into the sortie package.
                </p>
                <div className="mt-6">
                  <ParticipantAssignForm missionId={mission.id} />
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
                <div className="flex items-center gap-3">
                  <NotebookText size={18} className="text-amber-300" />
                  <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                    Log Timeline Entry
                  </p>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Record command updates, contact reports, and post-mission notes directly against the sortie.
                </p>
                <div className="mt-6">
                  <MissionLogForm missionId={mission.id} />
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-8">
                <div className="flex items-center gap-3">
                  <FileCheck2 size={18} className="text-emerald-300" />
                  <p className="font-[family:var(--font-display)] text-2xl uppercase tracking-[0.16em] text-white">
                    Close Mission
                  </p>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  File the final disposition and package the after-action notes directly onto the sortie.
                </p>
                <div className="mt-6">
                  <MissionCloseoutForm
                    missionId={mission.id}
                    initialFinalStatus={mission.status === "aborted" ? "aborted" : "complete"}
                    initialCloseoutSummary={
                      mission.closeoutSummary ??
                      "Package completed assigned objectives, recovered aircraft, and cleared the lane."
                    }
                    initialAarSummary={
                      mission.aarSummary ??
                      "Threat picture stabilized after first merge. Escort geometry held, comms discipline remained solid, and civilian traffic cleared without additional loss."
                    }
                  />
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-8 text-amber-100">
              <div className="flex items-center gap-3">
                <Shield size={18} />
                <p className="font-semibold uppercase tracking-[0.18em]">Read-only operator view</p>
              </div>
              <p className="mt-4 text-sm leading-7 text-amber-50">
                Your current role is <span className="font-semibold uppercase">{session.role}</span>. You can read
                sortie detail, but update and package assignment remain restricted to command authority.
              </p>
            </section>
          )}
        </div>
      </section>
    </OpsShell>
  );
}
