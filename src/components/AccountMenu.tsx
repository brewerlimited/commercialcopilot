"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";
import { broadcastSessionLogout } from "@/lib/session";
import { checkAdminWithClient } from "@/lib/adminAccess";
import { getBillingSnapshot, humanPlanLabel } from "@/lib/billing";

const c = {
  card: "var(--surface)",
  border: "var(--border)",
  text: "var(--foreground)",
  sub: "var(--text-muted)",
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
  soft: "var(--surface-soft)",
};

type AccountState = {
  email: string;
  initials: string;
  plan: string;
  credits: string;
};

function getInitials(email: string) {
  const raw = email.split("@")[0] || "CC";
  const parts = raw.split(/[._\-\s]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  return raw.slice(0, 2).toUpperCase();
}

export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<AccountState>({
    email: "account@company.com",
    initials: "CC",
    plan: "Starter",
    credits: "15 credits",
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const supabase = supabaseBrowser();
      let user;
      try {
        user = await getRequiredUser(supabase);
      } catch (e: any) {
        if (isAuthErrorMessage(e?.message) || !mounted) return;
        throw e;
      }
      if (!mounted) return;

      const metadata = user.user_metadata ?? {};
      const email = user.email ?? "account@company.com";

      const [{ data: creditRow }, { data: profile }] = await Promise.all([
        (supabase as any).from("user_credits")
          .select("credits_remaining")
          .eq("user_id", user.id)
          .maybeSingle(),
        (supabase as any).from("profiles")
          .select("plan_type, subscription_status, is_admin_unlimited, stripe_customer_id, stripe_subscription_id, current_period_end, credits_remaining")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      const snapshot = getBillingSnapshot(profile, creditRow);
      const plan = humanPlanLabel(snapshot.plan);
      let credits: string | number = snapshot.creditsRemaining;

      const adminState = await checkAdminWithClient(supabase, email);

      if (!mounted) return;
      setIsAdmin(adminState);
      setAccount({
        email,
        initials: getInitials(email),
        plan: String(plan),
        credits:
          typeof credits === "number"
            ? `${credits.toLocaleString()} credits`
            : String(credits),
      });
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function onPointerDown(ev: MouseEvent) {
      if (!rootRef.current?.contains(ev.target as Node)) setOpen(false);
    }
    function onEscape(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  const rows = useMemo(
    () => [
      { label: "Plan", value: account.plan },
      { label: "Credits", value: account.credits },
    ],
    [account]
  );

  async function signOut() {
    const supabase = supabaseBrowser();
    broadcastSessionLogout("manual");
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const isPaidPlan = account.plan === "Pro" || account.plan === "Custom";
  const billingCtaLabel = isPaidPlan ? "Billing" : "Upgrade to Pro";

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          border: `1px solid ${c.border}`,
          background: c.card,
          color: c.text,
          height: 48,
          minWidth: 48,
          borderRadius: 18,
          padding: "0 12px",
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: c.soft,
            border: `1px solid ${c.border}`,
            display: "grid",
            placeItems: "center",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0,
          }}
        >
          {account.initials}
        </div>
        <span style={{ color: c.sub, fontSize: 11, lineHeight: 1 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 10px)",
            width: 320,
            background: c.card,
            border: `1px solid ${c.border}`,
            borderRadius: 22,
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.10)",
            padding: 18,
            display: "grid",
            gap: 14,
            zIndex: 30,
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.sub, textTransform: "uppercase", letterSpacing: 0.2 }}>
              Your account
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.black, wordBreak: "break-word" }}>{account.email}</div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${c.border}`,
                  background: c.soft,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: c.sub }}>{row.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.black }}>{row.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {isAdmin ? (
              <Link
                href="/app/admin"
                onClick={() => setOpen(false)}
                style={{
                  height: 44,
                  borderRadius: 14,
                  border: `1px solid ${c.border}`,
                  background: c.soft,
                  color: c.black,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  textDecoration: "none",
                }}
              >
                Admin dashboard
              </Link>
            ) : null}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Link
                href="/app/billing"
                onClick={() => setOpen(false)}
                style={{
                  height: 44,
                  borderRadius: 14,
                  border: `1px solid ${isPaidPlan ? c.border : c.black}`,
                  background: isPaidPlan ? c.soft : c.black,
                  color: isPaidPlan ? c.black : c.blackContrast,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  textDecoration: "none",
                  gridColumn: "1 / -1",
                  boxShadow: isPaidPlan ? "none" : "0 10px 22px rgba(15,23,42,0.16)",
                }}
              >
                {billingCtaLabel}
              </Link>
              <Link
                href="/app/settings"
                onClick={() => setOpen(false)}
                style={{
                  height: 44,
                  borderRadius: 14,
                  border: `1px solid ${c.border}`,
                  background: c.card,
                  color: c.black,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  textDecoration: "none",
                }}
              >
                Settings
              </Link>

              <button
                onClick={signOut}
                style={{
                  height: 44,
                  borderRadius: 14,
                  border: `1px solid ${c.border}`,
                  background: c.card,
                  color: c.black,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
