"use client";

import Link from "next/link";
import { AppSideCard, RingProgress } from "@/components/appUi";

type ReadinessRow = {
  label: string;
  value: string | number;
};

const railText = {
  sub: "var(--text-muted)",
  text: "var(--foreground)",
  border: "var(--border)",
  input: "var(--surface-input)",
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
};

export default function CEReadinessRail({
  readiness,
  readinessLabel,
  rows,
  coach,
  nextTitle = "What's next?",
  nextCopy,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  backHref,
}: {
  readiness: number;
  readinessLabel: string;
  rows: ReadinessRow[];
  coach: string;
  nextTitle?: string;
  nextCopy: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  backHref?: string;
}) {
  const safeReadiness = Math.max(0, Math.min(100, Math.round(readiness || 0)));

  return (
    <>
      <AppSideCard title="Commercial Readiness" tone="purple" icon="◎">
        <div style={{ display: "grid", placeItems: "center", marginBottom: 16 }}>
          <RingProgress value={safeReadiness} tone={safeReadiness >= 75 ? "green" : safeReadiness >= 40 ? "orange" : "purple"} label={readinessLabel} size={132} />
        </div>
        <div style={{ display: "grid", gap: 11 }}>
          {rows.map((row) => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: railText.sub, fontSize: 13, lineHeight: 1.35 }}>{row.label}</span>
              <strong style={{ color: railText.sub, fontSize: 13, lineHeight: 1.35, fontWeight: 800, textAlign: "right" }}>{row.value}</strong>
            </div>
          ))}
        </div>
      </AppSideCard>

      <AppSideCard title="Commercial Coach" tone="purple" icon="i">
        <div style={{ color: railText.sub, fontSize: 13, lineHeight: 1.6 }}>{coach}</div>
      </AppSideCard>

      <AppSideCard title={nextTitle} tone="blue" icon="→">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ color: railText.sub, fontSize: 13, lineHeight: 1.6 }}>{nextCopy}</div>
          {primaryHref && primaryLabel ? (
            <Link href={primaryHref} style={{ textDecoration: "none" }}>
              <span style={{ minHeight: 44, borderRadius: 12, display: "grid", placeItems: "center", background: railText.black, border: `1px solid ${railText.black}`, color: railText.blackContrast, fontSize: 13, fontWeight: 800 }}>
                {primaryLabel}
              </span>
            </Link>
          ) : null}
          {secondaryHref && secondaryLabel ? (
            <Link href={secondaryHref} style={{ textDecoration: "none" }}>
              <span style={{ minHeight: 42, borderRadius: 12, display: "grid", placeItems: "center", background: railText.input, border: `1px solid ${railText.border}`, color: railText.text, fontSize: 13, fontWeight: 750 }}>
                {secondaryLabel}
              </span>
            </Link>
          ) : null}
          {backHref ? (
            <Link href={backHref} style={{ color: "#6d4aff", textDecoration: "none", fontSize: 12.5, fontWeight: 750, textAlign: "center" }}>
              Back to dashboard
            </Link>
          ) : null}
        </div>
      </AppSideCard>
    </>
  );
}
