"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE_THEME,
  isAppearanceThemeId,
  type AppearanceThemeId,
} from "@/lib/appearance";

type AppearanceContextValue = {
  theme: AppearanceThemeId;
  resolvedTheme: Exclude<AppearanceThemeId, "system">;
  setTheme: (theme: AppearanceThemeId) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

const SYSTEM_FALLBACK_APPEARANCE_THEME: Exclude<AppearanceThemeId, "system"> = "contractor-dark";

const INLINE_THEME_KEYS = [
  "--background",
  "--foreground",
  "--surface",
  "--surface-soft",
  "--surface-raised",
  "--surface-input",
  "--border",
  "--border-strong",
  "--text-muted",
  "--text-soft",
  "--text-strong",
  "--topbar-bg",
  "--panel-bg",
  "--active-bg",
  "--hover-bg",
  "--accent",
  "--accent-contrast",
  "--accent-soft",
  "--blue-bg",
  "--blue-border",
  "--blue-text",
  "--green-bg",
  "--green-border",
  "--green-text",
  "--amber-bg",
  "--amber-border",
  "--amber-text",
  "--red-bg",
  "--red-border",
  "--red-text",
  "--shadow-soft",
  "--focus-ring",
] as const;

const INLINE_THEME_OVERRIDES: Partial<Record<Exclude<AppearanceThemeId, "system">, Partial<Record<(typeof INLINE_THEME_KEYS)[number], string>>>> = {
  "neon-ledger": {
    "--background": "#090b1f",
    "--foreground": "#f5f7ff",
    "--surface": "#121633",
    "--surface-soft": "#191f45",
    "--surface-raised": "#161b3c",
    "--surface-input": "#0d1128",
    "--border": "rgba(0, 229, 255, 0.18)",
    "--border-strong": "rgba(0, 229, 255, 0.34)",
    "--text-muted": "#b8c3ff",
    "--text-soft": "#8c99d8",
    "--text-strong": "#ffffff",
    "--topbar-bg": "rgba(9, 11, 31, 0.9)",
    "--panel-bg": "rgba(18, 22, 51, 0.88)",
    "--active-bg": "rgba(0, 229, 255, 0.14)",
    "--hover-bg": "rgba(255, 255, 255, 0.08)",
    "--accent": "#00e5ff",
    "--accent-contrast": "#07111d",
    "--accent-soft": "rgba(0, 229, 255, 0.14)",
    "--blue-bg": "rgba(0, 229, 255, 0.14)",
    "--blue-border": "rgba(0, 229, 255, 0.34)",
    "--blue-text": "#67e8f9",
    "--green-bg": "rgba(45, 212, 191, 0.14)",
    "--green-border": "rgba(45, 212, 191, 0.34)",
    "--green-text": "#5eead4",
    "--amber-bg": "rgba(251, 191, 36, 0.16)",
    "--amber-border": "rgba(251, 191, 36, 0.36)",
    "--amber-text": "#fde68a",
    "--red-bg": "rgba(244, 63, 94, 0.18)",
    "--red-border": "rgba(251, 113, 133, 0.38)",
    "--red-text": "#fda4af",
    "--shadow-soft": "0 1px 2px rgba(0, 0, 0, 0.32)",
    "--focus-ring": "0 0 0 3px rgba(0, 229, 255, 0.2)",
  },
  rainforest: {
    "--background": "#071a16",
    "--foreground": "#e8fff6",
    "--surface": "#0f2a24",
    "--surface-soft": "#14382f",
    "--surface-raised": "#123128",
    "--surface-input": "#0b211c",
    "--border": "rgba(125, 220, 104, 0.18)",
    "--border-strong": "rgba(125, 220, 104, 0.34)",
    "--text-muted": "#b8dccd",
    "--text-soft": "#91b9a9",
    "--text-strong": "#f5fff9",
    "--topbar-bg": "rgba(7, 26, 22, 0.9)",
    "--panel-bg": "rgba(15, 42, 36, 0.88)",
    "--active-bg": "rgba(125, 220, 104, 0.15)",
    "--hover-bg": "rgba(232, 255, 246, 0.08)",
    "--accent": "#7ddc68",
    "--accent-contrast": "#08160f",
    "--accent-soft": "rgba(125, 220, 104, 0.15)",
    "--blue-bg": "rgba(20, 184, 166, 0.15)",
    "--blue-border": "rgba(45, 212, 191, 0.35)",
    "--blue-text": "#5eead4",
    "--green-bg": "rgba(125, 220, 104, 0.16)",
    "--green-border": "rgba(134, 239, 172, 0.36)",
    "--green-text": "#bbf7d0",
    "--amber-bg": "rgba(245, 158, 11, 0.16)",
    "--amber-border": "rgba(252, 211, 77, 0.34)",
    "--amber-text": "#fde68a",
    "--red-bg": "rgba(239, 68, 68, 0.17)",
    "--red-border": "rgba(248, 113, 113, 0.36)",
    "--red-text": "#fca5a5",
    "--shadow-soft": "0 1px 2px rgba(0, 0, 0, 0.3)",
    "--focus-ring": "0 0 0 3px rgba(125, 220, 104, 0.2)",
  },
  "sunset-plum": {
    "--background": "#24101f",
    "--foreground": "#fff4ea",
    "--surface": "#35182d",
    "--surface-soft": "#43213a",
    "--surface-raised": "#3b1b33",
    "--surface-input": "#2c1426",
    "--border": "rgba(255, 122, 89, 0.22)",
    "--border-strong": "rgba(255, 122, 89, 0.4)",
    "--text-muted": "#f0c8bc",
    "--text-soft": "#d7a79d",
    "--text-strong": "#fffaf6",
    "--topbar-bg": "rgba(36, 16, 31, 0.9)",
    "--panel-bg": "rgba(53, 24, 45, 0.88)",
    "--active-bg": "rgba(255, 122, 89, 0.16)",
    "--hover-bg": "rgba(255, 244, 234, 0.08)",
    "--accent": "#ff7a59",
    "--accent-contrast": "#2a100c",
    "--accent-soft": "rgba(255, 122, 89, 0.16)",
    "--blue-bg": "rgba(168, 85, 247, 0.16)",
    "--blue-border": "rgba(216, 180, 254, 0.36)",
    "--blue-text": "#e9d5ff",
    "--green-bg": "rgba(52, 211, 153, 0.14)",
    "--green-border": "rgba(110, 231, 183, 0.34)",
    "--green-text": "#a7f3d0",
    "--amber-bg": "rgba(251, 146, 60, 0.18)",
    "--amber-border": "rgba(253, 186, 116, 0.4)",
    "--amber-text": "#fed7aa",
    "--red-bg": "rgba(244, 63, 94, 0.18)",
    "--red-border": "rgba(251, 113, 133, 0.38)",
    "--red-text": "#fecdd3",
    "--shadow-soft": "0 1px 2px rgba(0, 0, 0, 0.32)",
    "--focus-ring": "0 0 0 3px rgba(255, 122, 89, 0.22)",
  },
};

function getStoredTheme(): AppearanceThemeId {
  if (typeof window === "undefined") return SYSTEM_FALLBACK_APPEARANCE_THEME;
  try {
    const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return isAppearanceThemeId(stored) ? stored : DEFAULT_APPEARANCE_THEME;
  } catch {
    return DEFAULT_APPEARANCE_THEME;
  }
}

function getSystemTheme(): Exclude<AppearanceThemeId, "system"> {
  if (typeof window === "undefined") return SYSTEM_FALLBACK_APPEARANCE_THEME;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "contractor-dark" : SYSTEM_FALLBACK_APPEARANCE_THEME;
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppearanceThemeId>(DEFAULT_APPEARANCE_THEME);
  const [systemTheme, setSystemTheme] = useState<Exclude<AppearanceThemeId, "system">>(SYSTEM_FALLBACK_APPEARANCE_THEME);

  useEffect(() => {
    setThemeState(getStoredTheme());
    setSystemTheme(getSystemTheme());

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(getSystemTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.ccTheme = resolvedTheme;
    root.dataset.ccThemeChoice = theme;

    INLINE_THEME_KEYS.forEach((key) => root.style.removeProperty(key));
    const overrides = INLINE_THEME_OVERRIDES[resolvedTheme];
    if (overrides) {
      Object.entries(overrides).forEach(([key, value]) => {
        if (value) root.style.setProperty(key, value);
      });
    }
  }, [resolvedTheme, theme]);

  function setTheme(nextTheme: AppearanceThemeId) {
    setThemeState(nextTheme);
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, nextTheme);
    } catch {}
  }

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used inside AppearanceProvider");
  return ctx;
}
