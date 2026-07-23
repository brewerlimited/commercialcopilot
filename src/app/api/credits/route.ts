import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUserFromRequest } from "@/lib/apiAuth";
import { getProtectedGenerationAccess } from "@/lib/accessControl";

export const dynamic = "force-dynamic";

function asNumber(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin() as any;

    const [creditRes, profileRes] = await Promise.all([
      (admin as any).from("user_credits")
        .select("credits_remaining")
        .eq("user_id", user.id)
        .maybeSingle(),
      (admin as any).from("profiles")
        .select("is_admin_unlimited, credits_remaining, subscription_status, account_status")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    if (creditRes.error && !/relation .*user_credits.* does not exist/i.test(creditRes.error.message || "")) {
      throw creditRes.error;
    }
    if (profileRes.error && !/relation .*profiles.* does not exist/i.test(profileRes.error.message || "")) {
      throw profileRes.error;
    }

    const profile = (profileRes.data || {}) as any;
    const creditRow = (creditRes.data || {}) as any;

    const creditsRemaining = asNumber(
      creditRow.credits_remaining ?? profile.credits_remaining,
      0
    );
    const generationAccess = getProtectedGenerationAccess(profile, creditsRemaining);

    return NextResponse.json({
      success: true,
      userId: user.id,
      creditsRemaining,
      isAdminUnlimited: Boolean(profile.is_admin_unlimited),
      subscriptionStatus: profile.subscription_status || null,
      accountStatus: generationAccess.accountStatus,
      generationAllowed: generationAccess.allowed,
      generationGateCode: generationAccess.code,
      generationGateMessage: generationAccess.allowed ? null : generationAccess.message,
      source: creditRow.credits_remaining !== undefined ? "user_credits" : "profiles",
    });
  } catch (error: any) {
    console.error("Credit lookup error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load credits" },
      { status: 500 }
    );
  }
}
