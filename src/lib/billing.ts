export type BillingPlan = "starter" | "pro_monthly" | "custom";
export type BillingStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired";

export type AccountAccessStatus = "pending_activation" | "trial_active" | "active" | "suspended";

export type BillingSnapshot = {
  plan: BillingPlan;
  status: BillingStatus;
  creditsRemaining: number;
  isAdminUnlimited: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  accountStatus: AccountAccessStatus;
};

export const DEFAULT_MONTHLY_CREDITS = Number(process.env.NEXT_PUBLIC_DEFAULT_MONTHLY_CREDITS || 15);
export const STRIPE_PRICE_PRO_MONTHLY = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || "";
export const ADDITIONAL_CREDIT_UNIT_PRICE_GBP = 59;
export const MIN_ADDITIONAL_CREDITS = 1;
export const MAX_ADDITIONAL_CREDITS = 20;

export function humanPlanLabel(plan?: string | null) {
  switch (plan) {
    case "pro_monthly":
      return "Pro";
    case "custom":
      return "Custom";
    default:
      return "Starter";
  }
}

export function humanStatusLabel(status?: string | null) {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trialing";
    case "past_due":
      return "Past due";
    case "canceled":
      return "Cancelled";
    case "unpaid":
      return "Unpaid";
    case "incomplete":
      return "Incomplete";
    case "incomplete_expired":
      return "Expired";
    default:
      return "Inactive";
  }
}

export function isSubscriptionActive(status?: string | null) {
  return status === "active" || status === "trialing";
}

export function normaliseAccountAccessStatus(status?: string | null): AccountAccessStatus {
  switch (status) {
    case "trial_active":
    case "active":
    case "suspended":
      return status;
    default:
      return "pending_activation";
  }
}

export function humanAccountAccessLabel(status?: string | null) {
  switch (normaliseAccountAccessStatus(status)) {
    case "trial_active":
      return "Trial active";
    case "active":
      return "Active";
    case "suspended":
      return "Suspended";
    default:
      return "Pending activation";
  }
}

export function isAccountApproved(status?: string | null) {
  const accountStatus = normaliseAccountAccessStatus(status);
  return accountStatus === "trial_active" || accountStatus === "active";
}

export function canGenerateWithBilling(snapshot: BillingSnapshot | null | undefined) {
  if (!snapshot) return false;
  if (snapshot.isAdminUnlimited) return true;
  if (snapshot.accountStatus === "suspended") return false;
  if (isAccountApproved(snapshot.accountStatus) && snapshot.creditsRemaining > 0) return true;
  if (!isSubscriptionActive(snapshot.status)) return false;
  return snapshot.creditsRemaining > 0;
}

export function getBillingSnapshot(profile: any, creditRow?: any): BillingSnapshot {
  return {
    plan: (profile?.plan_type as BillingPlan) || "starter",
    status: (profile?.subscription_status as BillingStatus) || "inactive",
    creditsRemaining:
      typeof creditRow?.credits_remaining === "number"
        ? creditRow.credits_remaining
        : typeof profile?.credits_remaining === "number"
        ? profile.credits_remaining
        : 0,
    isAdminUnlimited: Boolean(profile?.is_admin_unlimited),
    stripeCustomerId: profile?.stripe_customer_id || null,
    stripeSubscriptionId: profile?.stripe_subscription_id || null,
    currentPeriodEnd: profile?.current_period_end || null,
    accountStatus: normaliseAccountAccessStatus(profile?.account_status),
  };
}
