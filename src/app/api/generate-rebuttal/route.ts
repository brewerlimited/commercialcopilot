import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUserFromRequest } from "@/lib/apiAuth";
import { buildGenerateDraftPayload } from "@/lib/generateDraftPayload";
import { generateAiRebuttalFromPayload } from "@/lib/aiDraft";
import { recordAdminErrorEvent, recordAiGenerationRun } from "@/lib/serverAnalytics";
import { getProtectedGenerationAccess } from "@/lib/accessControl";

export const dynamic = "force-dynamic";

function clampNum(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(req: NextRequest) {
  const metricsStartedAt = Date.now();
  let metricsAdmin: any = null;
  let metricsUserId: string | null = null;
  let metricsEventId: string | null = null;
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    metricsUserId = user.id;

    const body = await req.json().catch(() => ({}));
    const eventId = String(body?.eventId || body?.event_id || "").trim();
    metricsEventId = eventId || null;
    const contractorResponse = String(body?.contractorResponse || body?.contractor_response || "").trim();

    if (!eventId) {
      return NextResponse.json({ error: "Missing event id" }, { status: 400 });
    }
    if (contractorResponse.length < 20) {
      return NextResponse.json(
        { error: "Paste the contractor rejection or assessment response before generating a rebuttal." },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin() as any;
    metricsAdmin = admin;
    const eventRes = await (admin as any).from("events")
      .select("id,user_id,status")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (eventRes.error) throw eventRes.error;
    if (!eventRes.data) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const [profileRes, creditRes] = await Promise.all([
      (admin as any).from("profiles")
        .select("id,subscription_status,account_status,is_admin_unlimited,credits_remaining")
        .eq("id", user.id)
        .maybeSingle(),
      (admin as any).from("user_credits")
        .select("credits_remaining")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (creditRes.error) throw creditRes.error;

    const profile = (profileRes.data || {}) as Record<string, unknown>;
    const creditsRemaining = clampNum((creditRes.data as any)?.credits_remaining ?? (profile as any)?.credits_remaining, 0);
    const generationAccess = getProtectedGenerationAccess(profile, creditsRemaining);
    if (!generationAccess.allowed) {
      return NextResponse.json(
        {
          error: generationAccess.message,
          code: generationAccess.code,
          accountStatus: generationAccess.accountStatus,
        },
        { status: 403 }
      );
    }

    const packRes = await (admin as any).from("event_packs")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (packRes.error) throw packRes.error;
    const pack = packRes.data as { id: string } | null;

    if (!pack?.id) {
      return NextResponse.json(
        { error: "Want the proper rebuttal? Make sure the pack has been generated first." },
        { status: 403 }
      );
    }

    const latestDraftRes = await (admin as any).from("event_ai_drafts")
      .select("draft_output,created_at")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .eq("pack_id", pack.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestDraftRes.error) {
      console.warn("Latest generated pack AI draft unavailable for rebuttal:", latestDraftRes.error.message);
    }

    const generatedPackOutput = (latestDraftRes.data as any)?.draft_output || null;
    const payload = await buildGenerateDraftPayload({ admin, eventId, userId: user.id });
    const rebuttalPayload = {
      ...payload,
      generated_pack_output: generatedPackOutput?.client_output || generatedPackOutput || null,
      internal_commercial_intelligence: generatedPackOutput?.internal_commercial_intelligence || {
        commercial_pushback: generatedPackOutput?.commercial_pushback || [],
        evidence_gaps: generatedPackOutput?.evidence_gaps || [],
        strength_summary: generatedPackOutput?.strength_summary || "",
        internal_risk_notes: generatedPackOutput?.internal_risk_notes || [],
      },
    };
    const rebuttal = await generateAiRebuttalFromPayload(rebuttalPayload, contractorResponse);

    const saveRes = await ((admin as any).from("event_rebuttals") as any)
      .upsert(
        {
          event_id: eventId,
          user_id: user.id,
          contractor_response: contractorResponse,
          rebuttal_subject: rebuttal.rebuttal_subject,
          rebuttal_body: rebuttal.rebuttal_body,
          key_points: rebuttal.key_points,
          risk_note: rebuttal.risk_note,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_id" }
      )
      .select("id,updated_at")
      .single();

    if (saveRes.error) throw saveRes.error;
    const savedRebuttal = saveRes.data as { id: string; updated_at: string | null } | null;

    await recordAiGenerationRun(admin, {
      userId: user.id,
      eventId,
      packId: pack.id,
      generationType: "rebuttal",
      generationMode: "multistage",
      status: "success",
      startedAt: metricsStartedAt,
      metadata: {
        responseCharacters: contractorResponse.length,
      },
    });

    return NextResponse.json({
      success: true,
      rebuttal: {
        ...rebuttal,
        id: savedRebuttal?.id,
        updated_at: savedRebuttal?.updated_at,
      },
    });
  } catch (error: any) {
    console.error("Generate rebuttal error:", error);
    if (metricsAdmin) {
      await recordAiGenerationRun(metricsAdmin, {
        userId: metricsUserId,
        eventId: metricsEventId,
        generationType: "rebuttal",
        generationMode: "multistage",
        status: "failed",
        startedAt: metricsStartedAt,
        errorType: error?.name || "generate_rebuttal_error",
        message: error?.message,
      });
      await recordAdminErrorEvent(metricsAdmin, {
        userId: metricsUserId,
        route: "/api/generate-rebuttal",
        eventName: "rebuttal_generation_failed",
        errorType: error?.name || "generate_rebuttal_error",
        message: error?.message,
      });
    }
    return NextResponse.json(
      { error: error?.message || "Failed to generate rebuttal" },
      { status: 500 }
    );
  }
}
