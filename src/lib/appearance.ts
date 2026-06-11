export const APPEARANCE_STORAGE_KEY = "cc.appearance.theme";

export const APPEARANCE_THEMES = [
  {
    id: "professional-light",
    name: "Original",
    description: "The original Commercial Co-Pilot light workspace.",
    swatches: ["#f6f7fb", "#ffffff", "#111827", "#475569"],
  },
  {
    id: "system",
    name: "System",
    description: "Follows this device's light or dark setting.",
    swatches: ["#f6f7fb", "#ffffff", "#111827", "#2563eb"],
  },
  {
    id: "contractor-dark",
    name: "Contractor Dark",
    description: "Low-glare dark mode for long commercial sessions.",
    swatches: ["#0b1120", "#111827", "#e5e7eb", "#38bdf8"],
  },
  {
    id: "blueprint",
    name: "Blueprint",
    description: "A crisp blue workspace with drawing-office energy.",
    swatches: ["#eef5ff", "#ffffff", "#0f2a44", "#2563eb"],
  },
  {
    id: "qs-slate",
    name: "QS Slate",
    description: "Dense, serious and made for reviewing live value.",
    swatches: ["#eef2f4", "#fbfcfd", "#18212f", "#0f766e"],
  },
  {
    id: "warm-paper",
    name: "Warm Paper",
    description: "Softer contrast for drafting and reading submissions.",
    swatches: ["#f7f1e8", "#fffaf2", "#241f1a", "#b45309"],
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    description: "Sharper borders and stronger text for clarity.",
    swatches: ["#ffffff", "#ffffff", "#000000", "#005fcc"],
  },
  {
    id: "neon-ledger",
    name: "Neon Ledger",
    description: "Dark, electric and sharp for a more futuristic workspace.",
    swatches: ["#090b1f", "#121633", "#f5f7ff", "#00e5ff"],
  },
  {
    id: "rainforest",
    name: "Rainforest",
    description: "Deep green, teal and lime tones with a premium night feel.",
    swatches: ["#071a16", "#0f2a24", "#e8fff6", "#7ddc68"],
  },
  {
    id: "sunset-plum",
    name: "Sunset Plum",
    description: "Warm coral and plum for a richer, more expressive desk.",
    swatches: ["#24101f", "#35182d", "#fff4ea", "#ff7a59"],
  },
] as const;

export type AppearanceThemeId = (typeof APPEARANCE_THEMES)[number]["id"];

export const DEFAULT_APPEARANCE_THEME: AppearanceThemeId = "professional-light";

export function isAppearanceThemeId(value: unknown): value is AppearanceThemeId {
  return APPEARANCE_THEMES.some((theme) => theme.id === value);
}
