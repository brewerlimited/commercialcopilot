"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export const appUi = {
  bg: "var(--background)",
  surface: "var(--surface)",
  raised: "var(--surface-raised)",
  soft: "var(--surface-soft)",
  input: "var(--surface-input)",
  border: "var(--border)",
  text: "var(--foreground)",
  muted: "var(--text-muted)",
  navy: "var(--accent)",
  navyText: "var(--accent-contrast)",
  purple: "var(--purple, #6d4aff)",
  purpleSoft: "var(--purple-soft, #f3efff)",
  blue: "#2563eb",
  blueSoft: "#eff6ff",
  green: "#18a36f",
  greenSoft: "#ecfdf5",
  orange: "#f97316",
  orangeSoft: "#fff7ed",
  red: "#ef4444",
  redSoft: "#fff1f2",
  pink: "#c0567e",
  pinkSoft: "#fdf2f8",
  shadow: "0 18px 50px rgba(15, 23, 42, 0.06)",
  shadowSoft: "0 10px 30px rgba(15, 23, 42, 0.045)",
};

type Tone = "neutral" | "purple" | "blue" | "green" | "orange" | "red" | "pink";

export function toneColours(tone: Tone = "neutral") {
  switch (tone) {
    case "purple":
      return { bg: appUi.purpleSoft, text: appUi.purple, border: "#ddd4ff" };
    case "blue":
      return { bg: appUi.blueSoft, text: appUi.blue, border: "#bfdbfe" };
    case "green":
      return { bg: appUi.greenSoft, text: appUi.green, border: "#bbf7d0" };
    case "orange":
      return { bg: appUi.orangeSoft, text: appUi.orange, border: "#fed7aa" };
    case "red":
      return { bg: appUi.redSoft, text: appUi.red, border: "#fecdd3" };
    case "pink":
      return { bg: appUi.pinkSoft, text: appUi.pink, border: "#fbcfe8" };
    default:
      return { bg: appUi.soft, text: appUi.muted, border: appUi.border };
  }
}

