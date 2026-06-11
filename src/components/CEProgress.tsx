"use client";

import { useRouter } from "next/navigation";
import { buildEventStepPath } from "@/lib/routeParams";

const steps = [
  { id: "details", label: "Change", path: "" },
  { id: "evidence", label: "Evidence", path: "/evidence" },
  { id: "resources", label: "Resources", path: "/resources" },
  { id: "prelims", label: "Prelims", path: "/prelims" },
  { id: "review", label: "Review", path: "/review" },
];

const c = {
  active: "var(--accent)",
  complete: "var(--text-muted)",
  inactive: "var(--border-strong)",
};

export default function CEProgress({
  eventId,
  currentStep,
}: {
  eventId: string;
  currentStep:
    | "details"
    | "evidence"
    | "resources"
    | "prelims"
    | "review";
}) {
  const router = useRouter();

  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        marginBottom: 14,
        alignItems: "center",
      }}
    >
      {steps.map((step, i) => {

        let color = c.inactive;
        let height = 6;

        if (i < currentIndex) {
          color = c.complete;
        }

        if (i === currentIndex) {
          color = c.active;
          height = 8;
        }

        return (
          <button
            key={step.id}
            onClick={() =>
              router.push(buildEventStepPath(eventId, step.id as any))
            }
            style={{
              flex: 1,
              height,
              borderRadius: 999,
              border: "none",
              background: color,
              cursor: "pointer",
              transition: "0.2s",
            }}
            title={step.label}
          />
        );
      })}
    </div>
  );
}
