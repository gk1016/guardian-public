/**
 * App layout — wraps all authenticated routes with the sidebar, header,
 * engine context, and alert toasts.
 */
import { Outlet, useLocation } from "react-router";
import { useSession } from "@/lib/auth";
import { EngineProvider } from "@/lib/engine-context";

// Section metadata derived from path
const SECTION_MAP: Record<string, { section: string; title: string }> = {
  "/command": { section: "Operations", title: "Command" },
  "/missions": { section: "Operations", title: "Missions" },
  "/intel": { section: "Intelligence", title: "Intel Reports" },
  "/doctrine": { section: "Operations", title: "Doctrine" },
  "/rescues": { section: "Operations", title: "Rescues" },
  "/fleet": { section: "Fleet", title: "Fleet Management" },
  "/roster": { section: "Personnel", title: "Roster" },
  "/qrf": { section: "Operations", title: "QRF Readiness" },
  "/incidents": { section: "Operations", title: "Incidents" },
  "/notifications": { section: "System", title: "Notifications" },
  "/sitrep": { section: "Intelligence", title: "SITREP" },
  "/manual": { section: "Reference", title: "Manual" },
  "/tactical": { section: "Operations", title: "Tactical" },
  "/federation": { section: "Federation", title: "Federation" },
  "/ai": { section: "Intelligence", title: "AI Analysis" },
  "/admin": { section: "Administration", title: "Admin" },
  "/settings": { section: "System", title: "Settings" },
  "/aar": { section: "Operations", title: "After Action Reports" },
  "/ops": { section: "Operations", title: "Ops Center" },
  "/standards": { section: "Reference", title: "Standards" },
  "/about": { section: "System", title: "About" },
};

export function AppLayout() {
  const session = useSession();
  const location = useLocation();

  // Match path to section (handle /missions/123 -> /missions)
  const basePath = "/" + (location.pathname.split("/")[1] || "command");
  const meta = SECTION_MAP[basePath] ?? { section: "Operations", title: "Guardian" };

  return (
    <EngineProvider>
      <div className="flex min-h-screen">
        {/* Sidebar will be imported here once components are migrated */}
        <main className="min-h-screen flex-1 bg-[var(--color-bg)]">
          <div className="mx-auto max-w-[1400px] px-4 py-4">
            <header className="mb-4 border-b border-[var(--color-border)] pb-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                {session.orgName ?? session.orgTag ?? "Guardian"} / {meta.section}
              </p>
              <h1 className="mt-1 font-[family:var(--font-display)] text-2xl uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
                {meta.title}
              </h1>
            </header>
            <div className="flex flex-col gap-4">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </EngineProvider>
  );
}
