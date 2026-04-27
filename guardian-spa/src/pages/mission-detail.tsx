import { useParams, Link } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  BookCheck,
  ClipboardList,
  Crosshair,
  FileCheck2,
  NotebookText,
  Radar,
  RotateCcw,
  Shield,
  Users,
} from "lucide-react";
import { useSession } from "@/lib/auth";
import { useMissionDetail } from "@/hooks/use-views";
import { canManageMissions } from "@/lib/roles";
import type {
  MissionDetail,
  Participant,
  MissionLog,
  LinkedIntel,
  DoctrineTemplate,
  PackageDiscipline,
} from "@/hooks/use-views";

/* ------------------------------------------------------------------ */
/*  Shared                                                             */
/* ------------------------------------------------------------------ */

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Loading...</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
      {message}
    </div>
  );
}

const statusTone: Record<string, string> = {
  planning: "slate",
  ready: "amber",
  active: "emerald",
  launched: "emerald",
  complete: "sky",
  cancelled: "red",
};

function statusClasses(status: string) {
  const tone = statusTone[status] ?? "slate";
  return `border-${tone}-400/40 bg-${tone}-400/10 text-${tone}-300`;
}

function SectionHeading({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-[var(--color-text-tertiary)]" />
      <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
        {label}
      </h2>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated ${className}`}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-sections                                                       */
/* ------------------------------------------------------------------ */

function HeaderStats({ m }: { m: MissionDetail }) {
  return (
    <Card>
      <div className="mb-3 flex items-center gap-3">
        <Crosshair className="h-4 w-4 text-[var(--color-text-tertiary)]" />
        <span className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          {m.callsign}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${statusClasses(m.status)}`}>
          {m.status}
        </span>
      </div>

      <h1 className="mb-3 text-base font-medium text-[var(--color-text-strong)]">{m.title}</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <Label>Priority</Label>
          <p className="text-sm text-[var(--color-text-secondary)]">{m.priority}</p>
        </div>
        <div>
          <Label>Rev / Lead</Label>
          <p className="text-sm text-[var(--color-text-secondary)]">
            R{m.revisionNumber} &middot; {m.leadDisplay}
          </p>
        </div>
        <div>
          <Label>Readiness</Label>
          <p className="text-sm text-[var(--color-text-secondary)]">{m.packageSummary.readinessLabel}</p>
        </div>
        <div>
          <Label>Package</Label>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {m.packageSummary.readyOrLaunched}/{m.packageSummary.total}
          </p>
        </div>
      </div>
    </Card>
  );
}

