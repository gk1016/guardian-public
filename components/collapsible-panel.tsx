"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

type CollapsiblePanelProps = {
  label: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  variant?: "primary" | "inline";
  children: ReactNode;
};

export function CollapsiblePanel({
  label,
  icon,
  defaultOpen = false,
  variant = "primary",
  children,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  const isPrimary = variant === "primary";

  return (
    <div
      className={
        isPrimary
          ? "rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] panel-elevated"
          : "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input-bg)]"
      }
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 text-left transition-colors hover:bg-[var(--color-hover)] ${
          isPrimary
            ? "rounded-[var(--radius-lg)] px-5 py-3.5"
            : "rounded-[var(--radius-md)] px-4 py-3"
        }`}
      >
        <ChevronRight
          size={isPrimary ? 14 : 12}
          className={`shrink-0 text-[var(--color-text-tertiary)] transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
        {icon}
        <span
          className={`font-[family:var(--font-display)] uppercase tracking-[0.1em] text-[var(--color-text-strong)] ${
            isPrimary ? "text-sm" : "text-[10px]"
          }`}
        >
          {label}
        </span>
      </button>
      {open ? (
        <div
          className={`border-t border-[var(--color-border)] ${
            isPrimary ? "px-5 pb-5 pt-4" : "px-4 pb-4 pt-3"
          }`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
