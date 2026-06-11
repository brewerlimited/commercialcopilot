export function normalizeRouteParam(value: string | string[] | undefined | null): string {
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

export function buildEventStepPath(eventId: string, step?: "details" | "evidence" | "resources" | "prelims" | "review") {
  const safeId = encodeURIComponent(String(eventId || "").trim());
  if (!safeId) return "/app";
  if (!step || step === "details") return `/app/event/${safeId}`;
  return `/app/event/${safeId}/${step}`;
}