function MissionMeta({ m }: { m: MissionDetail }) {
  return (
    <Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <Label>Type</Label>
          <p className="text-sm text-[var(--color-text-secondary)]">{m.missionType}</p>
        </div>
        <div>
          <Label>Area of Operation</Label>
          <p className="text-sm text-[var(--color-text-secondary)]">{m.areaOfOperation || "---"}</p>
        </div>
        <div>
          <Label>ROE</Label>
          <p className="text-sm text-[var(--color-text-secondary)]">{m.roeCode || "---"}</p>
        </div>
        <div>
          <Label>Updated</Label>
          <p className="text-sm text-[var(--color-text-secondary)]">{m.updatedAtLabel}</p>
        </div>
      </div>

      {/* Package stats */}
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {([
          ["Open", m.packageSummary.open],
          ["Assigned", m.packageSummary.assigned],
          ["Ready", m.packageSummary.ready],
          ["Launched", m.packageSummary.launched],
          ["RTB", m.packageSummary.rtb],
          ["Total", m.packageSummary.total],
        ] as [string, number][]).map(([label, val]) => (
          <div key={label} className="text-center">
            <Label>{label}</Label>
            <p className="text-sm text-[var(--color-text-secondary)]">{val}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MissionBrief({ brief }: { brief: string }) {
  if (!brief) return null;
  return (
    <Card>
      <SectionHeading icon={ClipboardList} label="Mission Brief" />
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {brief}
      </p>
    </Card>
  );
}

function DisciplineSection({ disc }: { disc: PackageDiscipline }) {
  return (
    <Card>
      <SectionHeading icon={Shield} label="Package Discipline" />
      <div className="mb-2 flex items-center gap-3">
        <Label>{disc.profileLabel}</Label>
        <span className="text-xs text-[var(--color-text-secondary)]">{disc.coverageLabel}</span>
        {disc.shortfallCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-300">
            <AlertTriangle className="h-3 w-3" />
            {disc.shortfallCount} shortfall{disc.shortfallCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {disc.warnings.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {disc.warnings.map((w, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {w}
            </span>
          ))}
        </div>
      )}

      {disc.roleChecks.length > 0 && (
        <div className="space-y-1">
          {disc.roleChecks.map((rc) => (
            <div key={rc.key} className="flex items-center gap-2 text-xs">
              <span className={`h-2 w-2 rounded-full ${rc.shortfall === 0 ? "bg-emerald-400" : "bg-red-400"}`} />
              <span className="text-[var(--color-text-secondary)]">{rc.label}</span>
              <span className="ml-auto text-[var(--color-text-tertiary)]">
                {rc.matchedCount}/{rc.requiredCount}
              </span>
              {rc.matchedHandles.length > 0 && (
                <span className="text-[var(--color-text-faint)]">
                  {rc.matchedHandles.join(", ")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function CloseoutSection({ m }: { m: MissionDetail }) {
  if (!m.closeoutSummary && !m.aarSummary && !m.completedAtLabel) return null;
  return (
    <Card>
      <SectionHeading icon={FileCheck2} label="Closeout" />
      {m.completedAtLabel && (
        <div className="mb-2">
          <Label>Completed</Label>
          <p className="text-sm text-[var(--color-text-secondary)]">{m.completedAtLabel}</p>
        </div>
      )}
      {m.closeoutSummary && (
        <div className="mb-2">
          <Label>Closeout Summary</Label>
          <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{m.closeoutSummary}</p>
        </div>
      )}
      {m.aarSummary && (
        <div>
          <Label>AAR Summary</Label>
          <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{m.aarSummary}</p>
        </div>
      )}
    </Card>
  );
}

function DoctrineSection({ doc }: { doc: DoctrineTemplate | null }) {
  return (
    <Card>
      <SectionHeading icon={BookCheck} label="Doctrine" />
      {doc ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
              {doc.code}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">{doc.title}</span>
          </div>
          <Label>{doc.category}</Label>
          {doc.summary && (
            <p className="text-sm text-[var(--color-text-secondary)]">{doc.summary}</p>
          )}
          {doc.body && (
            <p className="whitespace-pre-wrap text-xs text-[var(--color-text-tertiary)]">{doc.body}</p>
          )}
          {doc.escalation && (
            <div className="mt-2">
              <Label>Escalation</Label>
              <p className="text-xs text-amber-300/80">{doc.escalation}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-[var(--color-text-tertiary)]">No doctrine template attached</p>
      )}
    </Card>
  );
}

function LinkedIntelSection({ intel }: { intel: LinkedIntel[] }) {
  return (
    <Card>
      <SectionHeading icon={Radar} label="Linked Intel" />
      {intel.length > 0 ? (
        <div className="space-y-2">
          {intel.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              <span className="text-xs font-medium text-[var(--color-text-strong)]">{item.title}</span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                {item.reportType}
              </span>
              <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">{item.severity}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--color-text-tertiary)]">No linked intel</p>
      )}
    </Card>
  );
}

function ParticipantsSection({ participants }: { participants: Participant[] }) {
  return (
    <Card>
      <SectionHeading icon={Users} label="Assigned Package" />
      {participants.length > 0 ? (
        <div className="space-y-1">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              <span className="text-xs font-medium text-[var(--color-text-strong)]">{p.handle}</span>
              <Label>{p.role}</Label>
              <Label>{p.platform}</Label>
              <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${statusClasses(p.status)}`}>
                {p.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--color-text-tertiary)]">No participants assigned</p>
      )}
    </Card>
  );
}

function TimelineSection({ logs }: { logs: MissionLog[] }) {
  return (
    <Card>
      <SectionHeading icon={NotebookText} label="Timeline" />
      {logs.length > 0 ? (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="border-l-2 border-[var(--color-border)] pl-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  {log.entryType}
                </span>
                <span className="text-[10px] text-[var(--color-text-tertiary)]">
                  {log.createdAtLabel}
                </span>
                <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">
                  {log.authorDisplay}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{log.message}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--color-text-tertiary)]">No log entries</p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Action Forms Placeholder                                           */
/* ------------------------------------------------------------------ */

function ActionSidebar({ isManager }: { isManager: boolean }) {
  if (!isManager) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
          <RotateCcw className="h-3.5 w-3.5" />
          Read-only &mdash; you do not have mission manager permissions
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* TODO: Mission edit form */}
      <Card>
        <SectionHeading icon={ClipboardList} label="Edit Mission" />
        <p className="text-xs text-[var(--color-text-tertiary)]">TODO: Mission edit form</p>
      </Card>

      {/* TODO: Doctrine attach form */}
      <Card>
        <SectionHeading icon={BookCheck} label="Attach Doctrine" />
        <p className="text-xs text-[var(--color-text-tertiary)]">TODO: Doctrine attachment form</p>
      </Card>

      {/* TODO: Intel link form */}
      <Card>
        <SectionHeading icon={Radar} label="Link Intel" />
        <p className="text-xs text-[var(--color-text-tertiary)]">TODO: Intel link form</p>
      </Card>

      {/* TODO: Participant assign form */}
      <Card>
        <SectionHeading icon={Users} label="Assign Participant" />
        <p className="text-xs text-[var(--color-text-tertiary)]">TODO: Participant assignment form</p>
      </Card>

      {/* TODO: Log entry form */}
      <Card>
        <SectionHeading icon={NotebookText} label="Add Log Entry" />
        <p className="text-xs text-[var(--color-text-tertiary)]">TODO: Log entry form</p>
      </Card>

      {/* TODO: Closeout form */}
      <Card>
        <SectionHeading icon={FileCheck2} label="Closeout Mission" />
        <p className="text-xs text-[var(--color-text-tertiary)]">TODO: Closeout form</p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function MissionDetailPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const session = useSession();
  const { data, isLoading, error } = useMissionDetail(missionId ?? "");
  const isManager = canManageMissions(session.role);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  if (!data.mission) {
    return (
      <div className="space-y-4">
        <Link
          to="/missions"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Missions
        </Link>
        <Card>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            {data.error ?? "Mission not found"}
          </p>
        </Card>
      </div>
    );
  }

  const m = data.mission;

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        to="/missions"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Missions
      </Link>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          <HeaderStats m={m} />
          <MissionMeta m={m} />
          <MissionBrief brief={m.missionBrief} />
          <DisciplineSection disc={m.packageDiscipline} />
          <CloseoutSection m={m} />
          <DoctrineSection doc={m.doctrineTemplate} />
          <LinkedIntelSection intel={m.linkedIntel} />
          <ParticipantsSection participants={m.participants} />
          <TimelineSection logs={m.logs} />
        </div>

        {/* Right column — 1/3 */}
        <div>
          <ActionSidebar isManager={isManager} />
        </div>
      </div>
    </div>
  );
}
