import { useState } from "react";
import { Network } from "lucide-react";

type IntelShareButtonProps = {
  intelId: string;
};

export function IntelShareButton({ intelId }: IntelShareButtonProps) {
  const [state, setState] = useState<"idle" | "sharing" | "done" | "error">("idle");
  const [peersReached, setPeersReached] = useState(0);

  const share = async () => {
    setState("sharing");
    try {
      const res = await fetch(`/engine/api/federation/share/intel/${intelId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Share failed");
      const data = await res.json();
      setPeersReached(data.peers_reached ?? 0);
      setState("done");
      setTimeout(() => setState("idle"), 4000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  return (
    <button
      onClick={share}
      disabled={state === "sharing"}
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-1 text-[10px] uppercase tracking-[0.08em] transition ${
        state === "done"
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : state === "error"
            ? "border-red-400/30 bg-red-400/10 text-red-200"
            : "border-violet-400/20 bg-violet-400/8 text-violet-200 hover:bg-violet-400/15"
      } disabled:opacity-50`}
      title="Share this intel report with connected federation peers"
    >
      <Network size={11} className={state === "sharing" ? "animate-pulse" : ""} />
      {state === "idle" && "Share to Federation"}
      {state === "sharing" && "Sharing..."}
      {state === "done" && `Shared (${peersReached} peer${peersReached !== 1 ? "s" : ""})`}
      {state === "error" && "Share failed"}
    </button>
  );
}
