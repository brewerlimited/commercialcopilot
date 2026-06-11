"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  broadcastSessionActivity,
  broadcastSessionLogout,
  broadcastSessionWarning,
  DEFAULT_SESSION_SECURITY_SETTINGS,
  getEffectiveIdleTimeoutMinutes,
  getEffectiveWarningMinutes,
  getSessionSecuritySettings,
  SESSION_ACTIVITY_KEY,
  SESSION_LOGOUT_BROADCAST_KEY,
  SESSION_SETTINGS_KEY,
  SESSION_WARNING_KEY,
  type SessionSecuritySettings,
} from "@/lib/session";

const c = {
  card: "var(--surface)",
  border: "var(--border)",
  text: "var(--foreground)",
  sub: "var(--text-muted)",
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
  backdrop: "rgba(15,23,42,0.28)",
  soft: "var(--surface-soft)",
  amberBg: "var(--amber-bg)",
  amberBorder: "var(--amber-border)",
  amberText: "var(--amber-text)",
};

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function SessionManager() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [settings, setSettings] = useState<SessionSecuritySettings>(DEFAULT_SESSION_SECURITY_SETTINGS);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [warningOpen, setWarningOpen] = useState(false);

  const expiresAtRef = useRef<number | null>(null);
  const signingOutRef = useRef(false);

  async function forceSignOut(reason: "manual" | "idle" | "expired") {
    if (signingOutRef.current) return;
    signingOutRef.current = true;

    try {
      broadcastSessionLogout(reason);
    } catch {}

    try {
      await supabase.auth.signOut();
    } catch {}

    router.replace(`/login${reason === "manual" ? "" : "?reason=session-ended"}`);
  }

  function resetIdleWindow(nextSettings?: SessionSecuritySettings, shouldBroadcast = true) {
    const activeSettings = nextSettings ?? settings;
    const timeoutMinutes = getEffectiveIdleTimeoutMinutes(activeSettings);

    if (!Number.isFinite(timeoutMinutes)) {
      expiresAtRef.current = null;
      setExpiresAt(null);
      setRemainingMs(0);
      setWarningOpen(false);
      return;
    }

    const nextExpiresAt = Date.now() + timeoutMinutes * 60 * 1000;
    expiresAtRef.current = nextExpiresAt;
    setExpiresAt(nextExpiresAt);
    setRemainingMs(timeoutMinutes * 60 * 1000);
    setWarningOpen(false);

    if (shouldBroadcast) broadcastSessionActivity();
  }

  useEffect(() => {
    setSettings(getSessionSecuritySettings());
    resetIdleWindow(getSessionSecuritySettings(), false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pathname?.startsWith("/app")) return;

    const onActivity = () => {
      if (document.hidden) return;
      resetIdleWindow();
    };

    const events: Array<keyof WindowEventMap> = [
      "mousedown",
      "keydown",
      "mousemove",
      "scroll",
      "touchstart",
      "click",
    ];

    events.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));

    const onVisible = () => {
      if (!document.hidden) onActivity();
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      events.forEach((name) => window.removeEventListener(name, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, settings]);

  useEffect(() => {
    if (!pathname?.startsWith("/app")) return;

    const timer = window.setInterval(() => {
      const currentExpiresAt = expiresAtRef.current;
      if (!currentExpiresAt) return;

      const nextRemaining = currentExpiresAt - Date.now();
      setRemainingMs(nextRemaining);

      const warningMs = getEffectiveWarningMinutes(settings) * 60 * 1000;
      if (nextRemaining <= warningMs && nextRemaining > 0 && !warningOpen) {
        setWarningOpen(true);
        broadcastSessionWarning(currentExpiresAt);
      }

      if (nextRemaining <= 0) {
        setWarningOpen(false);
        void forceSignOut("idle");
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [pathname, settings, warningOpen]);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        if (!signingOutRef.current) {
          router.replace("/login?reason=session-ended");
        }
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        signingOutRef.current = false;
        resetIdleWindow();
      }
    });

    return () => listener.subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, supabase]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;

      if (event.key === SESSION_SETTINGS_KEY) {
        const next = getSessionSecuritySettings();
        setSettings(next);
        resetIdleWindow(next, false);
      }

      if (event.key === SESSION_ACTIVITY_KEY && !document.hidden) {
        resetIdleWindow(undefined, false);
      }

      if (event.key === SESSION_WARNING_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          if (typeof parsed?.expiresAt === "number") {
            expiresAtRef.current = parsed.expiresAt;
            setExpiresAt(parsed.expiresAt);
            setWarningOpen(true);
          }
        } catch {}
      }

      if (event.key === SESSION_LOGOUT_BROADCAST_KEY && event.newValue) {
        if (signingOutRef.current) return;
        signingOutRef.current = true;
        router.replace("/login?reason=session-ended");
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, settings]);

  if (!pathname?.startsWith("/app") || !warningOpen || !expiresAt) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: c.backdrop,
        display: "grid",
        placeItems: "center",
        padding: 24,
        zIndex: 80,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 20,
          border: `1px solid ${c.border}`,
          background: c.card,
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
          padding: 22,
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: c.text, letterSpacing: -0.3 }}>
            Session ending soon
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: c.sub }}>
            For security, Commercial Co-Pilot will sign you out after a period of inactivity. Stay signed in to continue working on this device.
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${c.amberBorder}`,
            background: c.amberBg,
            color: c.amberText,
            borderRadius: 18,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>Time remaining</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>{formatRemaining(remainingMs)}</div>
        </div>

        <div
          style={{
            borderRadius: 18,
            border: `1px solid ${c.border}`,
            background: c.soft,
            padding: "14px 16px",
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>Current security window</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub }}>
            Auto logout is set to {getEffectiveIdleTimeoutMinutes(settings)} minutes on this device with a {getEffectiveWarningMinutes(settings)} minute warning.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            onClick={() => void forceSignOut("manual")}
            style={{
              height: 46,
              padding: "0 16px",
              borderRadius: 14,
              border: `1px solid ${c.border}`,
              background: c.card,
              color: c.text,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Sign out now
          </button>

          <button
            onClick={() => resetIdleWindow()}
            style={{
              height: 46,
              padding: "0 16px",
              borderRadius: 14,
              border: `1px solid ${c.black}`,
              background: c.black,
              color: c.blackContrast,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
