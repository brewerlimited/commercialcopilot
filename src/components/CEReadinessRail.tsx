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
  currentStep,
  showFirstCeChecklist = false,
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
  currentStep?: "details" | "basis" | "evidence" | "resources" | "prelims" | "review";
  showFirstCeChecklist?: boolean;
  nextTitle?: string;
  nextCopy: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  backHref?: string;
}) {
  const safeReadiness = Math.max(0, Math.min(100, Math.round(readiness || 0)));
  const checklist = [
    { key: "details", label: "Set up CE details" },
    { key: "basis", label: "Complete Basis of Change" },
    { key: "evidence", label: "Upload evidence" },
    { key: "resources", label: "Add resources" },
    { key: "prelims", label: "Add prelims + fee" },
    { key: "review", label: "Review readiness" },
    { key: "issue", label: "Generate submission pack" },
    { key: "payment", label: "Track payment" },
  ];
  const stepOrder = ["details", "basis", "evidence", "resources", "prelims", "review", "issue", "payment"];
  const activeIndex = Math.max(0, stepOrder.indexOf(currentStep || "details"));

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

      {showFirstCeChecklist ? (
        <AppSideCard title="First CE / VO checklist" tone="purple" icon="✓">
          <div style={{ display: "grid", gap: 8 }}>
            {checklist.map((item, itemIndex) => {
              const complete = itemIndex < activeIndex;
              const active = itemIndex === activeIndex;
              const future = itemIndex > activeIndex;
              return (
                <div
                  key={item.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    border: `1px solid ${active ? "#ddd4ff" : railText.border}`,
                    background: active ? "var(--purple-soft, #f3efff)" : complete ? "#ecfdf5" : "var(--surface-input)",
                    borderRadius: 13,
                    padding: "8px 9px",
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      display: "grid",
                      placeItems: "center",
                      flex: "0 0 auto",
                      background: complete ? "#18a36f" : active ? "#6d4aff" : "transparent",
                      border: future ? `1px solid ${railText.border}` : "1px solid transparent",
                      color: complete || active ? "#fff" : railText.sub,
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    {complete ? "✓" : itemIndex + 1}
                  </span>
                  <span style={{ color: active ? "#6d4aff" : railText.text, fontSize: 12.5, fontWeight: active ? 850 : 720, lineHeight: 1.25 }}>{item.label}</span>
                </div>
              );
            })}
          </div>
        </AppSideCard>
      ) : null}

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
