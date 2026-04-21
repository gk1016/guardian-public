"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export type EngineEvent = {
  type: string;
  category: string;
  severity: string;
  title: string;
  org_id?: string;
  mission_id?: string;
  callsign?: string;
  field?: string;
  hostile_group?: string;
  star_system?: string;
  report_count?: number;
  max_severity?: number;
  overlapping_missions?: string[];
};

type ConnectionState = "connecting" | "connected" | "disconnected";

const MIN_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 25000; // 25s ping to keep connection alive through proxies

/**
 * Hook for connecting to guardian-engine WebSocket via wss:// through Caddy.
 * Auto-reconnects with exponential backoff. Fires onEvent for each parsed message.
 */
export function useEngineWS(onEvent: (event: EngineEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(MIN_RECONNECT_DELAY);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const onEventRef = useRef(onEvent);
  const [state, setState] = useState<ConnectionState>("disconnected");

  // Keep callback ref fresh without re-triggering effect
  onEventRef.current = onEvent;

  const cleanup = useCallback(() => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();
    setState("connecting");

    // Build WSS URL from current page origin
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    // Engine WS goes through Caddy on same port as the app (3411)
    const port = window.location.port || (proto === "wss:" ? "443" : "80");
    const url = `${proto}//${host}:${port}/engine/ws`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setState("connected");
      reconnectDelay.current = MIN_RECONNECT_DELAY;

      // Start heartbeat pings
      heartbeatTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, HEARTBEAT_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as EngineEvent;
        onEventRef.current(data);
      } catch {
        // Non-JSON message, ignore
      }
    };

    ws.onclose = () => {
      setState("disconnected");
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
        heartbeatTimer.current = null;
      }

      // Exponential backoff reconnect
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(
          reconnectDelay.current * 2,
          MAX_RECONNECT_DELAY
        );
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };
  }, [cleanup]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  return { state };
}
