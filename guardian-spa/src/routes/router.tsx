import { createBrowserRouter } from "react-router";
import { AppLayout } from "@/routes/layout";
import { ProtectedRoute } from "@/lib/auth";

// Lazy-loaded pages
import { LoginPage } from "@/pages/login";

// Placeholder for pages not yet migrated — shows a clean loading state
function Stub({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        {title}
      </p>
      <p className="mt-2 text-sm text-[var(--color-text-faint)]">
        Page migration in progress
      </p>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/setup",
    element: <Stub title="Setup" />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Stub title="Home" /> },
      { path: "command", element: <Stub title="Command" /> },
      { path: "missions", element: <Stub title="Missions" /> },
      { path: "missions/new", element: <Stub title="New Mission" /> },
      { path: "missions/:missionId", element: <Stub title="Mission Detail" /> },
      { path: "intel", element: <Stub title="Intel" /> },
      { path: "doctrine", element: <Stub title="Doctrine" /> },
      { path: "rescues", element: <Stub title="Rescues" /> },
      { path: "fleet", element: <Stub title="Fleet" /> },
      { path: "roster", element: <Stub title="Roster" /> },
      { path: "qrf", element: <Stub title="QRF" /> },
      { path: "incidents", element: <Stub title="Incidents" /> },
      { path: "notifications", element: <Stub title="Notifications" /> },
      { path: "sitrep", element: <Stub title="SITREP" /> },
      { path: "manual", element: <Stub title="Manual" /> },
      { path: "tactical", element: <Stub title="Tactical" /> },
      { path: "federation", element: <Stub title="Federation" /> },
      { path: "ai", element: <Stub title="AI" /> },
      { path: "admin", element: <Stub title="Admin" /> },
      { path: "settings", element: <Stub title="Settings" /> },
      { path: "aar", element: <Stub title="AAR" /> },
      { path: "ops", element: <Stub title="Ops" /> },
      { path: "standards", element: <Stub title="Standards" /> },
      { path: "about", element: <Stub title="About" /> },
    ],
  },
]);
