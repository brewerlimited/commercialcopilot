import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUserFromRequest } from "@/lib/apiAuth";
import { isSubscriptionActive, MAX_ADDITIONAL_CREDITS, MIN_ADDITIONAL_CREDITS } from "@/lib/billing";

export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const creditPriceId = process.env.STRIPE_PRICE_ADDITIONAL_CREDIT;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

function getStripe() {
  if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(stripeSecretKey);
}

function normaliseQuantity(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MIN_ADDITIONAL_CREDITS;
  return Math.min(MAX_ADDITIONAL_CREDITS, Math.max(MIN_ADDITIONAL_CREDITS, Math.floor(parsed)));
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!creditPriceId) {
      return NextResponse.json({ error: "STRIPE_PRICE_ADDITIONAL_CREDIT is not configured" }, { status: 500 });
    }
    if (!appUrl) {
      return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL is not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const quantity = normaliseQuantity(body?.quantity);

    const admin = supabaseAdmin() as any;
    const { data: rawProfile, error: profileError } = await (admin as any).from("profiles")
      .select("stripe_customer_id, subscription_status, plan_type, is_admin_unlimited")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const profile = rawProfile as {
      stripe_customer_id?: string | null;
      subscription_status?: string | null;
      plan_type?: string | null;
      is_admin_unlimited?: boolean | null;
    } | null;

    const isPro = profile?.is_admin_unlimited || (profile?.plan_type === "pro_monthly" && isSubscriptionActive(profile?.subscription_status));
    if (!isPro) {
      return NextResponse.json({ error: "Additional emergency credits are only available to Pro users." }, { status: 403 });
    }

    const stripe = getStripe();
    let customerId = profile?.stripe_customer_id || null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;

      const { error: updateProfileError } = await (admin as any).from("profiles")
        .upsert({ id: user.id, stripe_customer_id: customerId, updated_at: new Date().toISOString() }, { onConflict: "id" });

      if (updateProfileError) throw updateProfileError;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: creditPriceId, quantity }],
      success_url: `${appUrl}/app/billing?credits=success`,
      cancel_url: `${appUrl}/app/billing?credits=cancelled`,
      metadata: {
        user_id: user.id,
        email: user.email,
        purchase_type: "additional_credits",
        credits: String(quantity),
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          email: user.email,
          purchase_type: "additional_credits",
          credits: String(quantity),
        },
      },
      allow_promotion_codes: false,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create additional credits checkout" }, { status: 500 });
  }
}
