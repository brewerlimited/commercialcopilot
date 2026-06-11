"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const disabled = useMemo(() => loading || !email.trim() || pw.length < 6, [loading, email, pw]);

  async function submit() {
    setErr(null);
    setLoading(true);

    try {
      const supabase = supabaseBrowser();

      const res =
        mode === "signup"
          ? await supabase.auth.signUp({ email, password: pw })
          : await supabase.auth.signInWithPassword({ email, password: pw });

      if (res.error) throw res.error;

      const { data: sessionData } = await supabase.auth.getSession();

      // If email confirmation is ON, signup may not create a session yet.
      if (!sessionData.session && mode === "signup") {
        setErr("Check your email to confirm your account, then sign in.");
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
    bg: "#f6f7fb",
    card: "#ffffff",
    text: "#0f172a",
    sub: "#475569",
    border: "#e5e7eb",
    black: "#111827",
    redBg: "#fef2f2",
    redBorder: "#fecaca",
    redText: "#991b1b",
  };

  return (
    <main style={{ minHeight: "100vh", background: c.bg, color: c.text }}>
      {/* Top bar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          background: "rgba(246,247,251,0.92)",
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
                fontWeight: 900,
                color: c.black,
              }}
            >
              CC
            </div>
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 950, letterSpacing: -0.2, color: c.black }}>
                Commercial Co-Pilot
              </div>
              <div style={{ fontSize: 12, color: c.sub }}>
                Draft CEs fast. Submit with confidence.
              </div>
            </div>
          </div>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${c.border}`,
              background: c.card,
              fontWeight: 900,
              color: c.black,
              cursor: "pointer",
            }}
          >
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </div>
      </header>

      {/* Center card */}
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
            <h1 style={{ fontSize: 26, fontWeight: 950, letterSpacing: -0.4, margin: 0, color: c.black }}>
              {mode === "signin" ? "Sign in" : "Create your account"}
            </h1>
            <p style={{ marginTop: 8, marginBottom: 0, color: c.sub }}>
              {mode === "signin"
                ? "Access your CE drafts and submission packs."
                : "Start drafting clause-ready CEs with a guided workflow."}
            </p>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 900, fontSize: 13, color: c.sub }}>Email</span>
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
                  background: "#fff",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 900, fontSize: 13, color: c.sub }}>Password</span>
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
                  background: "#fff",
                }}
              />
            </label>

            {err && (
              <div
                style={{
                  border: `1px solid ${c.redBorder}`,
                  background: c.redBg,
                  color: c.redText,
                  padding: 10,
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 800,
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
                color: "#fff",
                fontWeight: 950,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              {loading ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>

            <div style={{ textAlign: "center", fontSize: 13, color: c.sub }}>
              {mode === "signin" ? (
                <>
                  New here?{" "}
                  <button
                    onClick={() => setMode("signup")}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontWeight: 950,
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                      color: c.black,
                    }}
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    onClick={() => setMode("signin")}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontWeight: 950,
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                      color: c.black,
                    }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: `1px solid ${c.border}`,
              display: "grid",
              gap: 6,
              fontSize: 12,
              color: c.sub,
              textAlign: "center",
            }}
          >
            <div>Structured CE drafting • Deterministic costing • Submission packs</div>
            <div>© {new Date().getFullYear()} Commercial Co-Pilot</div>
          </div>
        </div>
      </section>
    </main>
  );
}
