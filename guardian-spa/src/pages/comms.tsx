/**
 * Comms — tactical communications page.
 *
 * Link 16-style layered channels with role-based clearance filtering,
 * real-time WebSocket delivery, typing indicators, and presence.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Radio,
  Hash,
  Users,
  Lock,
  Send,
  Plus,
  ChevronDown,
  Circle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  MessageSquare,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Channel = {
  id: string;
  name: string;
  channelType: string;
  scope: string;
  encrypted: boolean;
  refType?: string;
  refId?: string;
  parentId?: string;
  createdAt: string;
};

type Message = {
  id: string;
  channelId: string;
  senderId?: string;
  senderHandle: string;
  senderType: string;
  content: string;
  messageType: string;
  classification: string;
  encrypted: boolean;
  createdAt: string;
};

type Participant = {
  id: string;
  channelId: string;
  userId?: string;
  handle: string;
  clearance: string;
  role: string;
  online?: boolean;
};

type WsEvent =
  | { type: "chat:message"; channelId: string; message: Message }
  | { type: "chat:typing"; channelId: string; userId: string; handle: string; active: boolean }
  | { type: "chat:presence"; channelId: string; userId: string; handle: string; online: boolean };

/* ------------------------------------------------------------------ */
/*  Classification + Clearance display                                 */
/* ------------------------------------------------------------------ */

const classColors: Record<string, string> = {
  unclass: "emerald",
  restricted: "amber",
  internal: "red",
};

const channelTypeIcons: Record<string, typeof Radio> = {
  net: Radio,
  group: Users,
  team: Hash,
  direct: MessageSquare,
};

function ClassBadge({ classification }: { classification: string }) {
  const tone = classColors[classification] ?? "slate";
  const label = classification === "unclass" ? "UNCLASS" : classification.toUpperCase();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-${tone}-400/30 bg-${tone}-400/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-${tone}-300`}
    >
      {classification === "internal" && <EyeOff className="h-2 w-2" />}
      {classification === "restricted" && <ShieldAlert className="h-2 w-2" />}
      {label}
    </span>
  );
}

function ClearanceBadge({ clearance }: { clearance: string }) {
  const icons: Record<string, typeof Shield> = {
    full: ShieldCheck,
    tactical: ShieldAlert,
    customer: Eye,
  };
  const Icon = icons[clearance] ?? Shield;
  const tone = clearance === "full" ? "emerald" : clearance === "tactical" ? "amber" : "sky";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-${tone}-400/30 bg-${tone}-400/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-${tone}-300`}
    >
      <Icon className="h-2 w-2" />
      {clearance}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Comms WebSocket hook                                               */
/* ------------------------------------------------------------------ */

function useCommsWs(onEvent: (event: WsEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const [state, setState] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  onEventRef.current = onEvent;

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port = window.location.port || (proto === "wss:" ? "443" : "80");
    const url = `${proto}//${host}:${port}/ws/comms`;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let delay = 1000;

    function connect() {
      setState("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setState("connected");
        delay = 1000;
      };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as WsEvent;
          onEventRef.current(data);
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        setState("disconnected");
        reconnectTimer = setTimeout(() => {
          delay = Math.min(delay * 2, 30000);
          connect();
        }, delay);
      };
      ws.onerror = () => {};
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const send = useCallback((cmd: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    }
  }, []);

  return { state, send };
}

/* ------------------------------------------------------------------ */
/*  Create Channel Dialog                                              */
/* ------------------------------------------------------------------ */

function CreateChannelDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (ch: Channel) => void;
}) {
  const [name, setName] = useState("");
  const [channelType, setChannelType] = useState("group");
  const [encrypted, setEncrypted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ ok: boolean; channel: Channel }>("/api/comms/channels", {
        name: name.trim(),
        channelType,
        scope: "org",
        encrypted,
      });
      onCreated(res.channel);
      onClose();
    } catch {
      // TODO: surface error
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
            New Channel
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              Channel Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ALPHA-NET, CSAR-OPS"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              Type
            </label>
            <div className="flex gap-2">
              {(["net", "group", "team", "direct"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setChannelType(t)}
                  className={`rounded-[var(--radius-md)] border px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] transition ${
                    channelType === t
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:border-[var(--color-border-bright)]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={encrypted}
              onChange={(e) => setEncrypted(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-[var(--color-border)] bg-transparent accent-[var(--color-accent)]"
            />
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
              <Lock className="h-3 w-3" /> Encrypt at rest
            </span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-text-tertiary)] hover:bg-[var(--color-border)]/20"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || submitting}
            className="rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-2 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 disabled:opacity-40"
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Channel List Sidebar                                               */
/* ------------------------------------------------------------------ */

function ChannelSidebar({
  channels,
  activeId,
  onSelect,
  onCreate,
}: {
  channels: Channel[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  // Group channels by type
  const grouped: Record<string, Channel[]> = {};
  for (const ch of channels) {
    const key = ch.channelType;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ch);
  }

  const order = ["net", "group", "team", "direct"];
  const typeLabels: Record<string, string> = {
    net: "Nets",
    group: "Groups",
    team: "Teams",
    direct: "Direct",
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-3">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          <span className="font-[family:var(--font-display)] text-xs uppercase tracking-[0.12em] text-[var(--color-text-strong)]">
            Channels
          </span>
        </div>
        <button
          onClick={onCreate}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-1 text-[var(--color-text-tertiary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-1">
        {order.map((type) => {
          const list = grouped[type];
          if (!list || list.length === 0) return null;
          return (
            <div key={type} className="mb-2">
              <div className="px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                {typeLabels[type] ?? type}
              </div>
              {list.map((ch) => {
                const Icon = channelTypeIcons[ch.channelType] ?? Hash;
                const isActive = ch.id === activeId;
                return (
                  <button
                    key={ch.id}
                    onClick={() => onSelect(ch.id)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition ${
                      isActive
                        ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/20 hover:text-[var(--color-text-strong)]"
                    }`}
                  >
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="truncate text-xs">{ch.name}</span>
                    {ch.encrypted && <Lock className="ml-auto h-2.5 w-2.5 shrink-0 text-amber-400/60" />}
                  </button>
                );
              })}
            </div>
          );
        })}
        {channels.length === 0 && (
          <div className="px-3 py-8 text-center text-[10px] text-[var(--color-text-tertiary)]">
            No channels yet
          </div>
        )}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Message Bubble                                                     */
/* ------------------------------------------------------------------ */

function MessageBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isSystem = msg.senderType === "system" || msg.messageType === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-[var(--color-border)]/30 px-3 py-1 text-[10px] text-[var(--color-text-tertiary)]">
          {msg.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} mb-1`}>
      <div className="mb-0.5 flex items-center gap-1.5">
        {!isOwn && (
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
            {msg.senderHandle}
          </span>
        )}
        {msg.classification !== "unclass" && <ClassBadge classification={msg.classification} />}
        <span className="text-[9px] text-[var(--color-text-tertiary)]">{time}</span>
      </div>
      <div
        className={`max-w-[75%] rounded-[var(--radius-md)] px-3 py-2 text-sm ${
          isOwn
            ? "bg-[var(--color-accent)]/15 text-[var(--color-text-strong)]"
            : "bg-[var(--color-border)]/20 text-[var(--color-text-secondary)]"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Participants Panel                                                 */
/* ------------------------------------------------------------------ */

function ParticipantsPanel({
  participants,
  onClose,
}: {
  participants: Participant[];
  onClose: () => void;
}) {
  const online = participants.filter((p) => p.online);
  const offline = participants.filter((p) => !p.online);

  function renderList(list: Participant[]) {
    return list.map((p) => (
      <div key={p.id} className="flex items-center gap-2 py-1">
        <Circle
          className={`h-2 w-2 shrink-0 ${p.online ? "fill-emerald-400 text-emerald-400" : "fill-slate-500 text-slate-500"}`}
        />
        <span className="truncate text-xs text-[var(--color-text-secondary)]">{p.handle}</span>
        <ClearanceBadge clearance={p.clearance} />
      </div>
    ));
  }

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-3">
        <span className="font-[family:var(--font-display)] text-xs uppercase tracking-[0.12em] text-[var(--color-text-strong)]">
          Participants
        </span>
        <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {online.length > 0 && (
          <div className="mb-3">
            <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-emerald-400/80">
              Online ({online.length})
            </div>
            {renderList(online)}
          </div>
        )}
        {offline.length > 0 && (
          <div>
            <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
              Offline ({offline.length})
            </div>
            {renderList(offline)}
          </div>
        )}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Chat Area                                                          */
/* ------------------------------------------------------------------ */

function ChatArea({
  channel,
  messages,
  typingUsers,
  userId,
  onSend,
  onTyping,
  onLoadMore,
  hasMore,
  showParticipants,
  onToggleParticipants,
}: {
  channel: Channel;
  messages: Message[];
  typingUsers: Map<string, string>;
  userId: string;
  onSend: (content: string, classification: string) => void;
  onTyping: (active: boolean) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  showParticipants: boolean;
  onToggleParticipants: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [classification, setClassification] = useState<string>("unclass");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMsgCount = useRef(messages.length);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMsgCount.current = messages.length;
  }, [messages.length]);

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    onSend(text, classification);
    setDraft("");
    onTyping(false);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(value: string) {
    setDraft(value);
    onTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping(false), 3000);
  }

  const Icon = channelTypeIcons[channel.channelType] ?? Hash;
  const typingList = Array.from(typingUsers.values()).filter(Boolean);

  return (
    <div className="flex flex-1 flex-col">
      {/* Channel header */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-2.5">
        <Icon className="h-4 w-4 text-[var(--color-text-tertiary)]" />
        <span className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
          {channel.name}
        </span>
        {channel.encrypted && (
          <span className="flex items-center gap-1 text-[9px] text-amber-400/70">
            <Lock className="h-2.5 w-2.5" /> E2E
          </span>
        )}
        <span className="text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          {channel.channelType} / {channel.scope}
        </span>
        <div className="ml-auto">
          <button
            onClick={onToggleParticipants}
            className={`rounded-[var(--radius-sm)] border p-1.5 transition ${
              showParticipants
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {hasMore && (
          <div className="mb-3 flex justify-center">
            <button
              onClick={onLoadMore}
              className="rounded-full border border-[var(--color-border)] px-3 py-1 text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)] hover:border-[var(--color-border-bright)]"
            >
              Load earlier messages
            </button>
          </div>
        )}
        {/* Oldest first */}
        {[...messages].reverse().map((m) => (
          <MessageBubble key={m.id} msg={m} isOwn={m.senderId === userId} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingList.length > 0 && (
        <div className="px-4 py-1 text-[10px] text-[var(--color-text-tertiary)]">
          {typingList.join(", ")} {typingList.length === 1 ? "is" : "are"} typing...
        </div>
      )}

      {/* Send box */}
      <div className="border-t border-[var(--color-border)] px-4 py-3">
        <div className="flex items-end gap-2">
          {/* Classification selector */}
          <div className="relative">
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              className="appearance-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 pr-6 text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none"
            >
              <option value="unclass">UNCLASS</option>
              <option value="restricted">RESTRICTED</option>
              <option value="internal">INTERNAL</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          </div>

          <textarea
            value={draft}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            rows={1}
            className="flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />

          <button
            onClick={handleSend}
            disabled={!draft.trim()}
            className="rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 p-2 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 disabled:opacity-30"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function CommsPage() {
  const session = useSession();
  const userId = session.userId;

  // State
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [showParticipants, setShowParticipants] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;
  const joinedChannels = useRef(new Set<string>());

  // Fetch channels on mount
  useEffect(() => {
    api
      .get<{ channels: Channel[] }>("/api/comms/channels")
      .then((res) => {
        setChannels(res.channels);
        if (res.channels.length > 0 && !activeChannelId) {
          setActiveChannelId(res.channels[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch messages + participants when channel changes
  useEffect(() => {
    if (!activeChannelId) return;

    api
      .get<{ messages: Message[] }>(`/api/comms/channels/${activeChannelId}/messages?limit=50`)
      .then((res) => {
        setMessages(res.messages);
        setHasMore(res.messages.length >= 50);
      })
      .catch(() => setMessages([]));

    api
      .get<{ participants: Participant[] }>(`/api/comms/channels/${activeChannelId}/participants`)
      .then((res) => setParticipants(res.participants))
      .catch(() => setParticipants([]));

    setTypingUsers(new Map());

    // Mark read
    api.post(`/api/comms/channels/${activeChannelId}/read`).catch(() => {});
  }, [activeChannelId]);

  // WebSocket
  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      switch (event.type) {
        case "chat:message":
          if (event.channelId === activeChannelId) {
            setMessages((prev) => [event.message, ...prev]);
            // Clear typing for this sender
            setTypingUsers((prev) => {
              const next = new Map(prev);
              if (event.message.senderId) next.delete(event.message.senderId);
              return next;
            });
            // Mark read
            api.post(`/api/comms/channels/${event.channelId}/read`).catch(() => {});
          }
          break;

        case "chat:typing":
          if (event.channelId === activeChannelId && event.userId !== userId) {
            setTypingUsers((prev) => {
              const next = new Map(prev);
              if (event.active) {
                next.set(event.userId, event.handle);
              } else {
                next.delete(event.userId);
              }
              return next;
            });
          }
          break;

        case "chat:presence":
          if (event.channelId === activeChannelId) {
            setParticipants((prev) =>
              prev.map((p) =>
                p.userId === event.userId ? { ...p, online: event.online } : p,
              ),
            );
          }
          break;
      }
    },
    [activeChannelId, userId],
  );

  const { state: wsState, send: wsSend } = useCommsWs(handleWsEvent);

  // Join/leave WS rooms when channel changes
  useEffect(() => {
    if (wsState !== "connected") return;

    // Leave old rooms
    for (const chId of joinedChannels.current) {
      if (chId !== activeChannelId) {
        wsSend({ type: "chat:leave", channelId: chId });
        joinedChannels.current.delete(chId);
      }
    }

    // Join new room
    if (activeChannelId && !joinedChannels.current.has(activeChannelId)) {
      wsSend({ type: "chat:join", channelId: activeChannelId });
      joinedChannels.current.add(activeChannelId);
    }
  }, [activeChannelId, wsState, wsSend]);

  // Handlers
  function handleSend(content: string, classification: string) {
    if (!activeChannelId) return;
    api
      .post(`/api/comms/channels/${activeChannelId}/messages`, {
        content,
        classification,
        senderType: "user",
        messageType: "text",
      })
      .catch(() => {});
  }

  function handleTyping(active: boolean) {
    if (!activeChannelId) return;
    wsSend({ type: "chat:typing", channelId: activeChannelId, active });
  }

  function handleLoadMore() {
    if (!activeChannelId || messages.length === 0) return;
    const oldest = messages[messages.length - 1];
    api
      .get<{ messages: Message[] }>(
        `/api/comms/channels/${activeChannelId}/messages?limit=50&cursor=${oldest.id}`,
      )
      .then((res) => {
        setMessages((prev) => [...prev, ...res.messages]);
        setHasMore(res.messages.length >= 50);
      })
      .catch(() => {});
  }

  function handleChannelCreated(ch: Channel) {
    setChannels((prev) => [...prev, ch]);
    setActiveChannelId(ch.id);
  }

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)]">
      {/* Channel sidebar */}
      <ChannelSidebar
        channels={channels}
        activeId={activeChannelId}
        onSelect={setActiveChannelId}
        onCreate={() => setShowCreate(true)}
      />

      {/* Main area */}
      {activeChannel ? (
        <>
          <ChatArea
            channel={activeChannel}
            messages={messages}
            typingUsers={typingUsers}
            userId={userId}
            onSend={handleSend}
            onTyping={handleTyping}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            showParticipants={showParticipants}
            onToggleParticipants={() => setShowParticipants((v) => !v)}
          />
          {showParticipants && (
            <ParticipantsPanel
              participants={participants}
              onClose={() => setShowParticipants(false)}
            />
          )}
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Radio className="mx-auto mb-3 h-8 w-8 text-[var(--color-text-tertiary)]" />
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              Select or create a channel
            </p>
          </div>
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <CreateChannelDialog
          onClose={() => setShowCreate(false)}
          onCreated={handleChannelCreated}
        />
      )}

      {/* WS status indicator */}
      <div className="fixed bottom-4 right-4 z-40">
        <span
          className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.12em] ${
            wsState === "connected"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
              : wsState === "connecting"
                ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
                : "border-red-400/30 bg-red-400/10 text-red-400"
          }`}
        >
          <Circle className={`h-1.5 w-1.5 ${wsState === "connected" ? "fill-emerald-400" : wsState === "connecting" ? "fill-amber-400" : "fill-red-400"}`} />
          {wsState}
        </span>
      </div>
    </div>
  );
}
