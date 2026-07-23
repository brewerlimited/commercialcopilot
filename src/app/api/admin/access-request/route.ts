import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/apiAuth";
import { checkAdminWithServiceRole, normalizeEmail } from "@/lib/adminAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function isAdminEmail(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const admin = supabaseAdmin() as any;
  return checkAdminWithServiceRole(admin, normalized);
}

async function findUserIdByEmail(admin: any, email: string) {
  const target = normalizeEmail(email);
  if (!target) return null;

  const perPage = 200;
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const match = users.find((user: any) => normalizeEmail(user.email) === target);
    if (match?.id) return match.id as string;
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

function isMissingProfileColumn(error: any) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    message.includes("approved_at") ||
    message.includes("approved_by") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  );
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await getAuthUserFromRequest(req);
    if (!adminUser?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminEmail(adminUser.email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const requestedUserId = typeof body?.userId === "string" ? body.userId.trim() : "";
    const requestedEmail = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
    const action = body?.action === "decline" ? "decline" : body?.action === "approve" ? "approve" : "";

    if (!requestedUserId && !requestedEmail) return NextResponse.json({ error: "Missing userId or email" }, { status: 400 });
    if (!action) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    const admin = supabaseAdmin() as any;
    const userId = requestedUserId || await findUserIdByEmail(admin, requestedEmail);
    if (!userId) return NextResponse.json({ error: "No signed-up user found for that email" }, { status: 404 });

    const now = new Date().toISOString();
    const update =
      action === "approve"
        ? {
            id: userId,
            account_status: "trial_active",
            early_access_request_status: "approved",
            early_access_request_email: requestedEmail || undefined,
            approved_at: now,
            approved_by: adminUser.id,
            updated_at: now,
          }
        : {
            id: userId,
            account_status: "pending_activation",
            early_access_request_status: "declined",
            early_access_request_email: requestedEmail || undefined,
            updated_at: now,
          };

    let updatePayload = update;
    let result = await (admin as any).from("profiles")
      .upsert(update, { onConflict: "id" })
      .select("id,early_access_request_email,early_access_request_status,account_status")
      .maybeSingle();

    if (result.error && isMissingProfileColumn(result.error)) {
      const { approved_at, approved_by, ...legacyUpdate } = update as any;
      updatePayload = legacyUpdate;
      result = await (admin as any).from("profiles")
        .upsert(updatePayload, { onConflict: "id" })
        .select("id,early_access_request_email,early_access_request_status,account_status")
        .maybeSingle();
    }

    const { data, error } = result;
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    return NextResponse.json({ success: true, request: data });
  } catch (error: any) {
    console.error("[admin/access-request] failed", error);
    return NextResponse.json({ error: error?.message || "Failed to update access request" }, { status: 500 });
  }
}
