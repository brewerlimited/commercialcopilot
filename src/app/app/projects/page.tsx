"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getContractLabel } from "@/lib/contracts";
import { displayEventTitle } from "@/lib/eventReference";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";
import { normaliseCommercialStatus, normalisePaymentStatus } from "@/lib/commercialControl";
import { AppCard, AppPageHeader, MetricCard, PrimaryButton, QuietButton, toneColours } from "@/components/appUi";

type ProjectRow = {
  id: string;
  project_name: string;
  main_contractor: string | null;
  contract_type: string | null;
  status: string | null;
  job_number?: string | null;
  updated_at?: string | null;
  is_demo?: boolean | null;
};

type ProjectSeed = {
  user_id: string;
  project_name: string;
  main_contractor: string;
  contract_type: string | null;
  status: "live";
  updated_at: string;
  is_demo?: boolean | null;
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
  is_demo?: boolean | null;
};

type EwnRow = {
  id: string;
  title: string | null;
  status: string | null;
  project_id?: string | null;
  project_name?: string | null;
  main_contractor?: string | null;
  is_demo?: boolean | null;
};

const PROJECT_STATUS_OPTIONS = [
  { value: "live", label: "Live", tone: "green" },
  { value: "dormant", label: "Dormant", tone: "orange" },
  { value: "defects", label: "Defects", tone: "purple" },
  { value: "closed", label: "Closed", tone: "neutral" },
] as const;

type ProjectStatusValue = (typeof PROJECT_STATUS_OPTIONS)[number]["value"];
type AppTone = "neutral" | "purple" | "blue" | "green" | "orange" | "red" | "pink";

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
  if (normalisePaymentStatus(event.payment_status) === "paid" || normaliseCommercialStatus(event.status) === "paid") return 0;
  return Math.max(0, assessedValue(event) - paidValue(event));
}

function isVoided(event: EventRow) {
  return normaliseCommercialStatus(event.status) === "void";
}

function projectKey(project: { project_name?: string | null; main_contractor?: string | null }) {
  return `${String(project.project_name ?? "").trim().toLowerCase()}__${String(project.main_contractor ?? "").trim().toLowerCase()}`;
}

function demoFilteredRows<T extends { is_demo?: boolean | null }>(rows: T[], demoMode: boolean) {
  return demoMode ? rows.filter((row) => row.is_demo === true) : rows.filter((row) => row.is_demo !== true);
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
  if (normalisePaymentStatus(event.payment_status) === "paid") return false;
  if (!event.expected_payment_date) return false;
  const due = new Date(event.expected_payment_date);
  if (Number.isNaN(due.getTime())) return false;
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime() > due.getTime();
}

function statusTone(status?: string | null) {
  const option = PROJECT_STATUS_OPTIONS.find((item) => item.value === status);
  const tone = (option?.tone ?? "green") as AppTone;
  const colors = toneColours(tone);
  return { bg: colors.bg, bd: colors.border, tx: colors.text, tone };
}

function projectActionColours(tone: "neutral" | "purple" | "blue" | "green" | "orange" | "red" | "pink") {
  const colors = toneColours(tone);
  return { bg: colors.bg, bd: colors.border, tx: colors.text };
}

