"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Bot,
  User,
  Wrench,
  ChevronUp,
  ChevronDown,
  Trash2,
  Sparkles,
} from "lucide-react";

const ENGINE_BASE = "/engine";
const STORAGE_KEY = "guardian-ai-chat";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  timestamp: Date;
};

function loadMessages(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Omit<Message, "timestamp"> & { timestamp: string }>;
    return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function saveMessages(msgs: Message[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Simple markdown-ish rendering: **bold**, `code`, ```blocks```, line breaks
function renderContent(text: string) {
  const parts: React.ReactNode[] = [];
  let key = 0;

  // Split on code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIdx = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Text before code block
    if (match.index > lastIdx) {
      parts.push(
        <span key={key++}>{renderInline(text.slice(lastIdx, match.index))}</span>
      );
    }
    // Code block
    parts.push(
      <pre
        key={key++}
        className="my-2 overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[11px] leading-relaxed"
      >
        <code>{match[2]}</code>
      </pre>
    );
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    parts.push(
      <span key={key++}>{renderInline(text.slice(lastIdx))}</span>
    );
  }

  return parts;
}

function renderInline(text: string): React.ReactNode[] {
  // Split into lines and handle basic formatting
  return text.split("\n").flatMap((line, i, arr) => {
    const nodes: React.ReactNode[] = [];

    // Bold
    let processed = line;
    const boldParts = processed.split(/\*\*(.*?)\*\*/g);
    const lineNodes: React.ReactNode[] = [];
    boldParts.forEach((part, j) => {
      if (j % 2 === 1) {
        lineNodes.push(
          <strong key={`b-${i}-${j}`} className="font-semibold text-[var(--color-text-strong)]">
            {part}
          </strong>
        );
      } else {
        // Inline code
        const codeParts = part.split(/`([^`]+)`/g);
        codeParts.forEach((cp, k) => {
          if (k % 2 === 1) {
            lineNodes.push(
              <code
                key={`c-${i}-${j}-${k}`}
                className="rounded bg-[var(--color-overlay-subtle)] px-1 py-0.5 text-[11px] font-mono text-[var(--color-accent)]"
              >
                {cp}
              </code>
            );
          } else {
            lineNodes.push(cp);
          }
        });
      }
    });

    nodes.push(<span key={`line-${i}`}>{lineNodes}</span>);
    if (i < arr.length - 1) {
      nodes.push(<br key={`br-${i}`} />);
    }
    return nodes;
  });
}

export function AiCommandPanel() {
  const [messages, setMessages] = useState<Message[]>(() => loadMessages());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist messages to sessionStorage on every change
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;

    setError("");
    setInput("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: msg,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Build history for the API (exclude the current message)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch(`${ENGINE_BASE}/api/ai/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Command failed");
        return;
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        toolsUsed: data.tools_used,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError("Failed to reach Guardian AI");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function clearHistory() {
    setMessages([]);
    setError("");
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--color-accent)]" />
          <h2 className="text-sm font-medium text-[var(--color-text-strong)]">Guardian AI</h2>
          <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Command
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasMessages && (
            <button
              onClick={clearHistory}
              className="flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-[10px] text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-overlay-subtle)] hover:text-[var(--color-text-secondary)]"
              title="Clear conversation"
            >
              <Trash2 size={11} />
              Clear
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-overlay-subtle)] hover:text-[var(--color-text-secondary)]"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Chat area */}
          <div className="flex-1 overflow-y-auto">
            {!hasMessages && !loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Bot size={32} className="mb-3 text-[var(--color-text-faint)]" />
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Guardian AI Command Interface
                </p>
                <p className="mt-1 max-w-sm text-[11px] text-[var(--color-text-tertiary)]">
                  Search across missions, intel, users, manuals, and more. Execute admin actions with natural language.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {[
                    "Show me all active missions",
                    "Who has admin access?",
                    "Any critical intel reports?",
                    "Org status overview",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[10px] text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent)]/20 hover:text-[var(--color-text-strong)]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1 p-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 rounded-[var(--radius-md)] px-3 py-2.5 ${
                      msg.role === "user"
                        ? "bg-transparent"
                        : "bg-[var(--color-overlay-subtle)]"
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {msg.role === "user" ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-overlay-medium)]">
                          <User size={11} className="text-[var(--color-text-secondary)]" />
                        </div>
                      ) : (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)]/15">
                          <Bot size={11} className="text-[var(--color-accent)]" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                          {msg.role === "user" ? "You" : "Guardian AI"}
                        </span>
                        <span className="text-[9px] text-[var(--color-text-faint)]">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                        {renderContent(msg.content)}
                      </div>
                      {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {[...new Set(msg.toolsUsed)].map((tool) => (
                            <span
                              key={tool}
                              className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] text-[var(--color-text-faint)]"
                            >
                              <Wrench size={8} />
                              {tool.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-3 rounded-[var(--radius-md)] bg-[var(--color-overlay-subtle)] px-3 py-2.5">
                    <div className="mt-0.5 flex-shrink-0">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)]/15">
                        <Bot size={11} className="text-[var(--color-accent)]" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                      <Loader2 size={12} className="animate-spin" />
                      Processing command...
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mb-2 rounded-[var(--radius-sm)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-[10px] text-red-200">
              {error}
            </div>
          )}

          {/* Command bar */}
          <div className="border-t border-[var(--color-border)] p-3">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  autoComplete="off"
                  name="guardian-ai-command"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Guardian AI anything..."
                  disabled={loading}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2.5 pr-10 text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-faint)] transition focus:border-[var(--color-accent)]/40 disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 text-[var(--color-accent)] transition hover:bg-[var(--color-accent)]/20 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
