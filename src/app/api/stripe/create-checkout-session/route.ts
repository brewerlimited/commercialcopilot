import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUserFromRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const priceId = process.env.STRIPE_PRICE_PRO_MONTHLY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

function getStripe() {
  if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(stripeSecretKey);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!priceId) {
      return NextResponse.json({ error: "STRIPE_PRICE_PRO_MONTHLY is not configured" }, { status: 500 });
    }
    if (!appUrl) {
      return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL is not configured" }, { status: 500 });
    }

    const admin = supabaseAdmin() as any;
    const { data: rawProfile, error: profileError } = await (admin as any).from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const profile = rawProfile as { stripe_customer_id?: string | null } | null;
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
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/app/billing?checkout=success`,
      cancel_url: `${appUrl}/app/billing?checkout=cancelled`,
      metadata: {
        user_id: user.id,
        email: user.email,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          email: user.email,
        },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create checkout session" }, { status: 500 });
  }
}
