"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const c = {
  card: "#ffffff",
  border: "rgba(15,23,42,0.08)",
  text: "#0f172a",
  sub: "#475569",
  black: "#111827",
  soft: "#f8fafc",
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

  useEffect(() => {
    let mounted = true;

    async function load() {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user || !mounted) return;

      const metadata = user.user_metadata ?? {};
      const email = user.email ?? "account@company.com";

      let plan = metadata.plan_type ?? metadata.plan ?? metadata.subscription_plan ?? "Starter";
      let credits = metadata.credits_available ?? metadata.credits ?? metadata.credit_balance ?? 15;

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan_type, credits_available")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.plan_type) plan = profile.plan_type;
        if (typeof profile?.credits_available !== "undefined" && profile.credits_available !== null) {
          credits = profile.credits_available;
        }
      } catch {
        // Safe fallback when table/columns do not exist yet.
      }

      if (!mounted) return;
      setAccount({
        email,
        initials: getInitials(email),
        plan: String(plan),
        credits: typeof credits === "number" ? `${credits} credits` : String(credits),
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
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

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
          borderRadius: 16,
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
            fontWeight: 900,
            letterSpacing: -0.1,
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
            borderRadius: 18,
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.10)",
            padding: 16,
            display: "grid",
            gap: 14,
            zIndex: 30,
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: c.sub, textTransform: "uppercase", letterSpacing: 0.2 }}>
              Your account
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: c.black, wordBreak: "break-word" }}>{account.email}</div>
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
                <div style={{ fontSize: 14, fontWeight: 800, color: c.black }}>{row.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Link
              href="/app/settings"
              onClick={() => setOpen(false)}
              style={{
                height: 44,
                borderRadius: 14,
                border: `1px solid ${c.border}`,
                background: c.card,
                color: c.black,
                fontWeight: 800,
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
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
