"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AppCard, AppPageHeader, MetricCard, SmallIcon, StatusBadge } from "@/components/appUi";

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

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={{ fontSize: 12, color: c.sub, fontWeight: 800 }}>{label}</span>
      {children}
    </label>
  );
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
  const [editValues, setEditValues] = useState<Record<string, Partial<EwnRow>>>({});
  const [editSavingId, setEditSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const pageSize = 6;

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

  const projectOptions = useMemo(() => {
    const names = new Set<string>();
    for (const ewn of ewns) {
      const project = ewn.project_name?.trim();
      if (project) names.add(project);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [ewns]);

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...ewns]
      .filter((ewn) => statusFilter === "all" || statusSelectValue(ewn) === statusFilter)
      .filter((ewn) => projectFilter === "all" || (ewn.project_name ?? "") === projectFilter)
      .filter((ewn) => !q || [ewn.title, ewn.project_name, ewn.main_contractor, ewn.location].join(" ").toLowerCase().includes(q))
      .sort((a, b) => {
        const newest = String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
        return sortOrder === "newest" ? newest : -newest;
      });
  }, [ewns, projectFilter, query, sortOrder, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [projectFilter, query, sortOrder, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const shownFrom = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const shownTo = Math.min(sorted.length, safePage * pageSize);

  const totals = useMemo(() => ({
    all: ewns.length,
    open: ewns.filter((ewn) => statusSelectValue(ewn) === "open").length,
    converted: ewns.filter(isConverted).length,
    overdue: ewns.filter((ewn) => statusSelectValue(ewn) === "open" && isEwnOverdue(ewn)).length,
    thisMonth: ewns.filter((ewn) => {
      const date = new Date(ewn.created_at ?? "");
      const now = new Date();
      return !Number.isNaN(date.getTime()) && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length,
  }), [ewns]);

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

  function isEwnOverdue(e: EwnRow) {
    const date = new Date(e.event_date || e.created_at || "");
    if (Number.isNaN(date.getTime())) return false;
    const ageDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays >= 14;
  }

  function rowAccent(e: EwnRow) {
    if (isConverted(e)) return "#18a36f";
    if (statusSelectValue(e) === "submitted") return "#2563eb";
    if (isEwnOverdue(e)) return "var(--red-text)";
    return "#f97316";
  }

  function editValue(e: EwnRow, key: keyof EwnRow) {
    const edited = editValues[e.id];
    if (edited && Object.prototype.hasOwnProperty.call(edited, key)) {
      const value = edited[key];
      return typeof value === "string" ? value : "";
    }
    const value = e[key];
    return typeof value === "string" ? value : "";
  }

  function setEditValue(id: string, key: keyof EwnRow, value: string) {
    setEditValues((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? {}),
        [key]: value,
      },
    }));
  }

  function hasEditChanges(e: EwnRow) {
    return Boolean(editValues[e.id] && Object.keys(editValues[e.id] ?? {}).length > 0);
  }

  function updateLocalEwnRow(id: string, patch: Partial<EwnRow>) {
    const local = readLocalEwns();
    if (!local.some((item) => item.id === id)) return;
    localStorage.setItem(
      "cc.ewns",
      JSON.stringify(local.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    );
  }

  async function saveEwnEdits(ewn: EwnRow) {
    const rawPatch = editValues[ewn.id] ?? {};
    const patch: Partial<EwnRow> = {
      title: String(rawPatch.title ?? ewn.title ?? "").trim() || null,
      project_name: String(rawPatch.project_name ?? ewn.project_name ?? "").trim() || null,
      main_contractor: String(rawPatch.main_contractor ?? ewn.main_contractor ?? "").trim() || null,
      contract_type: String(rawPatch.contract_type ?? ewn.contract_type ?? "").trim() || null,
      event_date: String(rawPatch.event_date ?? ewn.event_date ?? "").trim() || null,
      location: String(rawPatch.location ?? ewn.location ?? "").trim() || null,
      what_happened: String(rawPatch.what_happened ?? ewn.what_happened ?? "").trim() || null,
      impact: String(rawPatch.impact ?? ewn.impact ?? "").trim() || null,
      required_action: String(rawPatch.required_action ?? ewn.required_action ?? "").trim() || null,
      evidence_summary: String(rawPatch.evidence_summary ?? ewn.evidence_summary ?? "").trim() || null,
    };
    const previous = ewn;

    setEwns((prev) => prev.map((item) => (item.id === ewn.id ? { ...item, ...patch } : item)));

    try {
      setEditSavingId(ewn.id);
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (user) {
        const { error } = await (supabase as any)
          .from("ewns")
          .update(patch)
          .eq("id", ewn.id)
          .eq("user_id", user.id);
        if (error) throw error;
      }

      updateLocalEwnRow(ewn.id, patch);
      setEditValues((prev) => {
        const next = { ...prev };
        delete next[ewn.id];
        return next;
      });
    } catch (err) {
      console.error("Failed to save EWN edits", err);
      setEwns((prev) => prev.map((item) => (item.id === ewn.id ? previous : item)));
    } finally {
      setEditSavingId(null);
    }
  }

  function resetEwnEdits(id: string) {
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
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
    <div style={{ display: "grid", gap: 16 }}>
      <AppPageHeader
        eyebrow="Commercial log"
        title="EWN Register"
        description="Keep early warnings visible and move them into the CE workflow when a recoverable impact develops."
      />

      <div className="app-ewn-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
        <MetricCard label="Total EWNs" value={totals.all} hint="All projects" tone="purple" icon={<SmallIcon name="file" />} />
        <MetricCard label="Open" value={totals.open} hint="Awaiting action" tone="green" icon={<SmallIcon name="check" />} />
        <MetricCard label="Converted" value={totals.converted} hint="Moved to CE" tone="orange" icon={<SmallIcon name="clock" />} />
        <MetricCard label="Overdue" value={totals.overdue} hint="Require attention" tone="red" icon={<SmallIcon name="alert" />} />
        <MetricCard label="This month" value={totals.thisMonth} hint="Newly created" tone="blue" icon={<SmallIcon name="calendar" />} />
      </div>

      <AppCard style={{ padding: 0, overflow: "hidden" }}>
        <div className="app-ewn-filters" style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) auto 170px 170px 160px", gap: 10, padding: 16 }}>
          <input className="app-control" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search EWNs..." style={{ padding: "0 13px", fontWeight: 650 }} />
          <button className="app-control" type="button" style={{ padding: "0 14px", fontWeight: 750, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <SmallIcon name="radar" /> Filters
          </button>
          <select className="app-control" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} style={{ padding: "0 12px", fontWeight: 700 }}>
            <option value="all">All projects</option>
            {projectOptions.map((project) => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
          <select className="app-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ padding: "0 12px", fontWeight: 700 }}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="submitted">Submitted</option>
            <option value="converted">Converted</option>
            <option value="closed">Closed</option>
          </select>
          <select className="app-control" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest")} style={{ padding: "0 12px", fontWeight: 700 }}>
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
          </select>
        </div>
        <div style={{ borderTop: `1px solid ${c.border}` }}>
        {loading ? (
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 18, padding: 18, color: c.sub, fontWeight: 700 }}>Loading EWNs…</div>
        ) : sorted.length === 0 ? (
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 18, padding: 22 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: c.black }}>No EWNs logged yet</h2>
            <p style={{ margin: "8px 0 0", color: c.sub, fontSize: 13, lineHeight: 1.55 }}>Use EWNs to capture risk early, then convert to CE once impact and entitlement are clearer.</p>
          </div>
        ) : (
          paged.map((e) => {
            const isOpen = openId === e.id;
            const style = statusStyle(e.status);
            return (
              <div key={e.id} id={`ewn-${e.id}`} style={{ background: c.card, borderBottom: `1px solid ${c.border}`, overflow: "hidden" }}>
                <div className="app-list-row app-ewn-row" style={{ display: "grid", gridTemplateColumns: "96px 3px minmax(280px, 1fr) 140px 150px", gap: 14, alignItems: "center", background: isOpen ? c.soft : c.card, padding: 16 }}>
                  <span style={{ display: "inline-flex", justifyContent: "center" }}>
                    <StatusBadge tone={e.status === "converted" ? "green" : e.status === "submitted" ? "blue" : e.status === "closed" ? "neutral" : "orange"}>{style.label}</StatusBadge>
                  </span>
                  <span aria-hidden="true" style={{ width: 3, height: 56, borderRadius: 999, background: rowAccent(e), justifySelf: "center" }} />
                  <button onClick={() => setOpenId(isOpen ? null : e.id)} style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", cursor: "pointer", textAlign: "left", padding: 0 }}>
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
                    <Link href={openCeHref(e)} style={{ alignSelf: "center", textAlign: "center", border: `1px solid ${c.border}`, background: c.input, color: c.black, borderRadius: 12, padding: "11px 12px", textDecoration: "none", fontWeight: 750, fontSize: 13, whiteSpace: "nowrap" }}>
                      View CE ↗
                    </Link>
                  ) : e.status === "closed" ? null : (
                    <Link href={convertHref(e)} style={{ alignSelf: "center", textAlign: "center", border: `1px solid ${c.black}`, background: c.black, color: c.blackContrast, borderRadius: 12, padding: "11px 12px", textDecoration: "none", fontWeight: 750, fontSize: 13, whiteSpace: "nowrap" }}>
                      Convert to CE
                    </Link>
                  )}
                </div>

                {isOpen ? (
                  <div style={{ padding: 18, borderTop: `1px solid ${c.border}`, display: "grid", gap: 14 }}>
                    <section style={{ border: `1px solid ${c.border}`, background: c.soft, borderRadius: 16, padding: 14, display: "grid", gap: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 12, color: c.sub, fontWeight: 850, textTransform: "uppercase", letterSpacing: 0.3 }}>Edit EWN record</div>
                          <div style={{ marginTop: 4, color: c.black, fontSize: 14, fontWeight: 750 }}>Keep this record live until the full EWN output is added.</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {hasEditChanges(e) ? (
                            <button
                              type="button"
                              onClick={() => resetEwnEdits(e.id)}
                              style={{ minHeight: 38, border: `1px solid ${c.border}`, background: c.input, color: c.black, borderRadius: 12, padding: "9px 12px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
                            >
                              Cancel edits
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void saveEwnEdits(e)}
                            disabled={editSavingId === e.id || !hasEditChanges(e)}
                            style={{ minHeight: 38, border: `1px solid ${c.black}`, background: c.black, color: c.blackContrast, borderRadius: 12, padding: "9px 12px", fontWeight: 800, fontSize: 13, cursor: editSavingId === e.id || !hasEditChanges(e) ? "not-allowed" : "pointer", opacity: editSavingId === e.id || !hasEditChanges(e) ? 0.55 : 1 }}
                          >
                            {editSavingId === e.id ? "Saving..." : "Save EWN"}
                          </button>
                        </div>
                      </div>

                      <div className="app-ewn-edit-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                        <EditField label="EWN title">
                          <input className="app-control" value={editValue(e, "title")} onChange={(event) => setEditValue(e.id, "title", event.target.value)} placeholder="EWN title" style={{ padding: "0 12px", fontWeight: 700 }} />
                        </EditField>
                        <EditField label="Notice date">
                          <input className="app-control" type="date" value={editValue(e, "event_date")} onChange={(event) => setEditValue(e.id, "event_date", event.target.value)} style={{ padding: "0 12px", fontWeight: 700 }} />
                        </EditField>
                        <EditField label="Project / job">
                          <input className="app-control" value={editValue(e, "project_name")} onChange={(event) => setEditValue(e.id, "project_name", event.target.value)} placeholder="Project / job" style={{ padding: "0 12px", fontWeight: 700 }} />
                        </EditField>
                        <EditField label="Main contractor">
                          <input className="app-control" value={editValue(e, "main_contractor")} onChange={(event) => setEditValue(e.id, "main_contractor", event.target.value)} placeholder="Main contractor" style={{ padding: "0 12px", fontWeight: 700 }} />
                        </EditField>
                        <EditField label="Contract type">
                          <input className="app-control" value={editValue(e, "contract_type")} onChange={(event) => setEditValue(e.id, "contract_type", event.target.value)} placeholder="e.g. NEC4 ECS Option B" style={{ padding: "0 12px", fontWeight: 700 }} />
                        </EditField>
                        <EditField label="Location">
                          <input className="app-control" value={editValue(e, "location")} onChange={(event) => setEditValue(e.id, "location", event.target.value)} placeholder="Location / work area" style={{ padding: "0 12px", fontWeight: 700 }} />
                        </EditField>
                      </div>

                      <div className="app-ewn-edit-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                        <EditField label="What happened">
                          <textarea className="app-control" value={editValue(e, "what_happened")} onChange={(event) => setEditValue(e.id, "what_happened", event.target.value)} placeholder="Record the issue, facts, dates, location and sequence." style={{ minHeight: 118, padding: 12, fontWeight: 650, lineHeight: 1.55, resize: "vertical" }} />
                        </EditField>
                        <EditField label="Impact">
                          <textarea className="app-control" value={editValue(e, "impact")} onChange={(event) => setEditValue(e.id, "impact", event.target.value)} placeholder="Delay, disruption, resequencing, extra attendance or risk." style={{ minHeight: 118, padding: 12, fontWeight: 650, lineHeight: 1.55, resize: "vertical" }} />
                        </EditField>
                        <EditField label="Required action">
                          <textarea className="app-control" value={editValue(e, "required_action")} onChange={(event) => setEditValue(e.id, "required_action", event.target.value)} placeholder="What needs confirming, instructing or mitigating?" style={{ minHeight: 100, padding: 12, fontWeight: 650, lineHeight: 1.55, resize: "vertical" }} />
                        </EditField>
                        <EditField label="Evidence / records">
                          <textarea className="app-control" value={editValue(e, "evidence_summary")} onChange={(event) => setEditValue(e.id, "evidence_summary", event.target.value)} placeholder="Photos, drawings, emails, daily records or site instructions." style={{ minHeight: 100, padding: 12, fontWeight: 650, lineHeight: 1.55, resize: "vertical" }} />
                        </EditField>
                      </div>
                    </section>

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
        {!loading && sorted.length > 0 ? (
          <div className="app-ewn-pagination" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", borderTop: `1px solid ${c.border}`, color: c.sub, fontSize: 13, fontWeight: 700 }}>
            <span>Showing {shownFrom} to {shownTo} of {sorted.length} EWNs</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="app-control" type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1} style={{ width: 38, minHeight: 38, padding: 0, opacity: safePage === 1 ? 0.45 : 1 }}>‹</button>
              {Array.from({ length: pageCount }).slice(0, 5).map((_, index) => {
                const pageNumber = index + 1;
                const active = pageNumber === safePage;
                return (
                  <button
                    key={pageNumber}
                    className="app-control"
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    style={{
                      width: 38,
                      minHeight: 38,
                      padding: 0,
                      borderColor: active ? "#d8ccff" : c.border,
                      background: active ? "#f3efff" : c.input,
                      color: active ? "#6d4aff" : c.text,
                      fontWeight: 850,
                    }}
                  >
                    {pageNumber}
                  </button>
                );
              })}
              <button className="app-control" type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={safePage === pageCount} style={{ width: 38, minHeight: 38, padding: 0, opacity: safePage === pageCount ? 0.45 : 1 }}>›</button>
            </div>
          </div>
        ) : null}
      </AppCard>
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
