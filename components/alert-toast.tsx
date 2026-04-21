"use client";

import { useState, useCallback, useRef } from "react";
import type { EngineEvent } from "@/lib/use-engine-ws";
import { useEngineWS } from "@/lib/use-engine-ws";

type Toast = {
  id: string;
  event: EngineEvent;
  timestamp: number;
};

const MAX_TOASTS = 5;
const DISMISS_CRITICAL = 8000;
const DISMISS_DEFAULT = 5000;

function severityStyles(severity: string): string {
  switch (severity) {
    case "critical":
      return "border-l-[var(--color-danger)] bg-[rgba(239,68,68,0.12)]";
    case "warning":
      return "border-l-[var(--color-signal)] bg-[rgba(244,182,60,0.10)]";
    default:
      return "border-l-[var(--color-cyan)] bg-[rgba(56,189,248,0.08)]";
  }
}

function severityLabel(severity: string): string {
  switch (severity) {
    case "critical":
      return "CRITICAL";
    case "warning":
      return "WARNING";
    default:
      return "INFO";
  }
}

function severityLabelColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "text-red-400";
    case "warning":
      return "text-amber-400";
    default:
      return "text-sky-400";
  }
}

function getHref(event: EngineEvent): string | null {
  if (event.mission_id) return `/missions/${event.mission_id}`;
  return null;
}

/**
 * Real-time alert toast container. Connects to guardian-engine via WSS
 * and renders incoming alerts as dismissible toasts.
 */
export function AlertToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const onEvent = useCallback(
    (event: EngineEvent) => {
      if (event.type !== "alert") return;

      const id = `toast-${++counterRef.current}`;
      const toast: Toast = { id, event, timestamp: Date.now() };

      setToasts((prev) => {
        const next = [toast, ...prev];
        return next.slice(0, MAX_TOASTS);
      });

      // Auto-dismiss
      const delay =
        event.severity === "critical" ? DISMISS_CRITICAL : DISMISS_DEFAULT;
      setTimeout(() => dismiss(id), delay);
    },
    [dismiss]
  );

  const { state } = useEngineWS(onEvent);

  return (
    <div className="fixed right-4 top-4 z-[9999] flex w-[380px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {/* Connection indicator - only show when disconnected */}
      {state === "disconnected" && (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-panel)] px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] border border-[var(--color-border)]">
          Engine disconnected - reconnecting...
        </div>
      )}

      {toasts.map((toast) => {
        const href = getHref(toast.event);
        return (
          <div
            key={toast.id}
            className={`rounded-[var(--radius-md)] border-l-[3px] px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-300 ${severityStyles(
              toast.event.severity
            )}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${severityLabelColor(
                    toast.event.severity
                  )}`}
                >
                  {severityLabel(toast.event.severity)}
                  {toast.event.category === "doctrine_violation"
                    ? " / DISCIPLINE"
                    : toast.event.category === "threat_cluster"
                    ? " / THREAT"
                    : ""}
                </span>
                <p className="mt-1 text-[13px] leading-tight text-[var(--color-text)]">
                  {toast.event.title
                    .replace(/^DISCIPLINE: /, "")
                    .replace(/^THREAT: /, "")}
                </p>
                {toast.event.overlapping_missions &&
                  toast.event.overlapping_missions.length > 0 && (
                    <p className="mt-1 text-[11px] text-red-400">
                      Missions in area:{" "}
                      {toast.event.overlapping_missions.join(", ")}
                    </p>
                  )}
                {href && (
                  <a
                    href={href}
                    className="mt-1.5 inline-block text-[11px] text-[var(--color-cyan)] hover:underline"
                  >
                    View mission
                  </a>
                )}
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="shrink-0 p-0.5 text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                aria-label="Dismiss"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
