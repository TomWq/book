"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "ai-novel-workbench-theme";
const BACKGROUND_STORAGE_KEY = "ai-novel-workbench-background";
type ThemeMode = "light" | "dark";

function resolveInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function applyWorkspaceBackgroundForTheme(theme: ThemeMode) {
  const raw = window.localStorage.getItem(BACKGROUND_STORAGE_KEY);

  if (!raw) {
    return;
  }

  if (theme === "dark") {
    document.documentElement.dataset.workspaceBg = "off";
    document.documentElement.style.removeProperty("--workspace-bg-image");
    document.documentElement.style.removeProperty("--workspace-bg-opacity");
    document.documentElement.style.removeProperty("--workspace-bg-blur");
    document.documentElement.style.removeProperty("--workspace-bg-saturation");
    document.documentElement.style.removeProperty("--workspace-bg-overlay");
    document.documentElement.style.removeProperty("--workspace-surface");
    document.documentElement.style.removeProperty("--workspace-surface-soft");
    return;
  }

  try {
    const bg = JSON.parse(raw) as { enabled?: boolean; imageDataUrl?: string; clarity?: unknown; strength?: unknown };
    const clamp = (value: unknown) => {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? Math.min(100, Math.max(0, Math.round(numericValue))) : 55;
    };
    const legacyClarity = (value: unknown) => (value === "weak" ? 28 : value === "strong" ? 82 : 55);
    const clarity = typeof bg.clarity !== "undefined" ? clamp(bg.clarity) : legacyClarity(bg.strength);
    const ratio = clamp(clarity) / 100;
    const blur = Math.max(0, Math.round((18 - ratio * 18) * 10) / 10);
    const opacity = Math.round((0.14 + ratio * 0.42) * 100) / 100;
    const saturation = Math.round((0.76 + ratio * 0.34) * 100) / 100;
    const overlayAlpha = Math.round((0.72 - ratio * 0.56) * 100) / 100;
    const surfaceAlpha = Math.round((0.58 - ratio * 0.34) * 100) / 100;
    const softAlpha = Math.round((0.42 - ratio * 0.24) * 100) / 100;

    if (bg.enabled !== false && typeof bg.imageDataUrl === "string" && bg.imageDataUrl) {
      document.documentElement.dataset.workspaceBg = "on";
      document.documentElement.style.setProperty("--workspace-bg-image", `url("${bg.imageDataUrl}")`);
      document.documentElement.style.setProperty("--workspace-bg-opacity", String(opacity));
      document.documentElement.style.setProperty("--workspace-bg-blur", `${blur}px`);
      document.documentElement.style.setProperty("--workspace-bg-saturation", String(saturation));
      document.documentElement.style.setProperty("--workspace-bg-overlay", `rgba(242, 247, 255, ${overlayAlpha})`);
      document.documentElement.style.setProperty("--workspace-surface", `rgba(255, 255, 255, ${surfaceAlpha})`);
      document.documentElement.style.setProperty("--workspace-surface-soft", `rgba(255, 255, 255, ${softAlpha})`);
    }
  } catch {
    // ignore malformed background config
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const initialTheme = resolveInitialTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      className="button theme-toggle"
      type="button"
      aria-label={`切换到${nextTheme === "dark" ? "暗黑" : "浅色"}主题`}
      onClick={() => {
        setTheme(nextTheme);
        window.localStorage.setItem(STORAGE_KEY, nextTheme);
        applyTheme(nextTheme);
        applyWorkspaceBackgroundForTheme(nextTheme);
      }}
    >
      <span className="theme-toggle-mark" aria-hidden="true" />
      {theme === "dark" ? "浅色" : "暗黑"}
    </button>
  );
}
