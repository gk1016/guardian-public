import { lazy, Suspense, type ComponentType } from "react";
import { createBrowserRouter } from "react-router";
import { AppLayout } from "@/routes/layout";
import { ProtectedRoute } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Route-level code splitting                                         */
/*  Each page is its own chunk, loaded on demand. The shell           */
/*  (ProtectedRoute + AppLayout) stays in the entry bundle.           */
/* ------------------------------------------------------------------ */

const RouteFallback = (
  <div className="flex min-h-[40vh] items-center justify-center">
    <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
      Loading...
    </p>
  </div>
);

function page(factory: () => Promise<{ default: ComponentType }>) {
  const C = lazy(factory);
  return (
    <Suspense fallback={RouteFallback}>
      <C />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  /* Public pages (no auth required) */
  { path: "/", element: page(() => import("@/pages/home").then((m) => ({ default: m.HomePage }))) },
  { path: "/login", element: page(() => import("@/pages/login").then((m) => ({ default: m.LoginPage }))) },
  { path: "/about", element: page(() => import("@/pages/about").then((m) => ({ default: m.AboutPage }))) },
  { path: "/standards", element: page(() => import("@/pages/standards").then((m) => ({ default: m.StandardsPage }))) },
  { path: "/recruit", element: page(() => import("@/pages/recruit").then((m) => ({ default: m.RecruitPage }))) },
  { path: "/setup", element: page(() => import("@/pages/setup").then((m) => ({ default: m.SetupPage }))) },
  { path: "/ops", element: page(() => import("@/pages/ops").then((m) => ({ default: m.OpsPage }))) },
  { path: "/aar", element: page(() => import("@/pages/aar").then((m) => ({ default: m.AarPage }))) },

  /* Authenticated app — all operational routes */
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: "command", element: page(() => import("@/pages/command").then((m) => ({ default: m.CommandPage }))) },
      { path: "missions", element: page(() => import("@/pages/missions").then((m) => ({ default: m.MissionsPage }))) },
      { path: "missions/new", element: page(() => import("@/pages/missions-new").then((m) => ({ default: m.MissionsNewPage }))) },
      { path: "missions/:missionId", element: page(() => import("@/pages/mission-detail").then((m) => ({ default: m.MissionDetailPage }))) },
      { path: "intel", element: page(() => import("@/pages/intel").then((m) => ({ default: m.IntelPage }))) },
      { path: "threat-actors", element: page(() => import("@/pages/threat-actors").then((m) => ({ default: m.ThreatActorsPage }))) },
      { path: "intel-reqs", element: page(() => import("@/pages/intel-reqs").then((m) => ({ default: m.IntelReqsPage }))) },
      { path: "assessments", element: page(() => import("@/pages/assessments").then((m) => ({ default: m.AssessmentsPage }))) },
      { path: "targeting", element: page(() => import("@/pages/targeting").then((m) => ({ default: m.TargetingPage }))) },
      { path: "doctrine", element: page(() => import("@/pages/doctrine").then((m) => ({ default: m.DoctrinePage }))) },
      { path: "rescues", element: page(() => import("@/pages/rescues").then((m) => ({ default: m.RescuesPage }))) },
      { path: "roster", element: page(() => import("@/pages/roster").then((m) => ({ default: m.RosterPage }))) },
      { path: "fleet", element: page(() => import("@/pages/fleet").then((m) => ({ default: m.FleetPage }))) },
      { path: "qrf", element: page(() => import("@/pages/qrf").then((m) => ({ default: m.QrfPage }))) },
      { path: "incidents", element: page(() => import("@/pages/incidents").then((m) => ({ default: m.IncidentsPage }))) },
      { path: "notifications", element: page(() => import("@/pages/notifications").then((m) => ({ default: m.NotificationsPage }))) },
      { path: "manual", element: page(() => import("@/pages/manual").then((m) => ({ default: m.ManualPage }))) },
      { path: "settings", element: page(() => import("@/pages/settings").then((m) => ({ default: m.SettingsPage }))) },
      { path: "sitrep", element: page(() => import("@/pages/sitrep").then((m) => ({ default: m.SitrepPage }))) },
      { path: "tactical", element: page(() => import("@/pages/tactical").then((m) => ({ default: m.TacticalPage }))) },
      { path: "federation", element: page(() => import("@/pages/federation").then((m) => ({ default: m.FederationPage }))) },
      { path: "ai", element: page(() => import("@/pages/ai").then((m) => ({ default: m.AiPage }))) },
      { path: "admin", element: page(() => import("@/pages/admin").then((m) => ({ default: m.AdminPage }))) },
      { path: "comms", element: page(() => import("@/pages/comms").then((m) => ({ default: m.CommsPage }))) },
    ],
  },
]);
