"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

type EventRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at?: string | null;
  contract_type?: string | null;
};

const c = {
  bg: "#f6f7fb",
  card: "#ffffff",
  border: "#e5e7eb",
  sub: "#475569",
  text: "#111827",
  black: "#111827",
  soft: "#f8fafc",
  greenBg: "#ecfdf5",
  greenBd: "#a7f3d0",
  greenTx: "#065f46",
  amberBg: "#fffbeb",
  amberBd: "#fde68a",
  amberTx: "#92400e",
  blueBg: "#eff6ff",
  blueBd: "#bfdbfe",
  blueTx: "#1d4ed8",
};

function niceDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normaliseStatus(status?: string | null) {
  return (status || "draft").toLowerCase();
}

function statusTone(status?: string | null) {
  const s = normaliseStatus(status);

  if (s === "ready" || s === "complete") {
    return {
      bg: c.greenBg,
      bd: c.greenBd,
      tx: c.greenTx,
      label: status || "Ready",
    };
  }

  if (s === "submitted") {
    return {
      bg: c.blueBg,
      bd: c.blueBd,
      tx: c.blueTx,
      label: status || "Submitted",
    };
  }

  if (s === "review") {
    return {
      bg: c.amberBg,
      bd: c.amberBd,
      tx: c.amberTx,
      label: status || "Review",
    };
  }

  return {
    bg: "#fff",
    bd: c.border,
    tx: c.sub,
    label: status || "Draft",
  };
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: 18,
        padding: 18,
      }}
    >
      <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: c.text,
            letterSpacing: -0.2,
          }}
        >
          {title}
        </div>

        {hint ? (
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: c.sub,
              maxWidth: 760,
            }}
          >
            {hint}
          </div>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "green" | "blue" | "amber";
}) {
  const toneMap =
    tone === "green"
      ? { bg: c.greenBg, bd: c.greenBd }
      : tone === "blue"
      ? { bg: c.blueBg, bd: c.blueBd }
      : tone === "amber"
      ? { bg: c.amberBg, bd: c.amberBd }
      : { bg: "#fff", bd: c.border };

  return (
    <div
      style={{
        background: toneMap.bg,
        border: `1px solid ${toneMap.bd}`,
        borderRadius: 16,
        padding: 16,
        minHeight: 96,
        display: "grid",
        alignContent: "space-between",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: c.sub,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: c.text,
          letterSpacing: -0.6,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function AppHome() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSavingId, setRenameSavingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();

      if (!data.session?.user) {
        window.location.href = "/login";
        return;
      }

      const { data: eventsData } = await supabase
        .from("events")
        .select("id,title,status,created_at,contract_type")
        .order("created_at", { ascending: false });

      if (eventsData) setEvents(eventsData as EventRow[]);
      setLoading(false);
    })();
  }, []);

  const totals = useMemo(() => {
    const total = events.length;
    const drafts = events.filter((e) => normaliseStatus(e.status) === "draft").length;
    const ready = events.filter((e) => {
      const s = normaliseStatus(e.status);
      return s === "ready" || s === "complete";
    }).length;
    const inReview = events.filter((e) => normaliseStatus(e.status) === "review").length;

    return { total, drafts, ready, inReview };
  }, [events]);

  const latestFive = useMemo(() => events.slice(0, 5), [events]);

  function startRename(event: EventRow) {
    setRenamingId(event.id);
    setRenameValue(event.title || "");
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  async function saveRename(eventId: string) {
    const nextTitle = renameValue.trim();
    if (!nextTitle) return;

    try {
      setRenameSavingId(eventId);
      const supabase = supabaseBrowser();
      const { error } = await supabase.from("events").update({ title: nextTitle }).eq("id", eventId);
      if (error) throw error;
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, title: nextTitle } : e)));
      cancelRename();
    } catch (err) {
      console.error("Failed to rename CE", err);
    } finally {
      setRenameSavingId(null);
    }
  }

  return (
    <div style={{ background: c.bg, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <Card
            title="Dashboard"
            hint="Track live CE drafts, jump back into active items, and keep the workflow moving."
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 360px",
                gap: 18,
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  minHeight: "100%",
                  paddingTop: 2,
                }}
              >
                <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      color: c.text,
                      letterSpacing: -0.8,
                      lineHeight: 1.08,
                      maxWidth: 720,
                    }}
                  >
                    Structured CE drafting with deterministic cost build-up.
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: c.sub,
                      maxWidth: 760,
                    }}
                  >
                    Start a new CE, continue an active draft, or return to the latest items already in progress.
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                    <Link href="/app/new" style={{ textDecoration: "none" }}>
                      <button
                        style={{
                          height: 48,
                          padding: "0 16px",
                          borderRadius: 16,
                          border: `1px solid ${c.black}`,
                          background: c.black,
                          color: "#fff",
                          fontWeight: 900,
                          fontSize: 14,
                          cursor: "pointer",
                        }}
                      >
                        + New CE
                      </button>
                    </Link>

                    <Link href="/app/rates" style={{ textDecoration: "none" }}>
                      <button
                        style={{
                          height: 48,
                          padding: "0 16px",
                          borderRadius: 16,
                          border: `1px solid ${c.border}`,
                          background: "#fff",
                          color: c.text,
                          fontWeight: 800,
                          fontSize: 14,
                          cursor: "pointer",
                        }}
                      >
                        Open rate cards
                      </button>
                    </Link>
                  </div>
                </div>
              </div>

              <div
                style={{
                  border: `1px solid ${c.border}`,
                  borderRadius: 16,
                  background: c.soft,
                  padding: 16,
                  display: "grid",
                  gap: 10,
                  alignSelf: "stretch",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: c.text }}>Current focus</div>

                <div style={{ fontSize: 13, color: c.sub, lineHeight: 1.55 }}>
                  Build new CEs consistently, keep pricing deterministic, and push active drafts through to review.
                </div>

                <div
                  style={{
                    height: 1,
                    background: c.border,
                    margin: "2px 0",
                  }}
                />

                <div style={{ display: "grid", gap: 8, fontSize: 13, color: c.sub }}>
                  <div>• Basis, evidence, resources, prelims and review in one flow</div>
                  <div>• Deterministic totals for resources, prelims and fee</div>
                  <div>• Review stage set up for final quality checks before generation</div>
                </div>
              </div>
            </div>
          </Card>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 16,
            }}
          >
            <StatCard label="Total CEs" value={totals.total} />
            <StatCard label="Drafts" value={totals.drafts} tone="amber" />
            <StatCard label="In review" value={totals.inReview} tone="blue" />
            <StatCard label="Ready / complete" value={totals.ready} tone="green" />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 0.8fr",
              gap: 16,
              alignItems: "start",
            }}
          >
            <Card
              title="Recent CE drafts"
              hint="Jump back into the latest live items without having to rely on the sidebar alone."
            >
              {loading ? (
                <div
                  style={{
                    border: `1px solid ${c.border}`,
                    borderRadius: 16,
                    padding: 14,
                    color: c.sub,
                    background: "#fff",
                  }}
                >
                  Loading drafts…
                </div>
              ) : latestFive.length === 0 ? (
                <div
                  style={{
                    border: `1px dashed ${c.border}`,
                    borderRadius: 16,
                    padding: 18,
                    color: c.sub,
                    background: "#fff",
                  }}
                >
                  No CE drafts yet. Create your first CE to get started.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {latestFive.map((e) => {
                    const tone = statusTone(e.status);
                    const isRenaming = renamingId === e.id;
                    const isSavingRename = renameSavingId === e.id;

                    return (
                      <div
                        key={e.id}
                        style={{
                          border: `1px solid ${c.border}`,
                          borderRadius: 16,
                          padding: 14,
                          background: "#fff",
                          display: "grid",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            {isRenaming ? (
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <input
                                  value={renameValue}
                                  onChange={(evt) => setRenameValue(evt.target.value)}
                                  onKeyDown={(evt) => {
                                    if (evt.key === "Enter") saveRename(e.id);
                                    if (evt.key === "Escape") cancelRename();
                                  }}
                                  autoFocus
                                  style={{
                                    flex: 1,
                                    minWidth: 220,
                                    border: `1px solid ${c.border}`,
                                    borderRadius: 12,
                                    padding: "10px 12px",
                                    fontSize: 14,
                                    fontWeight: 800,
                                  fontSize: 13,
                                    color: c.text,
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => saveRename(e.id)}
                                  disabled={isSavingRename || !renameValue.trim()}
                                  style={{
                                    padding: "10px 12px",
                                    borderRadius: 12,
                                    border: `1px solid ${c.black}`,
                                    background: c.black,
                                    color: "#fff",
                                    fontWeight: 800,
                                    cursor: isSavingRename ? "wait" : "pointer",
                                    opacity: isSavingRename || !renameValue.trim() ? 0.7 : 1,
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelRename}
                                  style={{
                                    padding: "10px 12px",
                                    borderRadius: 12,
                                    border: `1px solid ${c.border}`,
                                    background: "#fff",
                                    color: c.text,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div
                                style={{
                                  fontSize: 16,
                                  fontWeight: 800,
                                  color: c.text,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {e.title || "Untitled CE"}
                              </div>
                            )}

                            <div
                              style={{
                                marginTop: 6,
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{
                                  padding: "5px 8px",
                                  borderRadius: 999,
                                  border: `1px solid ${tone.bd}`,
                                  background: tone.bg,
                                  color: tone.tx,
                                  fontSize: 12,
                                  fontWeight: 800,
                                }}
                              >
                                {tone.label}
                              </span>

                              <span style={{ fontSize: 12, color: c.sub, fontWeight: 700 }}>
                                Created {niceDate(e.created_at)}
                              </span>
                            </div>
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: c.sub,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {e.contract_type
                              ? e.contract_type.replaceAll("_", " ").toUpperCase()
                              : "Contract not set"}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ fontSize: 13, color: c.sub }}>
                            Open this CE and continue the workflow.
                          </div>

                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            {!isRenaming ? (
                              <button
                                type="button"
                                onClick={() => startRename(e)}
                                style={{
                                  padding: "10px 12px",
                                  borderRadius: 12,
                                  border: `1px solid ${c.border}`,
                                  background: "#fff",
                                  color: c.text,
                                  fontWeight: 800,
                                  fontSize: 13,
                                  cursor: "pointer",
                                }}
                              >
                                Rename
                              </button>
                            ) : null}

                            <Link
                              href={`/app/event/${e.id}`}
                              style={{
                                textDecoration: "none",
                                fontSize: 13,
                                fontWeight: 800,
                                color: c.text,
                              }}
                            >
                              Open →
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card
              title="Quick actions"
              hint="Get back into the most useful parts of the system quickly."
            >
              <div style={{ display: "grid", gap: 10 }}>
                <Link href="/app/new" style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      border: `1px solid ${c.border}`,
                      borderRadius: 14,
                      padding: 14,
                      background: "#fff",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: c.text }}>Create new CE</div>
                      <div style={{ fontSize: 12, color: c.sub, marginTop: 4 }}>
                        Start a fresh draft with contract-aware setup.
                      </div>
                    </div>
                    <div style={{ fontWeight: 900, color: c.text }}>→</div>
                  </div>
                </Link>

                <Link href="/app/rates" style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      border: `1px solid ${c.border}`,
                      borderRadius: 14,
                      padding: 14,
                      background: "#fff",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: c.text }}>Manage rate cards</div>
                      <div style={{ fontSize: 12, color: c.sub, marginTop: 4 }}>
                        Keep labour, plant and material libraries tidy.
                      </div>
                    </div>
                    <div style={{ fontWeight: 900, color: c.text }}>→</div>
                  </div>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}