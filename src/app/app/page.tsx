"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getContractLabel } from "@/lib/contracts";
import { displayEventReference } from "@/lib/eventReference";
import { readFinalTotal, recalculateEventFinancialSummary } from "@/lib/financialSummary";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";
import {
  PAYMENT_STATUS_OPTIONS,
  calculateTimeRisk,
  formatDateShort,
  getAllowedCommercialStatusOptions,
  getCommercialStatusLabel,
  getDefaultNoticePeriodDays,
  getPaymentStatusLabel,
  normaliseCommercialStatus,
  normalisePaymentStatus,
  toDateInputValue,
} from "@/lib/commercialControl";

type EventRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at?: string | null;
  contract_type?: string | null;
  event_number?: number | null;
  event_reference?: string | null;
  project_name?: string | null;
  main_contractor?: string | null;
  event_date?: string | null;
  notice_period_days?: number | null;
  notification_deadline?: string | null;
  payment_status?: string | null;
  submitted_date?: string | null;
  expected_payment_date?: string | null;
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
};

type DashboardAction = {
  id: string;
  eventId: string;
  severity: 1 | 2 | 3 | 4;
  eyebrow: string;
  title: string;
  detail: string;
  value: number | null;
  sortDate: Date | null;
  href: string;
  cta: string;
  tone: "red" | "amber" | "blue" | "neutral";
};

type FocusAction = {
  event: EventRow;
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone: "red" | "amber" | "blue" | "neutral";
};

type EventValueMap = Record<string, number | null>;

type FocusProgress = {
  basis: boolean;
  evidence: boolean;
  resources: boolean;
  prelims: boolean;
  review: boolean;
};

const c = {
  bg: "var(--background)",
  card: "var(--surface)",
  raised: "var(--surface-raised)",
  input: "var(--surface-input)",
  border: "var(--border)",
  borderStrong: "var(--border-strong)",
  sub: "var(--text-muted)",
  text: "var(--foreground)",
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
  soft: "var(--surface-soft)",
  softBlue: "var(--accent-soft)",
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
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(v) ? v : 0);
}

function fullMoney(v: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(v) ? v : 0);
}

function niceDate(v?: string | null) {
  return formatDateShort(v);
}

function projectContext(e: EventRow) {
  const project = e.project_name?.trim();
  const contractor = e.main_contractor?.trim();
  if (project && contractor) return `${project} — ${contractor}`;
  if (project) return project;
  if (contractor) return contractor;
  return "Project not set";
}


function todayInputValue() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateOnly(dateLike?: string | Date | null) {
  if (!dateLike) return null;
  const d = typeof dateLike === "string" ? new Date(dateLike) : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(from?: string | Date | null, to: string | Date | null = new Date()) {
  const fromDate = dateOnly(from);
  const toDate = dateOnly(to);
  if (!fromDate || !toDate) return null;
  return Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000);
}

function pluralDays(days: number) {
  return `${days} day${days === 1 ? "" : "s"}`;
}

function hasCommercialValue(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function moneyInputValue(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return String(value);
}

function cleanMoneyInput(value: string) {
  if (!value.trim()) return null;
  const next = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(next) ? Math.max(0, next) : null;
}

function numberOrNull(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function submittedAmount(event: EventRow, fallbackValue?: number | null) {
  return numberOrNull(event.submitted_amount) ?? numberOrNull(fallbackValue) ?? 0;
}

function assessedAmount(event: EventRow, fallbackValue?: number | null) {
  return numberOrNull(event.assessed_amount) ?? submittedAmount(event, fallbackValue);
}

function paidAmount(event: EventRow, fallbackValue?: number | null) {
  const paid = numberOrNull(event.paid_amount);
  if (paid !== null) return paid;
  return normalisePaymentStatus(event.payment_status) === "paid" ? assessedAmount(event, fallbackValue) : 0;
}

function balanceOutstanding(event: EventRow, fallbackValue?: number | null) {
  const explicit = numberOrNull(event.balance_outstanding);
  if (explicit !== null) return explicit;
  if (normalisePaymentStatus(event.payment_status) === "paid") return 0;
  return Math.max(0, assessedAmount(event, fallbackValue) - paidAmount(event, fallbackValue));
}

function paymentDueDate(event: EventRow) {
  return dateOnly(event.expected_payment_date);
}

function isUnpaidCe(status?: string | null, paymentStatus?: string | null) {
  const s = normaliseCommercialStatus(status);
  return (s === "submitted" || s === "accepted") && getPaymentState(paymentStatus) !== "paid";
}

function isOverdueCe(event: EventRow) {
  if (!isUnpaidCe(event.status, event.payment_status)) return false;
  const due = paymentDueDate(event);
  const dueDay = dateOnly(due);
  const today = dateOnly(new Date());
  if (!dueDay || !today) return false;
  return today.getTime() > dueDay.getTime();
}

function paymentAgeDetail(event: EventRow) {
  const days = daysBetween(event.submitted_date || event.created_at);
  if (days === null) return "submitted date not set";
  return `submitted ${pluralDays(Math.max(0, days))} ago`;
}

function actionAgeDetail(event: EventRow) {
  const lastActionDate = event.last_action_date || event.submitted_date || event.created_at;
  const days = daysBetween(lastActionDate);
  if (days === null) return null;

  const rawAction = String(event.last_action_type || "updated");
  const actionLabel: Record<string, string> = {
    submitted: "submitted",
    status_submitted: "submitted",
    status_accepted: "accepted",
    status_rejected: "rejected",
    status_ready: "marked ready",
    status_review: "moved to review",
    status_draft: "moved to draft",
    status_paid: "paid",
    paid: "paid",
    payment_updated: "payment updated",
    payment_date_updated: "payment date updated",
    value_updated: "value updated",
    chased: "chased",
    recovery_updated: "recovery updated",
    updated: "updated",
  };

  if (rawAction === "submitted" || event.submitted_date === lastActionDate) {
    return `submitted ${pluralDays(Math.max(0, days))} ago`;
  }
  return `${actionLabel[rawAction] || rawAction.replace(/_/g, " ")} ${pluralDays(Math.max(0, days))} ago`;
}

function staleActionDetail(event: EventRow) {
  const lastActionDate = event.last_action_date || event.submitted_date || event.created_at;
  const days = daysBetween(lastActionDate);
  if (days === null) return null;
  return `no action for ${pluralDays(Math.max(0, days))}`;
}

function recoveryActionSummary(patch: Partial<EventRow>) {
  if (patch.last_action_type === "chased") return "Payment chased.";
  if (patch.last_action_type === "value_updated") return "Recovery values updated.";
  if (patch.last_action_type === "payment_date_updated") return "Expected payment date updated.";
  if (patch.last_action_type === "paid") return "Payment marked paid.";
  if (patch.last_action_type?.startsWith("status_")) return `CE status changed to ${patch.status}.`;
  if (patch.last_action_type === "recovery_updated") return "Recovery notes updated.";
  return "Tracking updated.";
}

function paymentDueDetail(event: EventRow) {
  const due = paymentDueDate(event);
  if (!due) return "Payment date not set.";
  return `Due ${formatDateShort(due)}`;
}

function paymentActionDetail(event: EventRow, overdue: boolean) {
  const due = paymentDueDate(event);
  const age = actionAgeDetail(event) || paymentAgeDetail(event);

  if (overdue && due) {
    const lateDays = Math.max(0, daysBetween(due) ?? 0);
    const stale = staleActionDetail(event);
    return `Overdue by ${pluralDays(lateDays)}${stale ? ` • ${stale}` : ""}.`;
  }

  if (due) return age ? `${paymentDueDetail(event)} • ${age}.` : `${paymentDueDetail(event)}.`;
  return "Payment date not set.";
}

function statusTone(status?: string | null) {
  const s = normaliseCommercialStatus(status);
  if (s === "paid" || s === "accepted" || s === "complete") return { bg: c.greenBg, bd: c.greenBd, tx: c.greenTx };
  if (s === "submitted") return { bg: c.blueBg, bd: c.blueBd, tx: c.blueTx };
  if (s === "rejected") return { bg: c.redBg, bd: c.redBd, tx: c.redTx };
  if (s === "review" || s === "ready") return { bg: c.amberBg, bd: c.amberBd, tx: c.amberTx };
  return { bg: c.card, bd: c.border, tx: c.sub };
}


function isCommerciallyClosed(status?: string | null, paymentStatus?: string | null) {
  const s = normaliseCommercialStatus(status);
  return s === "paid" || s === "complete" || getPaymentState(paymentStatus) === "paid";
}

function isSubmissionOutstanding(status?: string | null) {
  const s = normaliseCommercialStatus(status);
  return s === "draft" || s === "review" || s === "ready";
}

function isSubmittedOrAccepted(status?: string | null) {
  const s = normaliseCommercialStatus(status);
  return s === "submitted" || s === "accepted";
}

function getPaymentState(paymentStatus?: string | null) {
  return normalisePaymentStatus(paymentStatus);
}

function paymentTone(status?: string | null) {
  const p = getPaymentState(status);
  if (p === "paid") return { bg: c.greenBg, bd: c.greenBd, tx: c.greenTx };
  if (p === "disputed_short_paid") return { bg: c.redBg, bd: c.redBd, tx: c.redTx };
  if (p === "assessed" || p === "submitted_for_payment" || p === "part_paid") return { bg: c.amberBg, bd: c.amberBd, tx: c.amberTx };
  return { bg: c.card, bd: c.border, tx: c.sub };
}

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

function actionTone(tone: DashboardAction["tone"]) {
  if (tone === "red") return { bg: c.redBg, bd: c.redBd, tx: c.redTx };
  if (tone === "amber") return { bg: c.amberBg, bd: c.amberBd, tx: c.amberTx };
  if (tone === "blue") return { bg: c.blueBg, bd: c.blueBd, tx: c.blueTx };
  return { bg: c.card, bd: c.border, tx: c.sub };
}

function paymentTrackingHref(eventId: string) {
  return `/app?trackPayment=${encodeURIComponent(eventId)}`;
}

function registerActionFor(event: EventRow) {
  const status = normaliseCommercialStatus(event.status);
  if (isCommerciallyClosed(status, event.payment_status)) {
    return { label: "View record", href: `/app/event/${event.id}/review` };
  }
  if (status === "rejected") {
    return { label: "Open rebuttal", href: `/app/event/${event.id}/review?mode=rebuttal` };
  }
  if (status === "submitted" || status === "accepted") {
    return { label: "Track payment", href: paymentTrackingHref(event.id) };
  }
  return { label: "Continue", href: `/app/event/${event.id}` };
}

function registerStateLine(event: EventRow) {
  const status = normaliseCommercialStatus(event.status);
  if (isCommerciallyClosed(status, event.payment_status)) return "Paid — removed from live unpaid and overdue actions.";
  if (status === "rejected") return "Rejected — rebuttal workflow is the next commercial action.";
  if (status === "accepted") return "Accepted — awaiting payment until marked paid.";
  if (status === "submitted") return "Submitted — payment tracking is now live.";
  if (status === "ready") return "Ready — submit or keep completing the pack.";
  if (status === "review") return "In review — not yet submitted.";
  return "Draft — not yet submitted.";
}

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: 18,
        padding: 22,
        boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
      }}
    >
      <div style={{ display: "grid", gap: 6, marginBottom: 18 }}>
        <div style={{ fontSize: 16, lineHeight: 1.25, fontWeight: 650, color: c.text, letterSpacing: 0 }}>{title}</div>
        {hint ? <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub, maxWidth: 760 }}>{hint}</div> : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, hint, tone = "default" }: { label: string; value: React.ReactNode; hint?: string; tone?: "default" | "red" | "amber" | "blue" | "green" }) {
  const toneMap =
    tone === "red"
      ? { bg: c.redBg, bd: c.redBd }
      : tone === "amber"
      ? { bg: c.amberBg, bd: c.amberBd }
      : tone === "blue"
      ? { bg: c.blueBg, bd: c.blueBd }
      : tone === "green"
      ? { bg: c.greenBg, bd: c.greenBd }
      : { bg: c.card, bd: c.border };

  return (
    <div
      style={{
        background: toneMap.bg,
        border: `1px solid ${toneMap.bd}`,
        borderRadius: 18,
        padding: 20,
        minHeight: 118,
        display: "grid",
        gridTemplateRows: "30px 34px minmax(34px, auto)",
        alignItems: "start",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 650, color: c.sub, textTransform: "uppercase", letterSpacing: 0.6, lineHeight: 1.2 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 650, color: c.text, letterSpacing: 0, lineHeight: 1.06 }}>{value}</div>
      {hint ? <div style={{ fontSize: 12, lineHeight: 1.45, color: c.sub }}>{hint}</div> : <div />}
    </div>
  );
}

function QuietButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <button
        style={{
          height: 46,
          padding: "0 15px",
          borderRadius: 15,
          border: `1px solid ${c.border}`,
          background: c.input,
          color: c.text,
          fontWeight: 650,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        {children}
      </button>
    </Link>
  );
}


function CompactStatusCard({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "green" | "blue" | "amber" }) {
  const toneMap =
    tone === "green"
      ? { bg: c.greenBg, bd: c.greenBd }
      : tone === "blue"
      ? { bg: c.blueBg, bd: c.blueBd }
      : tone === "amber"
      ? { bg: c.amberBg, bd: c.amberBd }
      : { bg: c.card, bd: c.border };

  return (
    <div
      style={{
        background: toneMap.bg,
        border: `1px solid ${toneMap.bd}`,
        borderRadius: 16,
        padding: "15px 16px",
        minHeight: 92,
        display: "grid",
        alignContent: "space-between",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 10.5, fontWeight: 650, color: c.sub, textTransform: "uppercase", letterSpacing: 0.55 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 650, color: c.text, letterSpacing: 0, lineHeight: 1.05 }}>{value}</div>
    </div>
  );
}

function focusActionFor(row: { event: EventRow; value: number | null; status: string; timeRisk: ReturnType<typeof calculateTimeRisk> }): FocusAction | null {
  const title = row.event.title || "Untitled CE";

  if (row.status === "rejected") {
    return {
      event: row.event,
      eyebrow: "Rejected",
      title: `Prepare rebuttal for ${title}`,
      detail: "Rejected — respond with the commercial position.",
      href: `/app/event/${row.event.id}/review?mode=rebuttal`,
      cta: "Open CE →",
      tone: "red",
    };
  }

  if (isSubmissionOutstanding(row.status) && (row.timeRisk.state === "overdue" || row.timeRisk.state === "due_soon")) {
    return {
      event: row.event,
      eyebrow: "Notice deadline",
      title: `Continue ${title}`,
      detail: row.timeRisk.state === "overdue" ? row.timeRisk.detail : row.timeRisk.label,
      href: `/app/event/${row.event.id}`,
      cta: "Open CE →",
      tone: row.timeRisk.state === "overdue" ? "red" : "amber",
    };
  }

  if (row.status === "draft" || row.status === "review" || row.status === "ready") {
    return {
      event: row.event,
      eyebrow: row.status === "ready" ? "Ready to submit" : "Draft",
      title: `Continue ${title}`,
      detail: row.status === "ready" ? "Ready — submit or complete final review." : "Draft not submitted.",
      href: row.status === "ready" ? `/app/event/${row.event.id}/review` : `/app/event/${row.event.id}`,
      cta: "Open CE →",
      tone: row.status === "ready" ? "blue" : "neutral",
    };
  }

  if (isUnpaidCe(row.status, row.event.payment_status)) {
    return {
      event: row.event,
      eyebrow: isOverdueCe(row.event) ? "Payment overdue" : "Unpaid",
      title: `Track payment for ${title}`,
      detail: paymentActionDetail(row.event, isOverdueCe(row.event)),
      href: paymentTrackingHref(row.event.id),
      cta: "Track payment →",
      tone: isOverdueCe(row.event) ? "red" : "blue",
    };
  }

  return null;
}