export function AppCard({
  children,
  style,
  tone = "neutral",
}: {
  children: ReactNode;
  style?: CSSProperties;
  tone?: Tone;
}) {
  const tc = toneColours(tone);
  return (
    <section
      style={{
        background: appUi.surface,
        border: `1px solid ${tone === "neutral" ? appUi.border : tc.border}`,
        borderRadius: 18,
        boxShadow: appUi.shadowSoft,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function AppPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="app-page-header">
      <div style={{ minWidth: 0 }}>
        {eyebrow ? <div className="app-page-eyebrow">{eyebrow}</div> : null}
        <h1 className="app-page-title">{title}</h1>
        {description ? <p className="app-page-description">{description}</p> : null}
      </div>
      {actions ? <div className="app-page-actions">{actions}</div> : null}
    </header>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  chart,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
  chart?: ReactNode;
}) {
  const tc = toneColours(tone);
  return (
    <AppCard style={{ padding: 18, minHeight: 120, display: "grid", gridTemplateColumns: chart ? "1fr 86px" : "1fr", gap: 12, alignItems: "end" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          {icon ? <IconBubble tone={tone} size={34}>{icon}</IconBubble> : null}
          <div className="app-metric-label">{label}</div>
        </div>
        <div className="app-metric-value" style={{ color: tone === "neutral" ? appUi.text : tc.text }}>{value}</div>
        {hint ? <div className="app-metric-hint">{hint}</div> : null}
      </div>
      {chart ? <div style={{ alignSelf: "end", minWidth: 0 }}>{chart}</div> : null}
    </AppCard>
  );
}

export function AppSideCard({
  title,
  icon,
  tone = "purple",
  children,
}: {
  title: string;
  icon?: ReactNode;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <AppCard style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        {icon ? <IconBubble tone={tone} size={36}>{icon}</IconBubble> : null}
        <h2 style={{ margin: 0, fontSize: 15, lineHeight: 1.25, fontWeight: 750, color: appUi.text }}>{title}</h2>
      </div>
      <div style={{ color: appUi.muted, fontSize: 13, lineHeight: 1.65 }}>{children}</div>
    </AppCard>
  );
}

export function IconBubble({
  children,
  tone = "purple",
  size = 42,
}: {
  children: ReactNode;
  tone?: Tone;
  size?: number;
}) {
  const tc = toneColours(tone);
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        display: "grid",
        placeItems: "center",
        background: tc.bg,
        color: tc.text,
        border: `1px solid ${tc.border}`,
        flex: `0 0 ${size}px`,
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const tc = toneColours(tone);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "6px 10px",
        minWidth: 82,
        borderRadius: 999,
        border: `1px solid ${tc.border}`,
        background: tc.bg,
        color: tc.text,
        fontSize: 12,
        lineHeight: 1,
        fontWeight: 750,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  href,
  children,
  style,
}: {
  href?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const button = (
    <button
      style={{
        height: 44,
        border: `1px solid ${appUi.navy}`,
        borderRadius: 13,
        background: appUi.navy,
        color: appUi.navyText,
        padding: "0 16px",
        fontSize: 13,
        fontWeight: 750,
        cursor: "pointer",
        boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)",
        ...style,
      }}
    >
      {children}
    </button>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{button}</Link> : button;
}

export function QuietButton({
  href,
  children,
  style,
}: {
  href?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const button = (
    <button
      style={{
        height: 44,
        border: `1px solid ${appUi.border}`,
        borderRadius: 13,
        background: appUi.surface,
        color: appUi.text,
        padding: "0 15px",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{button}</Link> : button;
}

export function MiniSparkline({
  values,
  tone = "green",
  height = 52,
}: {
  values: number[];
  tone?: Tone;
  height?: number;
}) {
  const tc = toneColours(tone);
  const width = 180;
  const points = values.length ? values : [0, 0];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((v, i) => {
      const x = (i / Math.max(1, points.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 8) - 4;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const fill = `${d} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={fill} fill={tc.bg} opacity="0.9" />
      <path d={d} fill="none" stroke={tc.text} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RingProgress({
  value,
  tone = "green",
  label,
  size = 94,
}: {
  value: number;
  tone?: Tone;
  label?: string;
  size?: number;
}) {
  const tc = toneColours(tone);
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 38;
  const circumference = Math.PI * 2 * radius;
  const offset = circumference * (1 - clamped / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, display: "grid", placeItems: "center" }}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} stroke="#eef0f5" strokeWidth="9" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={tc.text}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          textAlign: "center",
          width: Math.max(54, size - 38),
          display: "grid",
          justifyItems: "center",
        }}
      >
        <div style={{ color: appUi.text, fontSize: 21, fontWeight: 850, lineHeight: 1 }}>{clamped}%</div>
        {label ? (
          <div
            style={{
              color: appUi.muted,
              fontSize: size < 86 ? 8 : 9,
              fontWeight: 750,
              lineHeight: 1.05,
              marginTop: 3,
              maxWidth: Math.max(46, size - 44),
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SmallIcon({ name }: { name: "file" | "money" | "clock" | "check" | "alert" | "rocket" | "building" | "box" | "calendar" | "radar" | "plus" }) {
  const common = {
    width: 19,
    height: 19,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "money":
      return <svg {...common}><path d="M12 3v18" /><path d="M17 7.5c0-1.7-2-3-5-3s-5 1.3-5 3 2 2.7 5 3 5 1.3 5 3-2 3-5 3-5-1.3-5-3" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "check":
      return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
    case "alert":
      return <svg {...common}><path d="M10.3 3.2 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.2a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
    case "rocket":
      return <svg {...common}><path d="M4.5 16.5c-1 1-1.5 2.5-1.5 4.5 2 0 3.5-.5 4.5-1.5" /><path d="M9 15 5 19" /><path d="M15 9l-6 6" /><path d="M14 4h6v6c0 5-4 9-9 9H7v-4c0-5 4-11 7-11z" /></svg>;
    case "building":
      return <svg {...common}><path d="M3 21h18" /><path d="M5 21V5a2 2 0 0 1 2-2h7l5 5v13" /><path d="M14 3v5h5" /></svg>;
    case "box":
      return <svg {...common}><path d="M21 8 12 3 3 8l9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></svg>;
    case "calendar":
      return <svg {...common}><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /></svg>;
    case "radar":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 12 18 7" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
    case "file":
    default:
      return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>;
  }
}
