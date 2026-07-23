"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";
import { isAccountApproved, isSubscriptionActive, normaliseAccountAccessStatus } from "@/lib/billing";
import AccountMenu from "@/components/AccountMenu";
import ForceGenerateToggle from "@/components/ForceGenerateToggle";
import { FloatingOnboardingHelper } from "@/components/OnboardingActivation";
import SessionManager from "@/components/SessionManager";
import { broadcastSessionLogout } from "@/lib/session";

const c = {
  bg: "var(--background)",
  panel: "var(--panel-bg)",
  panelSolid: "var(--surface)",
  panelInput: "var(--surface-input)",
  border: "var(--border)",
  text: "var(--foreground)",
  sub: "var(--text-muted)",
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
  activeBg: "var(--active-bg)",
  hoverBg: "var(--hover-bg)",
  topBg: "var(--topbar-bg)",
};

type EventRow = {
  id: string;
  title: string;
  status: string | null;
  created_at?: string;
  is_demo?: boolean | null;
};

type EwnRow = {
  id: string;
  title: string;
  status: string | null;
  created_at?: string;
  is_demo?: boolean | null;
};

type AccessGateState = {
  loaded: boolean;
  allowed: boolean;
  requested: boolean;
  email: string | null;
  accountStatus: string | null;
  error: string | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function isOptionalSchemaError(error: any) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("column") ||
    error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST204"
  );
}

function demoFilteredRows<T extends { is_demo?: boolean | null }>(rows: T[], demoMode: boolean) {
  return demoMode ? rows.filter((row) => row.is_demo === true) : rows.filter((row) => row.is_demo !== true);
}

function Icon({
  name,
}: {
  name:
    | "home"
    | "plus"
    | "search"
    | "file"
    | "ceRegister"
    | "ewnRegister"
    | "logout"
    | "collapse"
    | "expand"
    | "rates"
    | "projects"
    | "company"
    | "settings"
    | "warning";
}) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 10v10h14V10" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      );
    case "ceRegister":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </svg>
      );
    case "ewnRegister":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M12 12v4" />
          <path d="M12 19h.01" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
    case "collapse":
      return (
        <svg {...common}>
          <path d="M15 18l-6-6 6-6" />
          <path d="M21 4v16" />
        </svg>
      );
    case "expand":
      return (
        <svg {...common}>
          <path d="M9 18l6-6-6-6" />
          <path d="M3 4v16" />
        </svg>
      );
    case "rates":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 17V9" />
          <path d="M12 17V7" />
          <path d="M16 17v-5" />
        </svg>
      );
    case "projects":
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <path d="M5 21V5a2 2 0 0 1 2-2h6l6 6v12" />
          <path d="M13 3v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h6" />
        </svg>
      );
    case "company":
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <path d="M5 21V7l7-4 7 4v14" />
          <path d="M9 21v-6h6v6" />
          <path d="M9 10h.01" />
          <path d="M15 10h.01" />
        </svg>
      );
    case "warning":
      return (
        <svg {...common}>
          <path d="M10.3 3.2 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.2a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82V22a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8.6 20a1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33H2a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 6.44 3.9l.06.06A1.65 1.65 0 0 0 8.6 4.6a1.65 1.65 0 0 0 1-.6A1.65 1.65 0 0 0 9.91 2H10a2 2 0 1 1 4 0v.09c0 .7.4 1.34 1 1.65.58.3 1.27.26 1.82-.07l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8.6c.3.58.94 1 1.65 1H21a2 2 0 1 1 0 4h-.09c-.7 0-1.34.4-1.65 1z" />
        </svg>
      );
  }
}

function Row({
  href,
  label,
  icon,
  active,
  collapsed,
  right,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  collapsed: boolean;
  right?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onMouseEnter={(ev) => {
        if (active) return;
        (ev.currentTarget as HTMLAnchorElement).style.background = c.hoverBg;
      }}
      onMouseLeave={(ev) => {
        (ev.currentTarget as HTMLAnchorElement).style.background = active ? c.activeBg : "transparent";
      }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: collapsed ? 0 : 10,
        width: collapsed ? 52 : "100%",
        height: collapsed ? 52 : undefined,
        minHeight: collapsed ? 52 : 42,
        padding: collapsed ? 0 : "9px 11px",
        borderRadius: collapsed ? 16 : 14,
        textDecoration: "none",
        color: active ? "#6d4aff" : c.text,
        background: active ? c.activeBg : "transparent",
        transition: "background 140ms ease, color 140ms ease, border-color 140ms ease",
        border: `1px solid ${active ? "#ddd4ff" : "transparent"}`,
      }}
    >
      {icon ? <span style={{ width: collapsed ? 24 : 20, height: collapsed ? 24 : 20, display: "grid", placeItems: "center", color: active ? "#6d4aff" : c.sub, flex: `0 0 ${collapsed ? 24 : 20}px` }}>{icon}</span> : null}
      {!collapsed && (
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 13,
            fontWeight: 650,
          }}
        >
          {label}
        </span>
      )}
      {!collapsed && right ? (
        <span style={{ color: c.sub, fontSize: 12, fontWeight: 700 }}>{right}</span>
      ) : null}
    </Link>
  );
}

