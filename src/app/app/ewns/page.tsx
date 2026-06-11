"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

const c = {
  card: "var(--surface)",
  input: "var(--surface-input)",
  border: "var(--border)",
  sub: "var(--text-muted)",
  text: "var(--foreground)",
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
  soft: "var(--surface-soft)",
  greenBg: "var(--green-bg)",
  greenBorder: "var(--green-border)",
  greenText: "var(--green-text)",
  amberBg: "var(--amber-bg)",
  amberBorder: "var(--amber-border)",
  amberText: "var(--amber-text)",
  blueBg: "var(--blue-bg)",
  blueBorder: "var(--blue-border)",
  blueText: "var(--blue-text)",
};

type EwnRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at?: string | null;
  project_name?: string | null;
  project_id?: string | null;
  main_contractor?: string | null;
  contract_type?: string | null;
  what_happened?: string | null;
  event_date?: string | null;
  location?: string | null;
  impact?: string | null;
  required_action?: string | null;
  evidence_summary?: string | null;
  generated_output?: { narrative?: string } | null;
  converted_event_id?: string | null;
};

function statusStyle(status?: string | null) {
  if (status === "converted") return { bg: c.greenBg, bd: c.greenBorder, tx: c.greenText, label: "Converted" };
  if (status === "submitted") return { bg: c.blueBg, bd: c.blueBorder, tx: c.blueText, label: "Submitted" };
  if (status === "closed") return { bg: c.soft, bd: c.border, tx: c.sub, label: "Closed" };
  return { bg: c.amberBg, bd: c.amberBorder, tx: c.amberText, label: "Open" };
}

