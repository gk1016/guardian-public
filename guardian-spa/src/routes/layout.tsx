/**
 * App layout — wraps all authenticated routes with the sidebar, header,
 * engine context, and alert toasts.
 */
import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { useSession } from "@/lib/auth";
import { EngineProvider } from "@/lib/engine-context";
import { Sidebar } from "@/components/sidebar";
import { AlertToastContainer } from "@/components/alert-toast";

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
  "/comms": { section: "Communications", title: "Comms" },
};

export function AppLayout() {
  const session = useSession();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("guardian-sidebar-collapsed");
      if (saved === "true") setSidebarCollapsed(true);
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("guardian-sidebar-collapsed", String(sidebarCollapsed));
    } catch {
      // localStorage unavailable
    }
  }, [sidebarCollapsed]);

  // Match path to section (handle /missions/123 -> /missions)
  const basePath = "/" + (location.pathname.split("/")[1] || "command");
  const meta = SECTION_MAP[basePath] ?? { section: "Operations", title: "Guardian" };
  const orgName = session.orgName ?? session.orgTag ?? "Guardian";

  return (
    <EngineProvider>
      <div className="flex min-h-screen">
        <Sidebar
          desktopCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />
        <main className="min-h-screen flex-1 bg-[var(--color-bg)]">
          <div className="mx-auto max-w-[1400px] px-4 py-4">
            <header className="mb-4 border-b border-[var(--color-border)] pb-3 pl-10 md:pl-0">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                {orgName} / {meta.section}
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
        <AlertToastContainer />
      </div>
    </EngineProvider>
  );
}
