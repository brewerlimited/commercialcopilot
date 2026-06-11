"use client";

import { FormEvent, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type FeedbackType = "Bug" | "Confusing" | "Feature idea" | "General feedback";

const feedbackTypes: FeedbackType[] = ["Bug", "Confusing", "Feature idea", "General feedback"];

const c = {
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
  card: "var(--surface)",
  input: "var(--surface-input)",
  border: "var(--border)",
  soft: "var(--surface-soft)",
  sub: "var(--text-soft)",
  text: "var(--foreground)",
  successBg: "var(--green-bg)",
  successBorder: "var(--green-border)",
  successText: "var(--green-text)",
  errorBg: "var(--red-bg)",
  errorBorder: "var(--red-border)",
  errorText: "var(--red-text)",
};

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("Bug");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedMessage = useMemo(() => message.trim(), [message]);

  function resetForm() {
    setFeedbackType("Bug");
    setMessage("");
    setError(null);
    setSubmitted(false);
    setSubmitting(false);
  }

  function closePanel() {
    setOpen(false);
    window.setTimeout(resetForm, 180);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitted(false);

    if (!trimmedMessage) {
      setError("Please add a short message before submitting feedback.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = supabaseBrowser();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const user = userData.user;
      if (!user) {
        throw new Error("Please log in before submitting feedback.");
      }

      const { error: insertError } = await (supabase as any).from("feedback").insert({
        user_id: user.id,
        user_email: user.email || null,
        page_url: typeof window !== "undefined" ? window.location.href : null,
        feedback_type: feedbackType,
        message: trimmedMessage,
        status: "New",
      });

      if (insertError) throw insertError;

      setSubmitted(true);
      setMessage("");

      window.setTimeout(() => {
        closePanel();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Unable to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        aria-label="Open feedback"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          width: 52,
          height: 52,
          borderRadius: 999,
          border: "1px solid rgba(15,23,42,0.12)",
          background: c.black,
          color: c.blackContrast,
          fontSize: 20,
          cursor: "pointer",
          boxShadow: "0 18px 45px rgba(15,23,42,0.22)",
          display: "grid",
          placeItems: "center",
        }}
      >
        💬
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Submit feedback"
          style={{
            position: "fixed",
            bottom: 88,
            right: 24,
            zIndex: 9999,
            width: 380,
            maxWidth: "calc(100vw - 32px)",
            background: c.card,
            border: `1px solid ${c.border}`,
            borderRadius: 20,
            padding: 18,
            boxShadow: "0 24px 60px rgba(15,23,42,0.2)",
          }}
        >
          {submitted ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  border: `1px solid ${c.successBorder}`,
                  background: c.successBg,
                  color: c.successText,
                  borderRadius: 16,
                  padding: 16,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 800 }}>Thank you for your feedback ✓</div>
                <div style={{ fontSize: 13, lineHeight: 1.55 }}>It has been submitted and will appear in the admin dashboard.</div>
              </div>
              <button
                type="button"
                onClick={closePanel}
                style={{
                  height: 42,
                  borderRadius: 14,
                  border: "none",
                  background: c.black,
                  color: c.blackContrast,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: c.text, letterSpacing: 0 }}>Send feedback</h3>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: c.sub }}>Report bugs, confusing screens or improvement ideas.</p>
                </div>
                <button
                  type="button"
                  onClick={closePanel}
                  aria-label="Close feedback"
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: c.sub, fontSize: 18, lineHeight: 1 }}
                >
                  ×
                </button>
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: c.text }}>Type</span>
                <select
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 12px",
                    borderRadius: 14,
                    border: `1px solid ${c.border}`,
                    background: c.soft,
                    color: c.text,
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  {feedbackTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: c.text }}>Message</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={submitting}
                  placeholder="Tell us what happened or what would make this better..."
                  style={{
                    width: "100%",
                    minHeight: 122,
                    padding: 12,
                    borderRadius: 14,
                    border: `1px solid ${c.border}`,
                    background: c.input,
                    color: c.text,
                    resize: "vertical",
                    fontSize: 13,
                    lineHeight: 1.55,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </label>

              {error ? (
                <div
                  style={{
                    border: `1px solid ${c.errorBorder}`,
                    background: c.errorBg,
                    color: c.errorText,
                    borderRadius: 14,
                    padding: "10px 12px",
                    fontSize: 12.5,
                    lineHeight: 1.5,
                  }}
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting || !trimmedMessage}
                style={{
                  height: 44,
                  borderRadius: 14,
                  border: "none",
                  background: submitting || !trimmedMessage ? c.soft : c.black,
                  color: submitting || !trimmedMessage ? c.sub : c.blackContrast,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: submitting || !trimmedMessage ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Submitting…" : "Submit feedback"}
              </button>
            </form>
          )}
        </div>
      ) : null}
    </>
  );
}
