import { type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleCardProps {
  id?: string;
  expanded: boolean;
  onToggle: () => void;
  /** Always-visible header content rendered in collapsed and expanded states */
  header: (expanded: boolean) => ReactNode;
  /** Body content shown only when expanded */
  children: ReactNode;
}

export function CollapsibleCard({
  id,
  expanded,
  onToggle,
  header,
  children,
}: CollapsibleCardProps) {
  return (
    <article
      id={id}
      className={`rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] panel-elevated transition-all ${
        expanded ? "p-6" : "px-5 py-3"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between gap-4 text-left"
      >
        <div className="min-w-0 flex-1">{header(expanded)}</div>
        {expanded ? (
          <ChevronUp size={14} className="shrink-0 text-[var(--color-text-faint)]" />
        ) : (
          <ChevronDown size={14} className="shrink-0 text-[var(--color-text-faint)]" />
        )}
      </button>
      {expanded ? <div className="mt-5">{children}</div> : null}
    </article>
  );
}
