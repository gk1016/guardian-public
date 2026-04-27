import { createBrowserRouter } from "react-router";
import { AppLayout } from "@/routes/layout";
import { ProtectedRoute } from "@/lib/auth";
import { LoginPage } from "@/pages/login";
import { HomePage } from "@/pages/home";
import { AboutPage } from "@/pages/about";
import { StandardsPage } from "@/pages/standards";
import { RecruitPage } from "@/pages/recruit";
import { CommandPage } from "@/pages/command";
import { MissionsPage } from "@/pages/missions";
import { MissionDetailPage } from "@/pages/mission-detail";
import { DoctrinePage } from "@/pages/doctrine";
import { RosterPage } from "@/pages/roster";
import { IntelPage } from "@/pages/intel";
import { RescuesPage } from "@/pages/rescues";

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
  { path: "/setup", element: <Stub title="Setup" /> },

  /* Authenticated app */
  {
    path: "/app",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <CommandPage /> },
      { path: "command", element: <CommandPage /> },
      { path: "missions", element: <MissionsPage /> },
      { path: "missions/new", element: <Stub title="New Mission" /> },
      { path: "missions/:missionId", element: <MissionDetailPage /> },
      { path: "intel", element: <IntelPage /> },
      { path: "doctrine", element: <DoctrinePage /> },
      { path: "rescues", element: <RescuesPage /> },
      { path: "roster", element: <RosterPage /> },
      { path: "fleet", element: <Stub title="Fleet" /> },
      { path: "qrf", element: <Stub title="QRF" /> },
      { path: "incidents", element: <Stub title="Incidents" /> },
      { path: "notifications", element: <Stub title="Notifications" /> },
      { path: "sitrep", element: <Stub title="Situation Report" /> },
      { path: "manual", element: <Stub title="Manual" /> },
      { path: "tactical", element: <Stub title="Tactical" /> },
      { path: "federation", element: <Stub title="Federation" /> },
      { path: "ai", element: <Stub title="AI" /> },
      { path: "admin", element: <Stub title="Admin" /> },
      { path: "settings", element: <Stub title="Settings" /> },
      { path: "aar", element: <Stub title="After Action Reports" /> },
      { path: "ops", element: <Stub title="Operations" /> },
      { path: "standards", element: <Stub title="Standards" /> },
      { path: "about", element: <Stub title="About" /> },
    ],
  },

  /* Legacy routes: redirect /command -> /app/command etc. */
  {
    path: "/command",
    element: <RedirectToApp />,
  },
  {
    path: "/missions",
    element: <RedirectToApp />,
  },
  {
    path: "/missions/:missionId",
    element: <RedirectToApp />,
  },
  {
    path: "/intel",
    element: <RedirectToApp />,
  },
  {
    path: "/doctrine",
    element: <RedirectToApp />,
  },
  {
    path: "/rescues",
    element: <RedirectToApp />,
  },
  {
    path: "/roster",
    element: <RedirectToApp />,
  },
  {
    path: "/fleet",
    element: <RedirectToApp />,
  },
  {
    path: "/qrf",
    element: <RedirectToApp />,
  },
  {
    path: "/notifications",
    element: <RedirectToApp />,
  },
  {
    path: "/admin",
    element: <RedirectToApp />,
  },
  {
    path: "/settings",
    element: <RedirectToApp />,
  },
]);

/* Redirect bare /command, /missions etc. to /app/command, /app/missions */
function RedirectToApp() {
  const loc = window.location;
  const newPath = "/app" + loc.pathname;
  window.location.replace(newPath + loc.search + loc.hash);
  return null;
}
