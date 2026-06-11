import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUserFromRequest } from "@/lib/apiAuth";
import { checkAdminWithServiceRole } from "@/lib/adminAccess";
import { buildGenerateDraftPayload, tryStoreDraftPayload } from "@/lib/generateDraftPayload";
import { generateAiDraftFromPayload } from "@/lib/aiDraft";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

function clampNum(value: any, fallback = 0) {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

function isActiveSubscription(status?: string | null) {
  return status === "active" || status === "trialing";
}

function isUuid(value: unknown) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const eventId = String(body?.eventId || body?.event_id || "").trim();
    const requestedForceGenerate = Boolean(body?.forceGenerateMode);
    const generationMode = body?.generationMode === "multistage" ? "multistage" : "standard";
    const pack = body?.pack || {};

    if (!isUuid(eventId)) {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }

    const admin = supabaseAdmin() as any;

    const eventRes = await (admin as any).from("events")
      .select("id,user_id")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (eventRes.error) throw eventRes.error;
    if (!eventRes.data) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const [profileRes, creditRes] = await Promise.all([
      (admin as any).from("profiles")
        .select("id,subscription_status,is_admin_unlimited,credits_remaining")
        .eq("id", user.id)
        .maybeSingle(),
      (admin as any).from("user_credits")
        .select("credits_remaining")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (creditRes.error) throw creditRes.error;

    const profile = profileRes.data || {};
    const isAdminUnlimited = Boolean((profile as any).is_admin_unlimited);
    const userEmail = String((user as any)?.email || "").toLowerCase();
    const isConfiguredAdmin = await checkAdminWithServiceRole(admin, userEmail);

    // Force Generate is an internal/admin-only QA override. Normal/demo users
    // must never bypass the existing-pack guard, otherwise they could regenerate
    // the same event and spend/avoid credits incorrectly.
    const canForceGenerate = isAdminUnlimited || isConfiguredAdmin;
    const forceGenerateMode = requestedForceGenerate && canForceGenerate;

    console.info("[generate-pack] request mode", {
      eventId,
      requestedForceGenerate,
      forceGenerateMode,
      canForceGenerate,
      isAdminUnlimited,
      isConfiguredAdmin,
      userEmail,
      generationMode,
    });

    const creditsRemaining = clampNum(
      (creditRes.data as any)?.credits_remaining ?? (profile as any)?.credits_remaining,
      0
    );

    // Idempotency guard: once a pack has been generated for this event,
    // normal Generate Pack calls must return the saved pack instead of creating
    // a duplicate pack or deducting another credit. Only the internal/admin
    // force-generate mode is allowed to bypass this.
    if (!forceGenerateMode) {
      const existingPackRes = await (admin as any).from("event_packs")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPackRes.error) throw existingPackRes.error;

      const existingPack = existingPackRes.data as { id: string } | null;
      if (existingPack?.id) {
        const latestDraftRes = await (admin as any).from("event_ai_drafts")
          .select("draft_payload,draft_output")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .eq("pack_id", existingPack.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestDraftRes.error) {
          console.warn("Existing pack AI draft lookup failed:", latestDraftRes.error.message);
        }

        const aiDraft = (latestDraftRes.data as any)?.draft_output || null;
        const storedPayload = (latestDraftRes.data as any)?.draft_payload || null;

        // Only treat a saved pack as downloadable where its AI draft and payload
        // are present. Historic demo/test rows can leave event_packs without a
        // usable draft, which incorrectly makes the Review CTA show Download Pack.
        // In that stale state, ignore the orphan pack and continue to fresh generation.
        if (aiDraft && storedPayload) {
          return NextResponse.json({
            success: true,
            existing: true,
            generated: false,
            forceGenerated: false,
            usedExistingPack: true,
            aiPromptSent: false,
            aiDraftGenerated: false,
            payloadGenerated: false,
            creditCharged: false,
            requestedForceGenerate,
            forceGenerateMode,
            forceGenerateAllowed: canForceGenerate,
            usedExistingDraft: true,
            packId: existingPack.id,
            generationMode,
            creditsRemaining,
            draftPayload: storedPayload,
            aiDraft,
          });
        }

        console.warn("Ignoring stale event_pack with no usable AI draft/payload", {
          eventId,
          packId: existingPack.id,
        });
      }
    }

    if (!forceGenerateMode && !isAdminUnlimited && !isActiveSubscription((profile as any).subscription_status)) {
      return NextResponse.json(
        { error: "Your subscription is not active. Open Billing to upgrade before generating a pack." },
        { status: 403 }
      );
    }

    if (!forceGenerateMode && !isAdminUnlimited && creditsRemaining <= 0) {
      return NextResponse.json(
        { error: "No credits remaining. Open Billing to upgrade or buy additional credits before generating a pack." },
        { status: 403 }
      );
    }

    const draftPayload = await buildGenerateDraftPayload({
      admin,
      eventId,
      userId: user.id,
    });

    const openAiRequestStartedAt = new Date().toISOString();
    console.info(`[generate-pack] AI generation started for event ${eventId}`, {
      forceGenerateMode,
      requestedForceGenerate,
      openAiRequestStartedAt,
    });
    const aiDraft = await generateAiDraftFromPayload(draftPayload, { generationMode });
    const openAiRequestCompletedAt = new Date().toISOString();
    console.info(`[generate-pack] AI generation completed for event ${eventId}`, {
      forceGenerateMode,
      requestedForceGenerate,
      openAiRequestCompletedAt,
      generationMode,
      multiStageDiagnostics: (aiDraft as any)?.multi_stage_diagnostics || null,
    });

    const insertPackRes = await ((admin as any).from("event_packs") as any)
      .insert({
        event_id: eventId,
        user_id: user.id,
        delay_days: clampNum(pack.delay_days, 0),
        defined_cost: clampNum(pack.defined_cost, 0),
        prelim_cost: clampNum(pack.prelim_cost, 0),
        fee_amount: clampNum(pack.fee_amount, 0),
        total_value: clampNum(pack.total_value, 0),
        readiness_score: clampNum(pack.readiness_score, 0),
        pack_version: clampNum(pack.pack_version, 1),
      })
      .select("id")
      .single();

    if (insertPackRes.error) throw insertPackRes.error;
    const insertedPack = insertPackRes.data as { id: string } | null;

    await tryStoreDraftPayload({
      admin,
      eventId,
      userId: user.id,
      packId: insertedPack?.id,
      payload: draftPayload,
      aiDraft,
    });

    // A successful generation always spends one CE credit. Admin/unlimited users
    // can bypass the zero-credit gate for QA, but Generate Pack and Force Generate
    // are both real generation actions and should still record credit use.
    const nextCredits = Math.max(0, creditsRemaining - 1);
    const now = new Date().toISOString();

    const [profileUpdateRes, creditUpdateRes] = await Promise.all([
      ((admin as any).from("profiles") as any)
        .update({ credits_remaining: nextCredits, updated_at: now })
        .eq("id", user.id),
      ((admin as any).from("user_credits") as any)
        .upsert(
          { user_id: user.id, credits_remaining: nextCredits, updated_at: now },
          { onConflict: "user_id" }
        ),
    ]);

    if (profileUpdateRes.error) throw profileUpdateRes.error;
    if (creditUpdateRes.error) throw creditUpdateRes.error;

    return NextResponse.json({
      success: true,
      generated: true,
      existing: false,
      forceGenerated: forceGenerateMode,
      usedExistingPack: false,
      aiPromptSent: true,
      aiDraftGenerated: true,
      payloadGenerated: true,
      creditCharged: true,
      requestedForceGenerate,
      forceGenerateMode,
      forceGenerateAllowed: canForceGenerate,
      usedExistingDraft: false,
      openAiRequestStartedAt,
      openAiRequestCompletedAt,
      packId: insertedPack?.id,
      generationMode,
      creditsRemaining: nextCredits,
      draftPayload,
      aiDraft,
    });
  } catch (error: any) {
    console.error("Generate pack error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate pack" },
      { status: 500 }
    );
  }
}


/*
QA_HARMONISATION_PASS

After specialist section generation:
- review change_to_contract_basis
- review commercial_impact
- review contractual_position

Check:
1. contradictions
2. repeated wording
3. clause consistency
4. operational causation depth
5. entitlement not preceding narrative
6. missing factual limitations
7. NEC/JCT terminology correctness

Return improved sections before final JSON assembly.
*/
