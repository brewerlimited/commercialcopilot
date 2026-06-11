"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getContractLabel } from "@/lib/contracts";
import { displayEventReference } from "@/lib/eventReference";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";
import { normaliseCommercialStatus, normalisePaymentStatus } from "@/lib/commercialControl";

type ProjectRow = {
  id: string;
  project_name: string;
  main_contractor: string | null;
  contract_type: string | null;
  status: string | null;
  job_number?: string | null;
  updated_at?: string | null;
};

type ProjectSeed = {
  user_id: string;
  project_name: string;
  main_contractor: string;
  contract_type: string | null;
  status: "live";
  updated_at: string;
};

type EventRow = {
  id: string;
  title: string | null;
  status: string | null;
  project_id?: string | null;
  project_name?: string | null;
  main_contractor?: string | null;
  contract_type?: string | null;
  event_number?: number | null;
  event_reference?: string | null;
  expected_payment_date?: string | null;
  payment_status?: string | null;
  submitted_amount?: number | null;
  assessed_amount?: number | null;
  paid_amount?: number | null;
  balance_outstanding?: number | null;
  event_financial_summary?: unknown;
};

type EwnRow = {
  id: string;
  title: string | null;
  status: string | null;
  project_id?: string | null;
  project_name?: string | null;
  main_contractor?: string | null;
};

const c = {
  card: "var(--surface)",
  input: "var(--surface-input)",
  border: "var(--border)",
  sub: "var(--text-muted)",
  text: "var(--foreground)",
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
  soft: "var(--surface-soft)",
  redBg: "var(--red-bg)",
  redBd: "var(--red-border)",
  redTx: "var(--red-text)",
  greenBg: "var(--green-bg)",
  greenBd: "var(--green-border)",
  greenTx: "var(--green-text)",
  amberBg: "var(--amber-bg)",
  amberBd: "var(--amber-border)",
  amberTx: "var(--amber-text)",
  blueBg: "var(--blue-bg)",
  blueBd: "var(--blue-border)",
  blueTx: "var(--blue-text)",
};

function money(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number.isFinite(v) ? v : 0);
}

