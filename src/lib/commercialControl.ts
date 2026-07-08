import { getContractFamily } from "@/lib/contracts";

export type CommercialStatus =
  | "draft"
  | "review"
  | "ready"
  | "submitted"
  | "rejected"
  | "accepted"
  | "paid"
  | "void"
  | "complete";

export type PaymentStatus =
  | "not_applied"
  | "submitted_for_payment"
  | "assessed"
  | "part_paid"
  | "paid"
  | "disputed_short_paid";

export const COMMERCIAL_STATUS_OPTIONS: { value: CommercialStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "review", label: "In Review" },
  { value: "ready", label: "Ready to Submit" },
  { value: "submitted", label: "Submitted" },
  { value: "rejected", label: "Rejected" },
  { value: "accepted", label: "Accepted" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

export const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: "not_applied", label: "Not applied" },
  { value: "submitted_for_payment", label: "Submitted for payment" },
  { value: "assessed", label: "Assessed" },
  { value: "part_paid", label: "Part paid" },
  { value: "paid", label: "Paid" },
  { value: "disputed_short_paid", label: "Disputed / short paid" },
];

export function normaliseCommercialStatus(status?: string | null): CommercialStatus {
  const s = String(status || "draft").toLowerCase().trim();
  if (s === "in_review") return "review";
  if (s === "ready_to_submit") return "ready";
  if (s === "complete") return "complete";
  if (["draft", "review", "ready", "submitted", "rejected", "accepted", "paid", "void"].includes(s)) {
    return s as CommercialStatus;
  }
  return "draft";
}

export function getCommercialStatusLabel(status?: string | null) {
  const normalised = normaliseCommercialStatus(status);
  if (normalised === "complete") return "Complete";
  return COMMERCIAL_STATUS_OPTIONS.find((o) => o.value === normalised)?.label || "Draft";
}

export function getAllowedCommercialStatusOptions(status?: string | null) {
  const current = normaliseCommercialStatus(status);
  const allowed: Record<CommercialStatus, CommercialStatus[]> = {
    draft: ["draft", "review"],
    review: ["draft", "review", "ready"],
    ready: ["review", "ready", "submitted"],
    submitted: ["submitted", "accepted", "rejected", "paid"],
    rejected: ["rejected", "submitted", "accepted"],
    accepted: ["accepted", "rejected", "paid"],
    paid: ["paid"],
    void: ["void", "draft", "review"],
    complete: ["paid"],
  };
  const values = new Set<CommercialStatus>(allowed[current] || [current]);
  values.add(current === "complete" ? "paid" : current);
  return COMMERCIAL_STATUS_OPTIONS.filter((option) => values.has(option.value));
}

export function normalisePaymentStatus(status?: string | null): PaymentStatus {
  const s = String(status || "not_applied").toLowerCase().trim();
  if (s === "applied" || s === "overdue") return "submitted_for_payment";
  if (["not_applied", "submitted_for_payment", "assessed", "part_paid", "paid", "disputed_short_paid"].includes(s)) {
    return s as PaymentStatus;
  }
  return "not_applied";
}

export function getPaymentStatusLabel(status?: string | null) {
  const normalised = normalisePaymentStatus(status);
  return PAYMENT_STATUS_OPTIONS.find((o) => o.value === normalised)?.label || "Not applied";
}

export function getDefaultNoticePeriodDays(contractType?: string | null) {
  const raw = String(contractType || "").toLowerCase();
  const family = getContractFamily(contractType);

  if (raw.includes("nec")) return 56;
  if (family === "JCT") return null;
  return null;
}

export function addDays(dateLike: string | Date, days: number) {
  const d = typeof dateLike === "string" ? new Date(`${dateLike}T00:00:00`) : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export function toDateInputValue(dateLike?: string | null) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateShort(dateLike?: string | Date | null) {
  if (!dateLike) return "—";
  const d = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function daysBetweenToday(target?: string | Date | null) {
  if (!target) return null;
  const d = typeof target === "string" ? new Date(target) : target;
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDay = new Date(d);
  targetDay.setHours(0, 0, 0, 0);
  return Math.ceil((targetDay.getTime() - today.getTime()) / 86400000);
}

export type TimeRisk = {
  state: "unknown" | "safe" | "due_soon" | "overdue";
  label: string;
  detail: string;
  deadline: Date | null;
  daysRemaining: number | null;
};

export function calculateTimeRisk(input: {
  eventDate?: string | null;
  noticePeriodDays?: number | null;
  notificationDeadline?: string | null;
}): TimeRisk {
  const noticeDays = Number(input.noticePeriodDays);
  // Recalculate from the live event date whenever possible.
  // The stored notification_deadline is only a fallback for older rows; otherwise
  // changing the event date can keep showing/saving a stale deadline.
  const deadline = input.eventDate && Number.isFinite(noticeDays) && noticeDays > 0
    ? addDays(input.eventDate, noticeDays)
    : input.notificationDeadline
    ? new Date(input.notificationDeadline)
    : null;

  if (!input.eventDate) {
    return {
      state: "unknown",
      label: "Event date needed",
      detail: "Add the event date to calculate time-bar risk.",
      deadline: null,
      daysRemaining: null,
    };
  }

  if (!deadline || Number.isNaN(deadline.getTime())) {
    return {
      state: "unknown",
      label: "Notice rule needed",
      detail: "Confirm the contract notice period before relying on this risk flag.",
      deadline: null,
      daysRemaining: null,
    };
  }

  const days = daysBetweenToday(deadline);
  if (days === null) {
    return {
      state: "unknown",
      label: "Time risk unknown",
      detail: "Unable to read the calculated deadline.",
      deadline: null,
      daysRemaining: null,
    };
  }

  if (days < 0) {
    return {
      state: "overdue",
      label: "Time bar risk",
      detail: `Deadline passed ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago.`,
      deadline,
      daysRemaining: days,
    };
  }

  if (days <= 7) {
    return {
      state: "due_soon",
      label: `${days} day${days === 1 ? "" : "s"} remaining`,
      detail: "Notification deadline is close. Treat this as an action item.",
      deadline,
      daysRemaining: days,
    };
  }

  return {
    state: "safe",
    label: `${days} days remaining`,
    detail: "No immediate notice deadline risk based on the current event date.",
    deadline,
    daysRemaining: days,
  };
}
