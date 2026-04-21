"use client";

import { useState, useEffect, type ReactNode } from "react";
import type { GuardianSession } from "@/lib/auth-core";
import { EngineProvider } from "@/lib/engine-context";
import { Sidebar } from "@/components/sidebar";
import { AlertToastContainer } from "@/components/alert-toast";

type OpsShellProps = {
  currentPath:
    | "/command"
    | "/missions"
    | "/intel"
    | "/doctrine"
    | "/rescues"
    | "/roster"
    | "/qrf"
    | "/incidents"
    | "/admin"
    | "/notifications";
  section: string;
  title: string;
  orgName: string;
  session: GuardianSession;
  children: ReactNode;
};

export function OpsShell({
  currentPath,
  section,
  title,
  orgName,
  session,
  children,
}: OpsShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("guardian-sidebar-collapsed");
      if (saved === "true") setSidebarCollapsed(true);
    } catch {
      // SSR or localStorage unavailable
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("guardian-sidebar-collapsed", String(sidebarCollapsed));
    } catch {
      // localStorage unavailable
    }
  }, [sidebarCollapsed]);

  return (
    <EngineProvider>
      <div className="flex min-h-screen">
        <Sidebar
          session={session}
          orgName={orgName}
          desktopCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />
        <main
          className={`ml-0 min-h-screen flex-1 bg-[var(--color-bg)] transition-[margin] duration-200 ${
            sidebarCollapsed ? "md:ml-14" : "md:ml-[var(--sidebar-width)]"
          }`}
        >
          <div className="mx-auto max-w-[1400px] px-5 py-5">
            <header className="mb-5 border-b border-[var(--color-border)] pb-4 pl-10 md:pl-0">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                {orgName} / {section}
              </p>
              <h1 className="mt-1 font-[family:var(--font-display)] text-2xl uppercase tracking-[0.08em] text-white">
                {title}
              </h1>
            </header>
            <div className="flex flex-col gap-5">{children}</div>
          </div>
        </main>
        <AlertToastContainer />
      </div>
    </EngineProvider>
  );
}
