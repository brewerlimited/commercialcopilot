"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
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

      router.push("/app");
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const c = {
    bg: "var(--background)",
    card: "var(--surface)",
    input: "var(--surface-input)",
    text: "var(--foreground)",
    sub: "var(--text-muted)",
    border: "var(--border)",
    black: "var(--accent)",
    blackContrast: "var(--accent-contrast)",
    redBg: "var(--red-bg)",
    redBorder: "var(--red-border)",
    redText: "var(--red-text)",
    blueBg: "var(--blue-bg)",
    blueBorder: "var(--blue-border)",
    blueText: "var(--blue-text)",
    topbar: "var(--topbar-bg)",
  };

  return (
    <main style={{ minHeight: "100vh", background: c.bg, color: c.text }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          background: c.topbar,
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${c.border}`,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              aria-hidden
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                border: `1px solid ${c.border}`,
                background: c.card,
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                color: c.black,
              }}
            >
              CC
            </div>
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 700, letterSpacing: 0, color: c.black }}>Commercial Co-Pilot</div>
              <div style={{ fontSize: 12, color: c.sub }}>Clause-aware CE drafting for live commercial work.</div>
            </div>
          </div>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${c.border}`,
              background: c.card,
              fontWeight: 700,
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
          maxWidth: 1080,
          margin: "0 auto",
          padding: "56px 16px",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 560,
            border: `1px solid ${c.border}`,
            borderRadius: 18,
            padding: 22,
            background: c.card,
            boxShadow: "0 14px 40px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: 0, margin: 0, color: c.black }}>
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset password"}
            </h1>
            <p style={{ marginTop: 8, marginBottom: 0, color: c.sub }}>
              {mode === "signin"
                ? "Access your CE drafts, evidence and submission packs."
                : mode === "signup"
                ? "Start with a guided workflow built for commercially robust submissions."
                : "Enter your email and we will send reset instructions."}
            </p>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: c.sub }}>Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@company.com"
                style={{
                  width: "100%",
                  padding: "12px 12px",
                  borderRadius: 14,
                  border: `1px solid ${c.border}`,
                  outline: "none",
                  color: c.black,
                  background: c.input,
                }}
              />
            </label>

            {mode !== "reset" ? (
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: c.sub }}>Password</span>
                <input
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  type="password"
                  placeholder="Minimum 6 characters"
                  style={{
                    width: "100%",
                    padding: "12px 12px",
                    borderRadius: 14,
                    border: `1px solid ${c.border}`,
                    outline: "none",
                    color: c.black,
                    background: c.input,
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
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  border: `1px solid ${c.border}`,
                  borderRadius: 14,
                  background: c.input,
                  padding: 12,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    marginTop: 1,
                    borderRadius: 6,
                    border: `1px solid ${trustedDevice ? c.black : c.border}`,
                    background: trustedDevice ? c.black : c.input,
                    display: "grid",
                    placeItems: "center",
                    color: c.blackContrast,
                    fontSize: 12,
                    fontWeight: 700,
                    flex: "0 0 auto",
                  }}
                >
                  {trustedDevice ? "✓" : ""}
                </span>
                <span style={{ display: "grid", gap: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: c.text }}>Trusted device</span>
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: c.sub }}>
                    Keep a longer inactivity window on this device. Turn this off on shared machines or temporary site laptops.
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
                  padding: 10,
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
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
                  padding: 10,
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {err}
              </div>
            )}

            <button
              onClick={submit}
              disabled={disabled}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${c.black}`,
                background: c.black,
                color: c.blackContrast,
                fontWeight: 700,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.6 : 1,
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
                      style={{ border: "none", background: "transparent", padding: 0, color: c.black, fontWeight: 700, cursor: "pointer" }}
                    >
                      Create account
                    </button>
                  </>
                ) : mode === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <button
                      onClick={() => setMode("signin")}
                      style={{ border: "none", background: "transparent", padding: 0, color: c.black, fontWeight: 700, cursor: "pointer" }}
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    Back to{" "}
                    <button
                      onClick={() => setMode("signin")}
                      style={{ border: "none", background: "transparent", padding: 0, color: c.black, fontWeight: 700, cursor: "pointer" }}
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>

              {mode !== "reset" ? (
                <button
                  onClick={() => setMode("reset")}
                  style={{ border: "none", background: "transparent", padding: 0, color: c.black, fontWeight: 700, cursor: "pointer" }}
                >
                  Forgot password?
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
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
