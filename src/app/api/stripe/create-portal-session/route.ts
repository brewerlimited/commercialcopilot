import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUserFromRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

function getStripe() {
  if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(stripeSecretKey);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!appUrl) return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL is not configured" }, { status: 500 });

    const admin = supabaseAdmin();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer found for this account" }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/app/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create billing portal session" }, { status: 500 });
  }
}
