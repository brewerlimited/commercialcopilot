"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { checkAdminWithClient } from "@/lib/adminAccess";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";

const STORAGE_KEY = "cc_force_generate_mode";

const c = {
  border: "var(--border)",
  card: "var(--surface)",
  text: "var(--foreground)",
  sub: "var(--text-muted)",
  black: "var(--accent)",
  soft: "var(--surface-soft)",
  greenBg: "var(--green-bg)",
  greenBorder: "var(--green-border)",
  greenText: "var(--green-text)",
};

export default function ForceGenerateToggle() {
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "1") setEnabled(true);
    } catch {}

    async function load() {
      const supabase = supabaseBrowser();
      try {
        const user = await getRequiredUser(supabase);
        const shouldShow = await checkAdminWithClient(supabase, user.email);
        if (mounted) setVisible(shouldShow);
      } catch (e: any) {
        if (isAuthErrorMessage(e?.message)) return;
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (!visible) return null;

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      window.dispatchEvent(new CustomEvent("cc:force-generate-changed", { detail: { enabled: next } }));
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title="Testing only. Keeps Review on Generate Pack so you can repeatedly test pack generation."
      style={{
        height: 48,
        padding: "0 14px",
        borderRadius: 16,
        border: `1px solid ${enabled ? c.greenBorder : c.border}`,
        background: enabled ? c.greenBg : c.card,
        color: enabled ? c.greenText : c.text,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 13 }}>Force Generate</span>
      <span
        aria-hidden
        style={{
          width: 34,
          height: 20,
          borderRadius: 999,
          background: enabled ? c.black : c.soft,
          border: `1px solid ${enabled ? c.black : c.border}`,
          position: "relative",
          transition: "all 160ms ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: enabled ? 16 : 1,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: "var(--accent-contrast)",
            transition: "all 160ms ease",
            boxShadow: "0 1px 2px rgba(0,0,0,0.14)",
          }}
        />
      </span>
    </button>
  );
}
