"use client";

import { useState, useEffect } from "react";
import { Moon, CloudSun, Sun } from "lucide-react";

const themes = [
  { id: "midnight", label: "Midnight", icon: Moon },
  { id: "overcast", label: "Overcast", icon: CloudSun },
  { id: "daylight", label: "Daylight", icon: Sun },
] as const;

type ThemeId = (typeof themes)[number]["id"];

function getTheme(): ThemeId {
  if (typeof document === "undefined") return "midnight";
  const match = document.cookie.match(/(?:^|; )guardian-theme=(\w+)/);
  return (match?.[1] as ThemeId) ?? "midnight";
}

function setTheme(theme: ThemeId) {
  document.documentElement.setAttribute("data-theme", theme);
  document.cookie = `guardian-theme=${theme};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
}

export function ThemeSwitcher() {
  const [current, setCurrent] = useState<ThemeId>("midnight");

  useEffect(() => {
    setCurrent(getTheme());
  }, []);

  const cycle = () => {
    const idx = themes.findIndex((t) => t.id === current);
    const next = themes[(idx + 1) % themes.length];
    setTheme(next.id);
    setCurrent(next.id);
  };

  const CurrentIcon = themes.find((t) => t.id === current)?.icon ?? Moon;

  return (
    <button
      onClick={cycle}
      className="flex items-center gap-2 rounded-[var(--radius-md)] px-1.5 py-1 text-[10px] text-[var(--color-text-faint)] transition hover:bg-[var(--color-overlay-subtle)] hover:text-[var(--color-text-strong)]"
      title={`Theme: ${current}`}
    >
      <CurrentIcon size={11} />
      <span className="capitalize">{current}</span>
    </button>
  );
}
