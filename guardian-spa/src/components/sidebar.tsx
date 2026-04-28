import { Link, useLocation } from "react-router";
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
  UserCog,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ScrollText,
  BookOpen,
  Monitor,
  Network,
  Sparkles,
  Anchor,
  Radio,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useSession, useAuth } from "@/lib/auth";
import { useEngine } from "@/lib/engine-context";
import { ThemeSwitcher } from "@/components/theme-switcher";

const navSections = [
  {
    title: "Command",
    items: [
      { href: "/command", label: "Watch Floor", icon: LayoutDashboard },
      { href: "/tactical", label: "Tactical", icon: Monitor },
      { href: "/missions", label: "Missions", icon: Target },
      { href: "/comms", label: "Comms", icon: Radio },
      { href: "/federation", label: "Federation", icon: Network },
      { href: "/ai", label: "AI", icon: Sparkles },
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
    title: "Reference",
    items: [
      { href: "/manual", label: "Manual", icon: BookOpen },
    ],
  },
  {
    title: "Review",
    items: [
      { href: "/sitrep", label: "SITREP", icon: ScrollText },
      { href: "/incidents", label: "Incidents", icon: AlertTriangle },
      { href: "/notifications", label: "Alerts", icon: Bell },
    ],
  },
  {
    title: "Org",
    items: [
      { href: "/fleet", label: "Fleet", icon: Anchor },
      { href: "/roster", label: "Roster", icon: Users },
      { href: "/settings", label: "Settings", icon: UserCog },
      { href: "/admin", label: "Admin", icon: Settings, adminOnly: true },
    ],
  },
];

function formatTickAge(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

type SidebarProps = {
  desktopCollapsed: boolean;
  onToggleCollapse: () => void;
};

export function Sidebar({
  desktopCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const session = useSession();
  const { logout } = useAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>({});
  const { connectionState, lastTick, opsSummary } = useEngine();
  const [tickAge, setTickAge] = useState<string>("");

  const orgName = session.orgName ?? session.orgTag ?? "Guardian";

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

  useEffect(() => {
    if (!lastTick) return;
    function update() {
      if (lastTick) setTickAge(formatTickAge(lastTick));
    }
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [lastTick]);

  const toggleSection = (title: string) => {
    setSectionCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const statusColor =
    connectionState === "connected"
      ? "bg-emerald-400"
      : connectionState === "connecting"
        ? "bg-amber-400"
        : "bg-red-500";
  const statusLabel =
    connectionState === "connected"
      ? "LIVE"
      : connectionState === "connecting"
        ? "SYNC"
        : "OFFLINE";

  const navContent = (
    <>
      {navSections.map((section) => {
        const isCollapsed = sectionCollapsed[section.title] ?? false;
        return (
          <div key={section.title}>
            <button
              onClick={() => toggleSection(section.title)}
              className="flex w-full items-center justify-between px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-strong)]"
            >
              <span>{section.title}</span>
              <ChevronDown
                size={11}
                className={`transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
              />
            </button>
            {!isCollapsed ? (
              <ul className="space-y-px">
                {section.items
                  .filter(
                    (item) =>
                      !("adminOnly" in item && item.adminOnly) ||
                      ["commander", "director", "admin"].includes(session.role),
                  )
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <li key={item.href}>
                        <Link
                          to={item.href}
                          className={`flex items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm transition ${
                            isActive
                              ? "bg-[var(--color-overlay-medium)] font-medium text-[var(--color-text-strong)]"
                              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-overlay-subtle)] hover:text-[var(--color-text-strong)]"
                          }`}
                        >
                          <Icon size={14} className={isActive ? "text-[var(--color-accent)]" : ""} />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </>
  );

  const bottomBlock = (
    <div className="border-t border-[var(--color-border)] px-2.5 py-2">
      <div className="flex items-center gap-2">
        <div className="relative">
          <div className={`h-2 w-2 rounded-full ${statusColor}`} />
          {connectionState === "connected" ? (
            <div className={`absolute inset-0 h-2 w-2 animate-ping rounded-full ${statusColor} opacity-40`} />
          ) : null}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
          {statusLabel}
        </span>
        {tickAge ? (
          <span className="text-[10px] text-[var(--color-text-faint)]">{tickAge}</span>
        ) : null}
      </div>
      {opsSummary ? (
        <p className="mt-0.5 text-[10px] text-[var(--color-text-faint)]">
          {opsSummary.active_missions} msn / {opsSummary.qrf_ready} qrf / {opsSummary.active_intel} intel
        </p>
      ) : null}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-overlay-medium)] text-[9px] font-semibold text-[var(--color-accent)]">
          {session.handle?.charAt(0)?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-[var(--color-text-strong)]">{session.handle ?? "Operator"}</p>
          <p className="text-[10px] text-[var(--color-text-tertiary)]">{session.role}</p>
        </div>
        <button
          onClick={onToggleCollapse}
          className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-overlay-subtle)] hover:text-[var(--color-text-strong)]"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft size={13} />
        </button>
      </div>
      <ThemeSwitcher />
      <button
        onClick={() => logout()}
        className="mt-1 flex w-full items-center gap-2 rounded-[var(--radius-md)] px-1.5 py-1 text-[10px] text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-overlay-subtle)] hover:text-[var(--color-text-strong)]"
      >
        <LogOut size={11} />
        <span>Sign out</span>
      </button>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-panel)] p-2 text-[var(--color-text-secondary)] md:hidden"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-[var(--color-backdrop)]"
            onClick={() => setMobileOpen(false)}
          />
          <nav className="relative flex h-full w-56 flex-col bg-[var(--color-surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2.5">
              <div>
                <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.12em] text-[var(--color-accent)]">
                  Guardian
                </p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  {orgName}
                </p>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-[var(--color-text-secondary)]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-1.5">{navContent}</div>
            {bottomBlock}
          </nav>
        </div>
      ) : null}

      <nav
        className={`hidden md:sticky md:top-0 md:flex md:h-screen md:flex-col md:flex-shrink-0 md:border-r md:border-[var(--color-border)] md:bg-[var(--color-surface)] transition-[width] duration-200 ${
          desktopCollapsed ? "md:w-12" : "md:w-48"
        }`}
      >
        {!desktopCollapsed ? (
          <>
            <div className="flex-shrink-0 border-b border-[var(--color-border)] px-3 py-2.5">
              <Link to="/command" className="block">
                <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.12em] text-[var(--color-accent)]">
                  Guardian
                </p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  {orgName}
                </p>
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto py-1.5">{navContent}</div>
            <div className="flex-shrink-0">{bottomBlock}</div>
          </>
        ) : (
          <>
            <div className="flex flex-shrink-0 flex-col items-center gap-1 py-2.5">
              <Link to="/command" className="block">
                <p className="font-[family:var(--font-display)] text-sm text-[var(--color-accent)]">G</p>
              </Link>
            </div>
            <div className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto py-1.5">
              {navSections.flatMap((section) =>
                section.items
                  .filter(
                    (item) =>
                      !("adminOnly" in item && item.adminOnly) ||
                      ["commander", "director", "admin"].includes(session.role),
                  )
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] transition ${
                          isActive
                            ? "bg-[var(--color-overlay-medium)] text-[var(--color-accent)]"
                            : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-overlay-subtle)] hover:text-[var(--color-text-strong)]"
                        }`}
                        title={item.label}
                      >
                        <Icon size={15} />
                      </Link>
                    );
                  }),
              )}
            </div>
            <div className="flex flex-shrink-0 flex-col items-center gap-2 border-t border-[var(--color-border)] py-2.5">
              <div className="relative">
                <div className={`h-2 w-2 rounded-full ${statusColor}`} />
                {connectionState === "connected" ? (
                  <div className={`absolute inset-0 h-2 w-2 animate-ping rounded-full ${statusColor} opacity-40`} />
                ) : null}
              </div>
              <button
                onClick={onToggleCollapse}
                className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-overlay-subtle)] hover:text-[var(--color-text-strong)]"
                aria-label="Expand sidebar"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </>
        )}
      </nav>
    </>
  );
}
