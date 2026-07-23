import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUserFromRequest } from "@/lib/apiAuth";
import { generateAiEwnFromInput } from "@/lib/ewnDraft";
import { getProtectedGenerationAccess } from "@/lib/accessControl";

export const dynamic = "force-dynamic";

const BASELINE_EWN_CREDITS = 20;

function isUuid(value: unknown) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function clampNum(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function nullableClean(value: unknown) {
  const v = clean(value);
  return v || null;
}


export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const title = clean(body.title);
    const whatHappened = clean(body.whatHappened ?? body.what_happened);
    const ewnId = clean(body.id);

    if (!title) return NextResponse.json({ error: "EWN title is required." }, { status: 400 });
    if (!whatHappened) return NextResponse.json({ error: "What happened is required." }, { status: 400 });
    if (ewnId && !isUuid(ewnId)) return NextResponse.json({ error: "Invalid EWN id." }, { status: 400 });

    const admin = supabaseAdmin() as any;
    if (ewnId) {
      const existingEwn = await (admin as any).from("ewns")
        .select("id")
        .eq("id", ewnId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existingEwn.error) throw existingEwn.error;
      if (!existingEwn.data) return NextResponse.json({ error: "EWN not found." }, { status: 404 });
    }

    const profileRes = await (admin as any).from("profiles")
      .select("id,subscription_status,account_status,is_admin_unlimited,ewn_credits_remaining,ewn_credits_limit")
      .eq("id", user.id)
      .maybeSingle();

    if (profileRes.error) throw profileRes.error;

    const profile = (profileRes.data || {}) as Record<string, unknown>;
    const isAdminUnlimited = Boolean(profile.is_admin_unlimited);
    const currentCredits = clampNum(profile.ewn_credits_remaining, BASELINE_EWN_CREDITS);
    const generationAccess = getProtectedGenerationAccess(
      { ...profile, credits_remaining: currentCredits },
      currentCredits
    );

    if (!generationAccess.allowed) {
      return NextResponse.json(
        {
          error:
            generationAccess.code === "no_credits"
              ? "Monthly EWN generation allowance reached. EWN records can still be updated manually."
              : generationAccess.message,
          code: generationAccess.code,
          accountStatus: generationAccess.accountStatus,
        },
        { status: 403 }
      );
    }

    const contractType = clean(body.contractType ?? body.contract_type);
    const projectId = clean(body.projectId ?? body.project_id);
    if (projectId && !isUuid(projectId)) return NextResponse.json({ error: "Invalid project id." }, { status: 400 });
    const projectName = clean(body.projectName ?? body.project_name);
    const mainContractor = clean(body.mainContractor ?? body.main_contractor);

    let linkedProjectId = projectId || null;
    if (projectName) {
      const projectPayload = {
        ...(linkedProjectId ? { id: linkedProjectId } : {}),
        user_id: user.id,
        project_name: projectName,
        main_contractor: mainContractor,
        contract_type: contractType || null,
        status: "live",
        updated_at: new Date().toISOString(),
      };
      const projectRes = await (admin as any).from("projects")
        .upsert(projectPayload as never, { onConflict: linkedProjectId ? "id" : "user_id,project_name,main_contractor" })
        .select("id")
        .single();
      if (projectRes.error) throw projectRes.error;
      linkedProjectId = (projectRes.data as { id: string } | null)?.id ?? null;
    }

    const output = await generateAiEwnFromInput({
      title,
      projectName,
      mainContractor,
      contractType,
      whatHappened,
      when: clean(body.when ?? body.event_date),
      where: clean(body.where ?? body.location),
      impact: clean(body.impact),
      requiredAction: clean(body.requiredAction ?? body.required_action),
      evidence: clean(body.evidence ?? body.evidence_summary),
    });

    const now = new Date().toISOString();
    const row = {
      id: ewnId || crypto.randomUUID(),
      user_id: user.id,
      title,
      project_id: linkedProjectId,
      project_name: nullableClean(projectName),
      main_contractor: nullableClean(mainContractor),
      contract_type: nullableClean(contractType),
      what_happened: whatHappened,
      event_date: nullableClean(body.when ?? body.event_date),
      location: nullableClean(body.where ?? body.location),
      impact: nullableClean(body.impact),
      required_action: nullableClean(body.requiredAction ?? body.required_action),
      evidence_summary: nullableClean(body.evidence ?? body.evidence_summary),
      generated_output: output,
      status: "open",
      created_at: body.created_at || now,
    };

    const upsertRes = await (admin as any).from("ewns").upsert([row] as never, { onConflict: "id" }).select("id").single();
    if (upsertRes.error) throw upsertRes.error;

    let nextCredits = currentCredits;
    if (!isAdminUnlimited) {
      nextCredits = Math.max(0, currentCredits - 1);
      const updateRes = await (admin as any).from("profiles")
        .update({
          ewn_credits_remaining: nextCredits,
          ewn_credits_limit: clampNum(profile.ewn_credits_limit, BASELINE_EWN_CREDITS),
          updated_at: now,
        } as never)
        .eq("id", user.id);

      if (updateRes.error) throw updateRes.error;
    }

    return NextResponse.json({
      success: true,
      id: (upsertRes.data as { id: string } | null)?.id ?? row.id,
      project_id: linkedProjectId,
      generated_output: output,
    });
  } catch (error: unknown) {
    console.error("Generate EWN error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to generate EWN" }, { status: 500 });
  }
}
