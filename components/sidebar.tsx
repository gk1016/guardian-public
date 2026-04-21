"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  Shield,
  Zap,
  BookCheck,
  LifeBuoy,
  AlertTriangle,
  Bell,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { GuardianSession } from "@/lib/auth-core";

const navSections = [
  {
    title: "Command",
    items: [
      { href: "/command", label: "Watch Floor", icon: LayoutDashboard },
      { href: "/missions", label: "Missions", icon: Target },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/intel", label: "Intel", icon: Shield },
      { href: "/qrf", label: "QRF", icon: Zap },
      { href: "/rescues", label: "CSAR", icon: LifeBuoy },
      { href: "/doctrine", label: "Doctrine", icon: BookCheck },
    ],
  },
  {
    title: "Review",
    items: [
      { href: "/incidents", label: "Incidents", icon: AlertTriangle },
      { href: "/notifications", label: "Alerts", icon: Bell },
    ],
  },
  {
    title: "Org",
    items: [
      { href: "/roster", label: "Roster", icon: Users },
      { href: "/admin", label: "Admin", icon: Settings, adminOnly: true },
    ],
  },
];

type SidebarProps = {
  session: GuardianSession;
  orgName: string;
  desktopCollapsed: boolean;
  onToggleCollapse: () => void;
};

export function Sidebar({
  session,
  orgName,
  desktopCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isActive = (href: string) => {
    if (href === "/command") return pathname === "/command";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const toggleSection = (title: string) => {
    setSectionCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const isAdmin = session.role === "admin" || session.role === "commander";
  const dc = desktopCollapsed;

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-50 rounded-[var(--radius-md)] border border-white/10 bg-[var(--color-panel)] p-2 text-slate-400 md:hidden"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav
        className={[
          "fixed left-0 top-0 z-50 flex h-screen flex-col",
          "border-r border-[var(--color-border)] bg-[var(--color-panel)]",
          "transition-all duration-200",
          "w-[var(--sidebar-width)]",
          dc ? "md:w-14" : "md:w-[var(--sidebar-width)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
        ].join(" ")}
      >
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-2 top-2 z-10 rounded p-1 text-slate-500 hover:text-white md:hidden"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className={`border-b border-[var(--color-border)] px-4 py-4 ${dc ? "md:px-2 md:py-3" : ""}`}>
          <Link href="/command" className="block">
            <span
              className={`font-[family:var(--font-display)] text-lg uppercase tracking-[0.2em] text-amber-300 ${
                dc ? "md:text-sm md:tracking-[0.1em] md:text-center md:block" : ""
              }`}
            >
              <span className={dc ? "md:hidden" : ""}>Guardian</span>
              {dc && <span className="hidden md:block">G</span>}
            </span>
            <span
              className={`mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-slate-500 ${
                dc ? "md:hidden" : ""
              }`}
            >
              {orgName}
            </span>
          </Link>
        </div>

        {/* Nav sections */}
        <div className="flex-1 overflow-y-auto py-2">
          {navSections.map((section) => (
            <div key={section.title} className="mb-1">
              <button
                onClick={() => !dc && toggleSection(section.title)}
                className={`flex w-full items-center px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 hover:text-slate-400 ${
                  dc ? "md:justify-center md:px-0 md:pointer-events-none" : "justify-between"
                }`}
              >
                <span className={dc ? "md:hidden" : ""}>{section.title}</span>
                {dc && (
                  <span className="hidden md:block w-8 border-t border-[var(--color-border)]" />
                )}
                <span className={dc ? "md:hidden" : ""}>
                  {sectionCollapsed[section.title] ? (
                    <ChevronRight size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                </span>
              </button>
              {(!sectionCollapsed[section.title] || dc) && (
                <ul>
                  {section.items.map((item) => {
                    if (item.adminOnly && !isAdmin) return null;
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          title={dc ? item.label : undefined}
                          className={[
                            "mx-2 flex items-center rounded-[var(--radius-md)] px-3 py-2 text-[13px] font-medium transition-colors",
                            dc ? "md:justify-center md:mx-1 md:px-0" : "gap-2.5",
                            active
                              ? "bg-cyan-500/10 text-cyan-300"
                              : "text-slate-400 hover:bg-[var(--color-hover)] hover:text-slate-200",
                          ].join(" ")}
                        >
                          <Icon size={16} strokeWidth={1.5} />
                          <span className={dc ? "md:hidden" : ""}>
                            {item.label}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Desktop collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex items-center justify-center border-t border-[var(--color-border)] py-2.5 text-slate-500 hover:text-slate-300 transition-colors"
          title={dc ? "Expand sidebar" : "Collapse sidebar"}
        >
          {dc ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* User footer */}
        <div className={`border-t border-[var(--color-border)] px-4 py-3 ${dc ? "md:px-2" : ""}`}>
          <div className={`flex items-center ${dc ? "md:justify-center" : "gap-2.5"}`}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-hover)] text-[10px] font-bold uppercase text-slate-300">
              {(session.displayName || session.handle).charAt(0)}
            </div>
            <div className={`min-w-0 flex-1 ${dc ? "md:hidden" : ""}`}>
              <p className="truncate text-xs font-medium text-white">
                {session.displayName || session.handle}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {session.role}
              </p>
            </div>
          </div>
          <form action="/api/auth/logout" method="post" className={`mt-2 ${dc ? "md:mt-1" : ""}`}>
            <button
              type="submit"
              title={dc ? "Sign out" : undefined}
              className={`flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-[11px] text-slate-500 transition hover:bg-[var(--color-hover)] hover:text-red-400 ${
                dc ? "md:justify-center md:px-0" : ""
              }`}
            >
              <LogOut size={13} />
              <span className={dc ? "md:hidden" : ""}>Sign out</span>
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
