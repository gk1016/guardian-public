import { useState } from "react";
import { Link } from "react-router";
import { ClipboardList, Plus, Pencil, MessageSquare, Clock, Filter } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";
import { useIntelReqs } from "@/hooks/use-views";
import { canManageOperations } from "@/lib/roles";
import { CollapsibleCard } from "@/components/collapsible-card";
import { IntelReqForm } from "@/components/intel-req-form";
import { api } from "@/lib/api";
import type { IntelRequirementItem } from "@/hooks/use-views";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
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

function typeBadgeColor(t: string): string {
  switch (t) {
    case "pir": return "amber";
    case "ir": return "cyan";
    case "rfi": return "slate";
    default: return "slate";
  }
}

function priorityBadgeColor(p: number): string {
  switch (p) {
    case 1: return "red";
    case 2: return "amber";
    case 3: return "yellow";
    default: return "slate";
  }
}

function statusBadgeColor(s: string): string {
  switch (s) {
    case "open": return "slate";
    case "collecting": return "cyan";
    case "answered": return "emerald";
    case "expired": return "red";
    case "cancelled": return "slate";
    default: return "slate";
  }
}

function priorityLabel(p: number): string {
  switch (p) {
    case 1: return "P1";
    case 2: return "P2";
    case 3: return "P3";
    case 4: return "P4";
    case 5: return "P5";
    default: return `P${p}`;
  }
}

function ltiovDisplay(ltiov: string | null): { text: string; expired: boolean } | null {
  if (!ltiov) return null;
  const target = new Date(ltiov);
  const now = new Date();
  if (target < now) return { text: "EXPIRED", expired: true };
  const diffMs = target.getTime() - now.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffH / 24);
  if (diffD > 0) return { text: `${diffD}d ${diffH % 24}h remaining`, expired: false };
  return { text: `${diffH}h remaining`, expired: false };
}

/* ------------------------------------------------------------------ */
/*  Answer Dialog                                                      */
/* ------------------------------------------------------------------ */

