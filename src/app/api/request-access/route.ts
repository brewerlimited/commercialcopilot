import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/apiAuth";
import { isAccountApproved, isSubscriptionActive, normaliseAccountAccessStatus } from "@/lib/billing";
import { supabaseAdmin } from "@/lib/supabase/admin";

function cleanNote(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 1500) : "";
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const note = cleanNote((body as any)?.note);
    const now = new Date().toISOString();
    const admin = supabaseAdmin();

    const { data: profile, error: profileError } = await (admin as any).from("profiles")
      .select("id,account_status,subscription_status,is_admin_unlimited")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const accountStatus = normaliseAccountAccessStatus(profile?.account_status);
    const alreadyActive =
      Boolean(profile?.is_admin_unlimited) ||
      isAccountApproved(accountStatus) ||
      isSubscriptionActive(profile?.subscription_status);

    if (alreadyActive) {
      return NextResponse.json({ success: true, alreadyActive: true });
    }

    const payload = {
      id: user.id,
      account_status: accountStatus,
      early_access_request_email: user.email || null,
      early_access_requested_at: now,
      early_access_request_note: note || null,
      early_access_request_status: "requested",
      updated_at: now,
    };

    const { error: upsertError } = await (admin as any).from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true, requested: true });
  } catch (error) {
    console.error("[request-access] failed", error);
    return NextResponse.json({ error: "Failed to request access" }, { status: 500 });
  }
}