function CurrentFocusPanel({
  focusAction,
  focusLoading,
  focusProgress,
  focusItems,
  nextFocusAction,
  projectFilterLabel,
}: {
  focusAction: FocusAction | null;
  focusLoading: boolean;
  focusProgress: FocusProgress | null;
  focusItems: Array<{ label: string; done: boolean; kind: "done" | "warning" | "pending" }>;
  nextFocusAction: { label: string; href: string } | null;
  projectFilterLabel: string;
}) {
  return (
    <section
      style={{
        background: c.softBlue,
        border: `1px solid ${c.borderStrong}`,
        borderRadius: 22,
        padding: 22,
        display: "grid",
        gap: 16,
        alignContent: "start",
      }}
    >
      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ fontSize: 12, fontWeight: 650, color: c.sub, letterSpacing: 0.55, textTransform: "uppercase" }}>{`Next action${projectFilterLabel !== "All Projects" ? ` (${projectFilterLabel})` : ""}`}</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: c.sub, letterSpacing: 0, lineHeight: 1.5 }}>
          {focusAction ? "System-selected priority from the live register" : "Create your first Compensation Event"}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 650, color: c.sub, textTransform: "uppercase", letterSpacing: 0.45 }}>{focusAction ? focusAction.eyebrow : "No live action"}</div>
          <div style={{ fontSize: 15, fontWeight: 650, color: c.text, lineHeight: 1.3 }}>{focusAction ? focusAction.title : "No CE drafts yet"}</div>
          <div style={{ fontSize: 13, color: c.sub, lineHeight: 1.5 }}>
            {focusAction ? focusAction.detail : "Create your first event to start building a live submission pack."}
          </div>
        </div>

        {focusAction ? (
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 650, color: c.sub, textTransform: "uppercase", letterSpacing: 0.45 }}>Progress</div>
              {focusLoading && !focusProgress ? (
                <div style={{ fontSize: 13, color: c.sub, lineHeight: 1.6 }}>Checking latest CE progress…</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {focusItems.map((item) => {
                    const icon = item.kind === "done" ? "✔" : item.kind === "warning" ? "⚠" : "○";
                    const color = item.kind === "done" ? c.greenTx : item.kind === "warning" ? c.amberTx : c.sub;
                    const suffix = item.kind === "done" ? "complete" : item.label === "Review" ? "not ready" : "incomplete";
                    return (
                      <div key={item.label} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ width: 16, color, fontSize: 13, fontWeight: 650, textAlign: "center", flexShrink: 0 }}>{icon}</div>
                        <div style={{ fontSize: 13, color: c.text, lineHeight: 1.5 }}>
                          {item.label}
                          <span style={{ color: c.sub }}> • {suffix}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {nextFocusAction ? (
              <div style={{ display: "grid", gap: 6, paddingTop: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 650, color: c.sub, textTransform: "uppercase", letterSpacing: 0.45 }}>Primary action</div>
                <Link href={nextFocusAction.href} style={{ textDecoration: "none", color: c.text, fontSize: 13, fontWeight: 650 }}>
                  {nextFocusAction.label}
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}


function EmptyState() {
  return (
    <div
      style={{
        border: `1px dashed ${c.borderStrong}`,
        borderRadius: 18,
        padding: 28,
        background: c.soft,
        textAlign: "center",
        display: "grid",
        gap: 10,
        justifyItems: "center",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 650, color: c.black }}>No live actions yet</div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub, maxWidth: 520 }}>
        Create a CE, add the event date and value, then this dashboard will surface the commercial actions that need attention.
      </div>
      <QuietButton href="/app/new">Create first CE</QuietButton>
    </div>
  );
}

function AppHomeContent() {
  const searchParams = useSearchParams();
  const trackingTargetId = searchParams.get("trackPayment");
  const trackingTargetRef = useRef<HTMLDivElement | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventValues, setEventValues] = useState<EventValueMap>({});
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [openTrackingId, setOpenTrackingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSavingId, setRenameSavingId] = useState<string | null>(null);
  const [projectMoveValues, setProjectMoveValues] = useState<Record<string, string>>({});
  const [projectMoveSavingId, setProjectMoveSavingId] = useState<string | null>(null);
  const [focusProgress, setFocusProgress] = useState<FocusProgress | null>(null);
  const [focusLoading, setFocusLoading] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const supabase = supabaseBrowser();

      try {
        const user = await getRequiredUser(supabase);
        // Keep the dashboard resilient while preserving the new notice-risk fields.
        const trackingColumns = "payment_status,submitted_date,expected_payment_date,submitted_amount,assessed_amount,paid_amount,disallowed_amount,balance_outstanding,last_chased_date,next_chase_date,client_response,dispute_reason,agreed_payment_date,last_action_type,last_action_date";
        const eventSelects = [
          `id,title,status,created_at,contract_type,event_number,event_reference,project_name,main_contractor,event_date,notice_period_days,notification_deadline,${trackingColumns},event_financial_summary`,
          `id,title,status,created_at,contract_type,event_number,event_reference,project_name,main_contractor,event_date,notice_period_days,notification_deadline,${trackingColumns}`,
          "id,title,status,created_at,contract_type,event_number,event_reference,project_name,main_contractor,event_date,notice_period_days,notification_deadline,payment_status,submitted_date,expected_payment_date,last_action_type,last_action_date,event_financial_summary",
          "id,title,status,created_at,contract_type,event_number,event_reference,project_name,main_contractor,event_date,notice_period_days,notification_deadline,payment_status,submitted_date,expected_payment_date,last_action_type,last_action_date",
          "id,title,status,created_at,contract_type,event_number,event_reference,project_name,main_contractor,event_date,notice_period_days,notification_deadline,payment_status,last_action_type,last_action_date,event_financial_summary",
          "id,title,status,created_at,contract_type,event_number,event_reference,project_name,main_contractor,event_date,notice_period_days,notification_deadline,payment_status,last_action_type,last_action_date",
          "id,title,status,created_at,contract_type,event_number,event_reference,project_name,main_contractor,event_date,notice_period_days,notification_deadline,event_financial_summary",
          "id,title,status,created_at,contract_type,event_number,event_reference,project_name,main_contractor,event_date,notice_period_days,notification_deadline",
          "id,title,status,created_at,contract_type,event_number,event_reference,project_name,main_contractor",
        ];

        let rows: unknown[] | null = null;
        let lastError: unknown = null;

        for (const selectColumns of eventSelects) {
          const result = await supabase
            .from("events")
            .select(selectColumns)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (!result.error) {
            rows = result.data ?? [];
            lastError = null;
            break;
          }

          lastError = result.error;
          const message = String(result.error.message || "");
          const canTryFallback = /event_date|notice_period_days|notification_deadline|payment_status|submitted_date|expected_payment_date|submitted_amount|assessed_amount|paid_amount|disallowed_amount|balance_outstanding|last_chased_date|next_chase_date|client_response|dispute_reason|agreed_payment_date|last_action_type|last_action_date|event_financial_summary|schema cache|relationship/i.test(message);
          if (!canTryFallback) throw result.error;
        }

        if (lastError && rows === null) throw lastError;

        if (!active) return;
        const eventRows = (rows ?? []) as EventRow[];
        setEvents(eventRows);

        const values: EventValueMap = {};
        for (const event of eventRows) {
          const savedTotal = readFinalTotal(event.event_financial_summary);
          if (savedTotal !== null) {
            values[event.id] = savedTotal;
            continue;
          }

          try {
            const summary = await recalculateEventFinancialSummary(supabase, event.id, user.id);
            values[event.id] = summary.final_total;
          } catch (summaryError) {
            console.warn("Could not calculate CE value for dashboard", event.id, summaryError);
            values[event.id] = null;
          }
        }
        setEventValues(values);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "";
        if (isAuthErrorMessage(message)) {
          window.location.href = "/login";
          return;
        }
        console.error("Failed to load commercial dashboard", e);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!trackingTargetId) return;
    setShowAll(true);
    setOpenTrackingId(trackingTargetId);
  }, [trackingTargetId]);

  const projectOptions = useMemo(() => {
    const projects = Array.from(
      new Set(
        events
          .map((event) => event.project_name?.trim())
          .filter((project): project is string => Boolean(project))
      )
    ).sort((a, b) => a.localeCompare(b));

    return projects;
  }, [events]);

  useEffect(() => {
    if (selectedProject !== "all" && !projectOptions.includes(selectedProject)) {
      setSelectedProject("all");
    }
  }, [projectOptions, selectedProject]);

  const filteredEvents = useMemo(() => {
    if (selectedProject === "all") return events;
    return events.filter((event) => event.project_name?.trim() === selectedProject);
  }, [events, selectedProject]);

  const projectFilterLabel = selectedProject === "all" ? "All Projects" : selectedProject;

  const enriched = useMemo(() => {
    return filteredEvents.map((event) => {
      const value = eventValues[event.id] ?? null;
      const status = normaliseCommercialStatus(event.status);
      const noticePeriodDays = event.notice_period_days ?? getDefaultNoticePeriodDays(event.contract_type);
      const timeRisk = calculateTimeRisk({
        eventDate: event.event_date ?? null,
        noticePeriodDays,
        notificationDeadline: event.notification_deadline ?? null,
      });
      return { event, value, status, timeRisk };
    });
  }, [filteredEvents, eventValues]);

  const groupedRegister = useMemo(() => {
    const groups = new Map<string, typeof enriched>();

    for (const row of enriched) {
      const projectName = row.event.project_name?.trim() || "Unassigned Project";
      const current = groups.get(projectName) ?? [];
      current.push(row);
      groups.set(projectName, current);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => {
        if (a === "Unassigned Project") return 1;
        if (b === "Unassigned Project") return -1;
        return a.localeCompare(b);
      })
      .map(([projectName, rows]) => ({
        projectName,
        rows: rows.slice().sort((a, b) => {
          const aTime = dateOnly(a.event.created_at)?.getTime() ?? 0;
          const bTime = dateOnly(b.event.created_at)?.getTime() ?? 0;
          return bTime - aTime;
        }),
      }));
  }, [enriched]);

  useEffect(() => {
    if (!showAll || !openTrackingId) return;
    const timer = window.setTimeout(() => {
      trackingTargetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [showAll, openTrackingId, groupedRegister.length]);

  const totals = useMemo(() => {
    const total = filteredEvents.length;
    const drafts = filteredEvents.filter((e) => normaliseCommercialStatus(e.status) === "draft").length;
    const inReview = filteredEvents.filter((e) => normaliseCommercialStatus(e.status) === "review").length;
    const ready = filteredEvents.filter((e) => {
      const status = normaliseCommercialStatus(e.status);
      return status === "ready" || status === "complete" || status === "submitted" || status === "accepted" || status === "paid";
    }).length;
    return { total, drafts, inReview, ready };
  }, [filteredEvents]);

  const focusAction = useMemo<FocusAction | null>(() => {
    const openRows = enriched.filter((row) => !isCommerciallyClosed(row.status, row.event.payment_status));
    const priorityGroups = [
      openRows.filter((row) => isUnpaidCe(row.status, row.event.payment_status)),
      openRows.filter((row) => row.status === "rejected"),
      openRows.filter((row) => isSubmissionOutstanding(row.status) && (row.timeRisk.state === "overdue" || row.timeRisk.state === "due_soon")),
      openRows.filter((row) => row.status === "draft" || row.status === "review" || row.status === "ready"),
    ];

    for (const group of priorityGroups) {
      const [best] = group
        .slice()
        .sort((a, b) => {
          const aDeadline = a.timeRisk.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
          const bDeadline = b.timeRisk.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
          if (aDeadline !== bDeadline) return aDeadline - bDeadline;
          const aDate = dateOnly(a.event.last_action_date || a.event.created_at)?.getTime() ?? 0;
          const bDate = dateOnly(b.event.last_action_date || b.event.created_at)?.getTime() ?? 0;
          if (aDate !== bDate) return aDate - bDate;
          return (b.value ?? 0) - (a.value ?? 0);
        });

      const action = best ? focusActionFor(best) : null;
      if (action) return action;
    }

    return null;
  }, [enriched]);

  const focusEvent = focusAction?.event ?? null;

  const focusItems = useMemo(() => {
    if (!focusProgress) return [] as Array<{ label: string; done: boolean; kind: "done" | "warning" | "pending" }>;
    return [
      { label: "Basis of Change", done: focusProgress.basis, kind: focusProgress.basis ? "done" : "warning" as const },
      { label: "Evidence", done: focusProgress.evidence, kind: focusProgress.evidence ? "done" : "warning" as const },
      { label: "Resources", done: focusProgress.resources, kind: focusProgress.resources ? "done" : "warning" as const },
      { label: "Prelims", done: focusProgress.prelims, kind: focusProgress.prelims ? "done" : "warning" as const },
      { label: "Review", done: focusProgress.review, kind: focusProgress.review ? "done" : "pending" as const },
    ];
  }, [focusProgress]);

  const nextFocusAction = useMemo(() => {
    if (!focusAction || !focusProgress) return null;
    if (focusAction.event && normaliseCommercialStatus(focusAction.event.status) === "rejected") return { label: focusAction.cta, href: focusAction.href };
    if (!focusProgress.basis) return { label: focusAction.cta, href: `/app/event/${focusAction.event.id}` };
    if (!focusProgress.evidence) return { label: focusAction.cta, href: `/app/event/${focusAction.event.id}/evidence` };
    if (!focusProgress.resources) return { label: focusAction.cta, href: `/app/event/${focusAction.event.id}/resources` };
    if (!focusProgress.prelims) return { label: focusAction.cta, href: `/app/event/${focusAction.event.id}/prelims` };
    if (!focusProgress.review) return { label: focusAction.cta, href: `/app/event/${focusAction.event.id}/review` };
    return { label: focusAction.cta, href: focusAction.href };
  }, [focusAction, focusProgress]);

  const metrics = useMemo(() => {
    let totalValue = 0;
    let unpaid = 0;
    let overdue = 0;
    let paid = 0;
    let notSubmitted = 0;

    for (const row of enriched) {
      const value = row.value ?? 0;
      const closed = isCommerciallyClosed(row.status, row.event.payment_status);
      const balance = balanceOutstanding(row.event, value);
      totalValue += value;

      paid += paidAmount(row.event, value);
      if (!closed && isSubmissionOutstanding(row.status)) notSubmitted += value;
      if (!closed && isUnpaidCe(row.status, row.event.payment_status)) unpaid += balance;
      if (!closed && isOverdueCe(row.event)) overdue += balance;
    }

    return { totalValue, unpaid, overdue, paid, notSubmitted };
  }, [enriched]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!focusEvent?.id) {
        if (active) {
          setFocusProgress(null);
          setFocusLoading(false);
        }
        return;
      }

      const supabase = supabaseBrowser();
      setFocusLoading(true);

      try {
        const [basisRes, filesRes, contractFilesRes, resourcesRes, prelimsRes, reviewRes] = await Promise.all([
          supabase
            .from("event_basis")
            .select("happened_summary,cause_type,cause_summary,difference_from_plan,mechanism_tags,mitigation_summary")
            .eq("event_id", focusEvent.id)
            .maybeSingle(),
          supabase.from("event_files").select("id", { count: "exact", head: true }).eq("event_id", focusEvent.id),
          supabase.from("event_contract_files").select("id", { count: "exact", head: true }).eq("event_id", focusEvent.id),
          supabase.from("event_resource_lines").select("id", { count: "exact", head: true }).eq("event_id", focusEvent.id),
          supabase.from("event_prelim_lines").select("id", { count: "exact", head: true }).eq("event_id", focusEvent.id),
          supabase.from("event_review_settings").select("id", { count: "exact", head: true }).eq("event_id", focusEvent.id),
        ]);

        const basis = basisRes.data as
          | {
              happened_summary?: string | null;
              cause_type?: string | null;
              cause_summary?: string | null;
              difference_from_plan?: string | null;
              mechanism_tags?: string[] | null;
              mitigation_summary?: string | null;
            }
          | null;

        const basisComplete = Boolean(
          basis &&
            ((basis.happened_summary || "").trim() ||
              (basis.cause_summary || "").trim() ||
              (basis.difference_from_plan || "").trim() ||
              (basis.mitigation_summary || "").trim() ||
              basis.cause_type ||
              (basis.mechanism_tags?.length || 0) > 0)
        );

        if (active) {
          setFocusProgress({
            basis: basisComplete,
            evidence: ((filesRes.count || 0) + (contractFilesRes.count || 0)) > 0,
            resources: (resourcesRes.count || 0) > 0,
            prelims: (prelimsRes.count || 0) > 0,
            review: (reviewRes.count || 0) > 0,
          });
        }
      } catch (err) {
        console.error("Failed to load dashboard focus progress", err);
        if (active) setFocusProgress(null);
      } finally {
        if (active) setFocusLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [focusEvent?.id]);

  const actions = useMemo<DashboardAction[]>(() => {
    const items: DashboardAction[] = [];

    for (const row of enriched) {
      const title = row.event.title || "Untitled CE";
      const value = hasCommercialValue(row.value) ? row.value : null;
      const recoveryBalance = isUnpaidCe(row.status, row.event.payment_status) ? balanceOutstanding(row.event, value) : value;
      const closed = isCommerciallyClosed(row.status, row.event.payment_status);
      const outstandingSubmission = isSubmissionOutstanding(row.status);
      const due = paymentDueDate(row.event);
      const lastActionDate = dateOnly(row.event.last_action_date || row.event.submitted_date || row.event.created_at);

      if (closed) continue;

      if (isOverdueCe(row.event)) {
        items.push({
          id: `${row.event.id}-payment-overdue`,
          eventId: row.event.id,
          severity: 1,
          eyebrow: "Payment overdue",
          title,
          detail: paymentActionDetail(row.event, true),
          value: recoveryBalance,
          sortDate: due || lastActionDate,
          href: paymentTrackingHref(row.event.id),
          cta: "Track payment",
          tone: "red",
        });
        continue;
      }

      if (isUnpaidCe(row.status, row.event.payment_status)) {
        items.push({
          id: `${row.event.id}-unpaid`,
          eventId: row.event.id,
          severity: 2,
          eyebrow: row.status === "accepted" ? "Accepted / unpaid" : "Submitted / unpaid",
          title,
          detail: paymentActionDetail(row.event, false),
          value: recoveryBalance,
          sortDate: row.event.submitted_date ? dateOnly(row.event.submitted_date) : lastActionDate,
          href: paymentTrackingHref(row.event.id),
          cta: "Track payment",
          tone: "blue",
        });
        continue;
      }

      if (row.status === "rejected") {
        const age = staleActionDetail(row.event);
        items.push({
          id: `${row.event.id}-rejected`,
          eventId: row.event.id,
          severity: 3,
          eyebrow: "Rejected CE",
          title,
          detail: age
            ? `Rejected CE • ${age}. Open the review page; full rebuttal is unlocked after the pack has been generated.`
            : "Rejected CE. Open the review page; full rebuttal is unlocked after the pack has been generated.",
          value,
          sortDate: lastActionDate,
          href: `/app/event/${row.event.id}/review?mode=rebuttal`,
          cta: "Open rebuttal",
          tone: "red",
        });
        continue;
      }

      if (outstandingSubmission && row.timeRisk.state === "overdue") {
        items.push({
          id: `${row.event.id}-time-overdue`,
          eventId: row.event.id,
          severity: 4,
          eyebrow: "Time bar risk",
          title,
          detail: `${row.timeRisk.detail} ${row.timeRisk.deadline ? `Deadline ${formatDateShort(row.timeRisk.deadline)}.` : ""}`,
          value,
          sortDate: row.timeRisk.deadline || lastActionDate,
          href: `/app/event/${row.event.id}`,
          cta: "Open event",
          tone: "red",
        });
        continue;
      }

      if (outstandingSubmission && row.timeRisk.state === "due_soon") {
        items.push({
          id: `${row.event.id}-time-soon`,
          eventId: row.event.id,
          severity: 4,
          eyebrow: "Notice deadline",
          title,
          detail: `${row.timeRisk.label}${row.timeRisk.deadline ? `. Deadline ${formatDateShort(row.timeRisk.deadline)}.` : "."}`,
          value,
          sortDate: row.timeRisk.deadline || lastActionDate,
          href: `/app/event/${row.event.id}`,
          cta: "Review now",
          tone: "amber",
        });
        continue;
      }

      if (outstandingSubmission && value) {
        items.push({
          id: `${row.event.id}-not-submitted`,
          eventId: row.event.id,
          severity: row.status === "ready" ? 4 : 4,
          eyebrow: row.status === "ready" ? "Ready to submit" : "Not submitted",
          title,
          detail: row.status === "ready"
            ? `Value is built but not yet logged as submitted. ${actionAgeDetail(row.event) || "No recent action."}`
            : `Potential recovery value is still sitting in the workflow. ${actionAgeDetail(row.event) || "No recent action."}`,
          value,
          sortDate: lastActionDate,
          href: `/app/event/${row.event.id}/review`,
          cta: "Open CE",
          tone: row.status === "ready" ? "blue" : "neutral",
        });
      }
    }

    return items
      .sort((a, b) => {
        if (a.severity !== b.severity) return a.severity - b.severity;
        const aTime = a.sortDate?.getTime() ?? 0;
        const bTime = b.sortDate?.getTime() ?? 0;
        if (aTime !== bTime) return aTime - bTime;
        return (b.value ?? 0) - (a.value ?? 0);
      })
      .slice(0, 8);
  }, [enriched]);

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
      const user = await getRequiredUser(supabase);
      const { error } = await supabase.from("events").update({ title: nextTitle }).eq("id", eventId).eq("user_id", user.id);
      if (error) throw error;
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, title: nextTitle } : e)));
      cancelRename();
    } catch (err) {
      console.error("Failed to rename CE", err);
    } finally {
      setRenameSavingId(null);
    }
  }

  async function moveCeToProject(event: EventRow, rawValue: string) {
    const nextProject = rawValue.trim() || null;
    if ((event.project_name ?? null) === nextProject) return;
    const previous = event;

    try {
      setProjectMoveSavingId(event.id);
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, project_name: nextProject } : e)));

      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      const { error } = await supabase.from("events").update({ project_name: nextProject }).eq("id", event.id).eq("user_id", user.id);
      if (error) throw error;

      setProjectMoveValues((prev) => {
        const next = { ...prev };
        delete next[event.id];
        return next;
      });
    } catch (err) {
      console.error("Failed to move CE project", err);
      setEvents((prev) => prev.map((e) => (e.id === event.id ? previous : e)));
    } finally {
      setProjectMoveSavingId(null);
    }
  }


  async function updateRegisterTracking(eventId: string, next: TrackingUpdate) {
    const previous = events.find((e) => e.id === eventId) ?? null;
    const patch: Partial<EventRow> = nextTrackingState(next);
    const actionToday = todayInputValue();
    const currentValue = eventValues[eventId] ?? null;
    const nextPaymentStatus = Object.prototype.hasOwnProperty.call(patch, "payment_status")
      ? normalisePaymentStatus(patch.payment_status)
      : normalisePaymentStatus(previous?.payment_status);

    if (next.status) {
      const nextStatus = normaliseCommercialStatus(next.status);
      patch.last_action_type = nextStatus === "submitted" ? "submitted" : `status_${nextStatus}`;
      patch.last_action_date = actionToday;

      if ((nextStatus === "submitted" || nextStatus === "accepted") && !previous?.submitted_date) {
        patch.submitted_date = actionToday;
      }
      if ((nextStatus === "submitted" || nextStatus === "accepted") && numberOrNull(previous?.submitted_amount) === null && currentValue !== null) {
        patch.submitted_amount = currentValue;
        patch.assessed_amount = numberOrNull(previous?.assessed_amount) ?? currentValue;
        patch.balance_outstanding = Math.max(0, (patch.assessed_amount ?? currentValue) - paidAmount(previous || ({ payment_status: "not_applied" } as EventRow), currentValue));
      }
    }

    if (Object.prototype.hasOwnProperty.call(next, "payment_status")) {
      patch.last_action_type = nextPaymentStatus === "paid" ? "paid" : "payment_updated";
      patch.last_action_date = actionToday;
      if (nextPaymentStatus === "paid") {
        const assessed = assessedAmount({ ...(previous || ({} as EventRow)), ...patch }, currentValue);
        patch.paid_amount = numberOrNull(patch.paid_amount) ?? numberOrNull(previous?.paid_amount) ?? assessed;
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
      const merged = { ...(previous || ({} as EventRow)), ...patch };
      const assessed = assessedAmount(merged, currentValue);
      const paid = paidAmount(merged, currentValue);
      patch.balance_outstanding = Math.max(0, assessed - paid);
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

    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, ...patch } : e)));

    try {
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      const update = await supabase.from("events").update(patch).eq("id", eventId).eq("user_id", user.id);

      if (update.error) {
        const message = String(update.error.message || "");
        const fallbackNext: Partial<EventRow> = { ...patch };
        if (/payment_status/i.test(message)) delete fallbackNext.payment_status;
        if (/submitted_date/i.test(message)) delete fallbackNext.submitted_date;
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
          const fallback = await supabase.from("events").update(fallbackNext).eq("id", eventId).eq("user_id", user.id);
          if (fallback.error) throw fallback.error;
        }
      }

      await supabase.from("event_actions").insert({
        event_id: eventId,
        user_id: user.id,
        action_type: patch.last_action_type || "tracking_updated",
        action_date: patch.last_action_date || actionToday,
        notes: recoveryActionSummary(patch),
        metadata: patch,
      });
    } catch (err) {
      console.error("Failed to update CE register tracking", err);
      if (previous) setEvents((prev) => prev.map((e) => (e.id === eventId ? previous : e)));
    }
  }

  return (
    <div style={{ background: c.bg, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "34px 24px 44px" }}>
        <div style={{ display: "grid", gap: 18 }}>
          <section
            style={{
              background: c.raised,
              border: `1px solid ${c.border}`,
              borderRadius: 24,
              padding: 26,
              boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, 0.65fr)", gap: 28, alignItems: "end" }}>
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 650, color: c.sub, letterSpacing: 0.7, textTransform: "uppercase" }}>Recovery control panel</div>
                <div style={{ fontSize: 26, fontWeight: 650, lineHeight: 1.16, letterSpacing: 0, color: c.text, maxWidth: 760 }}>
                  See what value is live, what is stuck, and what needs action to get paid.
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.65, color: c.sub, maxWidth: 720 }}>
                  The dashboard stays deliberately simple: recoverable value first, payment risk second, detail only when opened.
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                <label style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                  <span style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>Project filter</span>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    style={{
                      height: 48,
                      minWidth: 176,
                      padding: "0 38px 0 15px",
                      borderRadius: 16,
                      border: `1px solid ${c.border}`,
                      background: c.input,
                      color: c.text,
                      fontWeight: 650,
                      fontSize: 14,
                      cursor: "pointer",
                      appearance: "none",
                    }}
                  >
                    <option value="all">All Projects</option>
                    {projectOptions.map((project) => (
                      <option key={project} value={project}>{project}</option>
                    ))}
                  </select>
                  <span aria-hidden="true" style={{ position: "absolute", right: 14, color: c.sub, fontSize: 12, pointerEvents: "none" }}>▼</span>
                </label>
                <Link href="/app/new" style={{ textDecoration: "none" }}>
                  <button
                    style={{
                      height: 48,
                      padding: "0 17px",
                      borderRadius: 16,
                      border: `1px solid ${c.black}`,
                      background: c.black,
                      color: c.blackContrast,
                      fontWeight: 650,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    New CE
                  </button>
                </Link>
                <QuietButton href="/app/ewns">EWN Register</QuietButton>
                <QuietButton href="/app/rates">Rate cards</QuietButton>
              </div>
            </div>
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 14 }}>
            <MetricCard label="Recoverable value" value={loading ? "—" : money(metrics.totalValue)} hint="All saved CE totals." tone="default" />
            <MetricCard label="Awaiting payment" value={loading ? "—" : money(metrics.unpaid)} hint="Submitted or accepted, not yet paid." tone={metrics.unpaid > 0 ? "amber" : "default"} />
            <MetricCard label="Overdue recovery" value={loading ? "—" : money(metrics.overdue)} hint="Past due date." tone="red" />
            <MetricCard label="Recovered" value={loading ? "—" : money(metrics.paid)} hint="Paid and completed." tone="green" />
            <MetricCard label="Value not issued" value={loading ? "—" : money(metrics.notSubmitted)} hint="Draft, review or ready CEs." tone={metrics.notSubmitted > 0 ? "blue" : "default"} />
          </div>

          <div
            style={{
              border: `1px solid ${c.border}`,
              borderRadius: 18,
              background: c.card,
              padding: 10,
              boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
            }}
          >
            <button
              type="button"
              onClick={() => setShowAll((p) => !p)}
              style={{
                width: "100%",
                height: 46,
                borderRadius: 14,
                border: `1px solid ${c.border}`,
                background: c.input,
                color: c.black,
                fontWeight: 650,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {showAll ? "Close CE register" : "Open CE register"}
            </button>

            {showAll ? (
              <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                {enriched.length === 0 ? (
                  <div style={{ border: `1px dashed ${c.borderStrong}`, borderRadius: 18, padding: 22, background: c.soft, color: c.sub, fontSize: 13, lineHeight: 1.55 }}>
                    No CEs found for {projectFilterLabel}. Switch back to All Projects or create a CE for this project.
                  </div>
                ) : (
                  groupedRegister.map((group) => (
                    <section
                      key={group.projectName}
                      style={{
                        border: `1px solid ${c.border}`,
                        borderRadius: 22,
                        background: c.soft,
                        padding: 12,
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "2px 4px" }}>
                        <div style={{ display: "grid", gap: 3 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{group.projectName}</div>
                          <div style={{ fontSize: 12, color: c.sub }}>
                            {group.rows.length} {group.rows.length === 1 ? "CE" : "CEs"}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 650, color: c.sub }}>
                          {selectedProject === "all" ? "Project group" : "Filtered project"}
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 10 }}>
                        {group.rows.map((row) => {
                          const st = statusTone(row.event.status);
                          const timeTone = row.timeRisk.state === "overdue" ? actionTone("red") : row.timeRisk.state === "due_soon" ? actionTone("amber") : actionTone("neutral");
                          const primaryAction = registerActionFor(row.event);
                          const isTrackingTarget = openTrackingId === row.event.id;
                          const paymentEditable = isSubmittedOrAccepted(row.event.status) || isCommerciallyClosed(row.event.status, row.event.payment_status);
                          const rowBalance = balanceOutstanding(row.event, row.value);
                          return (
                            <div
                              key={row.event.id}
                              ref={isTrackingTarget ? trackingTargetRef : null}
                              style={{
                                border: `1px solid ${isTrackingTarget ? c.blueBd : c.border}`,
                                borderRadius: 20,
                                padding: 16,
                                background: isTrackingTarget ? c.softBlue : c.card,
                                display: "grid",
                                gap: 14,
                                boxShadow: isTrackingTarget ? "0 0 0 3px rgba(37,99,235,0.08)" : "none",
                                transition: "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
                              }}
                            >
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 16, alignItems: "start" }}>
                        <div style={{ minWidth: 0 }}>
                          {renamingId === row.event.id ? (
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                style={{ flex: 1, minWidth: 0, border: `1px solid ${c.border}`, borderRadius: 12, padding: "9px 10px", fontSize: 13 }}
                              />
                              <button onClick={() => saveRename(row.event.id)} disabled={renameSavingId === row.event.id} style={{ border: `1px solid ${c.black}`, background: c.black, color: c.blackContrast, borderRadius: 12, padding: "0 10px", fontWeight: 650, cursor: "pointer" }}>Save</button>
                              <button onClick={cancelRename} style={{ border: `1px solid ${c.border}`, background: c.input, color: c.text, borderRadius: 12, padding: "0 10px", fontWeight: 650, cursor: "pointer" }}>Cancel</button>
                            </div>
                          ) : (
                            <>
                              <Link href={`/app/event/${row.event.id}`} style={{ color: c.text, textDecoration: "none", fontSize: 15, fontWeight: 650, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {displayEventReference(row.event)} — {row.event.title || "Untitled CE"}
                              </Link>
                              <div style={{ marginTop: 5, fontSize: 12.5, color: c.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.45 }}>
                                {projectContext(row.event)} • {getContractLabel(row.event.contract_type)}
                              </div>
                              <div style={{ marginTop: 6, fontSize: 12.5, color: c.sub, lineHeight: 1.45 }}>
                                {registerStateLine(row.event)}
                              </div>
                            </>
                          )}
                        </div>

                        <div style={{ textAlign: "right", display: "grid", gap: 7, justifyItems: "end" }}>
                          {row.value === null ? (
                            <Link href={`/app/event/${row.event.id}/resources`} style={{ fontSize: 14, fontWeight: 700, color: c.blueTx, textDecoration: "none", whiteSpace: "nowrap" }}>
                              Add value →
                            </Link>
                          ) : (
                            <div style={{ fontSize: 16, fontWeight: 650, color: c.text }}>{fullMoney(row.value)}</div>
                          )}
                          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <span style={{ padding: "5px 9px", borderRadius: 999, border: `1px solid ${st.bd}`, background: st.bg, color: st.tx, fontSize: 11.5, fontWeight: 650 }}>
                              {getCommercialStatusLabel(row.event.status)}
                            </span>
                            <span style={{ padding: "5px 9px", borderRadius: 999, border: `1px solid ${(isOverdueCe(row.event) ? actionTone("red") : paymentTone(row.event.payment_status)).bd}`, background: (isOverdueCe(row.event) ? actionTone("red") : paymentTone(row.event.payment_status)).bg, color: (isOverdueCe(row.event) ? actionTone("red") : paymentTone(row.event.payment_status)).tx, fontSize: 11.5, fontWeight: 650 }}>
                              {isOverdueCe(row.event) ? "Overdue" : getPaymentStatusLabel(row.event.payment_status)}
                            </span>
                            {!isSubmittedOrAccepted(row.event.status) && !isCommerciallyClosed(row.event.status, row.event.payment_status) ? (
                              <span style={{ padding: "5px 9px", borderRadius: 999, border: `1px solid ${timeTone.bd}`, background: row.timeRisk.state === "safe" ? c.card : timeTone.bg, color: timeTone.tx, fontSize: 11.5, fontWeight: 650 }}>
                                {row.timeRisk.deadline ? row.timeRisk.label : "No event date"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <details
                        open={isTrackingTarget}
                        onToggle={(e) => {
                          const isOpen = e.currentTarget.open;
                          setOpenTrackingId(isOpen ? row.event.id : openTrackingId === row.event.id ? null : openTrackingId);
                        }}
                        style={{ borderTop: `1px solid ${isTrackingTarget ? c.blueBd : c.border}`, paddingTop: 12 }}
                      >
                        <summary style={{ cursor: "pointer", color: isTrackingTarget ? c.blueTx : c.sub, fontSize: 12.5, fontWeight: 650, listStyle: "none" }}>
                          {isTrackingTarget ? "Managing payment tracking ▴" : "Manage tracking ▾"}
                        </summary>
                        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, alignItems: "end" }}>
                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 650, color: c.sub }}>CE status</span>
                            <select
                              value={normaliseCommercialStatus(row.event.status)}
                              onChange={(e) => void updateRegisterTracking(row.event.id, { status: e.target.value })}
                              style={{ width: "100%", height: 40, borderRadius: 12, border: `1px solid ${c.border}`, background: c.input, padding: "0 10px", fontSize: 13, color: c.text }}
                            >
                              {getAllowedCommercialStatusOptions(row.event.status).map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>

                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 650, color: c.sub }}>Payment</span>
                            <select
                              value={normalisePaymentStatus(row.event.payment_status)}
                              onChange={(e) => void updateRegisterTracking(row.event.id, { payment_status: e.target.value })}
                              disabled={!paymentEditable}
                              style={{ width: "100%", height: 40, borderRadius: 12, border: `1px solid ${c.border}`, background: paymentEditable ? c.input : c.soft, padding: "0 10px", fontSize: 13, color: c.text, cursor: paymentEditable ? "pointer" : "not-allowed" }}
                            >
                              {PAYMENT_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>

                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 650, color: c.sub }}>Expected payment</span>
                            <input
                              type="date"
                              value={toDateInputValue(row.event.expected_payment_date)}
                              onChange={(e) => void updateRegisterTracking(row.event.id, { expected_payment_date: e.target.value || null })}
                              style={{ width: "100%", height: 40, borderRadius: 12, border: `1px solid ${c.border}`, background: c.input, padding: "0 10px", fontSize: 13, color: c.text }}
                            />
                          </label>

                          <div style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 650, color: c.sub }}>Notice deadline</span>
                            <div style={{ height: 40, display: "flex", alignItems: "center", borderRadius: 12, border: `1px solid ${timeTone.bd}`, background: row.timeRisk.state === "safe" ? c.input : timeTone.bg, padding: "0 10px", fontSize: 13, color: c.text }}>
                              {isSubmittedOrAccepted(row.event.status) || isCommerciallyClosed(row.event.status, row.event.payment_status)
                                ? "No notice action"
                                : row.timeRisk.deadline
                                ? niceDate(row.timeRisk.deadline.toISOString())
                                : "Add event date"}
                            </div>
                          </div>

                          <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 650, color: c.sub }}>Project group</span>
                            <select
                              value={Object.prototype.hasOwnProperty.call(projectMoveValues, row.event.id) ? projectMoveValues[row.event.id] : row.event.project_name ?? ""}
                              onChange={(e) => {
                                const nextValue = e.target.value;
                                setProjectMoveValues((prev) => ({ ...prev, [row.event.id]: nextValue }));
                                void moveCeToProject(row.event, nextValue);
                              }}
                              disabled={projectMoveSavingId === row.event.id}
                              style={{ width: "100%", minWidth: 0, height: 40, borderRadius: 12, border: `1px solid ${c.border}`, background: c.input, padding: "0 10px", fontSize: 13, color: c.text, cursor: projectMoveSavingId === row.event.id ? "not-allowed" : "pointer" }}
                            >
                              <option value="">Unassigned Project</option>
                              {projectOptions.map((project) => (
                                <option key={project} value={project}>{project}</option>
                              ))}
                            </select>
                          </label>

                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 650, color: c.sub }}>Submitted amount</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={moneyInputValue(row.event.submitted_amount)}
                              onChange={(e) => void updateRegisterTracking(row.event.id, { submitted_amount: cleanMoneyInput(e.target.value) })}
                              disabled={!paymentEditable}
                              style={{ width: "100%", height: 40, borderRadius: 12, border: `1px solid ${c.border}`, background: paymentEditable ? c.input : c.soft, padding: "0 10px", fontSize: 13, color: c.text }}
                            />
                          </label>

                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 650, color: c.sub }}>Assessed amount</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={moneyInputValue(row.event.assessed_amount)}
                              onChange={(e) => void updateRegisterTracking(row.event.id, { assessed_amount: cleanMoneyInput(e.target.value) })}
                              disabled={!paymentEditable}
                              style={{ width: "100%", height: 40, borderRadius: 12, border: `1px solid ${c.border}`, background: paymentEditable ? c.input : c.soft, padding: "0 10px", fontSize: 13, color: c.text }}
                            />
                          </label>

                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 650, color: c.sub }}>Paid amount</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={moneyInputValue(row.event.paid_amount)}
                              onChange={(e) => void updateRegisterTracking(row.event.id, { paid_amount: cleanMoneyInput(e.target.value) })}
                              disabled={!paymentEditable}
                              style={{ width: "100%", height: 40, borderRadius: 12, border: `1px solid ${c.border}`, background: paymentEditable ? c.input : c.soft, padding: "0 10px", fontSize: 13, color: c.text }}
                            />
                          </label>

                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 650, color: c.sub }}>Disallowed amount</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={moneyInputValue(row.event.disallowed_amount)}
                              onChange={(e) => void updateRegisterTracking(row.event.id, { disallowed_amount: cleanMoneyInput(e.target.value) })}
                              disabled={!paymentEditable}
                              style={{ width: "100%", height: 40, borderRadius: 12, border: `1px solid ${c.border}`, background: paymentEditable ? c.input : c.soft, padding: "0 10px", fontSize: 13, color: c.text }}
                            />
                          </label>

                          <div style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 650, color: c.sub }}>Balance outstanding</span>
                            <div style={{ height: 40, display: "flex", alignItems: "center", borderRadius: 12, border: `1px solid ${rowBalance > 0 ? c.amberBd : c.greenBd}`, background: rowBalance > 0 ? c.amberBg : c.greenBg, padding: "0 10px", fontSize: 13, fontWeight: 700, color: rowBalance > 0 ? c.amberTx : c.greenTx }}>
                              {fullMoney(rowBalance)}
                            </div>
                          </div>

                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 650, color: c.sub }}>Last chased</span>
                            <input
                              type="date"
                              value={toDateInputValue(row.event.last_chased_date)}
                              onChange={(e) => void updateRegisterTracking(row.event.id, { last_chased_date: e.target.value || null })}
                              disabled={!paymentEditable}
                              style={{ width: "100%", height: 40, borderRadius: 12, border: `1px solid ${c.border}`, background: paymentEditable ? c.input : c.soft, padding: "0 10px", fontSize: 13, color: c.text }}
                            />
                          </label>

                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 650, color: c.sub }}>Next chase</span>
                            <input
                              type="date"
                              value={toDateInputValue(row.event.next_chase_date)}
                              onChange={(e) => void updateRegisterTracking(row.event.id, { next_chase_date: e.target.value || null })}
                              disabled={!paymentEditable}
                              style={{ width: "100%", height: 40, borderRadius: 12, border: `1px solid ${c.border}`, background: paymentEditable ? c.input : c.soft, padding: "0 10px", fontSize: 13, color: c.text }}
                            />
                          </label>

                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 650, color: c.sub }}>Agreed payment</span>
                            <input
                              type="date"
                              value={toDateInputValue(row.event.agreed_payment_date)}
                              onChange={(e) => void updateRegisterTracking(row.event.id, { agreed_payment_date: e.target.value || null })}
                              disabled={!paymentEditable}
                              style={{ width: "100%", height: 40, borderRadius: 12, border: `1px solid ${c.border}`, background: paymentEditable ? c.input : c.soft, padding: "0 10px", fontSize: 13, color: c.text }}
                            />
                          </label>

                          <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                            <span style={{ fontSize: 11.5, fontWeight: 650, color: c.sub }}>Client response</span>
                            <input
                              value={row.event.client_response ?? ""}
                              onChange={(e) => void updateRegisterTracking(row.event.id, { client_response: e.target.value })}
                              disabled={!paymentEditable}
                              placeholder="e.g. Awaiting PM assessment / QS queried labour"
                              style={{ width: "100%", height: 40, borderRadius: 12, border: `1px solid ${c.border}`, background: paymentEditable ? c.input : c.soft, padding: "0 10px", fontSize: 13, color: c.text }}
                            />
                          </label>

                          <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                            <span style={{ fontSize: 11.5, fontWeight: 650, color: c.sub }}>Dispute / short-pay reason</span>
                            <input
                              value={row.event.dispute_reason ?? ""}
                              onChange={(e) => void updateRegisterTracking(row.event.id, { dispute_reason: e.target.value })}
                              disabled={!paymentEditable}
                              placeholder="e.g. Prelims discounted / causation challenged"
                              style={{ width: "100%", height: 40, borderRadius: 12, border: `1px solid ${c.border}`, background: paymentEditable ? c.input : c.soft, padding: "0 10px", fontSize: 13, color: c.text }}
                            />
                          </label>

                          <div
                            style={{
                              gridColumn: "1 / -1",
                              display: "flex",
                              gap: 8,
                              justifyContent: "flex-end",
                              alignItems: "center",
                              minWidth: 0,
                              flexWrap: "wrap",
                            }}
                          >
                            <button onClick={() => startRename(row.event)} style={{ height: 40, border: `1px solid ${c.border}`, background: c.input, color: c.text, borderRadius: 12, padding: "0 14px", fontWeight: 650, cursor: "pointer", whiteSpace: "nowrap" }}>Rename</button>
                            <Link href={primaryAction.href} style={{ textDecoration: "none", display: "inline-flex" }}>
                              <button style={{ height: 40, border: `1px solid ${c.black}`, background: c.black, color: c.blackContrast, borderRadius: 12, padding: "0 16px", fontWeight: 650, cursor: "pointer", whiteSpace: "nowrap" }}>{primaryAction.label}</button>
                            </Link>
                          </div>
                        </div>
                        <div style={{ marginTop: 10, fontSize: 12, color: c.sub, lineHeight: 1.45 }}>
                          Tracking stays internal. It powers the dashboard and does not change the client-facing Excel narrative.
                        </div>
                      </details>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))
                )}
              </div>
            ) : null}

          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(340px, 0.85fr)", gap: 18, alignItems: "start" }}>
            <SectionCard title="Recovery actions" hint="Only items that can move value towards submission, acceptance or payment appear here. Notice deadlines are folded into the action text rather than split into a second dashboard card.">
              {loading ? (
                <div style={{ fontSize: 13, color: c.sub }}>Loading commercial actions…</div>
              ) : actions.length === 0 ? (
                <EmptyState />
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {actions.map((action) => {
                    const tone = actionTone(action.tone);
                    const resourcesHref = `/app/event/${action.eventId}/resources`;
                    const hasValue = action.value !== null;
                    return (
                      <div
                        key={action.id}
                        style={{
                          border: `1px solid ${tone.bd}`,
                          background: action.tone === "neutral" ? c.card : tone.bg,
                          borderRadius: 20,
                          padding: 16,
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) auto",
                          gap: 16,
                          alignItems: "center",
                        }}
                      >
                        <Link href={action.href} style={{ minWidth: 0, display: "grid", gap: 5, textDecoration: "none" }}>
                          <div style={{ fontSize: 11, fontWeight: 650, color: tone.tx, textTransform: "uppercase", letterSpacing: 0.55 }}>{action.eyebrow}</div>
                          <div style={{ fontSize: 15, fontWeight: 650, color: c.text, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{action.title}</div>
                          <div style={{ fontSize: 12.5, color: c.sub, lineHeight: 1.5 }}>{action.detail}</div>
                        </Link>
                        <div style={{ textAlign: "right", display: "grid", gap: 6, justifyItems: "end" }}>
                          {hasValue ? (
                            <div style={{ fontSize: 16, fontWeight: 650, color: c.text }}>{money(action.value)}</div>
                          ) : (
                            <Link href={resourcesHref} style={{ fontSize: 16, fontWeight: 650, color: tone.tx, textDecoration: "none" }}>
                              Add value →
                            </Link>
                          )}
                          <Link href={action.href} style={{ fontSize: 12, fontWeight: 650, color: tone.tx, textDecoration: "none" }}>
                            {action.cta}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 10 }}>
                <CompactStatusCard label="Total CEs" value={loading ? "—" : totals.total} />
                <CompactStatusCard label="Drafts" value={loading ? "—" : totals.drafts} tone="amber" />
                <CompactStatusCard label="In review" value={loading ? "—" : totals.inReview} tone="blue" />
                <CompactStatusCard label="Ready / complete" value={loading ? "—" : totals.ready} tone="green" />
              </div>
              <CurrentFocusPanel
                focusAction={focusAction}
                focusLoading={focusLoading}
                focusProgress={focusProgress}
                focusItems={focusItems}
                nextFocusAction={nextFocusAction}
                projectFilterLabel={projectFilterLabel}
              />
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}

export default function AppHome() {
  return (
    <Suspense fallback={null}>
      <AppHomeContent />
    </Suspense>
  );
}
