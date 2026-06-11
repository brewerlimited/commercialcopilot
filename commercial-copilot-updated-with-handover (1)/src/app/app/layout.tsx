"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import AccountMenu from "@/components/AccountMenu";

const c = {
  bg: "#f6f7fb",
  panel: "rgba(255,255,255,0.78)",
  panelSolid: "#ffffff",
  border: "rgba(15,23,42,0.08)",
  text: "#0f172a",
  sub: "#475569",
  black: "#111827",
  activeBg: "rgba(17,24,39,0.08)",
  hoverBg: "rgba(17,24,39,0.05)",
  topBg: "rgba(246,247,251,0.92)",
};

type EventRow = {
  id: string;
  title: string;
  status: string | null;
  created_at?: string;
};

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
    | "rates";
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
  icon: React.ReactNode;
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
        (ev.currentTarget as HTMLAnchorElement).style.transform = "translateX(1px)";
      }}
      onMouseLeave={(ev) => {
        (ev.currentTarget as HTMLAnchorElement).style.background = active ? c.activeBg : "transparent";
        (ev.currentTarget as HTMLAnchorElement).style.transform = "translateX(0)";
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 10px",
        borderRadius: 14,
        textDecoration: "none",
        color: c.text,
        background: active ? c.activeBg : "transparent",
        transition: "background 140ms ease, transform 140ms ease, color 140ms ease, border-color 140ms ease",
        border: `1px solid ${active ? c.border : "transparent"}`,
      }}
    >
      <span style={{ display: "grid", placeItems: "center", color: c.sub }}>{icon}</span>
      {!collapsed && (
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: 500,
          }}
        >
          {label}
        </span>
      )}
      {!collapsed && right ? (
        <span style={{ color: c.sub, fontSize: 12, fontWeight: 900 }}>{right}</span>
      ) : null}
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [q, setQ] = useState("");

  const [collapsed, setCollapsed] = useState<boolean>(false);

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

  async function signOut() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  useEffect(() => {
    (async () => {
      setLoadingEvents(true);

      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();

      if (!data.session?.user) {
        window.location.href = "/login";
        return;
      }

      // If your table doesn't have status, switch to: "id,title,created_at"
      const { data: eventsData } = await supabase
        .from("events")
        .select("id,title,status,created_at")
        .order("created_at", { ascending: false });

      setEvents((eventsData ?? []) as any);
      setLoadingEvents(false);
    })();
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
  const isRates = pathname?.startsWith("/app/rates") ?? false;

  const sideW = collapsed ? 72 : 280;

  return (
    <main style={{ minHeight: "100vh", background: c.bg, color: c.text }}>
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
        }}
      >
        {/* CLEAN header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "6px 4px",
          }}
        >
          <Link
            href="/app"
            title="Commercial Co-Pilot"
            onMouseEnter={(ev) => {
              (ev.currentTarget as HTMLAnchorElement).style.background = c.hoverBg;
        (ev.currentTarget as HTMLAnchorElement).style.transform = "translateX(1px)";
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
              borderRadius: 14,
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
                background: c.panelSolid,
                display: "grid",
                placeItems: "center",
                fontWeight: 950,
                color: c.text,
                flex: "0 0 auto",
              }}
            >
              CC
            </div>
          </Link>

          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onMouseEnter={(ev) => {
              (ev.currentTarget as HTMLButtonElement).style.background = c.hoverBg;
              (ev.currentTarget as HTMLButtonElement).style.transform = "translateX(1px)";
            }}
            onMouseLeave={(ev) => {
              (ev.currentTarget as HTMLButtonElement).style.background = c.panelSolid;
              (ev.currentTarget as HTMLButtonElement).style.transform = "translateX(0)";
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
              transition: "background 140ms ease, border-color 140ms ease, transform 140ms ease",
            }}
          >
            <Icon name={collapsed ? "expand" : "collapse"} />
          </button>
        </div>

        {/* Primary actions */}
        <div style={{ display: "grid", gap: 6 }}>
          <Row href="/app" label="Dashboard" icon={<Icon name="home" />} active={isAppHome} collapsed={collapsed} />
          <Row href="/app/new" label="New CE" icon={<Icon name="plus" />} active={isNew} collapsed={collapsed} />
          <Row
            href="/app/rates"
            label="Rate cards"
            icon={<Icon name="rates" />}
            active={isRates}
            collapsed={collapsed}
          />
        </div>

        {/* Search */}
        {!collapsed && (
        <div
          style={{
            marginTop: 4,
            padding: 8,
            borderRadius: 14,
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
                  borderRadius: 12,
                  border: `1px solid ${c.border}`,
                  outline: "none",
                  background: c.panelSolid,
                  color: c.text,
                  fontWeight: 900,
                }}
              />
            </div>
        </div>
        )}

        {/* CE list */}
        {!collapsed && <div style={{ flex: 1, overflow: "auto", paddingRight: 2 }}>
          {!collapsed && (
            <div style={{ display: "flex", justifyContent: "space-between", margin: "10px 6px 8px" }}>
              <div style={{ fontSize: 12, color: c.sub, fontWeight: 950 }}>Your CEs</div>
              <div style={{ fontSize: 12, color: c.sub, fontWeight: 900 }}>{events.length}</div>
            </div>
          )}

          <div style={{ display: "grid", gap: 6 }}>
            {loadingEvents ? (
              <div style={{ color: c.sub, fontWeight: 850, padding: "6px 6px" }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ color: c.sub, fontWeight: 850, padding: "6px 6px" }}>
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
                      gap: 10,
                      padding: "10px 10px",
                      borderRadius: 14,
                      textDecoration: "none",
                      color: c.text,
                      background: active ? c.activeBg : "transparent",
                    }}
                    onMouseEnter={(ev) => {
                      if (active) return;
                      (ev.currentTarget as any).style.background = c.hoverBg;
        (ev.currentTarget as HTMLAnchorElement).style.transform = "translateX(1px)";
                    }}
                    onMouseLeave={(ev) => {
                      (ev.currentTarget as any).style.background = active ? c.activeBg : "transparent";
                      (ev.currentTarget as any).style.transform = "translateX(0)";
                    }}
                  >
                    <span style={{ color: c.sub, display: "grid", placeItems: "center" }}>
                      <Icon name="file" />
                    </span>

                    {!collapsed && (
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 950,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            lineHeight: 1.1,
                          }}
                        >
                          {title}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                          <span style={{ fontSize: 12, color: c.sub, fontWeight: 900 }}>{sub}</span>
                          {e.created_at ? (
                            <span style={{ fontSize: 12, color: c.sub }}>
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
        </div>}

        {/* Footer */}
        {!collapsed && <button
          onClick={signOut}
          title="Sign out"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            gap: 10,
            padding: "10px 10px",
            borderRadius: 14,
            border: `1px solid ${c.border}`,
            background: c.panelSolid,
            color: c.text,
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: c.sub, display: "grid", placeItems: "center" }}>
              <Icon name="logout" />
            </span>
            {!collapsed ? "Sign out" : null}
          </span>
        </button>}
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
              maxWidth: 1200,
              margin: "0 auto",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              color: c.text,
            }}
          >
            <div style={{ fontWeight: 950, letterSpacing: -0.2, color: c.black }}>
              Commercial Co-Pilot
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                  fontWeight: 950,
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                + New CE
              </Link>
              <AccountMenu />
            </div>
          </div>
        </header>

        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 16px 56px" }}>
          {children}
        </section>
      </div>
    </main>
  );
}
