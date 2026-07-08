"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";
import AccountMenu from "@/components/AccountMenu";
import ForceGenerateToggle from "@/components/ForceGenerateToggle";
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
};

type EwnRow = {
  id: string;
  title: string;
  status: string | null;
  created_at?: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function Icon({
  name,
}: {
  name:
    | "home"
    | "plus"
    | "search"
    | "file"
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
        gap: 10,
        minHeight: 42,
        padding: "9px 11px",
        borderRadius: 14,
        textDecoration: "none",
        color: c.text,
        background: active ? c.activeBg : "transparent",
        transition: "background 140ms ease, color 140ms ease, border-color 140ms ease",
        border: `1px solid ${active ? c.border : "transparent"}`,
      }}
    >
      {icon ? <span style={{ width: 20, height: 20, display: "grid", placeItems: "center", color: c.sub, flex: "0 0 20px" }}>{icon}</span> : null}
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [ewns, setEwns] = useState<EwnRow[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [q, setQ] = useState("");

  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [logoHover, setLogoHover] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem("cc.sidebar.collapsed");
      if (v === "1") setCollapsed(true);
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((p) => {
      const next = !p;
      try {
        localStorage.setItem("cc.sidebar.collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
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

    async function loadEvents() {
      setLoadingEvents(true);

      try {
        const user = await getRequiredUser(supabase);
        const { data: eventsData, error } = await (supabase as any).from("events")
          .select("id,title,status,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const { data: ewnsData, error: ewnsError } = await (supabase as any).from("ewns")
          .select("id,title,status,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!active) return;
        setEvents((eventsData ?? []) as EventRow[]);
        setEwns(ewnsError ? readLocalEwns() : ([...((ewnsData ?? []) as EwnRow[]), ...readLocalEwns()]));
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
  }, []);

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
  const isNew = pathname === "/app/new";
  const isProjects = pathname?.startsWith("/app/projects") ?? false;
  const isNewEwn = pathname === "/app/ewns/new";
  const isEwns = pathname?.startsWith("/app/ewns") ?? false;
  const isRates = pathname?.startsWith("/app/rates") ?? false;
  const isSettings = pathname?.startsWith("/app/settings") ?? false;
  const isCompanyProfile = pathname?.startsWith("/app/company-profile") ?? false;

  const sideW = collapsed ? 72 : 280;

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
          background: c.panel,
          backdropFilter: "blur(10px)",
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
                  src="/brand/ccp-mark-navy-transparent.png"
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
                    src="/brand/ccp-mark-navy-transparent.png"
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
          <Row href="/app" label="Dashboard" icon={<Icon name="home" />} active={isAppHome} collapsed={collapsed} />
          <Row href="/app/projects" label="Projects" icon={<Icon name="projects" />} active={isProjects} collapsed={collapsed} />
          <Row href="/app/new" label="New CE" icon={<Icon name="plus" />} active={isNew} collapsed={collapsed} />
          <Row href="/app/ewns/new" label="New EWN" icon={<Icon name="warning" />} active={isNewEwn} collapsed={collapsed} />
          <Row href="/app/ewns" label="EWN Register" icon={<Icon name="file" />} active={isEwns && !isNewEwn} collapsed={collapsed} />
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
                      color: c.text,
                      background: active ? c.activeBg : "transparent",
                      minWidth: 0,
                      maxWidth: "100%",
                      overflow: "hidden",
                      border: `1px solid ${active ? c.border : "transparent"}`,
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
                          <span style={{ fontSize: 11, color: c.sub, fontWeight: 700 }}>{sub}</span>
                          {e.created_at ? (
                            <span style={{ fontSize: 11, color: c.sub }}>
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
                const active = pathname === `/app/ewns?ewn=${e.id}`;
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
                      color: c.text,
                      background: active ? c.activeBg : "transparent",
                      minWidth: 0,
                      maxWidth: "100%",
                      overflow: "hidden",
                      border: `1px solid ${active ? c.border : "transparent"}`,
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
                      <div style={{ fontSize: 11, color: c.sub, fontWeight: 700, marginTop: 4 }}>{sub}</div>
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
            background: c.topBg,
            backdropFilter: "blur(10px)",
            borderBottom: `1px solid ${c.border}`,
            zIndex: 10,
          }}
        >
          <div
            style={{
              maxWidth: 1240,
              margin: "0 auto",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              color: c.text,
            }}
          >
            <div style={{ fontWeight: 700, letterSpacing: 0, color: c.black }}>
              Commercial Co-Pilot
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ForceGenerateToggle />
              <Link
                href="/app/new"
                style={{
                  height: 48,
                  padding: "0 16px",
                  borderRadius: 16,
                  display: "inline-flex",
                  alignItems: "center",
                  border: `1px solid ${c.black}`,
                  background: c.black,
                  fontWeight: 700,
                  color: c.blackContrast,
                  textDecoration: "none",
                }}
              >
                + New CE
              </Link>
              <AccountMenu />
            </div>
          </div>
        </header>

        <section style={{ maxWidth: 1240, margin: "0 auto", padding: "18px 16px 56px" }}>
          {children}
        </section>
      </div>
    </main>
  );
}
