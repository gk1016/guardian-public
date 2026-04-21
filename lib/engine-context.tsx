"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useEngineWS, type EngineEvent } from "@/lib/use-engine-ws";

export type ReadinessBreakdown = {
  qrf_posture: number;
  package_discipline: number;
  rescue_response: number;
  threat_awareness: number;
};

export type OpsSummary = {
  active_missions: number;
  planning_missions: number;
  qrf_ready: number;
  qrf_total: number;
  open_rescues: number;
  unread_alerts: number;
  active_intel: number;
  threat_clusters: number;
  compliance_violations: number;
  readiness_score: number;
  readiness: ReadinessBreakdown;
  timestamp: string;
};

type AlertCallback = (event: EngineEvent) => void;

type EngineContextValue = {
  connectionState: "connecting" | "connected" | "disconnected";
  opsSummary: OpsSummary | null;
  lastTick: Date | null;
  subscribeAlerts: (cb: AlertCallback) => () => void;
};

const EngineContext = createContext<EngineContextValue>({
  connectionState: "disconnected",
  opsSummary: null,
  lastTick: null,
  subscribeAlerts: () => () => {},
});

export function useEngine() {
  return useContext(EngineContext);
}

export function EngineProvider({ children }: { children: ReactNode }) {
  const [opsSummary, setOpsSummary] = useState<OpsSummary | null>(null);
  const [lastTick, setLastTick] = useState<Date | null>(null);
  const alertCallbacks = useRef(new Set<AlertCallback>());

  const subscribeAlerts = useCallback((cb: AlertCallback) => {
    alertCallbacks.current.add(cb);
    return () => {
      alertCallbacks.current.delete(cb);
    };
  }, []);

  const onEvent = useCallback((event: EngineEvent) => {
    if (event.type === "ops_summary") {
      // The ops_summary event has numeric fields at the top level
      const summary = event as unknown as OpsSummary & { type: string };
      setOpsSummary({
        active_missions: summary.active_missions ?? 0,
        planning_missions: summary.planning_missions ?? 0,
        qrf_ready: summary.qrf_ready ?? 0,
        qrf_total: summary.qrf_total ?? 0,
        open_rescues: summary.open_rescues ?? 0,
        unread_alerts: summary.unread_alerts ?? 0,
        active_intel: summary.active_intel ?? 0,
        threat_clusters: summary.threat_clusters ?? 0,
        compliance_violations: summary.compliance_violations ?? 0,
        readiness_score: summary.readiness_score ?? 0,
        readiness: summary.readiness ?? {
          qrf_posture: 0,
          package_discipline: 0,
          rescue_response: 0,
          threat_awareness: 0,
        },
        timestamp: summary.timestamp ?? new Date().toISOString(),
      });
      setLastTick(new Date());
    } else {
      // Forward all non-summary events to alert subscribers
      for (const cb of alertCallbacks.current) {
        cb(event);
      }
    }
  }, []);

  const { state } = useEngineWS(onEvent);

  return (
    <EngineContext.Provider
      value={{ connectionState: state, opsSummary, lastTick, subscribeAlerts }}
    >
      {children}
    </EngineContext.Provider>
  );
}