function EarlyAccessScreen({
  email,
  requested,
  accountStatus,
  requestNote,
  requestBusy,
  requestMessage,
  requestError,
  onRequestNoteChange,
  onRequestAccess,
}: {
  email: string | null;
  requested: boolean;
  accountStatus: string | null;
  requestNote: string;
  requestBusy: boolean;
  requestMessage: string | null;
  requestError: string | null;
  onRequestNoteChange: (value: string) => void;
  onRequestAccess: () => void;
}) {
  const statusText = accountStatus === "suspended" ? "Account suspended" : requested ? "Request received" : "Pending verification";

  return (
    <section
      style={{
        maxWidth: 1480,
        margin: "0 auto",
        padding: "42px 20px",
        minHeight: "calc(100vh - 126px)",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 520px)",
        gap: 24,
        alignItems: "stretch",
      }}
    >
        <div
          style={{
            border: "1px solid #e5e7ef",
            borderRadius: 30,
            background: "#ffffff",
            padding: 38,
            boxShadow: "0 18px 55px rgba(15,23,42,0.06)",
            display: "grid",
            alignContent: "center",
            gap: 24,
          }}
        >
          <span
            style={{
              width: "fit-content",
              border: "1px solid #ddd4ff",
              background: "#f3efff",
              color: "#6d4aff",
              borderRadius: 999,
              padding: "8px 13px",
              fontSize: 12,
              fontWeight: 850,
            }}
          >
            {statusText}
          </span>
          <div style={{ display: "grid", gap: 14 }}>
            <h1 style={{ margin: 0, fontSize: 54, lineHeight: 1.02, letterSpacing: 0, fontWeight: 900 }}>
              Welcome to Commercial Co-Pilot.
            </h1>
            <p style={{ margin: 0, color: "#596579", fontSize: 18, lineHeight: 1.6, maxWidth: 720 }}>
              Commercial Co-Pilot is currently in an early access trial. During this period, only verified users can use the full site.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            {[
              ["Recoverable value", "Track CEs / VOs through to payment.", "#eff6ff", "#bfdbfe", "#2563eb"],
              ["Evidence-led packs", "Keep records, cost and entitlement joined up.", "#ecfdf5", "#bbf7d0", "#067647"],
              ["Early access", "Verified testers get the full workspace.", "#fff7ed", "#fed7aa", "#c24f0c"],
            ].map(([title, body, bg, border, tone]) => (
              <div key={title} style={{ border: `1px solid ${border}`, background: bg, borderRadius: 18, padding: 18, minHeight: 132 }}>
                <div style={{ color: tone, fontWeight: 850, fontSize: 14 }}>{title}</div>
                <div style={{ marginTop: 18, color: "#596579", fontSize: 13, lineHeight: 1.45, fontWeight: 650 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e5e7ef",
            borderRadius: 30,
            background: "#ffffff",
            padding: 30,
            boxShadow: "0 18px 55px rgba(15,23,42,0.06)",
            display: "grid",
            alignContent: "start",
            gap: 18,
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 26, lineHeight: 1.1, fontWeight: 900 }}>Request access</h2>
            <p style={{ margin: 0, color: "#596579", fontSize: 14, lineHeight: 1.5 }}>
              Tell us who you are and what you want to test. We will activate verified trial users manually.
            </p>
          </div>

          <div style={{ border: "1px solid #e5e7ef", borderRadius: 18, padding: 16, background: "#f8fafc" }}>
            <div style={{ color: "#596579", fontSize: 12, fontWeight: 850, textTransform: "uppercase", letterSpacing: 0.5 }}>Signed in as</div>
            <div style={{ marginTop: 6, fontWeight: 850, overflowWrap: "anywhere" }}>{email || "Unknown account"}</div>
          </div>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 850, color: "#475569" }}>Company, role and intended test use</span>
            <textarea
              value={requestNote}
              onChange={(e) => onRequestNoteChange(e.target.value)}
              placeholder="e.g. subcontractor QS testing CE / VO recovery workflow on NEC projects"
              rows={6}
              disabled={requestBusy || requested}
              style={{
                width: "100%",
                resize: "vertical",
                minHeight: 138,
                padding: 14,
                borderRadius: 16,
                border: "1px solid #e5e7ef",
                outline: "none",
                background: requested ? "#f8fafc" : "#ffffff",
                color: "#0f172a",
                fontSize: 14,
                lineHeight: 1.5,
                fontWeight: 650,
              }}
            />
          </label>

          {requestMessage ? (
            <div style={{ border: "1px solid #bbf7d0", background: "#ecfdf5", color: "#067647", padding: 13, borderRadius: 16, fontWeight: 800, fontSize: 13 }}>
              {requestMessage}
            </div>
          ) : null}

          {requestError ? (
            <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", padding: 13, borderRadius: 16, fontWeight: 800, fontSize: 13 }}>
              {requestError}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onRequestAccess}
            disabled={requestBusy || requested}
            style={{
              minHeight: 54,
              borderRadius: 16,
              border: `1px solid ${requestBusy || requested ? "#ddd4ff" : "#6d4aff"}`,
              background: requestBusy || requested ? "#f3efff" : "#6d4aff",
              color: requestBusy || requested ? "#6d4aff" : "#ffffff",
              fontWeight: 900,
              cursor: requestBusy || requested ? "not-allowed" : "pointer",
              boxShadow: requestBusy || requested ? "none" : "0 16px 30px rgba(109,74,255,0.20)",
            }}
          >
            {requestBusy ? "Sending request…" : requested ? "Access request received" : "Request access"}
          </button>
        </div>
    </section>
  );
}

function DemoReadOnlyBanner({ onExitDemo }: { onExitDemo: () => void }) {
  return (
    <div
      style={{
        marginBottom: 16,
        border: "1px solid #ddd4ff",
        background: "#f5f0ff",
        borderRadius: 18,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        color: "#4f35c6",
        boxShadow: "0 14px 34px rgba(109,74,255,0.08)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 900, color: "#6d4aff" }}>Demo data only</div>
        <div style={{ marginTop: 3, color: "#5f547f", fontWeight: 700, lineHeight: 1.35 }}>
          You are exploring the normal app with seeded demo records. Creation and saving are disabled, and pack generation downloads a sample workbook.
        </div>
      </div>
      <button
        type="button"
        onClick={onExitDemo}
        style={{
          flex: "0 0 auto",
          height: 40,
          padding: "0 14px",
          borderRadius: 14,
          border: "1px solid #cfc2ff",
          background: "#ffffff",
          color: "#6d4aff",
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        Exit demo
      </button>
    </div>
  );
}

function DemoCreateBlocked() {
  return (
    <div
      style={{
        border: `1px solid ${c.border}`,
        background: "#ffffff",
        borderRadius: 24,
        padding: 28,
        boxShadow: "0 18px 55px rgba(15,23,42,0.06)",
        color: c.text,
      }}
    >
      <div style={{ fontSize: 24, lineHeight: 1.15, fontWeight: 950, letterSpacing: 0 }}>Creation is disabled in demo mode</div>
      <p style={{ margin: "10px 0 0", color: c.sub, fontSize: 16, lineHeight: 1.55, fontWeight: 650 }}>
        Demo mode lets trial users explore the real workflow with seeded data, but it does not create or save new CEs, EWNs or projects.
      </p>
      <Link
        href="/app"
        style={{
          marginTop: 18,
          height: 44,
          padding: "0 16px",
          borderRadius: 14,
          display: "inline-flex",
          alignItems: "center",
          background: "#f3efff",
          border: "1px solid #ddd4ff",
          color: "#6d4aff",
          textDecoration: "none",
          fontWeight: 900,
        }}
      >
        Back to demo dashboard
      </Link>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [urlSearch, setUrlSearch] = useState("");

  const [events, setEvents] = useState<EventRow[]>([]);
  const [ewns, setEwns] = useState<EwnRow[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [q, setQ] = useState("");

  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [logoHover, setLogoHover] = useState(false);
  const [accessGate, setAccessGate] = useState<AccessGateState>({
    loaded: false,
    allowed: false,
    requested: false,
    email: null,
    accountStatus: null,
    error: null,
  });
  const [requestNote, setRequestNote] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoCountdown, setDemoCountdown] = useState(10);
  const [demoSeedStatus, setDemoSeedStatus] = useState<"idle" | "seeding" | "ready" | "error">("idle");
  const [demoSeedMessage, setDemoSeedMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem("cc.sidebar.collapsed");
      if (v === "1") setCollapsed(true);
      const demo = localStorage.getItem("cc.demo.mode");
      if (demo === "1") {
        setDemoMode(true);
        setDemoLoading(false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!demoLoading) return;

    if (demoCountdown <= 0) {
      setDemoLoading(false);
      return;
    }

    const t = window.setTimeout(() => {
      setDemoCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearTimeout(t);
  }, [demoCountdown, demoLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setUrlSearch(window.location.search);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((p) => {
      const next = !p;
      try {
        localStorage.setItem("cc.sidebar.collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  async function enableDemoMode() {
    if (demoLoading) return;

    setDemoSeedStatus("seeding");
    setDemoSeedMessage(null);
    setDemoLoading(true);
    setDemoCountdown(10);

    try {
      const supabase = supabaseBrowser();
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      const email = sessionRes.data.session?.user?.email || accessGate.email;

      if (!token) {
        throw new Error("Your session has expired. Please sign in again before loading demo mode.");
      }

      const res = await fetch("/api/admin/seed-demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetEmail: email, demoMode: true }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Demo seed failed. Please try again.");
      }

      const eventsLoaded = Number(data?.eventsCreated ?? data?.inserted?.events ?? data?.counts?.events ?? 0);
      const ewnsLoaded = Number(data?.ewnsCreated ?? data?.inserted?.ewns ?? data?.counts?.ewns ?? 0);
      setDemoSeedStatus("ready");
      setDemoSeedMessage(`Demo workspace ready: ${eventsLoaded} CEs and ${ewnsLoaded} EWNs loaded.`);
      setDemoMode(true);
      try {
        localStorage.setItem("cc.demo.mode", "1");
        window.dispatchEvent(new Event("cc:demo-mode-changed"));
      } catch {}
    } catch (error) {
      setDemoSeedStatus("error");
      setDemoSeedMessage(error instanceof Error ? error.message : "Demo seed failed. Please try again.");
      setDemoLoading(false);
      setDemoCountdown(10);
      return;
    }
  }

  function disableDemoMode() {
    setDemoMode(false);
    setDemoLoading(false);
    setDemoCountdown(10);
    setDemoSeedStatus("idle");
    setDemoSeedMessage(null);
    try {
      localStorage.removeItem("cc.demo.mode");
      window.dispatchEvent(new Event("cc:demo-mode-changed"));
    } catch {}
  }

  function readLocalEwns(): EwnRow[] {
    try {
      const raw = localStorage.getItem("cc.ewns");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function signOut() {
    const supabase = supabaseBrowser();
    broadcastSessionLogout("manual");
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  useEffect(() => {
    const supabase = supabaseBrowser();
    let active = true;

    async function loadAccess() {
      try {
        const user = await getRequiredUser(supabase);
        const { data, error } = await (supabase as any).from("profiles")
          .select("account_status,subscription_status,is_admin_unlimited,early_access_requested_at,early_access_request_status")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (!active) return;

        const accountStatus = normaliseAccountAccessStatus(data?.account_status);
        const allowed =
          Boolean(data?.is_admin_unlimited) ||
          isAccountApproved(accountStatus) ||
          isSubscriptionActive(data?.subscription_status);

        setAccessGate({
          loaded: true,
          allowed,
          requested: Boolean(data?.early_access_requested_at) || data?.early_access_request_status === "requested",
          email: user.email ?? null,
          accountStatus,
          error: null,
        });
      } catch (e: unknown) {
        if (isAuthErrorMessage(errorMessage(e))) {
          window.location.href = "/login";
          return;
        }
        console.error("Failed to check account access", e);
        if (active) {
          setAccessGate({
            loaded: true,
            allowed: false,
            requested: false,
            email: null,
            accountStatus: null,
            error: "We could not verify this account. Please request access or try again shortly.",
          });
        }
      }
    }

    void loadAccess();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        window.location.href = "/login";
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        void loadAccess();
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function requestAccess() {
    setRequestBusy(true);
    setRequestMessage(null);
    setRequestError(null);

    try {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Please sign in again before requesting access.");

      const res = await fetch("/api/request-access", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note: requestNote }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Access request failed.");

      if (payload?.alreadyActive) {
        setAccessGate((prev) => ({ ...prev, loaded: true, allowed: true, requested: true }));
        setRequestMessage("Your account is already active. Loading the app now.");
        window.location.reload();
        return;
      }

      setAccessGate((prev) => ({ ...prev, requested: true }));
      setRequestMessage("Access request received. We will review it and activate verified trial users manually.");
    } catch (e: unknown) {
      setRequestError(e instanceof Error ? e.message : "Access request failed.");
    } finally {
      setRequestBusy(false);
    }
  }

  useEffect(() => {
    if (!accessGate.loaded || !accessGate.allowed) {
      setEvents([]);
      setEwns([]);
      setLoadingEvents(false);
      return;
    }

    const supabase = supabaseBrowser();
    let active = true;

    async function loadEvents() {
      setLoadingEvents(true);

      try {
        const user = await getRequiredUser(supabase);
        let eventsResult = await (supabase as any).from("events")
          .select("id,title,status,created_at,is_demo")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (eventsResult.error && isOptionalSchemaError(eventsResult.error)) {
          eventsResult = await (supabase as any).from("events")
            .select("id,title,status,created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
        }

        if (eventsResult.error) throw eventsResult.error;

        let ewnsResult = await (supabase as any).from("ewns")
          .select("id,title,status,created_at,is_demo")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (ewnsResult.error && isOptionalSchemaError(ewnsResult.error)) {
          ewnsResult = await (supabase as any).from("ewns")
            .select("id,title,status,created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
        }

        if (!active) return;
        setEvents(demoFilteredRows((eventsResult.data ?? []) as EventRow[], demoMode));
        const localEwns = demoMode ? [] : readLocalEwns();
        setEwns(ewnsResult.error ? localEwns : [...demoFilteredRows((ewnsResult.data ?? []) as EwnRow[], demoMode), ...localEwns]);
      } catch (e: unknown) {
        if (isAuthErrorMessage(errorMessage(e))) {
          window.location.href = "/login";
          return;
        }
        console.error("Failed to load sidebar events", e);
        if (active) {
          setEvents([]);
          setEwns(readLocalEwns());
        }
      } finally {
        if (active) setLoadingEvents(false);
      }
    }

    loadEvents();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        window.location.href = "/login";
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        void loadEvents();
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [accessGate.loaded, accessGate.allowed, demoMode]);

  const activeEventId = useMemo(() => {
    const m = pathname?.match(/\/app\/event\/([^\/]+)/);
    const id = m?.[1] ?? null;
    if (!id) return null;
    return isUuid(id) ? id : null;
  }, [pathname]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return events;
    return events.filter((e) => (e.title ?? "").toLowerCase().includes(s));
  }, [events, q]);

  const isAppHome = pathname === "/app";
  const isCeRegister = pathname === "/app" && new URLSearchParams(urlSearch).get("register") === "1";
  const isNew = pathname === "/app/new";
  const isProjects = pathname?.startsWith("/app/projects") ?? false;
  const isNewEwn = pathname === "/app/ewns/new";
  const isEwns = pathname?.startsWith("/app/ewns") ?? false;
  const isRates = pathname?.startsWith("/app/rates") ?? false;
  const isSettings = pathname?.startsWith("/app/settings") ?? false;
  const isCompanyProfile = pathname?.startsWith("/app/company-profile") ?? false;

  const sideW = collapsed ? 72 : 280;

  if (!accessGate.loaded) {
    return (
      <main style={{ minHeight: "100vh", background: c.bg, color: c.text, display: "grid", placeItems: "center", padding: 24 }}>
        <SessionManager />
        <div style={{ border: `1px solid ${c.border}`, background: "#ffffff", borderRadius: 24, padding: 28, boxShadow: "0 18px 55px rgba(15,23,42,0.06)" }}>
          <div style={{ fontWeight: 900, fontSize: 20 }}>Checking account access…</div>
          <div style={{ marginTop: 8, color: c.sub, fontWeight: 650 }}>This only takes a moment.</div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: c.bg, color: c.text }}>
      <SessionManager />
      {/* Sidebar: flush left */}
      <aside
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          width: sideW,
          background: "#ffffff",
          borderRight: `1px solid ${c.border}`,
          padding: 10,
          zIndex: 30,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          overflow: "hidden",
          transition: "width 180ms ease",
          overscrollBehavior: "contain",
        }}
      >
        {/* CLEAN header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            gap: 10,
            padding: "6px 4px",
          }}
        >
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
            onMouseEnter={() => setLogoHover(true)}
            onMouseLeave={() => setLogoHover(false)}
              style={{
                width: 46,
                height: 46,
                borderRadius: 16,
                border: `1px solid ${c.border}`,
                background: logoHover ? c.black : "#ffffff",
                color: logoHover ? c.blackContrast : c.text,
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                cursor: "pointer",
                transition: "background 160ms ease, color 160ms ease, border-color 160ms ease",
              }}
            >
              {logoHover ? (
                <Icon name="expand" />
              ) : (
                <img
                  src="/brand/ccp-mark-black-transparent.png"
                  alt=""
                  aria-hidden
                  style={{ width: 24, height: 24, objectFit: "contain", display: "block" }}
                />
              )}
            </button>
          ) : (
            <>
              <Link
                href="/app"
                title="Commercial Co-Pilot"
                onMouseEnter={(ev) => {
                  (ev.currentTarget as HTMLAnchorElement).style.background = c.hoverBg;
                }}
                onMouseLeave={(ev) => {
                  (ev.currentTarget as HTMLAnchorElement).style.background = "transparent";
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textDecoration: "none",
                  color: c.text,
                  minWidth: 0,
                  padding: "4px 6px",
                  borderRadius: 16,
                  transition: "background 140ms ease",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    border: `1px solid ${c.border}`,
                    background: "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    flex: "0 0 auto",
                  }}
                >
                  <img
                    src="/brand/ccp-mark-black-transparent.png"
                    alt=""
                    aria-hidden
                    style={{ width: 21, height: 21, objectFit: "contain", display: "block" }}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0, lineHeight: 1.12 }}>Commercial</div>
                  <div style={{ fontSize: 11, color: c.sub, fontWeight: 700, lineHeight: 1.1 }}>Co-Pilot</div>
                </div>
              </Link>

              <button
                onClick={toggleCollapsed}
                title="Collapse sidebar"
                onMouseEnter={(ev) => {
                  (ev.currentTarget as HTMLButtonElement).style.background = c.hoverBg;
                }}
                onMouseLeave={(ev) => {
                  (ev.currentTarget as HTMLButtonElement).style.background = c.panelSolid;
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 12,
                  border: `1px solid ${c.border}`,
                  background: c.panelSolid,
                  color: c.text,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  flex: "0 0 auto",
                  transition: "background 140ms ease, border-color 140ms ease",
                }}
              >
                <Icon name="collapse" />
              </button>
            </>
          )}
        </div>

        {/* Primary actions */}
        <div style={{ display: "grid", gap: 6 }}>
          <Row href="/app" label="Dashboard" icon={<Icon name="home" />} active={isAppHome && !isCeRegister} collapsed={collapsed} />
          <Row href="/app/projects" label="Projects" icon={<Icon name="projects" />} active={isProjects} collapsed={collapsed} />
          <Row href={demoMode ? "/app" : "/app/new"} label="New CE" icon={<Icon name="plus" />} active={isNew} collapsed={collapsed} />
          <Row href={demoMode ? "/app" : "/app/ewns/new"} label="New EWN" icon={<Icon name="warning" />} active={isNewEwn} collapsed={collapsed} />
          <Row href="/app?register=1" label="CE Register" icon={<Icon name="ceRegister" />} active={isCeRegister} collapsed={collapsed} />
          <Row href="/app/ewns" label="EWN Register" icon={<Icon name="ewnRegister" />} active={isEwns && !isNewEwn} collapsed={collapsed} />
          <Row
            href="/app/rates"
            label="Rate cards"
            icon={<Icon name="rates" />}
            active={isRates}
            collapsed={collapsed}
          />
          <Row
            href="/app/company-profile"
            label="Company Profile"
            icon={<Icon name="company" />}
            active={isCompanyProfile}
            collapsed={collapsed}
          />
        </div>

        {/* Search */}
        {!collapsed && (
        <div
          style={{
            marginTop: 4,
            padding: 8,
            borderRadius: 16,
            background: "rgba(255,255,255,0.55)",
            border: `1px solid ${c.border}`,
          }}
        >
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: c.sub,
                  pointerEvents: "none",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Icon name="search" />
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search CEs…"
                style={{
                  width: "100%",
                  padding: "10px 10px 10px 34px",
                  height: 42,
                  borderRadius: 12,
                  border: `1px solid ${c.border}`,
                  outline: "none",
                  background: c.panelSolid,
                  color: c.text,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              />
            </div>
        </div>
        )}

        {/* CE list */}
        {!collapsed && <div className="cc-sidebar-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingRight: 4, minWidth: 0, overscrollBehavior: "contain" }}>
          {!collapsed && (
            <div style={{ display: "flex", justifyContent: "space-between", margin: "10px 6px 8px" }}>
              <div style={{ fontSize: 12, color: c.sub, fontWeight: 700 }}>Your CEs</div>
              <div style={{ fontSize: 12, color: c.sub, fontWeight: 700 }}>{events.length}</div>
            </div>
          )}

          <div style={{ display: "grid", gap: 6 }}>
            {loadingEvents ? (
              <div style={{ color: c.sub, fontWeight: 700, padding: "6px 6px" }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ color: c.sub, fontWeight: 700, padding: "6px 6px" }}>
                {collapsed ? "—" : "No CEs found."}
              </div>
            ) : (
              filtered.map((e) => {
                const active = activeEventId === e.id;
                const title = e.title || "Untitled CE";
                const sub = e.status || "draft";

                return (
                  <Link
                    key={e.id}
                    href={`/app/event/${e.id}`}
                    title={collapsed ? `${title} • ${sub}` : title}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0,
                      minHeight: 58,
                      padding: "10px 12px",
                      borderRadius: 16,
                      textDecoration: "none",
                      color: active ? "#6d4aff" : c.text,
                      background: active ? c.activeBg : "transparent",
                      minWidth: 0,
                      maxWidth: "100%",
                      overflow: "hidden",
                      border: `1px solid ${active ? "#ddd4ff" : "transparent"}`,
                      transition: "background 140ms ease, border-color 140ms ease",
                    }}
                    onMouseEnter={(ev) => {
                      if (active) return;
                      ev.currentTarget.style.background = c.hoverBg;
                    }}
                    onMouseLeave={(ev) => {
                      ev.currentTarget.style.background = active ? c.activeBg : "transparent";
                    }}
                  >
                    {!collapsed && (
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            lineHeight: 1.1,
                          }}
                        >
                          {title}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                          <span style={{ fontSize: 11, color: active ? "#6d4aff" : c.sub, fontWeight: 700 }}>{sub}</span>
                          {e.created_at ? (
                            <span style={{ fontSize: 11, color: active ? "#6d4aff" : c.sub }}>
                              {new Date(e.created_at).toLocaleDateString()}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", margin: "18px 6px 8px" }}>
            <div style={{ fontSize: 12, color: c.sub, fontWeight: 700 }}>EWNs</div>
            <div style={{ fontSize: 12, color: c.sub, fontWeight: 700 }}>{ewns.length}</div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            {ewns.length === 0 ? (
              <div style={{ color: c.sub, fontWeight: 700, padding: "6px 6px", fontSize: 12 }}>No EWNs logged.</div>
            ) : (
              ewns.slice(0, 5).map((e) => {
                const active = pathname === "/app/ewns" && new URLSearchParams(urlSearch).get("ewn") === e.id;
                const title = e.title || "Untitled EWN";
                const sub = e.status || "open";
                return (
                  <Link
                    key={e.id}
                    href={`/app/ewns?ewn=${e.id}`}
                    title={title}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0,
                      minHeight: 56,
                      padding: "10px 12px",
                      borderRadius: 16,
                      textDecoration: "none",
                      color: active ? "#6d4aff" : c.text,
                      background: active ? c.activeBg : "transparent",
                      minWidth: 0,
                      maxWidth: "100%",
                      overflow: "hidden",
                      border: `1px solid ${active ? "#ddd4ff" : "transparent"}`,
                      transition: "background 140ms ease, border-color 140ms ease",
                    }}
                    onMouseEnter={(ev) => {
                      if (active) return;
                      ev.currentTarget.style.background = c.hoverBg;
                    }}
                    onMouseLeave={(ev) => {
                      ev.currentTarget.style.background = active ? c.activeBg : "transparent";
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.1 }}>
                        {title}
                      </div>
                      <div style={{ fontSize: 11, color: active ? "#6d4aff" : c.sub, fontWeight: 700, marginTop: 4 }}>{sub}</div>
                    </div>
                  </Link>
                );
              })
            )}
            <Link href="/app/ewns" style={{ color: c.sub, fontSize: 12, fontWeight: 800, textDecoration: "none", padding: "7px 8px" }}>
              View EWN register →
            </Link>
          </div>
        </div>}

        {/* Footer */}
        <div style={{ marginTop: "auto", display: "grid", gap: 8 }}>
          <Row
            href="/app/settings"
            label="Settings"
            icon={<Icon name="settings" />}
            active={isSettings}
            collapsed={collapsed}
          />

          {!collapsed && (
            <button
              onClick={signOut}
              title="Sign out"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "11px 12px",
                borderRadius: 16,
                border: `1px solid ${c.border}`,
                background: c.panelSolid,
                color: c.text,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: c.sub, display: "grid", placeItems: "center" }}>
                  <Icon name="logout" />
                </span>
                Sign out
              </span>
            </button>
          )}
        </div>
      </aside>

      {/* Main content shifted right */}
      <div style={{ marginLeft: sideW, transition: "margin-left 180ms ease" }}>
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
              maxWidth: "none",
              margin: "0 auto",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              color: c.text,
            }}
          >
            <div style={{ minWidth: 0 }}>
              {isAppHome && !isCeRegister ? (
                <>
                  <div style={{ fontWeight: 800, letterSpacing: 0, color: c.black, fontSize: 18, lineHeight: 1.15 }}>
                    Good morning, Jack
                  </div>
                  <div style={{ marginTop: 2, color: c.sub, fontSize: 12, fontWeight: 650, lineHeight: 1.25 }}>
                    Here&apos;s your commercial recovery position.
                  </div>
                </>
              ) : (
                <div style={{ fontWeight: 700, letterSpacing: 0, color: c.black }}>
                  Commercial Co-Pilot
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {accessGate.allowed ? (
                <>
                  <ForceGenerateToggle />
                  <button
                    type="button"
                    onClick={demoMode ? disableDemoMode : enableDemoMode}
                    aria-pressed={demoMode}
                    disabled={demoLoading}
                    style={{
                      height: 48,
                      padding: "0 14px",
                      borderRadius: 16,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      border: demoMode ? "1px solid #d8c8ff" : `1px solid ${c.border}`,
                      background: demoMode ? "#f5f0ff" : c.panelSolid,
                      color: demoMode ? "#6d4aff" : c.text,
                      fontWeight: 800,
                      cursor: demoLoading ? "wait" : "pointer",
                      opacity: demoLoading ? 0.72 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 99,
                        background: demoMode ? "#6d4aff" : "#94a3b8",
                        boxShadow: demoMode ? "0 0 0 5px rgba(109, 74, 255, 0.12)" : "none",
                      }}
                    />
                    {demoLoading ? "Loading demo" : demoMode ? "Demo on" : "Demo"}
                  </button>
                  <Link
                    href={demoMode ? "/app" : "/app/new"}
                    aria-disabled={demoMode}
                    title={demoMode ? "Creation is disabled in demo mode" : undefined}
                    style={{
                      height: 48,
                      padding: "0 16px",
                      borderRadius: 16,
                      display: "inline-flex",
                      alignItems: "center",
                      border: demoMode ? `1px solid ${c.border}` : `1px solid ${c.black}`,
                      background: demoMode ? "#f3f4f6" : c.black,
                      fontWeight: 700,
                      color: demoMode ? c.sub : c.blackContrast,
                      textDecoration: "none",
                      cursor: demoMode ? "not-allowed" : "pointer",
                    }}
                  >
                    + New CE
                  </Link>
                  <Link
                    href={demoMode ? "/app" : "/app/ewns/new"}
                    aria-disabled={demoMode}
                    title={demoMode ? "Creation is disabled in demo mode" : undefined}
                    style={{
                      height: 48,
                      padding: "0 16px",
                      borderRadius: 16,
                      display: "inline-flex",
                      alignItems: "center",
                      border: `1px solid ${c.border}`,
                      background: demoMode ? "#f3f4f6" : c.panelSolid,
                      fontWeight: 700,
                      color: demoMode ? c.sub : c.text,
                      textDecoration: "none",
                      cursor: demoMode ? "not-allowed" : "pointer",
                    }}
                  >
                    + New EWN
                  </Link>
                </>
              ) : (
                <span
                  style={{
                    height: 44,
                    padding: "0 14px",
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    border: "1px solid #ddd4ff",
                    background: "#f3efff",
                    color: "#6d4aff",
                    fontWeight: 850,
                    whiteSpace: "nowrap",
                  }}
                >
                  Early access pending
                </span>
              )}
              <AccountMenu />
            </div>
          </div>
        </header>

        <section className="app-workspace" style={{ maxWidth: "none", margin: "0 auto", padding: "18px 24px 56px" }}>
          {demoSeedStatus === "error" && demoSeedMessage ? (
            <div
              role="alert"
              style={{
                margin: "0 0 14px",
                borderRadius: 16,
                border: "1px solid #fecaca",
                background: "#fff1f2",
                color: "#991b1b",
                padding: "14px 16px",
                fontWeight: 800,
              }}
            >
              {demoSeedMessage}
            </div>
          ) : null}
          {demoMode ? <DemoReadOnlyBanner onExitDemo={disableDemoMode} /> : null}
          {accessGate.allowed ? (
            demoMode && (isNew || isNewEwn) ? <DemoCreateBlocked /> : children
          ) : (
            <EarlyAccessScreen
              email={accessGate.email}
              requested={accessGate.requested}
              accountStatus={accessGate.accountStatus}
              requestNote={requestNote}
              requestBusy={requestBusy}
              requestMessage={requestMessage}
              requestError={requestError || accessGate.error}
              onRequestNoteChange={setRequestNote}
              onRequestAccess={requestAccess}
            />
          )}
        </section>
      </div>
      {!demoMode ? <FloatingOnboardingHelper /> : null}
      {demoLoading && (demoMode || demoSeedStatus === "seeding" || demoSeedStatus === "ready") ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "grid",
            placeItems: "center",
            background: "rgba(15, 23, 42, 0.28)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              width: "min(520px, calc(100vw - 40px))",
              borderRadius: 24,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              padding: 28,
              boxShadow: "0 30px 80px rgba(15, 23, 42, 0.18)",
              color: c.text,
              textAlign: "center",
            }}
          >
            <div
              style={{
                margin: "0 auto 18px",
                width: 56,
                height: 56,
                borderRadius: 18,
                display: "grid",
                placeItems: "center",
                background: "#f5f0ff",
                color: "#6d4aff",
                fontSize: 26,
                fontWeight: 900,
              }}
            >
              {demoCountdown}
            </div>
            <h2 style={{ margin: 0, color: c.black, fontSize: 28, lineHeight: 1.1, letterSpacing: 0 }}>
              {demoSeedStatus === "ready" ? "Demo data ready" : "Populating demo data"}
            </h2>
            <p style={{ margin: "12px 0 0", color: c.sub, fontSize: 16, lineHeight: 1.55, fontWeight: 650 }}>
              {demoSeedMessage ||
                "Building a sample recovery workspace with demo CEs, EWNs, project values and payment actions. Demo edits are temporary and pack generation downloads a pre-generated CE, so no credits are used."}
            </p>
            <div
              style={{
                marginTop: 22,
                height: 8,
                borderRadius: 999,
                background: "#eef2f7",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${((10 - demoCountdown) / 10) * 100}%`,
                  background: "linear-gradient(90deg, #6d4aff, #17a673)",
                  transition: "width 250ms ease",
                }}
              />
            </div>
            <p style={{ margin: "14px 0 0", color: c.sub, fontWeight: 800 }}>
              {demoCountdown} seconds remaining
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
