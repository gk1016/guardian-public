"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  Shield,
  Siren,
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
};

export function Sidebar({ session, orgName }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const isActive = (href: string) => {
    if (href === "/command") return pathname === "/command";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const toggleSection = (title: string) => {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const isAdmin = session.role === "admin" || session.role === "commander";

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-50 rounded-md border border-white/10 bg-[var(--color-panel)] p-2 text-slate-400 md:hidden"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav
        className={`fixed left-0 top-0 z-50 flex h-screen w-[var(--sidebar-width)] flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)] transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-2 top-2 rounded p-1 text-slate-500 hover:text-white md:hidden"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="border-b border-[var(--color-border)] px-4 py-4">
          <Link href="/command" className="block">
            <span className="font-[family:var(--font-display)] text-lg uppercase tracking-[0.2em] text-amber-300">
              Guardian
            </span>
            <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-slate-500">
              {orgName}
            </span>
          </Link>
        </div>

        {/* Nav sections */}
        <div className="flex-1 overflow-y-auto py-2">
          {navSections.map((section) => (
            <div key={section.title} className="mb-1">
              <button
                onClick={() => toggleSection(section.title)}
                className="flex w-full items-center justify-between px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 hover:text-slate-400"
              >
                {section.title}
                {collapsed[section.title] ? (
                  <ChevronRight size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
              </button>
              {!collapsed[section.title] && (
                <ul>
                  {section.items.map((item) => {
                    if (item.adminOnly && !isAdmin) return null;
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`mx-2 flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-[13px] font-medium transition-colors ${
                            active
                              ? "bg-cyan-500/10 text-cyan-300"
                              : "text-slate-400 hover:bg-[var(--color-hover)] hover:text-slate-200"
                          }`}
                        >
                          <Icon size={16} strokeWidth={1.5} />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* User */}
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-hover)] text-[10px] font-bold uppercase text-slate-300">
              {(session.displayName || session.handle).charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">
                {session.displayName || session.handle}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {session.role}
              </p>
            </div>
          </div>
          <form action="/api/auth/logout" method="post" className="mt-2">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-[11px] text-slate-500 transition hover:bg-[var(--color-hover)] hover:text-red-400"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
