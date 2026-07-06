"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getContractLabel } from "@/lib/contracts";
import { displayEventReference } from "@/lib/eventReference";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";
import {
  PAYMENT_STATUS_OPTIONS,
  formatDateShort,
  getAllowedCommercialStatusOptions,
  getCommercialStatusLabel,
  getPaymentStatusLabel,
  normaliseCommercialStatus,
  normalisePaymentStatus,
  toDateInputValue,
} from "@/lib/commercialControl";

type ProjectRow = {
  id: string;
  project_name: string;
  main_contractor: string | null;
  contract_type: string | null;
  status: string | null;
  job_number?: string | null;
  start_date?: string | null;
  completion_date?: string | null;
  project_manager?: string | null;
  quantity_surveyor?: string | null;
  notes?: string | null;
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
  disallowed_amount?: number | null;
  balance_outstanding?: number | null;
  last_chased_date?: string | null;
  next_chase_date?: string | null;
  client_response?: string | null;
  dispute_reason?: string | null;
  agreed_payment_date?: string | null;
  last_action_type?: string | null;
  last_action_date?: string | null;
  event_financial_summary?: unknown;
  created_at?: string | null;
};

type TrackingUpdate = Partial<Pick<EventRow,
  | "status"
  | "payment_status"
  | "expected_payment_date"
  | "submitted_amount"
  | "assessed_amount"
  | "paid_amount"
  | "disallowed_amount"
  | "balance_outstanding"
  | "last_chased_date"
  | "next_chase_date"
  | "client_response"
  | "dispute_reason"
  | "agreed_payment_date"
>>;

