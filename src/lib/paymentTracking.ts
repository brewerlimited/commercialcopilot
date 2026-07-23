import { normaliseCommercialStatus, normalisePaymentStatus, type PaymentStatus } from "@/lib/commercialControl";

type Amount = number | null | undefined;

export type PaymentTrackingShape = {
  status?: string | null;
  payment_status?: string | null;
  submitted_amount?: Amount;
  assessed_amount?: Amount;
  paid_amount?: Amount;
  disallowed_amount?: Amount;
  balance_outstanding?: Amount;
};

export type PaymentTrackingPatch = Partial<PaymentTrackingShape>;

function numberOrNull(value: Amount) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hasOwn(row: object, key: keyof PaymentTrackingShape) {
  return Object.prototype.hasOwnProperty.call(row, key);
}

function valueFromPatchOrCurrent(
  current: PaymentTrackingShape,
  patch: PaymentTrackingPatch,
  key: keyof Pick<PaymentTrackingShape, "submitted_amount" | "assessed_amount" | "disallowed_amount">,
  fallback = 0
) {
  const patched = hasOwn(patch, key) ? numberOrNull(patch[key]) : null;
  if (patched !== null) return patched;
  const existing = numberOrNull(current[key]);
  return existing ?? fallback;
}

function paidFromPatchOrCurrent(current: PaymentTrackingShape, patch: PaymentTrackingPatch, assessed: number) {
  if (hasOwn(patch, "paid_amount")) return numberOrNull(patch.paid_amount) ?? 0;
  const existing = numberOrNull(current.paid_amount);
  if (existing !== null) return existing;
  return normalisePaymentStatus(patch.payment_status ?? current.payment_status) === "paid" ? assessed : 0;
}

function statusCanBePaid(status?: string | null) {
  const normalised = normaliseCommercialStatus(status);
  return normalised === "submitted" || normalised === "accepted" || normalised === "paid" || normalised === "complete";
}

function derivePaymentStatus(input: {
  submitted: number;
  assessed: number;
  paid: number;
  disallowed: number;
  hasAssessedAmount: boolean;
  currentPaymentStatus?: string | null;
}): PaymentStatus {
  const { submitted, assessed, paid, disallowed, hasAssessedAmount, currentPaymentStatus } = input;

  if (assessed > 0 && paid >= assessed) return "paid";
  if (paid > 0 && paid < assessed) return "disputed_short_paid";
  if (disallowed > 0) return "disputed_short_paid";
  if (hasAssessedAmount && submitted > 0 && assessed > 0 && assessed < submitted) return "disputed_short_paid";
  if (hasAssessedAmount && assessed > 0) return "assessed";
  if (submitted > 0) return "submitted_for_payment";
  return normalisePaymentStatus(currentPaymentStatus);
}

export function applyDerivedPaymentTracking<T extends PaymentTrackingShape>(
  current: T,
  patch: Partial<T>,
  fallbackValue?: number | null
): Partial<T> {
  const amountChanged =
    hasOwn(patch, "submitted_amount") ||
    hasOwn(patch, "assessed_amount") ||
    hasOwn(patch, "paid_amount") ||
    hasOwn(patch, "disallowed_amount");

  if (!amountChanged) return patch;

  const submitted = valueFromPatchOrCurrent(current, patch, "submitted_amount", numberOrNull(fallbackValue) ?? 0);
  const hasAssessedAmount = numberOrNull(patch.assessed_amount) !== null || numberOrNull(current.assessed_amount) !== null;
  const assessed = valueFromPatchOrCurrent(current, patch, "assessed_amount", submitted);
  const paid = paidFromPatchOrCurrent(current, patch, assessed);
  const disallowed = valueFromPatchOrCurrent(current, patch, "disallowed_amount", Math.max(0, submitted - assessed));
  const balance = Math.max(0, assessed - paid);
  const nextPaymentStatus = derivePaymentStatus({
    submitted,
    assessed,
    paid,
    disallowed,
    hasAssessedAmount,
    currentPaymentStatus: patch.payment_status ?? current.payment_status,
  });
  const currentStatus = normaliseCommercialStatus(patch.status ?? current.status);
  const next: PaymentTrackingPatch = {
    ...patch,
    balance_outstanding: nextPaymentStatus === "paid" ? 0 : balance,
    payment_status: nextPaymentStatus,
  };

  if (nextPaymentStatus === "paid") {
    next.status = "paid";
    if (!hasOwn(next, "paid_amount")) next.paid_amount = assessed;
  } else if (currentStatus === "paid") {
    next.status = "accepted";
  } else if (!statusCanBePaid(currentStatus) && nextPaymentStatus !== "not_applied") {
    next.status = "submitted";
  }

  return next as Partial<T>;
}
