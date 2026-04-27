import { useState, useEffect, useCallback, useRef } from "react";
import { useEngine } from "@/lib/engine-context";
import { useSession } from "@/lib/auth";
import { Network, Send, MessageSquare, Shield, Zap, Radio } from "lucide-react";

/* -- Types -- */

type FederationStatus = {
  instance_id: string;
  instance_name: string;
  cert_fingerprint: string;
  federation_port: number;
  connected_peers: number;
  trusted_fingerprints: string[];
  seeds: string[];
};

type PeerEntry = {
  instance_id: string;
  instance_name: string;
  address: string;
  version: string;
  connected_at: string;
  last_heartbeat: string;
};

type FedEvent = {
  type: string;
  from_instance?: string;
  from_name?: string;
  channel?: string;
  sender_handle?: string;
  text?: string;
  title?: string;
  report_type?: string;
  severity?: number;
  callsign?: string;
  status?: string;
  instance_id?: string;
  name?: string;
  [key: string]: unknown;
};

/* -- Helpers -- */

function truncateFp(fp: string): string {
  return fp.length > 16 ? `${fp.slice(0, 8)}...${fp.slice(-8)}` : fp;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 5) return "now";
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h`;
}

/* -- Sub-components -- */

function IdentityCard({ status }: { status: FederationStatus | null }) {
  if (!status) return null;
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
      <div className="border-b border-[var(--color-border)] pb-3 mb-4">
        <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Instance Identity</p>
        <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">This node's federation credentials</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] mb-1">Instance Name</p>
          <p className="font-[family:var(--font-display)] text-lg tracking-[0.06em] text-[var(--color-text-strong)]">{status.instance_name}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] mb-1">Federation Port</p>
          <p className="font-[family:var(--font-display)] text-lg tracking-[0.06em] text-[var(--color-text-strong)]">{status.federation_port}</p>
        </div>
        <div className="col-span-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] mb-1">Certificate Fingerprint</p>
          <p className="font-mono text-xs text-[var(--color-text-secondary)] break-all">{status.cert_fingerprint}</p>
        </div>
        {status.seeds.length > 0 && (
          <div className="col-span-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] mb-1">Seed Peers</p>
            {status.seeds.map((s, i) => (
              <span key={i} className="inline-block mr-2 mb-1 rounded-[var(--radius-sm)] bg-[var(--color-overlay-subtle)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">{s}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PeerList({ peers }: { peers: PeerEntry[] }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
      <div className="border-b border-[var(--color-border)] pb-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Connected Peers</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Federated Guardian instances</p>
          </div>
          <span className="font-[family:var(--font-display)] text-xl text-[var(--color-text-strong)] tabular-nums">
            {peers.length.toString().padStart(2, "0")}
          </span>
        </div>
      </div>
      {peers.length === 0 ? (
        <div className="text-center py-8">
          <Network size={24} className="mx-auto mb-2 text-[var(--color-text-faint)]" />
          <p className="text-[11px] text-[var(--color-text-faint)]">No peers connected</p>
          <p className="text-[10px] text-[var(--color-text-faint)] mt-1">Set FEDERATION_SEEDS to connect to other instances</p>
        </div>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-overlay-subtle)]">
                <th className="py-2 px-3 text-[9px] uppercase tracking-widest text-[var(--color-text-faint)] w-8"></th>
                <th className="py-2 px-2 text-[9px] uppercase tracking-widest text-[var(--color-text-faint)]">Instance</th>
                <th className="py-2 px-2 text-[9px] uppercase tracking-widest text-[var(--color-text-faint)]">Address</th>
                <th className="py-2 px-2 text-[9px] uppercase tracking-widest text-[var(--color-text-faint)]">Version</th>
                <th className="py-2 px-2 text-[9px] uppercase tracking-widest text-[var(--color-text-faint)] text-right">Heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {peers.map((p) => (
                <tr key={p.instance_id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-hover)] transition-colors">
                  <td className="py-2.5 px-3">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  </td>
                  <td className="py-2.5 px-2">
                    <p className="text-[11px] font-semibold text-[var(--color-text-strong)]">{p.instance_name}</p>
                    <p className="text-[10px] text-[var(--color-text-faint)] font-mono">{truncateFp(p.instance_id)}</p>
                  </td>
                  <td className="py-2.5 px-2 text-[11px] text-[var(--color-text-secondary)] font-mono">{p.address}</td>
                  <td className="py-2.5 px-2 text-[11px] text-[var(--color-text-tertiary)]">{p.version}</td>
                  <td className="py-2.5 px-2 text-[11px] text-[var(--color-text-faint)] text-right tabular-nums">{timeAgo(p.last_heartbeat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChatPanel({ events }: { events: FedEvent[] }) {
  const session = useSession();
  const [channel, setChannel] = useState("general");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const chatMessages = events.filter((e) => e.type === "federation_chat" && e.channel === channel);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch("/engine/api/federation/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          channel,
          text: text.trim(),
          sender_handle: session.handle ?? "Operator",
        }),
      });
      setText("");
    } finally {
      setSending(false);
    }
  };

  const channels = ["general", "ops", "intel"];

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] panel-elevated flex flex-col">
      <div className="px-5 py-4 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Federation Chat</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Cross-instance comms</p>
          </div>
          <div className="flex gap-1">
            {channels.map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`rounded-[var(--radius-sm)] px-2 py-1 text-[10px] uppercase tracking-wider transition ${
                  channel === ch
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-overlay-subtle)]"
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3 max-h-[300px] min-h-[120px]">
        {chatMessages.length === 0 ? (
          <p className="text-[11px] text-[var(--color-text-faint)] text-center py-6">No messages in #{channel}</p>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={i} className="mb-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-semibold text-[var(--color-accent)]">{msg.from_name}</span>
                <span className="text-[10px] text-[var(--color-text-faint)]">{msg.sender_handle}</span>
              </div>
              <p className="text-[12px] text-[var(--color-text-secondary)] leading-snug">{msg.text}</p>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="px-5 py-3 border-t border-[var(--color-border)] shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={`Message #${channel}...`}
            className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !text.trim()}
            className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-2 text-white transition hover:opacity-90 disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EventFeed({ events }: { events: FedEvent[] }) {
  const fedEvents = events.filter((e) =>
    ["federation_intel", "federation_mission_status", "federation_qrf_status",
     "federation_peer_connected", "federation_peer_disconnected"].includes(e.type)
  );

  const iconMap: Record<string, typeof Shield> = {
    federation_intel: Shield,
    federation_mission_status: Radio,
    federation_qrf_status: Zap,
    federation_peer_connected: Network,
    federation_peer_disconnected: Network,
  };

  const colorMap: Record<string, string> = {
    federation_intel: "border-l-violet-500 text-violet-300",
    federation_mission_status: "border-l-[var(--color-cyan)] text-[var(--color-text-secondary)]",
    federation_qrf_status: "border-l-amber-500 text-amber-300",
    federation_peer_connected: "border-l-emerald-500 text-emerald-300",
    federation_peer_disconnected: "border-l-red-500 text-red-300",
  };

  function eventSummary(e: FedEvent): string {
    switch (e.type) {
      case "federation_intel":
        return `[${e.from_name}] Intel: ${e.title} (${e.report_type}, sev ${e.severity})`;
      case "federation_mission_status":
        return `[${e.from_name}] Mission ${e.callsign}: ${e.status}`;
      case "federation_qrf_status":
        return `[${e.from_name}] QRF ${e.callsign}: ${e.status}`;
      case "federation_peer_connected":
        return `Peer connected: ${e.name} (${e.instance_id ? truncateFp(e.instance_id) : ""})`;
      case "federation_peer_disconnected":
        return `Peer disconnected: ${e.instance_id ? truncateFp(e.instance_id) : ""}`;
      default:
        return e.type;
    }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] panel-elevated flex flex-col max-h-[400px]">
      <div className="px-5 py-4 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-[family:var(--font-display)] text-base uppercase tracking-[0.1em] text-[var(--color-text-strong)]">Federation Feed</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Intel, missions, and QRF from peers</p>
          </div>
          <span className="text-[10px] tabular-nums text-[var(--color-text-faint)]">{fedEvents.length} events</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {fedEvents.length === 0 ? (
          <p className="text-[11px] text-[var(--color-text-faint)] px-5 py-8 text-center">No federated events yet</p>
        ) : (
          fedEvents.map((event, i) => {
            const Icon = iconMap[event.type] || MessageSquare;
            const colors = colorMap[event.type] || "border-l-[var(--color-border)] text-[var(--color-text-tertiary)]";
            return (
              <div key={i} className={`flex items-start gap-2 px-3 py-2 text-[11px] ${colors} border-l-2 hover:bg-[var(--color-hover)] transition-colors`}>
                <Icon size={12} className="shrink-0 mt-0.5 opacity-70" />
                <span className="flex-1 leading-snug">{eventSummary(event)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* -- Main Panel -- */

export function FederationPanel() {
  const { subscribeAlerts } = useEngine();
  const [status, setStatus] = useState<FederationStatus | null>(null);
  const [peers, setPeers] = useState<PeerEntry[]>([]);
  const [events, setEvents] = useState<FedEvent[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, peersRes] = await Promise.all([
        fetch("/engine/api/federation/status", { credentials: "include" }),
        fetch("/engine/api/federation/peers", { credentials: "include" }),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (peersRes.ok) setPeers(await peersRes.json());
    } catch {
      // Network error, will retry
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const unsub = subscribeAlerts((event: Record<string, unknown>) => {
      const type = event.type as string;
      if (type?.startsWith("federation_")) {
        setEvents((prev) => [event as FedEvent, ...prev].slice(0, 200));
        if (type === "federation_peer_connected" || type === "federation_peer_disconnected") {
          fetchData();
        }
      }
    });
    return unsub;
  }, [subscribeAlerts, fetchData]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <IdentityCard status={status} />
        <PeerList peers={peers} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_0.6fr]">
        <ChatPanel events={events} />
        <EventFeed events={events} />
      </div>
    </div>
  );
}
