"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";
import {
  ADDITIONAL_CREDIT_UNIT_PRICE_GBP,
  MAX_ADDITIONAL_CREDITS,
  MIN_ADDITIONAL_CREDITS,
  getBillingSnapshot,
  humanPlanLabel,
  humanStatusLabel,
  isSubscriptionActive,
} from "@/lib/billing";

const c = {
  bg: "var(--background)",
  card: "var(--surface)",
  input: "var(--surface-input)",
  border: "var(--border)",
  text: "var(--foreground)",
  sub: "var(--text-muted)",
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
  soft: "var(--surface-soft)",
  greenBg: "var(--green-bg)",
  greenBorder: "var(--green-border)",
  greenText: "var(--green-text)",
  amberBg: "var(--amber-bg)",
  amberBorder: "var(--amber-border)",
  amberText: "var(--amber-text)",
  redText: "var(--red-text)",
};

function BillingPageContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("account@company.com");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "checkout" | "portal" | "credits">(null);
  const [error, setError] = useState<string | null>(null);
  const [creditQuantity, setCreditQuantity] = useState(MIN_ADDITIONAL_CREDITS);
  const [showCreditsPanel, setShowCreditsPanel] = useState(false);
  const [snapshot, setSnapshot] = useState(() =>
    getBillingSnapshot({ plan_type: "starter", subscription_status: "inactive" }, { credits_remaining: 0 })
  );

  async function loadBilling() {
    const supabase = supabaseBrowser();
    let user;
    try {
      user = await getRequiredUser(supabase);
    } catch (e: any) {
      if (isAuthErrorMessage(e?.message)) {
        window.location.href = "/login";
        return;
      }
      throw e;
    }

    setEmail(user.email ?? "account@company.com");

    const [{ data: profile }, { data: creditRow }] = await Promise.all([
      (supabase as any).from("profiles")
        .select("plan_type, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end, is_admin_unlimited, credits_remaining")
        .eq("id", user.id)
        .maybeSingle(),
      (supabase as any).from("user_credits").select("credits_remaining").eq("user_id", user.id).maybeSingle(),
    ]);

    setSnapshot(getBillingSnapshot(profile, creditRow));
    setLoading(false);
  }

  useEffect(() => {
    loadBilling().catch((e) => {
      console.error(e);
      setError(e?.message || "Failed to load billing");
      setLoading(false);
    });
  }, []);

  const notice = useMemo(() => {
    const checkout = searchParams.get("checkout");
    const credits = searchParams.get("credits");
    if (checkout === "success") return "Checkout completed. Your billing status will update as soon as Stripe confirms payment.";
    if (checkout === "cancelled") return "Checkout was cancelled. Your current access has not changed.";
    if (credits === "success") return "Additional credits purchased. Your balance will update as soon as Stripe confirms payment.";
    if (credits === "cancelled") return "Additional credit purchase was cancelled. Your balance has not changed.";
    return null;
  }, [searchParams]);

  async function postToBillingRoute(path: string, kind: "checkout" | "portal" | "credits", body?: Record<string, unknown>) {
    setBusy(kind);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("AUTH_REQUIRED");

      const res = await fetch(path, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Request failed");
      if (!json?.url) throw new Error("No redirect URL returned");
      window.location.href = json.url;
    } catch (e: any) {
      setError(e?.message || "Billing action failed");
    } finally {
      setBusy(null);
    }
  }

  const planLabel = humanPlanLabel(snapshot.plan);
  const statusLabel = humanStatusLabel(snapshot.status);
  const hasPortal = Boolean(snapshot.stripeCustomerId);
  const active = isSubscriptionActive(snapshot.status);
  const isPro = snapshot.isAdminUnlimited || (snapshot.plan === "pro_monthly" && active);
  const creditTotal = creditQuantity * ADDITIONAL_CREDIT_UNIT_PRICE_GBP;

  function changeCreditQuantity(next: number) {
    setCreditQuantity(Math.min(MAX_ADDITIONAL_CREDITS, Math.max(MIN_ADDITIONAL_CREDITS, next)));
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1120, background: c.bg }}>
      <section
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          borderRadius: 22,
          padding: 22,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 700, color: c.text, letterSpacing: 0 }}>Billing</div>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub, maxWidth: 760 }}>
          Plan access, monthly credits and Stripe billing controls for Commercial Co-Pilot.
        </div>
      </section>

      {notice ? (
        <section style={{ background: c.greenBg, border: `1px solid ${c.greenBorder}`, borderRadius: 18, padding: 16, color: c.greenText, fontSize: 13, fontWeight: 600 }}>
          {notice}
        </section>
      ) : null}

      <section style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 18, alignItems: "start" }}>
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 22, display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>Current plan</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub }}>
              Subscriptions gate paid draft generation and monthly credit resets. Emergency additional credits are only available to active Pro users.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {[
              ["Account", email],
              ["Plan", planLabel],
              ["Status", statusLabel],
              ["Credits remaining", String(snapshot.creditsRemaining)],
              ["Admin unlimited", snapshot.isAdminUnlimited ? "Enabled" : "No"],
              ["Current period end", snapshot.currentPeriodEnd ? new Date(snapshot.currentPeriodEnd).toLocaleDateString() : "—"],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ border: `1px solid ${c.border}`, borderRadius: 16, background: c.soft, padding: 16, display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.sub, textTransform: "uppercase", letterSpacing: 0.2 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: c.black, wordBreak: "break-word" }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {!isPro ? (
              <button
                type="button"
                onClick={() => postToBillingRoute("/api/stripe/create-checkout-session", "checkout")}
                disabled={busy !== null || loading}
                style={{
                  height: 46,
                  padding: "0 16px",
                  borderRadius: 14,
                  border: `1px solid ${c.black}`,
                  background: c.black,
                  color: c.blackContrast,
                  fontWeight: 700,
                  cursor: busy || loading ? "not-allowed" : "pointer",
                  opacity: busy || loading ? 0.6 : 1,
                }}
              >
                {busy === "checkout" ? "Opening Stripe…" : "Upgrade to Pro"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreditsPanel((v) => !v)}
                disabled={busy !== null || loading}
                style={{
                  height: 46,
                  padding: "0 16px",
                  borderRadius: 14,
                  border: `1px solid ${c.black}`,
                  background: c.black,
                  color: c.blackContrast,
                  fontWeight: 700,
                  cursor: busy || loading ? "not-allowed" : "pointer",
                  opacity: busy || loading ? 0.6 : 1,
                }}
              >
                Additional emergency credits
              </button>
            )}

            <button
              type="button"
              onClick={() => postToBillingRoute("/api/stripe/create-portal-session", "portal")}
              disabled={busy !== null || !hasPortal}
              style={{
                height: 46,
                padding: "0 16px",
                borderRadius: 14,
                border: `1px solid ${c.border}`,
                background: c.input,
                color: c.black,
                fontWeight: 700,
                cursor: busy || !hasPortal ? "not-allowed" : "pointer",
                opacity: busy || !hasPortal ? 0.6 : 1,
              }}
            >
              {busy === "portal" ? "Opening portal…" : "Manage billing"}
            </button>
          </div>

          {showCreditsPanel && isPro ? (
            <div style={{ border: `1px solid ${c.border}`, borderRadius: 18, background: c.soft, padding: 16, display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: c.text }}>Additional emergency credits</div>
                <div style={{ fontSize: 13, color: c.sub, lineHeight: 1.55 }}>
                  Additional credits are £{ADDITIONAL_CREDIT_UNIT_PRICE_GBP} each and are only available to active Pro users. Monthly subscription credits still refill to the plan allowance separately.
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => changeCreditQuantity(creditQuantity - 1)}
                  disabled={creditQuantity <= MIN_ADDITIONAL_CREDITS || busy !== null}
                  style={{ width: 42, height: 42, borderRadius: 12, border: `1px solid ${c.border}`, background: c.input, color: c.black, fontWeight: 800, cursor: creditQuantity <= MIN_ADDITIONAL_CREDITS || busy ? "not-allowed" : "pointer" }}
                >
                  −
                </button>
                <input
                  type="number"
                  min={MIN_ADDITIONAL_CREDITS}
                  max={MAX_ADDITIONAL_CREDITS}
                  value={creditQuantity}
                  onChange={(e) => changeCreditQuantity(Number(e.target.value))}
                  style={{ width: 86, height: 42, borderRadius: 12, border: `1px solid ${c.border}`, background: c.input, color: c.black, padding: "0 12px", fontWeight: 800, textAlign: "center" }}
                />
                <button
                  type="button"
                  onClick={() => changeCreditQuantity(creditQuantity + 1)}
                  disabled={creditQuantity >= MAX_ADDITIONAL_CREDITS || busy !== null}
                  style={{ width: 42, height: 42, borderRadius: 12, border: `1px solid ${c.border}`, background: c.input, color: c.black, fontWeight: 800, cursor: creditQuantity >= MAX_ADDITIONAL_CREDITS || busy ? "not-allowed" : "pointer" }}
                >
                  +
                </button>
                <div style={{ fontSize: 13, color: c.sub }}>
                  £{ADDITIONAL_CREDIT_UNIT_PRICE_GBP} per credit · Total <b style={{ color: c.black }}>£{creditTotal.toLocaleString("en-GB")}</b>
                </div>
              </div>

              <button
                type="button"
                onClick={() => postToBillingRoute("/api/stripe/create-credit-checkout-session", "credits", { quantity: creditQuantity })}
                disabled={busy !== null || loading || !isPro}
                style={{
                  height: 46,
                  padding: "0 16px",
                  borderRadius: 14,
                  border: `1px solid ${c.black}`,
                  background: c.black,
                  color: c.blackContrast,
                  fontWeight: 800,
                  justifySelf: "start",
                  cursor: busy || loading || !isPro ? "not-allowed" : "pointer",
                  opacity: busy || loading || !isPro ? 0.6 : 1,
                }}
              >
                {busy === "credits" ? "Opening Stripe…" : `Buy ${creditQuantity} credit${creditQuantity === 1 ? "" : "s"}`}
              </button>
            </div>
          ) : !isPro ? (
            <div style={{ background: c.amberBg, border: `1px solid ${c.amberBorder}`, borderRadius: 16, padding: 14, color: c.amberText, fontSize: 13, lineHeight: 1.5 }}>
              Additional emergency credits unlock once your account is on Pro.
            </div>
          ) : null}

          {error ? <div style={{ fontSize: 13, color: c.redText }}>{error}</div> : null}
        </div>

        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 22, display: "grid", gap: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>How credits work</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: c.sub }}>
            Paid plans receive a monthly credit allocation. Emergency credits are a premium top-up for Pro users who need more than their monthly allowance.
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              "Stripe subscription controls plan access.",
              "invoice.paid refills monthly credits to 15.",
              "Emergency credits add to the current balance.",
              "Generate Draft will consume credits after success.",
            ].map((item) => (
              <div key={item} style={{ display: "grid", gridTemplateColumns: "12px minmax(0,1fr)", gap: 10, alignItems: "start" }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: c.black, marginTop: 8, opacity: 0.55 }} />
                <span style={{ fontSize: 13, lineHeight: 1.55, color: c.sub }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading billing…</div>}>
      <BillingPageContent />
    </Suspense>
  );
}