type EwnRow = {
  id: string;
  title: string | null;
  status: string | null;
  project_id?: string | null;
  project_name?: string | null;
  main_contractor?: string | null;
  event_date?: string | null;
  impact?: string | null;
  converted_event_id?: string | null;
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

function fullMoney(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number.isFinite(v) ? v : 0);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function numberOrNull(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function moneyInputValue(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function cleanMoneyInput(value: string) {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

function submittedTrackingValue(event: EventRow, fallbackValue?: number | null) {
  return numberOrNull(event.submitted_amount) ?? numberOrNull(fallbackValue) ?? 0;
}

function assessedTrackingValue(event: EventRow, fallbackValue?: number | null) {
  return numberOrNull(event.assessed_amount) ?? submittedTrackingValue(event, fallbackValue);
}

function paidTrackingValue(event: EventRow, fallbackValue?: number | null) {
  if (normalisePaymentStatus(event.payment_status) === "paid" && numberOrNull(event.paid_amount) === null) return assessedTrackingValue(event, fallbackValue);
  return numberOrNull(event.paid_amount) ?? 0;
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

function nextTrackingState(next: TrackingUpdate) {
  const patch = { ...next };
  if (patch.status) {
    const status = normaliseCommercialStatus(patch.status);
    const paymentWasExplicitlyChanged = Object.prototype.hasOwnProperty.call(next, "payment_status");
    if (status === "paid" || status === "complete") patch.payment_status = "paid";
    if ((status === "submitted" || status === "accepted") && !paymentWasExplicitlyChanged) patch.payment_status = "submitted_for_payment";
    if ((status === "draft" || status === "review" || status === "ready" || status === "rejected") && !paymentWasExplicitlyChanged) patch.payment_status = "not_applied";
  }
  if (patch.payment_status === "paid" && !patch.status) patch.status = "paid";
  return patch;
}

function recoveryActionSummary(patch: Partial<EventRow>) {
  const parts = [
    patch.status ? `CE status: ${getCommercialStatusLabel(patch.status)}` : null,
    patch.payment_status ? `Payment: ${getPaymentStatusLabel(patch.payment_status)}` : null,
    patch.expected_payment_date ? `Expected payment: ${formatDateShort(patch.expected_payment_date)}` : null,
    numberOrNull(patch.submitted_amount) !== null ? `Submitted: ${fullMoney(Number(patch.submitted_amount))}` : null,
    numberOrNull(patch.assessed_amount) !== null ? `Assessed: ${fullMoney(Number(patch.assessed_amount))}` : null,
    numberOrNull(patch.paid_amount) !== null ? `Paid: ${fullMoney(Number(patch.paid_amount))}` : null,
    patch.last_chased_date ? `Last chased: ${formatDateShort(patch.last_chased_date)}` : null,
    patch.next_chase_date ? `Next chase: ${formatDateShort(patch.next_chase_date)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" • ") : "Project payment tracking updated.";
}

function paymentEditable(event: EventRow) {
  const status = normaliseCommercialStatus(event.status);
  return status === "submitted" || status === "accepted" || status === "paid" || normalisePaymentStatus(event.payment_status) === "paid";
}

function projectKey(project: { project_name?: string | null; main_contractor?: string | null }) {
  return `${String(project.project_name ?? "").trim().toLowerCase()}__${String(project.main_contractor ?? "").trim().toLowerCase()}`;
}

function belongsToProject(row: { project_id?: string | null; project_name?: string | null; main_contractor?: string | null }, project: ProjectRow) {
  if (row.project_id && row.project_id === project.id) return true;
  return projectKey(row) === projectKey(project);
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

function nextAction(events: EventRow[], ewns: EwnRow[]) {
  const overdue = events.filter(isOverdue).sort((a, b) => outstandingValue(b) - outstandingValue(a))[0];
  if (overdue) return { label: "Chase payment", detail: `${displayEventReference(overdue)} is overdue. Outstanding ${money(outstandingValue(overdue))}.`, href: `/app?trackPayment=${overdue.id}`, tone: "red" as const };
  const openEwn = ewns.find((ewn) => ewn.status !== "converted" && ewn.status !== "closed");
  if (openEwn) return { label: "Review EWN", detail: openEwn.title || "Open EWN needs review.", href: `/app/ewns?ewn=${openEwn.id}`, tone: "amber" as const };
  const draft = events.find((event) => ["draft", "review", "ready"].includes(normaliseCommercialStatus(event.status)));
  if (draft) return { label: "Continue CE", detail: draft.title || displayEventReference(draft), href: `/app/event/${draft.id}`, tone: "blue" as const };
  return { label: "No urgent action", detail: "Project is commercially quiet at the moment.", href: "/app/new", tone: "neutral" as const };
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [ewns, setEwns] = useState<EwnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const supabase = supabaseBrowser();
        const user = await getRequiredUser(supabase);
        const projectRes = await (supabase as any).from("projects")
          .select("id,project_name,main_contractor,contract_type,status,job_number,start_date,completion_date,project_manager,quantity_surveyor,notes")
          .eq("user_id", user.id)
          .eq("id", params.id)
          .single();
        if (projectRes.error) throw projectRes.error;
        const nextProject = projectRes.data as ProjectRow;

        const eventSelects = [
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference,expected_payment_date,payment_status,submitted_amount,assessed_amount,paid_amount,disallowed_amount,balance_outstanding,last_chased_date,next_chase_date,client_response,dispute_reason,agreed_payment_date,last_action_type,last_action_date,event_financial_summary,created_at",
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference,expected_payment_date,payment_status,submitted_amount,assessed_amount,paid_amount,balance_outstanding,event_financial_summary,created_at",
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference,expected_payment_date,payment_status,event_financial_summary,created_at",
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference,expected_payment_date,payment_status,created_at",
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference,event_financial_summary,created_at",
          "id,title,status,project_id,project_name,main_contractor,contract_type,event_number,event_reference,created_at",
          "id,title,status,project_name,main_contractor,contract_type,event_number,event_reference,created_at",
          "id,title,status,project_name,main_contractor,contract_type,created_at",
        ];

        const ewnSelects = [
          "id,title,status,project_id,project_name,main_contractor,event_date,impact,converted_event_id",
          "id,title,status,project_id,project_name,main_contractor,event_date,impact",
          "id,title,status,project_id,project_name,main_contractor",
          "id,title,status,project_name,main_contractor",
        ];

        async function selectWithFallback<T>(table: "events" | "ewns", selects: string[]) {
          let lastError: unknown = null;
          for (const selectColumns of selects) {
            const result = await (supabase as any).from(table).select(selectColumns).eq("user_id", user.id);
            if (!result.error) return (result.data ?? []) as T[];

            lastError = result.error;
            const message = String(result.error.message || "");
            const canTryFallback = /project_id|expected_payment_date|payment_status|submitted_amount|assessed_amount|paid_amount|disallowed_amount|balance_outstanding|last_chased_date|next_chase_date|client_response|dispute_reason|agreed_payment_date|last_action_type|last_action_date|event_financial_summary|converted_event_id|event_date|impact|schema cache|relationship/i.test(message);
            if (!canTryFallback) throw result.error;
          }
          throw lastError instanceof Error ? lastError : new Error(`Failed to load ${table}`);
        }

        const [eventRows, ewnRows] = await Promise.all([
          selectWithFallback<EventRow>("events", eventSelects),
          selectWithFallback<EwnRow>("ewns", ewnSelects),
        ]);
        if (!active) return;
        setProject(nextProject);
        setEvents(eventRows.filter((event) => belongsToProject(event, nextProject)));
        setEwns(ewnRows.filter((ewn) => belongsToProject(ewn, nextProject)));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load project";
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
  }, [params.id, router]);

  const summary = useMemo(() => {
    const recoverable = events.reduce((sum, event) => sum + readTotal(event.event_financial_summary), 0);
    const submitted = events.filter((event) => ["submitted", "accepted", "paid"].includes(normaliseCommercialStatus(event.status))).reduce((sum, event) => sum + assessedValue(event), 0);
    const paid = events.reduce((sum, event) => sum + paidValue(event), 0);
    const outstanding = events.reduce((sum, event) => sum + outstandingValue(event), 0);
    return { recoverable, submitted, paid, outstanding, overdue: events.filter(isOverdue), openEwns: ewns.filter((ewn) => ewn.status !== "converted" && ewn.status !== "closed"), action: nextAction(events, ewns) };
  }, [events, ewns]);

  async function updateProjectEventTracking(eventId: string, next: TrackingUpdate) {
    const previous = events.find((event) => event.id === eventId) ?? null;
    if (!previous) return;

    const patch: Partial<EventRow> = nextTrackingState(next);
    const actionToday = todayInputValue();
    const currentValue = readTotal(previous.event_financial_summary);
    const nextPaymentStatus = Object.prototype.hasOwnProperty.call(patch, "payment_status")
      ? normalisePaymentStatus(patch.payment_status)
      : normalisePaymentStatus(previous.payment_status);

    if (next.status) {
      const nextStatus = normaliseCommercialStatus(next.status);
      patch.last_action_type = nextStatus === "submitted" ? "submitted" : `status_${nextStatus}`;
      patch.last_action_date = actionToday;

      if ((nextStatus === "submitted" || nextStatus === "accepted") && numberOrNull(previous.submitted_amount) === null && currentValue > 0) {
        patch.submitted_amount = currentValue;
        patch.assessed_amount = numberOrNull(previous.assessed_amount) ?? currentValue;
        patch.balance_outstanding = Math.max(0, (patch.assessed_amount ?? currentValue) - paidTrackingValue(previous, currentValue));
      }
    }

    if (Object.prototype.hasOwnProperty.call(next, "payment_status")) {
      patch.last_action_type = nextPaymentStatus === "paid" ? "paid" : "payment_updated";
      patch.last_action_date = actionToday;
      if (nextPaymentStatus === "paid") {
        const assessed = assessedTrackingValue({ ...previous, ...patch }, currentValue);
        patch.paid_amount = numberOrNull(patch.paid_amount) ?? numberOrNull(previous.paid_amount) ?? assessed;
        patch.balance_outstanding = 0;
        patch.status = "paid";
      }
    }

    if (Object.prototype.hasOwnProperty.call(next, "expected_payment_date")) {
      patch.expected_payment_date = next.expected_payment_date || null;
      patch.last_action_type = "payment_date_updated";
      patch.last_action_date = actionToday;
    }

    if (
      Object.prototype.hasOwnProperty.call(next, "submitted_amount") ||
      Object.prototype.hasOwnProperty.call(next, "assessed_amount") ||
      Object.prototype.hasOwnProperty.call(next, "paid_amount") ||
      Object.prototype.hasOwnProperty.call(next, "disallowed_amount")
    ) {
      const merged = { ...previous, ...patch };
      patch.balance_outstanding = Math.max(0, assessedTrackingValue(merged, currentValue) - paidTrackingValue(merged, currentValue));
      patch.last_action_type = "value_updated";
      patch.last_action_date = actionToday;
    }

    if (
      Object.prototype.hasOwnProperty.call(next, "last_chased_date") ||
      Object.prototype.hasOwnProperty.call(next, "next_chase_date") ||
      Object.prototype.hasOwnProperty.call(next, "client_response") ||
      Object.prototype.hasOwnProperty.call(next, "dispute_reason") ||
      Object.prototype.hasOwnProperty.call(next, "agreed_payment_date")
    ) {
      patch.last_action_type = Object.prototype.hasOwnProperty.call(next, "last_chased_date") ? "chased" : "recovery_updated";
      patch.last_action_date = actionToday;
    }

    setEvents((prev) => prev.map((event) => (event.id === eventId ? { ...event, ...patch } : event)));

    try {
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      let update = await (supabase as any).from("events").update(patch).eq("id", eventId).eq("user_id", user.id);

      if (update.error && patch.payment_status === "submitted_for_payment") {
        update = await (supabase as any).from("events")
          .update({ ...patch, payment_status: "applied" })
          .eq("id", eventId)
          .eq("user_id", user.id);
      }

      if (update.error) {
        const message = String(update.error.message || "");
        const fallbackNext: Partial<EventRow> = { ...patch };
        if (/payment_status/i.test(message)) delete fallbackNext.payment_status;
        if (/expected_payment_date/i.test(message)) delete fallbackNext.expected_payment_date;
        if (/submitted_amount/i.test(message)) delete fallbackNext.submitted_amount;
        if (/assessed_amount/i.test(message)) delete fallbackNext.assessed_amount;
        if (/paid_amount/i.test(message)) delete fallbackNext.paid_amount;
        if (/disallowed_amount/i.test(message)) delete fallbackNext.disallowed_amount;
        if (/balance_outstanding/i.test(message)) delete fallbackNext.balance_outstanding;
        if (/last_chased_date/i.test(message)) delete fallbackNext.last_chased_date;
        if (/next_chase_date/i.test(message)) delete fallbackNext.next_chase_date;
        if (/client_response/i.test(message)) delete fallbackNext.client_response;
        if (/dispute_reason/i.test(message)) delete fallbackNext.dispute_reason;
        if (/agreed_payment_date/i.test(message)) delete fallbackNext.agreed_payment_date;
        if (/last_action_type/i.test(message)) delete fallbackNext.last_action_type;
        if (/last_action_date/i.test(message)) delete fallbackNext.last_action_date;
        if (Object.keys(fallbackNext).length === Object.keys(patch).length) throw update.error;
        if (Object.keys(fallbackNext).length > 0) {
          const fallback = await (supabase as any).from("events").update(fallbackNext).eq("id", eventId).eq("user_id", user.id);
          if (fallback.error) throw fallback.error;
        }
      }

      await (supabase as any).from("event_actions").insert({
        event_id: eventId,
        user_id: user.id,
        action_type: patch.last_action_type || "tracking_updated",
        action_date: patch.last_action_date || actionToday,
        notes: recoveryActionSummary(patch),
        metadata: patch,
      });
    } catch (err) {
      console.error("Failed to update project CE tracking", err);
      setEvents((prev) => prev.map((event) => (event.id === eventId ? previous : event)));
    }
  }

  if (loading) return <div style={{ color: c.sub, fontWeight: 800 }}>Loading project...</div>;
  if (err) return <div style={{ border: `1px solid ${c.redBd}`, background: c.redBg, color: c.redTx, borderRadius: 16, padding: 16, fontWeight: 800 }}>{err}</div>;
  if (!project) return <div style={{ color: c.sub, fontWeight: 800 }}>Project not found.</div>;

  const actionTone = summary.action.tone === "red" ? { bg: c.redBg, bd: c.redBd, tx: c.redTx } : summary.action.tone === "amber" ? { bg: c.amberBg, bd: c.amberBd, tx: c.amberTx } : summary.action.tone === "blue" ? { bg: c.blueBg, bd: c.blueBd, tx: c.blueTx } : { bg: c.soft, bd: c.border, tx: c.sub };
  const encodedProject = encodeURIComponent(project.project_name);
  const encodedContractor = encodeURIComponent(project.main_contractor || "");
  const encodedContract = project.contract_type ? encodeURIComponent(project.contract_type) : "";

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
          <div>
            <Link href="/app/projects" style={{ color: c.sub, fontSize: 13, fontWeight: 800, textDecoration: "none" }}>← Projects</Link>
            <h1 style={{ margin: "8px 0 0", color: c.black, fontSize: 28, letterSpacing: 0, lineHeight: 1.15 }}>{project.project_name}</h1>
            <p style={{ margin: "7px 0 0", color: c.sub, fontSize: 13, fontWeight: 700 }}>{project.main_contractor || "Contractor not set"} • {getContractLabel(project.contract_type)}</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href={`/app/new?project=${encodedProject}&main_contractor=${encodedContractor}&contract_type=${encodedContract}&project_id=${project.id}`} style={buttonStyle("primary")}>+ New CE</Link>
            <Link href={`/app/ewns/new?project=${encodedProject}&main_contractor=${encodedContractor}&contract_type=${encodedContract}&project_id=${project.id}`} style={buttonStyle("quiet")}>+ New EWN</Link>
            <Link href="/app/rates" style={buttonStyle("quiet")}>Rate cards</Link>
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12 }}>
        <Metric label="Recoverable" value={money(summary.recoverable)} />
        <Metric label="Submitted" value={money(summary.submitted)} />
        <Metric label="Paid" value={money(summary.paid)} />
        <Metric label="Outstanding" value={money(summary.outstanding)} />
        <Metric label="Overdue" value={summary.overdue.length} />
        <Metric label="Open EWNs" value={summary.openEwns.length} />
      </div>

      <section style={{ border: `1px solid ${actionTone.bd}`, background: actionTone.bg, color: actionTone.tx, borderRadius: 20, padding: 18, display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>Next action</div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800 }}>{summary.action.label}</div>
          <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700 }}>{summary.action.detail}</div>
        </div>
        <Link href={summary.action.href} style={{ ...buttonStyle("primary"), background: c.black, color: c.blackContrast }}>Open action →</Link>
      </section>

      <section style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 18 }}>
        <h2 style={{ margin: 0, color: c.black, fontSize: 18 }}>Project CEs / variations</h2>
        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
          {events.length === 0 ? <div style={{ color: c.sub, fontWeight: 800, padding: 12 }}>No CEs on this project yet.</div> : events.map((event) => {
            const editable = paymentEditable(event);
            const balance = outstandingValue(event);
            const balanceTone = isOverdue(event) ? { bg: c.redBg, bd: c.redBd, tx: c.redTx } : balance > 0 ? { bg: c.amberBg, bd: c.amberBd, tx: c.amberTx } : { bg: c.greenBg, bd: c.greenBd, tx: c.greenTx };
            return (
            <div key={event.id} style={{ border: `1px solid ${c.border}`, background: c.soft, borderRadius: 16, padding: 14, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 130px 150px 140px", gap: 12, alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <Link href={`/app/event/${event.id}`} style={{ color: c.black, fontSize: 15, fontWeight: 800, textDecoration: "none" }}>{displayEventReference(event)} — {event.title || "Untitled CE"}</Link>
                  <div style={{ marginTop: 4, color: c.sub, fontSize: 12, fontWeight: 700 }}>Created {formatDateShort(event.created_at)}</div>
                </div>
                <Badge label={getCommercialStatusLabel(event.status)} tone="blue" />
                <Badge label={getPaymentStatusLabel(event.payment_status)} tone={normalisePaymentStatus(event.payment_status) === "paid" ? "green" : isOverdue(event) ? "red" : "amber"} />
                <div style={{ color: c.black, fontWeight: 800, textAlign: "right" }}>{money(outstandingValue(event))}</div>
              </div>
              <details style={{ borderTop: `1px solid ${c.border}`, paddingTop: 10 }}>
                <summary style={{ cursor: "pointer", color: c.blueTx, fontSize: 12.5, fontWeight: 800, listStyle: "none" }}>Manage payment tracking ▾</summary>
                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, alignItems: "end" }}>
                  <TrackingSelect label="CE status" value={normaliseCommercialStatus(event.status)} onChange={(value) => void updateProjectEventTracking(event.id, { status: value })}>
                    {getAllowedCommercialStatusOptions(event.status).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </TrackingSelect>
                  <TrackingSelect label="Payment" value={normalisePaymentStatus(event.payment_status)} onChange={(value) => void updateProjectEventTracking(event.id, { payment_status: value })} disabled={!editable}>
                    {PAYMENT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </TrackingSelect>
                  <TrackingInput label="Expected payment" type="date" value={toDateInputValue(event.expected_payment_date)} onChange={(value) => void updateProjectEventTracking(event.id, { expected_payment_date: value || null })} />
                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: c.sub }}>Balance outstanding</span>
                    <div style={{ height: 40, display: "flex", alignItems: "center", borderRadius: 12, border: `1px solid ${balanceTone.bd}`, background: balanceTone.bg, padding: "0 10px", fontSize: 13, fontWeight: 800, color: balanceTone.tx }}>{fullMoney(balance)}</div>
                  </div>
                  <TrackingInput label="Submitted amount" type="number" value={moneyInputValue(event.submitted_amount)} onChange={(value) => void updateProjectEventTracking(event.id, { submitted_amount: cleanMoneyInput(value) })} disabled={!editable} />
                  <TrackingInput label="Assessed amount" type="number" value={moneyInputValue(event.assessed_amount)} onChange={(value) => void updateProjectEventTracking(event.id, { assessed_amount: cleanMoneyInput(value) })} disabled={!editable} />
                  <TrackingInput label="Paid amount" type="number" value={moneyInputValue(event.paid_amount)} onChange={(value) => void updateProjectEventTracking(event.id, { paid_amount: cleanMoneyInput(value) })} disabled={!editable} />
                  <TrackingInput label="Disallowed amount" type="number" value={moneyInputValue(event.disallowed_amount)} onChange={(value) => void updateProjectEventTracking(event.id, { disallowed_amount: cleanMoneyInput(value) })} disabled={!editable} />
                  <TrackingInput label="Last chased" type="date" value={toDateInputValue(event.last_chased_date)} onChange={(value) => void updateProjectEventTracking(event.id, { last_chased_date: value || null })} disabled={!editable} />
                  <TrackingInput label="Next chase" type="date" value={toDateInputValue(event.next_chase_date)} onChange={(value) => void updateProjectEventTracking(event.id, { next_chase_date: value || null })} disabled={!editable} />
                  <TrackingInput label="Agreed payment" type="date" value={toDateInputValue(event.agreed_payment_date)} onChange={(value) => void updateProjectEventTracking(event.id, { agreed_payment_date: value || null })} disabled={!editable} />
                  <TrackingInput label="Client response" value={event.client_response ?? ""} onChange={(value) => void updateProjectEventTracking(event.id, { client_response: value })} disabled={!editable} wide placeholder="e.g. Awaiting QS assessment / queried labour" />
                  <TrackingInput label="Dispute / short-pay reason" value={event.dispute_reason ?? ""} onChange={(value) => void updateProjectEventTracking(event.id, { dispute_reason: value })} disabled={!editable} wide placeholder="e.g. Prelims discounted / causation challenged" />
                  <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                    <Link href={`/app/event/${event.id}`} style={buttonStyle("primary")}>Open CE →</Link>
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: c.sub, lineHeight: 1.45 }}>Tracking stays internal and powers the project totals plus the main recovery dashboard.</div>
              </details>
            </div>
          );})}
        </div>
      </section>

      <section style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 18 }}>
        <h2 style={{ margin: 0, color: c.black, fontSize: 18 }}>Project EWNs</h2>
        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
          {ewns.length === 0 ? <div style={{ color: c.sub, fontWeight: 800, padding: 12 }}>No EWNs on this project yet.</div> : ewns.map((ewn) => (
            <Link key={ewn.id} href={ewn.converted_event_id ? `/app/event/${ewn.converted_event_id}` : `/app/ewns?ewn=${ewn.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ border: `1px solid ${c.border}`, background: c.soft, borderRadius: 16, padding: 14, display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 120px 140px", gap: 12, alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: c.black, fontSize: 15, fontWeight: 800 }}>{ewn.title || "Untitled EWN"}</div>
                  <div style={{ marginTop: 4, color: c.sub, fontSize: 12, fontWeight: 700 }}>{ewn.impact || "Impact not recorded"}</div>
                </div>
                <div style={{ color: c.sub, fontSize: 12, fontWeight: 800 }}>{formatDateShort(ewn.event_date)}</div>
                <Badge label={ewn.status === "converted" ? "Converted" : ewn.status || "Open"} tone={ewn.status === "converted" ? "green" : "amber"} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 18, padding: 16, minHeight: 98 }}>
      <div style={{ color: c.sub, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>{label}</div>
      <div style={{ marginTop: 14, color: c.black, fontSize: 23, fontWeight: 800, letterSpacing: 0, lineHeight: 1.08 }}>{value}</div>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "green" | "blue" | "amber" | "red" }) {
  const colors = tone === "green" ? { bg: c.greenBg, bd: c.greenBd, tx: c.greenTx } : tone === "blue" ? { bg: c.blueBg, bd: c.blueBd, tx: c.blueTx } : tone === "red" ? { bg: c.redBg, bd: c.redBd, tx: c.redTx } : { bg: c.amberBg, bd: c.amberBd, tx: c.amberTx };
  return <span style={{ justifySelf: "start", border: `1px solid ${colors.bd}`, background: colors.bg, color: colors.tx, borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 800, textTransform: "capitalize" }}>{label}</span>;
}

function buttonStyle(kind: "primary" | "quiet"): React.CSSProperties {
  return {
    border: `1px solid ${kind === "primary" ? c.black : c.border}`,
    background: kind === "primary" ? c.black : c.input,
    color: kind === "primary" ? c.blackContrast : c.black,
    borderRadius: 14,
    padding: "11px 13px",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
    whiteSpace: "nowrap",
  };
}

function fieldStyle(disabled = false): React.CSSProperties {
  return {
    width: "100%",
    height: 40,
    borderRadius: 12,
    border: `1px solid ${c.border}`,
    background: disabled ? c.soft : c.input,
    padding: "0 10px",
    fontSize: 13,
    color: c.text,
    cursor: disabled ? "not-allowed" : "auto",
  };
}

function TrackingInput({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  wide = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date" | "number";
  disabled?: boolean;
  wide?: boolean;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 6, gridColumn: wide ? "1 / -1" : undefined }}>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: c.sub }}>{label}</span>
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        style={fieldStyle(disabled)}
      />
    </label>
  );
}

function TrackingSelect({
  label,
  value,
  onChange,
  disabled = false,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: c.sub }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={fieldStyle(disabled)}>
        {children}
      </select>
    </label>
  );
}
