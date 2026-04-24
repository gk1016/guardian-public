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
  ScrollText,
  BookOpen,
  Monitor,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { GuardianSession } from "@/lib/auth-core";
import { useEngine } from "@/lib/engine-context";
import { ThemeSwitcher } from "@/components/theme-switcher";

const navSections = [
  {
    title: "Command",
    items: [
      { href: "/command", label: "Watch Floor", icon: LayoutDashboard },
      { href: "/tactical", label: "Tactical", icon: Monitor },
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
      { href: "/roster", label: "Roster", icon: Users },
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
  session: GuardianSession;
  orgName: string;
  desktopCollapsed: boolean;
  onToggleCollapse: () => void;
};
