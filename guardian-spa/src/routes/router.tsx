import { createBrowserRouter } from "react-router";
import { AppLayout } from "@/routes/layout";
import { ProtectedRoute } from "@/lib/auth";
import { LoginPage } from "@/pages/login";
import { HomePage } from "@/pages/home";
import { AboutPage } from "@/pages/about";
import { StandardsPage } from "@/pages/standards";
import { RecruitPage } from "@/pages/recruit";
import { SetupPage } from "@/pages/setup";
import { OpsPage } from "@/pages/ops";
import { AarPage } from "@/pages/aar";
import { CommandPage } from "@/pages/command";
import { MissionsPage } from "@/pages/missions";
import { MissionDetailPage } from "@/pages/mission-detail";
import { DoctrinePage } from "@/pages/doctrine";
import { RosterPage } from "@/pages/roster";
import { IntelPage } from "@/pages/intel";
import { RescuesPage } from "@/pages/rescues";
import { FleetPage } from "@/pages/fleet";
import { QrfPage } from "@/pages/qrf";
import { IncidentsPage } from "@/pages/incidents";
import { NotificationsPage } from "@/pages/notifications";
import { ManualPage } from "@/pages/manual";
import { SettingsPage } from "@/pages/settings";
import { FederationPage } from "@/pages/federation";
import { TacticalPage } from "@/pages/tactical";
import { SitrepPage } from "@/pages/sitrep";
import { AiPage } from "@/pages/ai";

/* ------------------------------------------------------------------ */
/*  Stub for unmigrated pages                                          */
/* ------------------------------------------------------------------ */

function Stub({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
        {title} &mdash; coming soon
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Router                                                             */
/* ------------------------------------------------------------------ */

export const router = createBrowserRouter([
  /* Public pages (no auth required) */
  { path: "/", element: <HomePage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/about", element: <AboutPage /> },
  { path: "/standards", element: <StandardsPage /> },
  { path: "/recruit", element: <RecruitPage /> },
  { path: "/setup", element: <SetupPage /> },
  { path: "/ops", element: <OpsPage /> },
  { path: "/aar", element: <AarPage /> },

  /* Authenticated app — all operational routes */
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: "command", element: <CommandPage /> },
      { path: "missions", element: <MissionsPage /> },
      { path: "missions/new", element: <Stub title="New Mission" /> },
      { path: "missions/:missionId", element: <MissionDetailPage /> },
      { path: "intel", element: <IntelPage /> },
      { path: "doctrine", element: <DoctrinePage /> },
      { path: "rescues", element: <RescuesPage /> },
      { path: "roster", element: <RosterPage /> },
      { path: "fleet", element: <FleetPage /> },
      { path: "qrf", element: <QrfPage /> },
      { path: "incidents", element: <IncidentsPage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "manual", element: <ManualPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "sitrep", element: <SitrepPage /> },
      { path: "tactical", element: <TacticalPage /> },
      { path: "federation", element: <FederationPage /> },
      { path: "ai", element: <AiPage /> },
      { path: "admin", element: <Stub title="Admin" /> },
    ],
  },
]);