function readTotal(summary: unknown) {
  if (!summary || typeof summary !== "object") return 0;
  const record = summary as Record<string, unknown>;
  const value = record.total ?? record.final_total ?? record.total_value;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function assessedValue(event: EventRow) {
  if (typeof event.assessed_amount === "number" && Number.isFinite(event.assessed_amount)) return event.assessed_amount;
  if (typeof event.submitted_amount === "number" && Number.isFinite(event.submitted_amount)) return event.submitted_amount;
  return readTotal(event.event_financial_summary);
}

function paidValue(event: EventRow) {
  if (typeof event.paid_amount === "number" && Number.isFinite(event.paid_amount)) return event.paid_amount;
  return normalisePaymentStatus(event.payment_status) === "paid" ? assessedValue(event) : 0;
}

function outstandingValue(event: EventRow) {
  if (typeof event.balance_outstanding === "number" && Number.isFinite(event.balance_outstanding)) return event.balance_outstanding;
  if (normalisePaymentStatus(event.status) === "paid" || normaliseCommercialStatus(event.status) === "paid") return 0;
  return Math.max(0, assessedValue(event) - paidValue(event));
}

function projectKey(project: { project_name?: string | null; main_contractor?: string | null }) {
  return `${String(project.project_name ?? "").trim().toLowerCase()}__${String(project.main_contractor ?? "").trim().toLowerCase()}`;
}

function deriveMissingProjects(userId: string, projectRows: ProjectRow[], eventRows: EventRow[], ewnRows: EwnRow[]) {
  const existing = new Set(projectRows.map(projectKey));
  const seeds = new Map<string, ProjectSeed>();
  const updatedAt = new Date().toISOString();

  function add(row: { project_name?: string | null; main_contractor?: string | null; contract_type?: string | null }) {
    const project_name = String(row.project_name ?? "").trim();
    if (!project_name) return;
    const main_contractor = String(row.main_contractor ?? "").trim();
    const key = projectKey({ project_name, main_contractor });
    if (existing.has(key) || seeds.has(key)) return;
    seeds.set(key, {
      user_id: userId,
      project_name,
      main_contractor,
      contract_type: row.contract_type ?? null,
      status: "live",
      updated_at: updatedAt,
    });
  }

  eventRows.forEach(add);
  ewnRows.forEach(add);

  return Array.from(seeds.values());
}

function eventBelongsToProject(event: EventRow, project: ProjectRow) {
  if (event.project_id && event.project_id === project.id) return true;
  return projectKey(event) === projectKey(project);
}

function ewnBelongsToProject(ewn: EwnRow, project: ProjectRow) {
  if (ewn.project_id && ewn.project_id === project.id) return true;
  return projectKey(ewn) === projectKey(project);
}

function isOverdue(event: EventRow) {
  const status = normaliseCommercialStatus(event.status);
  if (status !== "submitted" && status !== "accepted") return false;
  if (normalisePaymentStatus(event.status) === "paid") return false;
  if (!event.expected_payment_date) return false;
  const due = new Date(event.expected_payment_date);
  if (Number.isNaN(due.getTime())) return false;
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime() > due.getTime();
}

function statusTone(status?: string | null) {
  if (status === "closed") return { bg: c.soft, bd: c.border, tx: c.sub };
  if (status === "dormant" || status === "defects") return { bg: c.amberBg, bd: c.amberBd, tx: c.amberTx };
  return { bg: c.greenBg, bd: c.greenBd, tx: c.greenTx };
}

function nextProjectAction(events: EventRow[], ewns: EwnRow[]) {
  const overdue = events.filter(isOverdue).sort((a, b) => outstandingValue(b) - outstandingValue(a))[0];
  if (overdue) return { label: "Chase overdue payment", detail: `${overdue.title || displayEventReference(overdue)} • ${money(outstandingValue(overdue))}`, href: `/app?trackPayment=${overdue.id}`, tone: "red" as const };

  const openEwn = ewns.find((ewn) => ewn.status !== "converted" && ewn.status !== "closed");
  if (openEwn) return { label: "Review open EWN", detail: openEwn.title || "Open early warning", href: `/app/ewns?ewn=${openEwn.id}`, tone: "amber" as const };

  const draft = events.find((event) => ["draft", "review", "ready"].includes(normaliseCommercialStatus(event.status)));
  if (draft) return { label: "Continue CE pack", detail: draft.title || displayEventReference(draft), href: `/app/event/${draft.id}`, tone: "blue" as const };

  return { label: "Commercially quiet", detail: "No immediate recovery action flagged.", href: "/app/new", tone: "neutral" as const };
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [ewns, setEwns] = useState<EwnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("live");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const supabase = supabaseBrowser();
        const user = await getRequiredUser(supabase);

        const eventSelects = [
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference,expected_payment_date,payment_status,submitted_amount,assessed_amount,paid_amount,balance_outstanding,event_financial_summary",
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference,expected_payment_date,payment_status,event_financial_summary",
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference,expected_payment_date,payment_status",
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference,event_financial_summary",
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference",
          "id,title,status,project_name,main_contractor,contract_type,event_number,event_reference",
          "id,title,status,project_name,main_contractor,contract_type",
        ];

        const ewnSelects = [
          "id,title,status,project_id,project_name,main_contractor",
          "id,title,status,project_name,main_contractor",
        ];

        async function selectWithFallback<T>(table: "events" | "ewns", selects: string[]) {
          let lastError: unknown = null;
          for (const selectColumns of selects) {
            const result = await supabase.from(table).select(selectColumns).eq("user_id", user.id);
            if (!result.error) return (result.data ?? []) as T[];

            lastError = result.error;
            const message = String(result.error.message || "");
            const canTryFallback = /project_id|expected_payment_date|payment_status|submitted_amount|assessed_amount|paid_amount|balance_outstanding|event_financial_summary|schema cache|relationship/i.test(message);
            if (!canTryFallback) throw result.error;
          }
          throw lastError instanceof Error ? lastError : new Error(`Failed to load ${table}`);
        }

        const [projectRes, eventRows, ewnRows] = await Promise.all([
          supabase.from("projects").select("id,project_name,main_contractor,contract_type,status,job_number,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }),
          selectWithFallback<EventRow>("events", eventSelects),
          selectWithFallback<EwnRow>("ewns", ewnSelects),
        ]);
        if (projectRes.error) throw projectRes.error;
        if (!active) return;

        const projectRows = (projectRes.data ?? []) as ProjectRow[];
        const missingProjects = deriveMissingProjects(user.id, projectRows, eventRows, ewnRows);

        if (missingProjects.length > 0) {
          const repairRes = await supabase
            .from("projects")
            .upsert(missingProjects as never, { onConflict: "user_id,project_name,main_contractor" })
            .select("id,project_name,main_contractor,contract_type,status,job_number,updated_at");
          if (repairRes.error) throw repairRes.error;
          projectRows.push(...((repairRes.data ?? []) as ProjectRow[]));
        }

        setProjects(projectRows);
        setEvents(eventRows);
        setEwns(ewnRows);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load projects";
        if (isAuthErrorMessage(message)) {
          router.push("/login");
          return;
        }
        if (active) setErr(message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [router]);

  const projectSummaries = useMemo(() => {
    return projects.map((project) => {
      const projectEvents = events.filter((event) => eventBelongsToProject(event, project));
      const projectEwns = ewns.filter((ewn) => ewnBelongsToProject(ewn, project));
      const recoverable = projectEvents.reduce((sum, event) => sum + readTotal(event.event_financial_summary), 0);
      const submitted = projectEvents
        .filter((event) => ["submitted", "accepted", "paid"].includes(normaliseCommercialStatus(event.status)))
        .reduce((sum, event) => sum + assessedValue(event), 0);
      const paid = projectEvents.reduce((sum, event) => sum + paidValue(event), 0);
      const outstanding = projectEvents.reduce((sum, event) => sum + outstandingValue(event), 0);
      const overdue = projectEvents.filter(isOverdue);
      return {
        project,
        events: projectEvents,
        ewns: projectEwns,
        recoverable,
        submitted,
        paid,
        outstanding,
        overdue,
        openEwns: projectEwns.filter((ewn) => ewn.status !== "converted" && ewn.status !== "closed"),
        nextAction: nextProjectAction(projectEvents, projectEwns),
      };
    });
  }, [events, ewns, projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projectSummaries
      .filter((row) => (status === "all" ? true : (row.project.status || "live") === status))
      .filter((row) => {
        if (!q) return true;
        const hay = [row.project.project_name, row.project.main_contractor, row.project.job_number].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.outstanding - a.outstanding || b.overdue.length - a.overdue.length);
  }, [projectSummaries, query, status]);

  const totals = useMemo(() => {
    return projectSummaries.reduce(
      (acc, row) => ({
        recoverable: acc.recoverable + row.recoverable,
        outstanding: acc.outstanding + row.outstanding,
        paid: acc.paid + row.paid,
        overdue: acc.overdue + row.overdue.length,
        openEwns: acc.openEwns + row.openEwns.length,
      }),
      { recoverable: 0, outstanding: 0, paid: 0, overdue: 0, openEwns: 0 }
    );
  }, [projectSummaries]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.sub, textTransform: "uppercase", letterSpacing: "0.02em" }}>Commercial projects</div>
            <h1 style={{ margin: "6px 0 0", color: c.black, fontSize: 26, letterSpacing: 0, lineHeight: 1.15 }}>Projects</h1>
            <p style={{ margin: "8px 0 0", color: c.sub, fontSize: 13, lineHeight: 1.55, maxWidth: 780 }}>Project-level recovery, payment and EWN control across live jobs.</p>
          </div>
          <Link href="/app/projects/new" style={{ border: `1px solid ${c.black}`, background: c.black, color: c.blackContrast, borderRadius: 14, padding: "12px 14px", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
            + New Project
          </Link>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
        {[
          ["Recoverable", money(totals.recoverable), "All CE value"],
          ["Outstanding", money(totals.outstanding), "Unpaid balance"],
          ["Paid", money(totals.paid), "Recovered value"],
          ["Overdue CEs", totals.overdue, "Payment risk"],
          ["Open EWNs", totals.openEwns, "May become CEs"],
        ].map(([label, value, hint]) => (
          <div key={String(label)} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 18, padding: 18, minHeight: 112 }}>
            <div style={{ color: c.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>{label}</div>
            <div style={{ marginTop: 14, color: c.black, fontSize: 25, fontWeight: 800, letterSpacing: 0, lineHeight: 1.08 }}>{value}</div>
            <div style={{ marginTop: 6, color: c.sub, fontSize: 12, fontWeight: 650 }}>{hint}</div>
          </div>
        ))}
      </div>

      <section style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 10 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects..." style={{ border: `1px solid ${c.border}`, background: c.input, color: c.text, borderRadius: 14, padding: "12px 13px", fontWeight: 700 }} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ border: `1px solid ${c.border}`, background: c.input, color: c.text, borderRadius: 14, padding: "12px 13px", fontWeight: 800 }}>
            <option value="all">All statuses</option>
            <option value="live">Live</option>
            <option value="dormant">Dormant</option>
            <option value="defects">Defects</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {err ? <div style={{ marginTop: 12, border: `1px solid ${c.redBd}`, background: c.redBg, color: c.redTx, borderRadius: 14, padding: 12, fontWeight: 800 }}>{err}</div> : null}

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {loading ? (
            <div style={{ padding: 18, color: c.sub, fontWeight: 800 }}>Loading projects...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 18, color: c.sub, fontWeight: 800 }}>No projects found. Create a project or convert an existing CE/EWN after running the migration.</div>
          ) : (
            filtered.map((row) => {
              const tone = statusTone(row.project.status);
              const actionTone = row.nextAction.tone === "red" ? { bg: c.redBg, bd: c.redBd, tx: c.redTx } : row.nextAction.tone === "amber" ? { bg: c.amberBg, bd: c.amberBd, tx: c.amberTx } : row.nextAction.tone === "blue" ? { bg: c.blueBg, bd: c.blueBd, tx: c.blueTx } : { bg: c.soft, bd: c.border, tx: c.sub };
              return (
                <Link key={row.project.id} href={`/app/projects/${row.project.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <article style={{ border: `1px solid ${c.border}`, background: c.soft, borderRadius: 18, padding: 16, display: "grid", gap: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: c.black, fontSize: 18, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.project.project_name}</div>
                        <div style={{ marginTop: 5, color: c.sub, fontSize: 13, fontWeight: 700 }}>{row.project.main_contractor || "Contractor not set"} • {getContractLabel(row.project.contract_type)}</div>
                      </div>
                      <span style={{ border: `1px solid ${tone.bd}`, background: tone.bg, color: tone.tx, borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 800, textTransform: "capitalize" }}>{row.project.status || "live"}</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 }}>
                      <Mini label="CEs" value={row.events.length} />
                      <Mini label="EWNs" value={row.openEwns.length} />
                      <Mini label="Recoverable" value={money(row.recoverable)} />
                      <Mini label="Submitted" value={money(row.submitted)} />
                      <Mini label="Outstanding" value={money(row.outstanding)} />
                      <Mini label="Overdue" value={row.overdue.length} />
                    </div>

                    <div style={{ border: `1px solid ${actionTone.bd}`, background: actionTone.bg, color: actionTone.tx, borderRadius: 14, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>Next action</div>
                        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700 }}>{row.nextAction.label}: {row.nextAction.detail}</div>
                      </div>
                      <span style={{ fontWeight: 800, whiteSpace: "nowrap" }}>Open →</span>
                    </div>
                  </article>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${c.border}`, background: c.input, borderRadius: 14, padding: 10, minHeight: 70 }}>
      <div style={{ color: c.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>{label}</div>
      <div style={{ marginTop: 8, color: c.black, fontSize: 17, fontWeight: 800, lineHeight: 1.08 }}>{value}</div>
    </div>
  );
}
