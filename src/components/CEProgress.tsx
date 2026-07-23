"use client";

import { useRouter } from "next/navigation";
import { buildEventStepPath } from "@/lib/routeParams";

const steps = [
  { id: "setup", label: "New CE", path: "/app/new" },
  { id: "details", label: "Basis of Change", path: "" },
  { id: "evidence", label: "Evidence", path: "/evidence" },
  { id: "resources", label: "Resources", path: "/resources" },
  { id: "prelims", label: "Prelims + Fee", path: "/prelims" },
  { id: "review", label: "Review", path: "/review" },
];

const c = {
  active: "#6d4aff",
  activeSoft: "#f3efff",
  complete: "#18a36f",
  completeSoft: "#ecfdf5",
  inactive: "var(--border)",
  text: "var(--foreground)",
  muted: "var(--text-muted)",
  card: "var(--surface)",
};

export default function CEProgress({
  eventId,
  currentStep,
}: {
  eventId: string;
  currentStep:
    | "setup"
    | "details"
    | "evidence"
    | "resources"
    | "prelims"
    | "review";
}) {
  const router = useRouter();

  const currentIndex = steps.findIndex(s => s.id === currentStep);
  const hasCreatedEvent = eventId && eventId !== "new";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
        gap: 8,
        marginBottom: 18,
        alignItems: "center",
        background: c.card,
        border: `1px solid ${c.inactive}`,
        borderRadius: 16,
        padding: 10,
        width: "100%",
      }}
    >
      {steps.map((step, i) => {
        const active = i === currentIndex;
        const complete = i < currentIndex;
        const disabled = !hasCreatedEvent && step.id !== "setup";

        return (
          <button
            key={step.id}
            type="button"
            disabled={disabled}
            onClick={() =>
              disabled
                ? undefined
                : step.id === "setup"
                  ? router.push("/app/new")
                  : router.push(buildEventStepPath(eventId, step.id as any))
            }
            style={{
              width: "100%",
              minWidth: 0,
              minHeight: 42,
              borderRadius: 13,
              border: `1px solid ${active ? "#ddd4ff" : complete ? "#bbf7d0" : c.inactive}`,
              background: active ? c.activeSoft : complete ? c.completeSoft : "#ffffff",
              color: active ? c.active : complete ? c.complete : c.muted,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.58 : 1,
              transition: "background 160ms ease, border-color 160ms ease, color 160ms ease",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              padding: "0 12px",
              fontSize: 12.5,
              fontWeight: 750,
              whiteSpace: "nowrap",
            }}
            title={step.label}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                background: active ? c.active : complete ? c.complete : "#ffffff",
                color: active || complete ? "#ffffff" : c.text,
                border: `1px solid ${active ? c.active : complete ? c.complete : c.inactive}`,
                fontSize: 12,
                fontWeight: 850,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <span>{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}
