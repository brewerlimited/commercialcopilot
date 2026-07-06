import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_MONTHLY_CREDITS } from "@/lib/billing";

export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function getStripe() {
  if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(stripeSecretKey);
}

type BillingLogPayload = {
  stripe_event_id?: string | null;
  stripe_invoice_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  user_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  type?: string | null;
  raw_payload?: any;
};

async function alreadyProcessedEvent(admin: any, eventId: string) {
  const { data, error } = await (admin as any).from("billing_transactions")
    .select("id")
    .eq("stripe_event_id", eventId)
    .maybeSingle();

  if (error) {
    console.warn("Stripe webhook duplicate check skipped:", error.message);
    return false;
  }

  return Boolean(data?.id);
}

async function logBillingTransaction(admin: any, payload: BillingLogPayload) {
  const record = {
    stripe_event_id: payload.stripe_event_id || null,
    stripe_invoice_id: payload.stripe_invoice_id || null,
    stripe_customer_id: payload.stripe_customer_id || null,
    stripe_subscription_id: payload.stripe_subscription_id || null,
    user_id: payload.user_id || null,
    amount: payload.amount || 0,
    currency: payload.currency || "gbp",
    status: payload.status || "processed",
    type: payload.type || "subscription",
    raw_payload: payload.raw_payload || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await (admin as any).from("billing_transactions").upsert(record, { onConflict: "stripe_event_id" });

  if (error) {
    console.warn("Stripe billing log failed:", error.message);
  }
}

async function syncCredits(admin: any, userId: string, creditsRemaining: number) {
  const now = new Date().toISOString();

  const { error: profileError } = await (admin as any).from("profiles")
    .update({ credits_remaining: creditsRemaining, updated_at: now })
    .eq("id", userId);

  if (profileError) throw profileError;

  const { error: creditError } = await (admin as any).from("user_credits")
    .upsert({ user_id: userId, credits_remaining: creditsRemaining, updated_at: now }, { onConflict: "user_id" });

  if (creditError) throw creditError;
}

async function addCredits(admin: any, userId: string, creditsToAdd: number) {
  const safeCredits = Math.max(0, Math.floor(Number(creditsToAdd) || 0));
  if (safeCredits <= 0) return;

  const { data: rawCreditRow, error: creditLookupError } = await (admin as any).from("user_credits")
    .select("credits_remaining")
    .eq("user_id", userId)
    .maybeSingle();

  if (creditLookupError) throw creditLookupError;

  const { data: rawProfile, error: profileLookupError } = await (admin as any).from("profiles")
    .select("credits_remaining")
    .eq("id", userId)
    .maybeSingle();

  if (profileLookupError) throw profileLookupError;

  const creditRow = rawCreditRow as { credits_remaining?: number | null } | null;
  const profile = rawProfile as { credits_remaining?: number | null } | null;

  const currentCredits =
    typeof creditRow?.credits_remaining === "number"
      ? creditRow.credits_remaining
      : typeof profile?.credits_remaining === "number"
      ? profile.credits_remaining
      : 0;

  await syncCredits(admin, userId, currentCredits + safeCredits);
}

async function findProfileForInvoice(admin: any, stripeCustomerId: string | null, stripeSubscriptionId: string | null) {
  if (stripeCustomerId) {
    const { data, error } = await (admin as any).from("profiles")
      .select("id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data;
  }

  if (stripeSubscriptionId) {
    const { data, error } = await (admin as any).from("profiles")
      .select("id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data;
  }

  return null;
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice) {
  const anyInvoice = invoice as any;
  const subscription = anyInvoice.subscription;
  if (typeof subscription === "string") return subscription;
  if (subscription?.id) return subscription.id;

  const parentSubscription = anyInvoice.parent?.subscription_details?.subscription;
  if (typeof parentSubscription === "string") return parentSubscription;
  if (parentSubscription?.id) return parentSubscription.id;

  return null;
}

function getInvoicePeriodEnd(invoice: Stripe.Invoice) {
  const linePeriodEnd = invoice.lines?.data?.[0]?.period?.end;
  return linePeriodEnd ? new Date(linePeriodEnd * 1000).toISOString() : null;
}

function getCheckoutCredits(session: Stripe.Checkout.Session) {
  const raw = session.metadata?.credits;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

export async function POST(req: NextRequest) {
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error: any) {
    console.error("Stripe webhook signature failed:", error?.message || error);
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  const admin = supabaseAdmin() as any;

  try {
    if (await alreadyProcessedEvent(admin, event.id)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = (event.data as any)?.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id || session.client_reference_id || null;
        const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id || null;
        const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;
        const purchaseType = session.metadata?.purchase_type || null;

        if (purchaseType === "additional_credits" && session.mode === "payment") {
          const credits = getCheckoutCredits(session);
          if (userId && credits > 0) {
            await addCredits(admin, userId, credits);
          }

          await logBillingTransaction(admin, {
            stripe_event_id: event.id,
            stripe_customer_id: stripeCustomerId,
            user_id: userId,
            amount: typeof session.amount_total === "number" ? session.amount_total / 100 : 0,
            currency: session.currency || "gbp",
            status: "additional_credits_paid",
            type: "additional_credits",
            raw_payload: session,
          });

          break;
        }

        if (userId) {
          const { error } = await (admin as any).from("profiles")
            .upsert(
              {
                id: userId,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
                subscription_status: "active",
                plan_type: "pro_monthly",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );

          if (error) throw error;
        }

        await logBillingTransaction(admin, {
          stripe_event_id: event.id,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          user_id: userId,
          status: "checkout_completed",
          type: "checkout.session.completed",
          raw_payload: session,
        });

        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = (event.data as any)?.object as Stripe.Invoice;
        const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id || null;
        const stripeSubscriptionId = getSubscriptionIdFromInvoice(invoice);
        const profile = await findProfileForInvoice(admin, stripeCustomerId, stripeSubscriptionId);

        if (profile?.id) {
          const { error } = await (admin as any).from("profiles")
            .update({
              subscription_status: "active",
              plan_type: "pro_monthly",
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId,
              current_period_end: getInvoicePeriodEnd(invoice),
              updated_at: new Date().toISOString(),
            })
            .eq("id", profile.id);

          if (error) throw error;

          await syncCredits(admin, profile.id, DEFAULT_MONTHLY_CREDITS);
        }

        await logBillingTransaction(admin, {
          stripe_event_id: event.id,
          stripe_invoice_id: invoice.id,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          user_id: profile?.id || null,
          amount: typeof invoice.amount_paid === "number" ? invoice.amount_paid / 100 : 0,
          currency: invoice.currency || "gbp",
          status: "paid",
          type: event.type,
          raw_payload: invoice,
        });

        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = (event.data as any)?.object as Stripe.Subscription;
        const subscriptionWithPeriod = subscription as Stripe.Subscription & { current_period_end?: number | null };
        const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || null;
        const currentPeriodEnd = typeof subscriptionWithPeriod.current_period_end === "number"
          ? new Date(subscriptionWithPeriod.current_period_end * 1000).toISOString()
          : null;
        const subscriptionStatus = event.type === "customer.subscription.deleted" ? "canceled" : subscription.status;

        const { error } = await (admin as any).from("profiles")
          .update({
            subscription_status: subscriptionStatus,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: subscription.id,
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          })
          .or(`stripe_subscription_id.eq.${subscription.id},stripe_customer_id.eq.${stripeCustomerId}`);

        if (error) throw error;

        await logBillingTransaction(admin, {
          stripe_event_id: event.id,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: subscription.id,
          status: subscriptionStatus,
          type: event.type,
          raw_payload: subscription,
        });

        break;
      }

      default: {
        await logBillingTransaction(admin, {
          stripe_event_id: event.id,
          status: "ignored",
          type: event.type,
          raw_payload: (event.data as any)?.object,
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Stripe webhook processing warning:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}
