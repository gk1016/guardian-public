import { BookCheck, Lock } from "lucide-react";
import { useSession } from "@/lib/auth";
import { useDoctrine } from "@/hooks/use-views";
import { canManageAdministration } from "@/lib/roles";
import type { DoctrineItem } from "@/hooks/use-views";

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

/* ------------------------------------------------------------------ */
/*  Doctrine Card                                                      */
/* ------------------------------------------------------------------ */

function DoctrineCard({ item }: { item: DoctrineItem }) {
  const categoryTone: Record<string, string> = {
    combat: "red",
    rescue: "amber",
    logistics: "sky",
    general: "slate",
  };
  const tone = categoryTone[item.category] ?? "slate";

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <BookCheck className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
        <span className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          {item.code}
        </span>
        <span className={`rounded-full border border-${tone}-400/30 bg-${tone}-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-${tone}-300`}>
          {item.category}
        </span>
        {item.isDefault && (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-emerald-300">
            Default
          </span>
        )}
        <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">
          {item.missionCount} mission{item.missionCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Title + summary */}
      <p className="mb-1 text-sm font-medium text-[var(--color-text-strong)]">{item.title}</p>
      {item.summary && (
        <p className="mb-3 text-xs text-[var(--color-text-secondary)]">{item.summary}</p>
      )}

      {/* Execution body */}
      {item.body && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Execution
          </p>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--color-text-secondary)]">
            {item.body}
          </p>
        </div>
      )}

      {/* Escalation */}
      {item.escalation && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Escalation
          </p>
          <p className="text-xs text-amber-300/80">{item.escalation}</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function DoctrinePage() {
  const session = useSession();
  const { data, isLoading, error } = useDoctrine();
  const isAdmin = canManageAdministration(session.role);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <h1 className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
        Doctrine
      </h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — doctrine list */}
        <div className="lg:col-span-2 space-y-4">
          {data.items.map((item) => (
            <DoctrineCard key={item.id} item={item} />
          ))}
          {data.items.length === 0 && (
            <p className="py-12 text-center text-xs text-[var(--color-text-tertiary)]">
              No doctrine templates defined
            </p>
          )}
        </div>

        {/* Right column — create form or read-only */}
        <div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
            {isAdmin ? (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <BookCheck className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                  <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
                    Create Doctrine
                  </h2>
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  TODO: Doctrine create/edit form
                </p>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                <Lock className="h-3.5 w-3.5" />
                Read-only &mdash; administration permissions required
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
