"use client";

import type { ReactNode } from "react";
import type { GuardianSession } from "@/lib/auth-core";
import { Sidebar } from "@/components/sidebar";

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
  return (
    <div className="flex min-h-screen">
      <Sidebar session={session} orgName={orgName} />
      <main className="ml-0 min-h-screen flex-1 bg-[var(--color-bg)] md:ml-[var(--sidebar-width)]">
        <div className="mx-auto max-w-[1400px] px-5 py-5">
          <header className="mb-5 border-b border-[var(--color-border)] pb-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              {orgName} / {section}
            </p>
            <h1 className="mt-1 font-[family:var(--font-display)] text-2xl uppercase tracking-[0.08em] text-white">
              {title}
            </h1>
          </header>
          <div className="flex flex-col gap-5">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
