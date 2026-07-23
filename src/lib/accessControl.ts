import {
  isAccountApproved,
  isSubscriptionActive,
  normaliseAccountAccessStatus,
  type AccountAccessStatus,
} from "./billing";

export type ProtectedGenerationAccess = {
  allowed: boolean;
  code: "allowed" | "account_pending" | "account_suspended" | "no_credits";
  accountStatus: AccountAccessStatus;
  message: string;
};

export function getProtectedGenerationAccess(
  profile: Record<string, unknown> | null | undefined,
  creditsRemaining: number
): ProtectedGenerationAccess {
  const accountStatus = normaliseAccountAccessStatus(profile?.account_status as string | null | undefined);
  const isAdminUnlimited = Boolean(profile?.is_admin_unlimited);

  if (isAdminUnlimited) {
    return {
      allowed: true,
      code: "allowed",
      accountStatus,
      message: "Admin access allowed.",
    };
  }

  if (accountStatus === "suspended") {
    return {
      allowed: false,
      code: "account_suspended",
      accountStatus,
      message: "This account is suspended. Contact Commercial Co-Pilot support to restore generation access.",
    };
  }

  const hasCredits = Number.isFinite(creditsRemaining) && creditsRemaining > 0;
  const hasApprovedAccount = isAccountApproved(accountStatus);
  const hasActiveSubscription = isSubscriptionActive(profile?.subscription_status as string | null | undefined);

  if ((hasApprovedAccount || hasActiveSubscription) && hasCredits) {
    return {
      allowed: true,
      code: "allowed",
      accountStatus,
      message: "Generation access allowed.",
    };
  }

  if (!hasApprovedAccount && !hasActiveSubscription) {
    return {
      allowed: false,
      code: "account_pending",
      accountStatus,
      message:
        "Your workspace is ready, but generation is not active yet. Book a demo or ask us to activate trial access before generating packs, rebuttals or EWN drafts.",
    };
  }

  return {
    allowed: false,
    code: "no_credits",
    accountStatus,
    message: "No credits remaining. Open Billing or contact Commercial Co-Pilot to add generation credits.",
  };
}
