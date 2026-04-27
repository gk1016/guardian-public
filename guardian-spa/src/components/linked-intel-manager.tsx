import { useState } from "react";
import { AlertTriangle, Link2Off, LoaderCircle, Radar } from "lucide-react";

type LinkedIntelManagerProps = {
  missionId: string;
  intelLinks: {
    id: string;
    intelId: string;
    title: string;
    severity: number;
    reportType: string;
    locationName: string | null;
    hostileGroup: string | null;
  }[];
  onSuccess?: () => void;
};

export function LinkedIntelManager({
  missionId,
  intelLinks,
  onSuccess,
}: LinkedIntelManagerProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function handleUnlink(intelId: string) {
    setError("");
    setIsPending(true);

    try {
      const response = await fetch(`/api/missions/${missionId}/intel/${intelId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Intel unlink failed.");
        return;
      }

      onSuccess?.();
    } catch {
      setError("Intel unlink failed.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {intelLinks.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--color-border-bright)] bg-[var(--color-overlay-subtle)] px-4 py-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <Radar size={16} className="text-red-300" />
              <p className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.14em] text-[var(--color-text-strong)]">
                {item.title}
              </p>
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              {item.reportType.replaceAll("_", " ")} / Severity {item.severity}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {(item.locationName ?? "Unknown location")} / {item.hostileGroup ?? "Unconfirmed hostile group"}
            </p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleUnlink(item.intelId)}
            className="inline-flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Link2Off size={14} />}
            Unlink
          </button>
        </div>
      ))}

      {intelLinks.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border-bright)] bg-[var(--color-overlay-subtle)] px-4 py-4 text-sm text-slate-300">
          No linked intel for this sortie yet.
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