function AnswerDialog({
  reqId,
  reqTitle,
  onClose,
  onSaved,
}: {
  reqId: string;
  reqTitle: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) { setError("Answer is required."); return; }
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/api/intel-reqs/${reqId}/answer`, { answer: answer.trim() });
      onSaved();
      onClose();
    } catch {
      setError("Failed to submit answer.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 pt-16 pb-8">
      <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-6 shadow-xl">
        <h2 className="mb-3 font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          Answer: {reqTitle}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={5}
            placeholder="Provide the intelligence answer..."
            className={inputClass + " resize-none"}
          />
          {error && (
            <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-text-tertiary)] hover:bg-[var(--color-border)]/20">
              Cancel
            </button>
            <button type="submit" disabled={!answer.trim() || submitting} className="rounded-[var(--radius-md)] border border-emerald-400 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-400 hover:bg-emerald-400/20 disabled:opacity-40">
              {submitting ? "Submitting..." : "Submit Answer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Requirement Card                                                   */
/* ------------------------------------------------------------------ */

function ReqCard({
  item,
  isOps,
  onEdit,
  onAnswer,
  isChild,
}: {
  item: IntelRequirementItem;
  isOps: boolean;
  onEdit: (item: IntelRequirementItem) => void;
  onAnswer: (item: IntelRequirementItem) => void;
  isChild?: boolean;
}) {
  const typeTone = typeBadgeColor(item.requirementType);
  const prioTone = priorityBadgeColor(item.priority);
  const statusTone = statusBadgeColor(item.status);
  const ltiovInfo = ltiovDisplay(item.ltiov);

  return (
    <div className={`rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-4 panel-elevated ${!item.isActive ? "opacity-50" : ""} ${isChild ? "ml-6 border-l-2 border-l-cyan-400/30" : ""}`}>
      {/* Header row */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border border-${typeTone}-400/30 bg-${typeTone}-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-${typeTone}-300`}>
          {item.requirementType}
        </span>
        <span className={`rounded-full border border-${prioTone}-400/30 bg-${prioTone}-400/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-${prioTone}-300`}>
          {priorityLabel(item.priority)}
        </span>
        <span className="flex-1 text-sm font-medium text-[var(--color-text-strong)]">{item.title}</span>
        <span className={`rounded-full border border-${statusTone}-400/30 bg-${statusTone}-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-${statusTone}-300`}>
          {item.status}
        </span>
      </div>

      {/* Description */}
      {item.description && (
        <p className="mb-2 text-xs text-[var(--color-text-secondary)]">{item.description}</p>
      )}

      {/* LTIOV */}
      {ltiovInfo && (
        <div className={`mb-2 flex items-center gap-1.5 text-[10px] ${ltiovInfo.expired ? "text-red-400" : "text-amber-300"}`}>
          <Clock className="h-3 w-3" />
          <span className="font-semibold">LTIOV:</span>
          <span>{ltiovInfo.text}</span>
        </div>
      )}

      {/* Meta row */}
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--color-text-tertiary)]">
        {item.requestedByHandle && <span>Requested by: {item.requestedByHandle}</span>}
        {item.assignedToHandle && <span>Assigned to: {item.assignedToHandle}</span>}
      </div>

      {/* Linked entities */}
      {(item.linkedActorName || item.linkedIntelTitle) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {item.linkedActorName && (
            <Link
              to="/threat-actors"
              className="rounded-full border border-[var(--color-border-bright)] px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              Actor: {item.linkedActorName}
            </Link>
          )}
          {item.linkedIntelTitle && (
            <Link
              to="/intel"
              className="rounded-full border border-[var(--color-border-bright)] px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              Intel: {item.linkedIntelTitle}
            </Link>
          )}
        </div>
      )}

      {/* Indicators */}
      {item.indicators.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Indicators</p>
          <div className="flex flex-wrap gap-1">
            {item.indicators.map((ind) => (
              <span key={ind} className="rounded-full border border-cyan-400/20 bg-cyan-400/5 px-2 py-0.5 text-[10px] text-cyan-300/80">
                {ind}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Collection Guidance */}
      {item.collectionGuidance && (
        <div className="mb-2">
          <p className="mb-0.5 text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Collection Guidance</p>
          <p className="text-[11px] text-[var(--color-text-faint)]">{item.collectionGuidance}</p>
        </div>
      )}

      {/* Answer */}
      {item.answer && (
        <div className="mb-2 rounded-[var(--radius-md)] border border-emerald-400/20 bg-emerald-400/5 px-3 py-2">
          <p className="mb-0.5 text-[9px] uppercase tracking-[0.12em] text-emerald-300">Answer</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{item.answer}</p>
          {item.answeredAt && (
            <p className="mt-1 text-[9px] text-[var(--color-text-faint)]">Answered: {new Date(item.answeredAt).toLocaleString()}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-2">
        <span className="text-[9px] text-[var(--color-text-faint)]">
          {item.createdAt && new Date(item.createdAt).toLocaleDateString()}
        </span>
        {isOps && item.isActive && item.status !== "answered" && item.status !== "cancelled" && (
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(item)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-1.5 text-[var(--color-text-tertiary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              title="Edit requirement"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => onAnswer(item)}
              className="rounded-[var(--radius-sm)] border border-emerald-400/30 p-1.5 text-emerald-400/60 hover:border-emerald-400 hover:text-emerald-400"
              title="Answer requirement"
            >
              <MessageSquare className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function IntelReqsPage() {
  const session = useSession();
  const { data, isLoading, error } = useIntelReqs();
  const queryClient = useQueryClient();
  const isOpsManager = canManageOperations(session.role);

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<IntelRequirementItem | null>(null);
  const [answerTarget, setAnswerTarget] = useState<IntelRequirementItem | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["pirs", "rfis"]));

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["views", "intel-reqs"] });
  }

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  const allItems = data.items;
  const pirs = allItems.filter((i) => i.requirementType === "pir" && i.isActive && i.status !== "answered" && i.status !== "expired" && i.status !== "cancelled");
  const irs = allItems.filter((i) => i.requirementType === "ir" && i.isActive && i.status !== "answered" && i.status !== "expired" && i.status !== "cancelled");
  const rfis = allItems.filter((i) => i.requirementType === "rfi" && i.isActive && i.status !== "answered" && i.status !== "expired" && i.status !== "cancelled");
  const closedItems = allItems.filter((i) => i.status === "answered" || i.status === "expired" || i.status === "cancelled" || !i.isActive);

  // Build PIR -> IR hierarchy
  const pirOptions = pirs.map((p) => ({ id: p.id, title: p.title }));

  function getChildIRs(pirId: string) {
    return irs.filter((ir) => ir.parentId === pirId);
  }
  const orphanIRs = irs.filter((ir) => !ir.parentId || !pirs.some((p) => p.id === ir.parentId));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          Intel Requirements
        </h1>
        {isOpsManager && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
          >
            <Plus className="h-3 w-3" />
            New Requirement
          </button>
        )}
      </div>

      {/* PIRs Section */}
      <CollapsibleCard
        id="pirs"
        expanded={expanded.has("pirs")}
        onToggle={() => toggle("pirs")}
        header={(isOpen) => (
          <div className="flex items-center gap-3">
            <ClipboardList className="h-4 w-4 text-amber-400" />
            <span className="font-[family:var(--font-display)] text-xs uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
              Priority Intel Requirements
            </span>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
              {pirs.length} PIR{pirs.length !== 1 ? "s" : ""}
            </span>
            {!isOpen && pirs.length > 0 && (
              <span className="text-[10px] text-[var(--color-text-faint)]">
                + {irs.length} IR{irs.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      >
        <div className="space-y-4">
          {pirs.map((pir) => (
            <div key={pir.id}>
              <ReqCard item={pir} isOps={isOpsManager} onEdit={setEditTarget} onAnswer={setAnswerTarget} />
              {/* Child IRs */}
              {getChildIRs(pir.id).map((ir) => (
                <ReqCard key={ir.id} item={ir} isOps={isOpsManager} onEdit={setEditTarget} onAnswer={setAnswerTarget} isChild />
              ))}
            </div>
          ))}
          {/* Orphan IRs */}
          {orphanIRs.map((ir) => (
            <ReqCard key={ir.id} item={ir} isOps={isOpsManager} onEdit={setEditTarget} onAnswer={setAnswerTarget} />
          ))}
          {pirs.length === 0 && orphanIRs.length === 0 && (
            <p className="py-8 text-center text-xs text-[var(--color-text-tertiary)]">
              No active PIRs or IRs
            </p>
          )}
        </div>
      </CollapsibleCard>

      {/* RFIs Section */}
      <CollapsibleCard
        id="rfis"
        expanded={expanded.has("rfis")}
        onToggle={() => toggle("rfis")}
        header={(isOpen) => (
          <div className="flex items-center gap-3">
            <ClipboardList className="h-4 w-4 text-[var(--color-text-tertiary)]" />
            <span className="font-[family:var(--font-display)] text-xs uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
              Requests for Information
            </span>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
              {rfis.length}
            </span>
          </div>
        )}
      >
        <div className="space-y-3">
          {rfis.map((rfi) => (
            <ReqCard key={rfi.id} item={rfi} isOps={isOpsManager} onEdit={setEditTarget} onAnswer={setAnswerTarget} />
          ))}
          {rfis.length === 0 && (
            <p className="py-8 text-center text-xs text-[var(--color-text-tertiary)]">
              No active RFIs
            </p>
          )}
        </div>
      </CollapsibleCard>

      {/* Answered / Expired / Cancelled */}
      {closedItems.length > 0 && (
        <CollapsibleCard
          id="closed"
          expanded={expanded.has("closed")}
          onToggle={() => toggle("closed")}
          header={() => (
            <div className="flex items-center gap-3">
              <Filter className="h-4 w-4 text-[var(--color-text-tertiary)]" />
              <span className="font-[family:var(--font-display)] text-xs uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
                Answered / Expired / Cancelled
              </span>
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                {closedItems.length}
              </span>
            </div>
          )}
        >
          <div className="space-y-3">
            {closedItems.map((item) => (
              <ReqCard key={item.id} item={item} isOps={isOpsManager} onEdit={setEditTarget} onAnswer={setAnswerTarget} />
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* Create dialog */}
      {showCreate && (
        <IntelReqForm pirOptions={pirOptions} onClose={() => setShowCreate(false)} onSaved={refresh} />
      )}

      {/* Edit dialog */}
      {editTarget && (
        <IntelReqForm existing={editTarget} pirOptions={pirOptions} onClose={() => setEditTarget(null)} onSaved={refresh} />
      )}

      {/* Answer dialog */}
      {answerTarget && (
        <AnswerDialog reqId={answerTarget.id} reqTitle={answerTarget.title} onClose={() => setAnswerTarget(null)} onSaved={refresh} />
      )}
    </div>
  );
}
