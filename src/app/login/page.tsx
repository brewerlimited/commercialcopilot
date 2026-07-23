"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { trackAnalyticsWithUser } from "@/lib/analyticsClient";
import {
  DEFAULT_SESSION_SECURITY_SETTINGS,
  getSessionSecuritySettings,
  saveSessionSecuritySettings,
} from "@/lib/session";

type Mode = "signin" | "signup" | "reset";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [trustedDevice, setTrustedDevice] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(searchParams.get("reason") === "session-ended" ? "Your session ended for security. Sign in again to continue." : null);
  const [loading, setLoading] = useState(false);

  const disabled = useMemo(() => {
    if (mode === "reset") return loading || !email.trim();
    return loading || !email.trim() || pw.length < 6;
  }, [loading, email, pw, mode]);

  async function submit() {
    setErr(null);
    setInfo(null);
    setLoading(true);

    try {
      const supabase = supabaseBrowser();

      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
        });
        if (error) throw error;
        setInfo("Password reset instructions have been sent if the account exists.");
        setLoading(false);
        return;
      }

      const existing = getSessionSecuritySettings();
      saveSessionSecuritySettings({
        ...DEFAULT_SESSION_SECURITY_SETTINGS,
        ...existing,
        trusted_device: trustedDevice,
        idle_timeout_minutes: trustedDevice ? Math.max(existing.idle_timeout_minutes, 120) : Math.min(existing.idle_timeout_minutes, 60),
      });

      const res =
        mode === "signup"
          ? await supabase.auth.signUp({ email, password: pw })
          : await supabase.auth.signInWithPassword({ email, password: pw });

      if (res.error) throw res.error;

      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session && mode === "signup") {
        setInfo("Check your email to confirm your account, then sign in.");
        setLoading(false);
        return;
      }

      if (mode === "signup") {
        void trackAnalyticsWithUser(supabase, "signup_completed", {
          trusted_device: trustedDevice,
        });
      }

      router.push("/app");
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const c = {
    bg: "#f6f7fb",
    card: "#ffffff",
    input: "#ffffff",
    text: "#0f172a",
    sub: "#596579",
    muted: "#7c8798",
    border: "#e5e7ef",
    black: "#0f172a",
    blackContrast: "#ffffff",
    purple: "var(--purple, #6d4aff)",
    purpleSoft: "var(--purple-soft, #f3efff)",
    purpleBorder: "var(--purple-border, #ddd4ff)",
    green: "#18a36f",
    greenSoft: "#ecfdf5",
    greenBorder: "#bbf7d0",
    blue: "#2563eb",
    blueSoft: "#eff6ff",
    blueBorder: "#bfdbfe",
    orange: "#f97316",
    orangeSoft: "#fff7ed",
    orangeBorder: "#fed7aa",
    redBg: "var(--red-bg)",
    redBorder: "var(--red-border)",
    redText: "var(--red-text)",
    blueBg: "#eff6ff",
    blueText: "#2563eb",
  };

  const modeTitle = mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password";
  const modeCopy =
    mode === "signin"
      ? "Access your commercial recovery dashboard, CE / VO packs and payment tracking."
      : mode === "signup"
      ? "Create an account to start building stronger commercial records and recovery packs."
      : "Enter your email and we’ll send instructions to reset your password.";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: c.bg,
        color: c.text,
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          background: "#ffffff",
          borderBottom: `1px solid ${c.border}`,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: c.text,
              textDecoration: "none",
              borderRadius: 16,
            }}
          >
            <div
              aria-hidden
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                border: `1px solid ${c.border}`,
                background: c.black,
                display: "grid",
                placeItems: "center",
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
              }}
            >
              <img
                src="/brand/ccp-mark-white-transparent.png"
                alt=""
                aria-hidden
                style={{ width: 23, height: 23, objectFit: "contain", display: "block" }}
              />
            </div>
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 850, letterSpacing: 0, color: c.black }}>Commercial Co-Pilot</div>
              <div style={{ fontSize: 12, color: c.sub, fontWeight: 650 }}>Commercial management and recovery software.</div>
            </div>
          </Link>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            style={{
              minHeight: 44,
              padding: "0 18px",
              borderRadius: 16,
              border: `1px solid rgba(15, 23, 42, 0.18)`,
              background: "#ffffff",
              fontWeight: 800,
              fontSize: 14,
              color: c.black,
              cursor: "pointer",
            }}
          >
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </div>
      </header>

      <section
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "58px 20px",
          display: "grid",
          gridTemplateColumns: "minmax(360px, 0.78fr) minmax(420px, 560px)",
          gap: 24,
          alignItems: "center",
        }}
      >
        <aside
          style={{
            border: `1px solid ${c.border}`,
            borderRadius: 28,
            background: "#ffffff",
            boxShadow: "0 18px 55px rgba(15,23,42,0.06)",
            padding: 30,
            display: "grid",
            alignContent: "start",
            gap: 24,
          }}
        >
          <div style={{ display: "grid", gap: 18 }}>
            <span
              style={{
                width: "fit-content",
                border: `1px solid ${c.purpleBorder}`,
                background: c.purpleSoft,
                color: c.purple,
                borderRadius: 999,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 850,
              }}
            >
              Subcontractor recovery control
            </span>
            <div style={{ display: "grid", gap: 12 }}>
              <h1 style={{ margin: 0, color: c.black, fontSize: 42, lineHeight: 1.04, letterSpacing: 0, fontWeight: 900 }}>
                Sign in to your commercial recovery workspace.
              </h1>
              <p style={{ margin: 0, color: c.sub, fontSize: 17, lineHeight: 1.55 }}>
                Track EWNs, build stronger CE / VO submissions, manage evidence and keep unpaid value visible until it is recovered.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            {[
              { label: "Live recovery", value: "CE / VO", tone: c.blue, bg: c.blueSoft, bd: c.blueBorder },
              { label: "Evidence-led", value: "Packs", tone: c.green, bg: c.greenSoft, bd: c.greenBorder },
              { label: "Payment focus", value: "Tracking", tone: c.orange, bg: c.orangeSoft, bd: c.orangeBorder },
            ].map((item) => (
              <div key={item.label} style={{ border: `1px solid ${item.bd}`, background: item.bg, borderRadius: 18, padding: 16, minHeight: 112 }}>
                <div style={{ color: item.tone, fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{item.value}</div>
                <div style={{ marginTop: 18, color: c.sub, fontSize: 12, lineHeight: 1.35, fontWeight: 750 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div style={{ border: `1px solid ${c.border}`, borderRadius: 20, background: "#ffffff", padding: 18, display: "grid", gap: 12 }}>
            {[
              "Recoverable value, payment risk and next actions stay visible.",
              "Submission packs and Excel cost output use the saved project records.",
              "Commercial pushback stays inside the review process before issue.",
            ].map((item) => (
              <div key={item} style={{ display: "grid", gridTemplateColumns: "22px minmax(0, 1fr)", gap: 10, alignItems: "start", color: c.sub, fontSize: 14, lineHeight: 1.45 }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, display: "grid", placeItems: "center", background: c.greenSoft, color: c.green, fontWeight: 900 }}>✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </aside>

        <div
          style={{
            width: "100%",
            maxWidth: 560,
            border: `1px solid ${c.border}`,
            borderRadius: 28,
            padding: 32,
            background: "#ffffff",
            boxShadow: "0 18px 55px rgba(15, 23, 42, 0.08)",
            alignSelf: "center",
            justifySelf: "center",
          }}
        >
          <div style={{ marginBottom: 24, display: "grid", gap: 10 }}>
            <span style={{ width: 46, height: 46, borderRadius: 15, display: "grid", placeItems: "center", background: "#ffffff", border: `1px solid ${c.border}`, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
              <img
                src="/brand/ccp-mark-black-transparent.png"
                alt=""
                aria-hidden
                style={{ width: 28, height: 28, objectFit: "contain", display: "block" }}
              />
            </span>
            <h2 style={{ fontSize: 34, lineHeight: 1.05, fontWeight: 900, letterSpacing: 0, margin: 0, color: c.black }}>
              {modeTitle}
            </h2>
            <p style={{ margin: 0, color: c.sub, fontSize: 15, lineHeight: 1.5 }}>
              {modeCopy}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 18 }}>
            <button
              type="button"
              onClick={() => setMode("signin")}
              style={{
                border: `1px solid ${mode === "signin" ? c.purpleBorder : c.border}`,
                background: mode === "signin" ? c.purpleSoft : "#ffffff",
                color: mode === "signin" ? c.purple : c.sub,
                borderRadius: 14,
                minHeight: 44,
                fontWeight: 850,
                cursor: "pointer",
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              style={{
                border: `1px solid ${mode === "signup" ? c.purpleBorder : c.border}`,
                background: mode === "signup" ? c.purpleSoft : "#ffffff",
                color: mode === "signup" ? c.purple : c.sub,
                borderRadius: 14,
                minHeight: 44,
                fontWeight: 850,
                cursor: "pointer",
              }}
            >
              Create account
            </button>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 7 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: c.sub }}>Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@company.com"
                style={{
                  width: "100%",
                  padding: "0 14px",
                  minHeight: 54,
                  borderRadius: 16,
                  border: `1px solid ${c.border}`,
                  outline: "none",
                  color: c.black,
                  background: c.input,
                  fontSize: 15,
                  fontWeight: 650,
                }}
              />
            </label>

            {mode !== "reset" ? (
              <label style={{ display: "grid", gap: 7 }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: c.sub }}>Password</span>
                <input
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  type="password"
                  placeholder="Minimum 6 characters"
                  style={{
                    width: "100%",
                    padding: "0 14px",
                    minHeight: 54,
                    borderRadius: 16,
                    border: `1px solid ${c.border}`,
                    outline: "none",
                    color: c.black,
                    background: c.input,
                    fontSize: 15,
                    fontWeight: 650,
                  }}
                />
              </label>
            ) : null}

            {mode !== "reset" ? (
              <button
                type="button"
                onClick={() => setTrustedDevice((prev) => !prev)}
                aria-pressed={trustedDevice}
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px minmax(0, 1fr)",
                  alignItems: "start",
                  gap: 11,
                  border: `1px solid ${trustedDevice ? c.purpleBorder : c.border}`,
                  borderRadius: 16,
                  background: trustedDevice ? c.purpleSoft : "#ffffff",
                  padding: 14,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    border: `1px solid ${trustedDevice ? c.purple : c.border}`,
                    background: trustedDevice ? c.purple : "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 900,
                    flex: "0 0 auto",
                  }}
                >
                  {trustedDevice ? "✓" : ""}
                </span>
                <span style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 850, color: c.text }}>Trusted device</span>
                  <span style={{ fontSize: 13, lineHeight: 1.45, color: c.sub }}>
                    Keep a longer inactivity window here. Turn this off on shared machines or temporary site laptops.
                  </span>
                </span>
              </button>
            ) : null}

            {info && (
              <div
                style={{
                  border: `1px solid ${c.blueBorder}`,
                  background: c.blueBg,
                  color: c.blueText,
                  padding: 12,
                  borderRadius: 14,
                  fontSize: 13,
                  fontWeight: 750,
                }}
              >
                {info}
              </div>
            )}

            {err && (
              <div
                style={{
                  border: `1px solid ${c.redBorder}`,
                  background: c.redBg,
                  color: c.redText,
                  padding: 12,
                  borderRadius: 14,
                  fontSize: 13,
                  fontWeight: 750,
                }}
              >
                {err}
              </div>
            )}

            <button
              onClick={submit}
              disabled={disabled}
              style={{
                minHeight: 54,
                padding: "0 16px",
                borderRadius: 16,
                border: `1px solid ${disabled ? c.border : c.purple}`,
                background: disabled ? "#eef0f5" : c.purple,
                color: disabled ? c.muted : c.blackContrast,
                fontWeight: 850,
                fontSize: 15,
                cursor: disabled ? "not-allowed" : "pointer",
                boxShadow: disabled ? "none" : "0 14px 28px rgba(109,74,255,0.20)",
              }}
            >
              {loading ? "Working…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset instructions"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 13, color: c.sub }}>
              <div>
                {mode === "signin" ? (
                  <>
                    New here?{" "}
                    <button
                      onClick={() => setMode("signup")}
                      style={{ border: "none", background: "transparent", padding: 0, color: c.purple, fontWeight: 850, cursor: "pointer" }}
                    >
                      Create account
                    </button>
                  </>
                ) : mode === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <button
                      onClick={() => setMode("signin")}
                      style={{ border: "none", background: "transparent", padding: 0, color: c.purple, fontWeight: 850, cursor: "pointer" }}
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    Back to{" "}
                    <button
                      onClick={() => setMode("signin")}
                      style={{ border: "none", background: "transparent", padding: 0, color: c.purple, fontWeight: 850, cursor: "pointer" }}
                    >
                      sign in
                    </button>
                  </>
                )}
              </div>

              {mode !== "reset" ? (
                <button
                  onClick={() => setMode("reset")}
                  style={{ border: "none", background: "transparent", padding: 0, color: c.black, fontWeight: 850, cursor: "pointer" }}
                >
                  Forgot password?
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        @media (max-width: 980px) {
          section {
            grid-template-columns: 1fr !important;
            padding: 34px 16px !important;
          }
          aside {
            min-height: auto !important;
            padding: 24px !important;
          }
          aside h1 {
            font-size: 34px !important;
          }
        }
        @media (max-width: 640px) {
          header > div {
            padding: 12px 16px !important;
          }
          aside > div:nth-of-type(2) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh" }} />}>
      <LoginPageContent />
    </Suspense>
  );
}