function nextProjectAction(events: EventRow[], ewns: EwnRow[]) {
  const activeEvents = events.filter((event) => !isVoided(event));
  const overdue = activeEvents.filter(isOverdue).sort((a, b) => outstandingValue(b) - outstandingValue(a))[0];
  if (overdue) return { label: "Chase overdue payment", detail: `${displayEventTitle(overdue)} • ${money(outstandingValue(overdue))}`, href: `/app?trackPayment=${overdue.id}`, tone: "red" as const };

  const openEwn = ewns.find((ewn) => ewn.status !== "converted" && ewn.status !== "closed");
  if (openEwn) return { label: "Review open EWN", detail: openEwn.title || "Open early warning", href: `/app/ewns?ewn=${openEwn.id}`, tone: "orange" as const };

  const draft = activeEvents.find((event) => ["draft", "review", "ready"].includes(normaliseCommercialStatus(event.status)));
  if (draft) return { label: "Continue CE pack", detail: displayEventTitle(draft), href: `/app/event/${draft.id}`, tone: "blue" as const };

  return { label: "Commercially quiet", detail: "No immediate recovery action flagged.", href: "/app/new", tone: "green" as const };
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
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [demoModeActive, setDemoModeActive] = useState(false);

  useEffect(() => {
    function syncDemoMode() {
      try {
        setDemoModeActive(localStorage.getItem("cc.demo.mode") === "1");
      } catch {
        setDemoModeActive(false);
      }
    }
    syncDemoMode();
    window.addEventListener("cc:demo-mode-changed", syncDemoMode);
    window.addEventListener("storage", syncDemoMode);
    return () => {
      window.removeEventListener("cc:demo-mode-changed", syncDemoMode);
      window.removeEventListener("storage", syncDemoMode);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const supabase = supabaseBrowser();
        const user = await getRequiredUser(supabase);

        const eventSelects = [
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference,expected_payment_date,payment_status,submitted_amount,assessed_amount,paid_amount,balance_outstanding,event_financial_summary,is_demo",
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference,expected_payment_date,payment_status,event_financial_summary",
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference,expected_payment_date,payment_status",
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference,event_financial_summary",
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference",
          "id,title,status,project_name,main_contractor,contract_type,event_number,event_reference",
          "id,title,status,project_name,main_contractor,contract_type",
        ];

        const ewnSelects = [
          "id,title,status,project_id,project_name,main_contractor,is_demo",
          "id,title,status,project_name,main_contractor",
        ];

        async function selectWithFallback<T>(table: "events" | "ewns", selects: string[]) {
          let lastError: unknown = null;
          for (const selectColumns of selects) {
            const result = await (supabase as any).from(table).select(selectColumns).eq("user_id", user.id);
            if (!result.error) return (result.data ?? []) as T[];

            lastError = result.error;
            const message = String(result.error.message || "");
            const canTryFallback = /project_id|expected_payment_date|payment_status|submitted_amount|assessed_amount|paid_amount|balance_outstanding|event_financial_summary|is_demo|schema cache|relationship/i.test(message);
            if (!canTryFallback) throw result.error;
          }
          throw lastError instanceof Error ? lastError : new Error(`Failed to load ${table}`);
        }

        const [projectResInitial, eventRows, ewnRows] = await Promise.all([
          (supabase as any).from("projects").select("id,project_name,main_contractor,contract_type,status,job_number,updated_at,is_demo").eq("user_id", user.id).order("updated_at", { ascending: false }),
          selectWithFallback<EventRow>("events", eventSelects),
          selectWithFallback<EwnRow>("ewns", ewnSelects),
        ]);
        let projectRes = projectResInitial;
        if (projectRes.error && isOptionalSchemaError(projectRes.error)) {
          projectRes = await (supabase as any).from("projects").select("id,project_name,main_contractor,contract_type,status,job_number,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false });
        }
        if (projectRes.error) throw projectRes.error;
        if (!active) return;

        const projectRows = demoFilteredRows((projectRes.data ?? []) as ProjectRow[], demoModeActive);
        const filteredEventRows = demoFilteredRows(eventRows, demoModeActive);
        const filteredEwnRows = demoFilteredRows(ewnRows, demoModeActive);
        const missingProjects = demoModeActive ? [] : deriveMissingProjects(user.id, projectRows, filteredEventRows, filteredEwnRows);

        if (missingProjects.length > 0) {
          const repairRes = await (supabase as any).from("projects")
            .upsert(missingProjects as never, { onConflict: "user_id,project_name,main_contractor" })
            .select("id,project_name,main_contractor,contract_type,status,job_number,updated_at");
          if (repairRes.error) throw repairRes.error;
          projectRows.push(...((repairRes.data ?? []) as ProjectRow[]));
        }

        setProjects(projectRows);
        setEvents(filteredEventRows);
        setEwns(filteredEwnRows);
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
  }, [demoModeActive, router]);

  const projectSummaries = useMemo(() => {
    return projects.map((project) => {
      const projectEvents = events.filter((event) => eventBelongsToProject(event, project));
      const activeProjectEvents = projectEvents.filter((event) => !isVoided(event));
      const projectEwns = ewns.filter((ewn) => ewnBelongsToProject(ewn, project));
      const recoverable = activeProjectEvents.reduce((sum, event) => sum + readTotal(event.event_financial_summary), 0);
      const submitted = activeProjectEvents
        .filter((event) => ["submitted", "accepted", "paid"].includes(normaliseCommercialStatus(event.status)))
        .reduce((sum, event) => sum + assessedValue(event), 0);
      const paid = activeProjectEvents.reduce((sum, event) => sum + paidValue(event), 0);
      const outstanding = activeProjectEvents.reduce((sum, event) => sum + outstandingValue(event), 0);
      const overdue = activeProjectEvents.filter(isOverdue);
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

  async function updateProjectStatus(projectId: string, nextStatus: ProjectStatusValue) {
    const previous = projects.find((project) => project.id === projectId) ?? null;
    if (!previous || previous.status === nextStatus) return;

    setErr(null);
    setSavingStatusId(projectId);
    setProjects((prev) => prev.map((project) => (
      project.id === projectId ? { ...project, status: nextStatus, updated_at: new Date().toISOString() } : project
    )));

    if (demoModeActive) {
      setSavingStatusId(null);
      return;
    }

    try {
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      const update = await (supabase as any)
        .from("projects")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", projectId)
        .eq("user_id", user.id);
      if (update.error) throw update.error;
    } catch (error) {
      setProjects((prev) => prev.map((project) => (project.id === projectId ? previous : project)));
      const message = error instanceof Error ? error.message : "Project status could not be saved.";
      setErr(/status|schema cache|column/i.test(message)
        ? "Project status could not be saved. Run the projects status SQL patch, then try again."
        : message);
    } finally {
      setSavingStatusId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AppPageHeader
        eyebrow="Commercial projects"
        title="Projects"
        description="Project-level recovery, payment and EWN control across live jobs."
        actions={<PrimaryButton href={demoModeActive ? "/app/projects" : "/app/projects/new"}>+ New Project</PrimaryButton>}
      />

      <div className="app-project-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
        {[
          ["Recoverable value", money(totals.recoverable), "All live projects", "green"],
          ["Outstanding", money(totals.outstanding), "Unpaid balance", "blue"],
          ["Recovered", money(totals.paid), "Value paid", "green"],
          ["Overdue CEs", totals.overdue, "Payment risk", "red"],
          ["Open EWNs", totals.openEwns, "Potential change", "purple"],
        ].map(([label, value, hint, tone]) => (
          <MetricCard
            key={String(label)}
            label={String(label)}
            value={value}
            hint={String(hint)}
            tone={tone as "green" | "blue" | "red" | "purple"}
          />
        ))}
      </div>

      <AppCard style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 10 }}>
          <input className="app-control" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects..." style={{ margin: "16px 0 16px 16px", padding: "0 13px", fontWeight: 650 }} />
          <select className="app-control" value={status} onChange={(e) => setStatus(e.target.value)} style={{ margin: "16px 16px 16px 0", padding: "0 13px", fontWeight: 700 }}>
            <option value="all">All statuses</option>
            <option value="live">Live</option>
            <option value="dormant">Dormant</option>
            <option value="defects">Defects</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {err ? <div style={{ marginTop: 12, border: `1px solid ${c.redBd}`, background: c.redBg, color: c.redTx, borderRadius: 14, padding: 12, fontWeight: 800 }}>{err}</div> : null}

        <div style={{ borderTop: `1px solid ${c.border}` }}>
          {loading ? (
            <div style={{ padding: 18, color: c.sub, fontWeight: 800 }}>Loading projects...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 18, color: c.sub, fontWeight: 800 }}>No projects found. Create a project or convert an existing CE/EWN after running the migration.</div>
          ) : (
            filtered.map((row) => {
              const tone = statusTone(row.project.status);
              const actionTone = projectActionColours(row.nextAction.tone);
              const orangeTone = projectActionColours("orange");
              return (
                  <article key={row.project.id} className="app-list-row app-project-row" style={{ borderBottom: `1px solid ${c.border}`, padding: 16, display: "grid", gridTemplateColumns: "minmax(250px, 1.4fr) 70px repeat(4, minmax(90px, .55fr)) minmax(230px, 1fr) 128px 104px", gap: 14, alignItems: "center" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 99, background: tone.tx, flex: "0 0 auto" }} />
                        <Link href={`/app/projects/${row.project.id}`} style={{ color: c.text, fontSize: 15, fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>{row.project.project_name}</Link>
                      </div>
                      <div style={{ margin: "5px 0 0 16px", color: c.sub, fontSize: 12, fontWeight: 550 }}>{row.project.main_contractor || "Contractor not set"} • {getContractLabel(row.project.contract_type)}</div>
                    </div>
                    <Mini label="CEs" value={row.events.length} bare />
                    <Mini label="Recoverable" value={money(row.recoverable)} bare tone={c.greenTx} />
                    <Mini label="Submitted" value={money(row.submitted)} bare tone={c.blueTx} />
                    <Mini label="Outstanding" value={money(row.outstanding)} bare tone={orangeTone.tx} />
                    <Mini label="Overdue" value={row.overdue.length} bare tone={row.overdue.length ? c.redTx : c.text} />
                    <div style={{ border: `1px solid ${actionTone.bd}`, background: actionTone.bg, color: actionTone.tx, borderRadius: 12, padding: "10px 12px", minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 750, textTransform: "uppercase" }}>Next action</div>
                      <div style={{ marginTop: 3, fontSize: 12, lineHeight: 1.35, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis" }}>{row.nextAction.label}</div>
                    </div>
                    <select
                      className="app-control"
                      value={(row.project.status || "live") as ProjectStatusValue}
                      disabled={savingStatusId === row.project.id}
                      onChange={(e) => void updateProjectStatus(row.project.id, e.target.value as ProjectStatusValue)}
                      style={{ height: 38, padding: "0 10px", borderColor: tone.bd, background: tone.bg, color: tone.tx, fontWeight: 800 }}
                    >
                      {PROJECT_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <QuietButton href={`/app/projects/${row.project.id}`} style={{ height: 38, borderRadius: 12, padding: "0 12px" }}>Open →</QuietButton>
                  </article>
              );
            })
          )}
        </div>
      </AppCard>
    </div>
  );
}

function Mini({ label, value, bare = false, tone = c.text }: { label: string; value: React.ReactNode; bare?: boolean; tone?: string }) {
  return (
    <div style={bare ? { minWidth: 0 } : { border: `1px solid ${c.border}`, background: c.input, borderRadius: 14, padding: 10, minHeight: 70 }}>
      <div style={{ color: c.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>{label}</div>
      <div style={{ marginTop: bare ? 5 : 8, color: tone, fontSize: bare ? 14 : 17, fontWeight: 800, lineHeight: 1.08, whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}