function dateText(v?: string | null) {
  if (!v) return "Date not set";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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

function EwnRegisterInner() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("ewn");
  const [ewns, setEwns] = useState<EwnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(selectedId);
  const [projectMoveValues, setProjectMoveValues] = useState<Record<string, string>>({});
  const [projectMoveSavingId, setProjectMoveSavingId] = useState<string | null>(null);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);

  useEffect(() => {
    setOpenId(selectedId);
  }, [selectedId]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const supabase = supabaseBrowser();
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (!user) {
          if (active) setEwns(readLocalEwns());
          return;
        }
        const res = await (supabase as any).from("ewns")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (!active) return;
        setEwns(res.error ? readLocalEwns() : ([...((res.data ?? []) as EwnRow[]), ...readLocalEwns()]));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const sorted = useMemo(() => {
    return [...ewns].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  }, [ewns]);

  function convertHref(e: EwnRow) {
    const params = new URLSearchParams();
    params.set("from_ewn", e.id);
    if (e.project_id) params.set("project_id", e.project_id);
    params.set("title", e.title || "");
    if (e.project_name) params.set("project", e.project_name);
    if (e.main_contractor) params.set("main_contractor", e.main_contractor);
    if (e.contract_type) params.set("contract_type", e.contract_type);
    if (e.what_happened) params.set("what_happened", e.what_happened);
    if (e.impact) params.set("impact", e.impact);
    if (e.required_action) params.set("required_action", e.required_action);
    if (e.evidence_summary) params.set("evidence", e.evidence_summary);
    if (e.location) params.set("location", e.location);
    if (e.event_date) params.set("event_date", e.event_date);
    return `/app/new?${params.toString()}`;
  }

  function openCeHref(e: EwnRow) {
    return e.converted_event_id ? `/app/event/${e.converted_event_id}` : "/app";
  }

  function isConverted(e: EwnRow) {
    return Boolean(e.converted_event_id) || e.status === "converted";
  }

  function statusSelectValue(e: EwnRow) {
    if (e.status === "submitted" || e.status === "closed" || e.status === "converted") return e.status;
    return "open";
  }

  async function updateEwnStatus(ewn: EwnRow, nextStatus: string) {
    if (ewn.status === nextStatus) return;

    const previous = ewn;
    setEwns((prev) => prev.map((item) => (item.id === ewn.id ? { ...item, status: nextStatus } : item)));

    try {
      setStatusSavingId(ewn.id);
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (user) {
        const { error } = await (supabase as any).from("ewns").update({ status: nextStatus }).eq("id", ewn.id).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const local = readLocalEwns().map((item) => (item.id === ewn.id ? { ...item, status: nextStatus } : item));
        localStorage.setItem("cc.ewns", JSON.stringify(local));
      }
    } catch (err) {
      console.error("Failed to update EWN status", err);
      setEwns((prev) => prev.map((item) => (item.id === ewn.id ? previous : item)));
    } finally {
      setStatusSavingId(null);
    }
  }

  async function moveEwnToProject(ewn: EwnRow) {
    const rawValue = Object.prototype.hasOwnProperty.call(projectMoveValues, ewn.id)
      ? projectMoveValues[ewn.id]
      : ewn.project_name ?? "";
    const nextProject = rawValue.trim() || null;
    const previous = ewn;

    setEwns((prev) => prev.map((item) => (item.id === ewn.id ? { ...item, project_name: nextProject } : item)));

    try {
      setProjectMoveSavingId(ewn.id);
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (user) {
        const { error } = await (supabase as any).from("ewns").update({ project_name: nextProject }).eq("id", ewn.id).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const local = readLocalEwns().map((item) => (item.id === ewn.id ? { ...item, project_name: nextProject } : item));
        localStorage.setItem("cc.ewns", JSON.stringify(local));
      }

      setProjectMoveValues((prev) => {
        const next = { ...prev };
        delete next[ewn.id];
        return next;
      });
    } catch (err) {
      console.error("Failed to move EWN project", err);
      setEwns((prev) => prev.map((item) => (item.id === ewn.id ? previous : item)));
    } finally {
      setProjectMoveSavingId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: c.sub, textTransform: "uppercase", letterSpacing: 0.6 }}>Commercial log</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: "6px 0 0", color: c.black }}>EWN Register</h1>
            <p style={{ margin: "8px 0 0", color: c.sub, fontSize: 13, lineHeight: 1.55, maxWidth: 780 }}>
              Keep a light record of early warnings and move them into the CE workflow when there is a recoverable impact.
            </p>
          </div>
          <Link href="/app/ewns/new" style={{ border: `1px solid ${c.black}`, background: c.black, color: c.blackContrast, borderRadius: 14, padding: "12px 14px", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
            + New EWN
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {loading ? (
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 18, padding: 18, color: c.sub, fontWeight: 700 }}>Loading EWNs…</div>
        ) : sorted.length === 0 ? (
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 18, padding: 22 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: c.black }}>No EWNs logged yet</h2>
            <p style={{ margin: "8px 0 0", color: c.sub, fontSize: 13, lineHeight: 1.55 }}>Use EWNs to capture risk early, then convert to CE once impact and entitlement are clearer.</p>
          </div>
        ) : (
          sorted.map((e) => {
            const isOpen = openId === e.id;
            const style = statusStyle(e.status);
            return (
              <div key={e.id} id={`ewn-${e.id}`} style={{ background: c.card, border: `1px solid ${isOpen ? c.black : c.border}`, borderRadius: 20, overflow: "hidden", boxShadow: isOpen ? "0 10px 30px rgba(15,23,42,0.08)" : "none" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "stretch", background: isOpen ? c.soft : c.card, padding: 18 }}>
                  <button onClick={() => setOpenId(isOpen ? null : e.id)} style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", cursor: "pointer", textAlign: "left", padding: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: c.black, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title || "Untitled EWN"}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6, color: c.sub, fontSize: 12, fontWeight: 700 }}>
                          <span>{e.project_name || "Project not set"}</span>
                          <span>•</span>
                          <span>{dateText(e.event_date || e.created_at)}</span>
                          {e.location ? <><span>•</span><span>{e.location}</span></> : null}
                          {e.contract_type ? <><span>•</span><span>{e.contract_type}</span></> : null}
                        </div>
                      </div>
                      <span style={{ border: `1px solid ${style.bd}`, background: style.bg, color: style.tx, borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>{style.label}</span>
                    </div>
                  </button>

                  <select
                    value={statusSelectValue(e)}
                    onChange={(event) => void updateEwnStatus(e, event.target.value)}
                    disabled={statusSavingId === e.id}
                    aria-label="EWN status"
                    style={{
                      alignSelf: "center",
                      minHeight: 40,
                      border: `1px solid ${c.border}`,
                      background: c.input,
                      color: c.text,
                      borderRadius: 14,
                      padding: "0 10px",
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: statusSavingId === e.id ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <option value="open">Open</option>
                    <option value="submitted">Submitted</option>
                    <option value="closed">Closed</option>
                    {isConverted(e) ? <option value="converted">Converted</option> : null}
                  </select>

                  {isConverted(e) ? (
                    <Link href={openCeHref(e)} style={{ alignSelf: "center", border: `1px solid ${c.border}`, background: c.input, color: c.black, borderRadius: 14, padding: "10px 12px", textDecoration: "none", fontWeight: 800, fontSize: 13, whiteSpace: "nowrap" }}>
                      Open CE →
                    </Link>
                  ) : e.status === "closed" ? null : (
                    <Link href={convertHref(e)} style={{ alignSelf: "center", border: `1px solid ${c.black}`, background: c.black, color: c.blackContrast, borderRadius: 14, padding: "10px 12px", textDecoration: "none", fontWeight: 800, fontSize: 13, whiteSpace: "nowrap" }}>
                      Convert → CE
                    </Link>
                  )}
                </div>

                {isOpen ? (
                  <div style={{ padding: 18, borderTop: `1px solid ${c.border}`, display: "grid", gap: 14 }}>
                    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                      <section style={{ border: `1px solid ${c.border}`, background: c.soft, borderRadius: 16, padding: 14 }}>
                        <div style={{ fontSize: 12, color: c.sub, fontWeight: 800, marginBottom: 8 }}>What happened</div>
                        <p style={{ margin: 0, color: c.black, fontSize: 14, lineHeight: 1.6 }}>{e.what_happened || "Not recorded."}</p>
                      </section>
                      <section style={{ border: `1px solid ${c.border}`, background: c.soft, borderRadius: 16, padding: 14 }}>
                        <div style={{ fontSize: 12, color: c.sub, fontWeight: 800, marginBottom: 8 }}>Impact / required action</div>
                        <p style={{ margin: 0, color: c.black, fontSize: 14, lineHeight: 1.6 }}>{e.impact || "Impact not recorded."}</p>
                        {e.required_action ? <p style={{ margin: "8px 0 0", color: c.black, fontSize: 14, lineHeight: 1.6 }}>{e.required_action}</p> : null}
                      </section>
                    </div>

                    {e.generated_output?.narrative ? (
                      <section style={{ border: `1px solid ${c.border}`, background: c.soft, borderRadius: 16, padding: 14 }}>
                        <div style={{ fontSize: 12, color: c.sub, fontWeight: 800, marginBottom: 8 }}>Generated narrative</div>
                        <p style={{ margin: 0, color: c.black, fontSize: 14, lineHeight: 1.65 }}>{e.generated_output.narrative}</p>
                      </section>
                    ) : null}

                    <section style={{ border: `1px solid ${c.border}`, background: c.soft, borderRadius: 16, padding: 14 }}>
                      <div style={{ fontSize: 12, color: c.sub, fontWeight: 800, marginBottom: 8 }}>Project group</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          value={Object.prototype.hasOwnProperty.call(projectMoveValues, e.id) ? projectMoveValues[e.id] : e.project_name ?? ""}
                          onChange={(event) => setProjectMoveValues((prev) => ({ ...prev, [e.id]: event.target.value }))}
                          placeholder="Move to project"
                          style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 12, border: `1px solid ${c.border}`, background: c.input, padding: "0 10px", fontSize: 13, color: c.black }}
                        />
                        <button
                          onClick={() => void moveEwnToProject(e)}
                          disabled={projectMoveSavingId === e.id}
                          style={{ alignSelf: "center", minHeight: 40, border: `1px solid ${c.black}`, background: c.black, color: c.blackContrast, borderRadius: 14, padding: "10px 12px", fontWeight: 800, fontSize: 13, lineHeight: 1.2, cursor: projectMoveSavingId === e.id ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                        >
                          {projectMoveSavingId === e.id ? "Moving…" : "Move project"}
                        </button>
                      </div>
                      <p style={{ margin: "8px 0 0", color: c.sub, fontSize: 12, lineHeight: 1.45 }}>Use this if the EWN was logged under the wrong project group.</p>
                    </section>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                      {isConverted(e) ? (
                        <Link href={openCeHref(e)} style={{ border: `1px solid ${c.black}`, background: c.black, color: c.blackContrast, borderRadius: 14, padding: "11px 13px", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
                          Open CE →
                        </Link>
                      ) : e.status === "closed" ? null : (
                        <Link href={convertHref(e)} style={{ border: `1px solid ${c.black}`, background: c.black, color: c.blackContrast, borderRadius: 14, padding: "11px 13px", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
                          Convert to CE →
                        </Link>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function EwnRegisterPage() {
  return (
    <Suspense fallback={<div style={{ color: c.sub, fontWeight: 700 }}>Loading EWN register…</div>}>
      <EwnRegisterInner />
    </Suspense>
  );
}
