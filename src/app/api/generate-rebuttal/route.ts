import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUserFromRequest } from "@/lib/apiAuth";
import { buildGenerateDraftPayload } from "@/lib/generateDraftPayload";
import { generateAiRebuttalFromPayload } from "@/lib/aiDraft";

export const dynamic = "force-dynamic";

function isUuid(value: unknown) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
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

    const admin = supabaseAdmin();
    const eventRes = await admin
      .from("events")
      .select("id,user_id,status")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (eventRes.error) throw eventRes.error;
    if (!eventRes.data) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const packRes = await admin
      .from("event_packs")
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

    const latestDraftRes = await admin
      .from("event_ai_drafts")
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

    const saveRes = await (admin.from("event_rebuttals") as any)
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
    return NextResponse.json(
      { error: error?.message || "Failed to generate rebuttal" },
      { status: 500 }
    );
  }
}
