"use client";

import { useRouter } from "next/navigation";

const steps = [
  { id: "details", label: "Change", path: "" },
  { id: "evidence", label: "Evidence", path: "/evidence" },
  { id: "resources", label: "Resources", path: "/resources" },
  { id: "prelims", label: "Prelims", path: "/prelims" },
  { id: "review", label: "Review", path: "/review" },
];

const c = {
  active: "#111827",
  complete: "#6b7280",
  inactive: "#d1d5db",
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
        gap: 10,
        marginBottom: 14,
        alignItems: "center",
      }}
    >
      {steps.map((step, i) => {

        let color = c.inactive;
        let height = 3;

        if (i < currentIndex) {
          color = c.complete;
        }

        if (i === currentIndex) {
          color = c.active;
          height = 4;
        }

        return (
          <button
            key={step.id}
            onClick={() =>
              router.push(`/app/event/${eventId}${step.path}`)
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