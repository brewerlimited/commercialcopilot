import { getContractFamily } from "@/lib/contracts";

export function getEventReferencePrefix(contractType?: string | null) {
  return getContractFamily(contractType) === "JCT" ? "VO" : "CE";
}

export function formatEventReference(prefix: string, number: number) {
  const safePrefix = String(prefix || "CE").trim().toUpperCase();
  const safeNumber = Math.max(1, Math.floor(Number(number) || 1));
  return `${safePrefix} ${String(safeNumber).padStart(3, "0")}`;
}

export function buildEventReference(contractType: string | null | undefined, number: number) {
  return formatEventReference(getEventReferencePrefix(contractType), number);
}

export function displayEventReference(event?: { event_reference?: string | null; event_number?: number | null; contract_type?: string | null } | null) {
  const existing = String(event?.event_reference ?? "").trim();
  if (existing) return existing;
  if (event?.event_number) return buildEventReference(event.contract_type, event.event_number);
  return "Reference pending";
}
