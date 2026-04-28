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
      className={`rounded-3xl border border-white/10 bg-slate-950/60 transition-all ${
        expanded ? "p-8" : "px-6 py-4"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between gap-4 text-left"
      >
        <div className="min-w-0 flex-1">{header(expanded)}</div>
        {expanded ? (
          <ChevronUp size={16} className="shrink-0 text-slate-500" />
        ) : (
          <ChevronDown size={16} className="shrink-0 text-slate-500" />
        )}
      </button>
      {expanded ? <div className="mt-6">{children}</div> : null}
    </article>
  );
}
