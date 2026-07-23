"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getContractLabel } from "@/lib/contracts";
import { displayEventReference, displayEventTitle } from "@/lib/eventReference";
import { readFinalTotal, recalculateEventFinancialSummary } from "@/lib/financialSummary";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";
import { applyDerivedPaymentTracking } from "@/lib/paymentTracking";
import { trackAnalyticsWithUser } from "@/lib/analyticsClient";
import { OnboardingActivationDashboard } from "@/components/OnboardingActivation";
import type { OnboardingState } from "@/lib/onboarding";
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
import {
  AppCard,
  IconBubble,
  MiniSparkline,
  RingProgress,
  SmallIcon,
  StatusBadge,
  appUi,
  toneColours,
} from "@/components/appUi";

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
  is_demo?: boolean | null;
};

type EventActionRow = {
  event_id: string;
  action_type: string | null;
  action_date: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
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

type DashboardStage = {
  key: string;
  label: string;
  tone: "neutral" | "blue" | "orange" | "green" | "purple";
  count: number;
  value: number;
  avgDays: number | null;
};

type RiskFlag = {
  key: string;
  label: string;
  detail: string;
  value: string;
  href: string;
  tone: "red" | "orange" | "blue" | "purple" | "green";
  icon: "alert" | "clock" | "file" | "money" | "rocket";
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

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function recentMonthKeys(count = 8) {
  const now = new Date();
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(d));
  }
  return months;
}

function endOfMonthFromKey(key: string) {
  const [yearText, monthText] = key.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return new Date(year, month, 0, 23, 59, 59, 999);
}

function monthlySeries<T>(
  rows: T[],
  dateOf: (row: T) => string | Date | null | undefined,
  valueOf: (row: T) => number,
  options: { months?: string[]; cumulative?: boolean } = {}
) {
  const months = options.months ?? recentMonthKeys();
  const byMonth = new Map(months.map((month) => [month, 0]));

  for (const row of rows) {
    const date = dateOnly(dateOf(row));
    if (!date) continue;
    const key = monthKey(date);
    if (!byMonth.has(key)) continue;
    byMonth.set(key, (byMonth.get(key) || 0) + valueOf(row));
  }

  let running = 0;
  return months.map((month) => {
    const value = byMonth.get(month) || 0;
    if (!options.cumulative) return value;
    running += value;
    return running;
  });
}

function monthlyAverageSeries<T>(
  rows: T[],
  dateOf: (row: T) => string | Date | null | undefined,
  valueOf: (row: T) => number | null | undefined,
  months = recentMonthKeys()
) {
  const byMonth = new Map(months.map((month) => [month, { total: 0, count: 0 }]));

  for (const row of rows) {
    const date = dateOnly(dateOf(row));
    const value = valueOf(row);
    if (!date || typeof value !== "number" || !Number.isFinite(value)) continue;
    const key = monthKey(date);
    const bucket = byMonth.get(key);
    if (!bucket) continue;
    bucket.total += value;
    bucket.count += 1;
  }

  return months.map((month) => {
    const bucket = byMonth.get(month);
    return bucket && bucket.count > 0 ? Math.round(bucket.total / bucket.count) : 0;
  });
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

function metadataNumber(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
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
  if (s === "void") return { bg: c.soft, bd: c.border, tx: c.sub };
  if (s === "paid" || s === "accepted" || s === "complete") return { bg: c.greenBg, bd: c.greenBd, tx: c.greenTx };
  if (s === "submitted") return { bg: c.blueBg, bd: c.blueBd, tx: c.blueTx };
  if (s === "rejected") return { bg: c.redBg, bd: c.redBd, tx: c.redTx };
  if (s === "review" || s === "ready") return { bg: c.amberBg, bd: c.amberBd, tx: c.amberTx };
  return { bg: c.card, bd: c.border, tx: c.sub };
}

function isVoided(status?: string | null) {
  return normaliseCommercialStatus(status) === "void";
}

function isCommerciallyClosed(status?: string | null, paymentStatus?: string | null) {
  const s = normaliseCommercialStatus(status);
  return s === "paid" || s === "complete" || s === "void" || getPaymentState(paymentStatus) === "paid";
}

function isSubmissionOutstanding(status?: string | null) {
  const s = normaliseCommercialStatus(status);
  return s === "draft" || s === "review" || s === "ready";
}

function isSubmittedOrAccepted(status?: string | null) {
  const s = normaliseCommercialStatus(status);
  return s === "submitted" || s === "accepted";
}

function isAgreedStatus(status?: string | null) {
  const s = normaliseCommercialStatus(status);
  return s === "accepted" || s === "paid" || s === "complete";
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
    if ((status === "draft" || status === "review" || status === "ready" || status === "rejected" || status === "void") && !paymentWasExplicitlyChanged) patch.payment_status = "not_applied";
  }
  if (patch.payment_status === "paid" && !patch.status) patch.status = "paid";
  return patch;
}

function trackingPatchForDatabase(patch: Partial<EventRow>) {
  return { ...patch };
}

function legacyPaymentStatusPatch(patch: Partial<EventRow>) {
  if (patch.payment_status !== "submitted_for_payment") return null;
  return { ...patch, payment_status: "applied" };
}

const OPTIONAL_RECOVERY_TRACKING_COLUMNS = [
  "submitted_amount",
  "assessed_amount",
  "paid_amount",
  "disallowed_amount",
  "balance_outstanding",
  "last_chased_date",
  "next_chase_date",
  "client_response",
  "dispute_reason",
  "agreed_payment_date",
] as const;

const ACTION_TRACKING_COLUMNS = ["last_action_type", "last_action_date"] as const;

function removeColumns<T extends Record<string, unknown>>(row: T, columns: readonly string[]) {
  const next = { ...row };
  for (const column of columns) delete next[column];
  return next;
}

function compactTrackingPatch(row: Partial<EventRow>) {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined)
  ) as Partial<EventRow>;
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

async function optionalDeleteQuery(query: any, label: string) {
  const result = await query;
  if (result?.error && !isOptionalSchemaError(result.error)) {
    console.warn(`Could not delete linked ${label}`, result.error);
  }
  return result;
}

function hasCoreTrackingChange(next: TrackingUpdate) {
  return (
    Object.prototype.hasOwnProperty.call(next, "status") ||
    Object.prototype.hasOwnProperty.call(next, "payment_status") ||
    Object.prototype.hasOwnProperty.call(next, "expected_payment_date")
  );
}

async function updateEventTrackingWithFallback(supabase: any, eventId: string, userId: string, patch: Partial<EventRow>) {
  const databasePatch = compactTrackingPatch(trackingPatchForDatabase(patch));
  const legacyPatch = legacyPaymentStatusPatch(databasePatch);
  const attempts = [
    databasePatch,
    ...(legacyPatch ? [legacyPatch] : []),
    removeColumns(databasePatch, OPTIONAL_RECOVERY_TRACKING_COLUMNS),
    removeColumns(databasePatch, [...OPTIONAL_RECOVERY_TRACKING_COLUMNS, ...ACTION_TRACKING_COLUMNS]),
    Object.prototype.hasOwnProperty.call(databasePatch, "status")
      ? { status: databasePatch.status }
      : {},
  ].filter((attempt, index, arr) => {
    const keys = Object.keys(attempt);
    if (keys.length === 0) return false;
    const signature = JSON.stringify(keys.sort().map((key) => [key, (attempt as any)[key]]));
    return arr.findIndex((candidate) => {
      const candidateKeys = Object.keys(candidate);
      const candidateSignature = JSON.stringify(candidateKeys.sort().map((key) => [key, (candidate as any)[key]]));
      return candidateSignature === signature;
    }) === index;
  });

  let lastError: any = null;
  for (const attempt of attempts) {
    const result = await (supabase as any).from("events").update(attempt).eq("id", eventId).eq("user_id", userId);
    if (!result.error) {
      return { saved: true, partial: Object.keys(attempt).length !== Object.keys(databasePatch).length, error: null };
    }
    lastError = result.error;
  }

  return { saved: false, partial: false, error: lastError };
}

function actionTone(tone: DashboardAction["tone"]) {
  if (tone === "red") return { bg: c.redBg, bd: c.redBd, tx: c.redTx };
  if (tone === "amber") return { bg: c.amberBg, bd: c.amberBd, tx: c.amberTx };
  if (tone === "blue") return { bg: c.blueBg, bd: c.blueBd, tx: c.blueTx };
  return { bg: c.card, bd: c.border, tx: c.sub };
}

function paymentTrackingHref(eventId: string) {
  return `/app?register=1&trackPayment=${encodeURIComponent(eventId)}`;
}

function registerActionFor(event: EventRow) {
  const status = normaliseCommercialStatus(event.status);
  if (status === "void") {
    return { label: "View record", href: `/app/event/${event.id}/review` };
  }
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
  if (status === "void") return "Void — kept for audit, excluded from live recovery totals.";
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
  const title = displayEventTitle(row.event);

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

function DashboardMetric({
  label,
  value,
  hint,
  tone,
  spark,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  tone: "neutral" | "blue" | "green" | "orange" | "red" | "purple";
  spark?: number[];
  icon: React.ReactNode;
}) {
  const tc = toneColours(tone);
  return (
    <AppCard
      style={{
        padding: 18,
        minHeight: 124,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 12,
        overflow: "hidden",
      }}
      tone={tone === "neutral" ? "neutral" : tone}
    >
      <div style={{ minWidth: 0, display: "grid", gap: 7, alignContent: "start" }}>
        <div style={{ fontSize: 11, lineHeight: 1.2, fontWeight: 800, color: appUi.muted, textTransform: "uppercase", letterSpacing: 0.65 }}>{label}</div>
        <div style={{ fontSize: 26, lineHeight: 1, fontWeight: 850, color: appUi.text, letterSpacing: 0 }}>{value}</div>
        <div style={{ fontSize: 12, lineHeight: 1.4, color: appUi.muted }}>{hint}</div>
      </div>
      <div style={{ width: 92, display: "grid", alignContent: "space-between", justifyItems: "end", gap: 8 }}>
        <IconBubble tone={tone === "neutral" ? "blue" : tone} size={36}>{icon}</IconBubble>
        {spark ? <MiniSparkline values={spark} tone={tone === "neutral" ? "blue" : tone} height={36} /> : <span style={{ width: 46, height: 4, borderRadius: 999, background: tc.border }} />}
      </div>
    </AppCard>
  );
}

function DashboardTopCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <AppCard style={{ padding: 22, display: "grid", gap: 18, alignContent: "start", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 850, color: appUi.muted, textTransform: "uppercase", letterSpacing: 0.75 }}>{title}</div>
        {action}
      </div>
      {children}
    </AppCard>
  );
}

function PipelineStage({ stage }: { stage: DashboardStage }) {
  const tc = toneColours(stage.tone);
  return (
    <div style={{ minWidth: 0, display: "grid", justifyItems: "center", gap: 8, textAlign: "center" }}>
      <div style={{ width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text }}>
        <SmallIcon name={stage.key === "paid" ? "check" : stage.key === "draft" ? "file" : stage.key === "submitted" ? "rocket" : stage.key === "agreed" ? "money" : "clock"} />
      </div>
      <div style={{ minHeight: 38 }}>
        <div style={{ color: tc.text, fontSize: 12, lineHeight: 1.15, fontWeight: 850 }}>{stage.label}</div>
      </div>
      <div style={{ color: appUi.text, fontSize: 12, lineHeight: 1.35, fontWeight: 750 }}>{stage.count} {stage.count === 1 ? "event" : "events"}</div>
      <div style={{ color: appUi.text, fontSize: 12, lineHeight: 1.35, fontWeight: 850 }}>{money(stage.value)}</div>
      <div style={{ color: appUi.muted, fontSize: 11, lineHeight: 1.35 }}>
        {stage.avgDays === null ? "No age yet" : `Avg ${stage.avgDays} days`}
      </div>
    </div>
  );
}

function OpportunityRadar({ items }: { items: Array<{ label: string; value: number; tone: "blue" | "red" | "orange" | "purple" }> }) {
  return (
    <div className="dashboard-radar-detail" style={{ display: "grid", gridTemplateColumns: "minmax(210px, 1fr) minmax(210px, 0.98fr)", gap: 24, alignItems: "center", minWidth: 0 }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", maxWidth: 245, margin: "0 auto", minWidth: 0 }}>
        {[92, 70, 48, 26].map((size, index) => (
          <span
            key={size}
            style={{
              position: "absolute",
              inset: `${(100 - size) / 2}%`,
              borderRadius: "50%",
              border: "1px solid #e9e3ff",
              background: index === 3 ? "linear-gradient(135deg, #9b7cff, #6d4aff)" : "transparent",
              boxShadow: index === 3 ? "0 16px 35px rgba(109, 74, 255, 0.28)" : "none",
            }}
          />
        ))}
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "white" }}>
          <SmallIcon name="radar" />
        </span>
      </div>
      <div style={{ display: "grid", gap: 16, minWidth: 0, borderLeft: `1px solid ${appUi.border}`, paddingLeft: 24 }}>
        {items.map((item) => {
          const tc = toneColours(item.tone);
          return (
            <div key={item.label} style={{ display: "grid", gridTemplateColumns: "22px minmax(0, 1fr)", gap: 12, alignItems: "start", minWidth: 0 }}>
              <span style={{ width: 11, height: 11, marginTop: 7, borderRadius: 999, background: tc.text, boxShadow: `0 0 0 8px ${tc.bg}` }} />
              <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <span style={{ color: tc.text, fontSize: 16, lineHeight: 1.1, fontWeight: 900, whiteSpace: "nowrap" }}>{money(item.value)}</span>
                <span style={{ color: appUi.muted, fontSize: 12, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickAccessTile({
  href,
  label,
  hint,
  icon,
  tone,
}: {
  href: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  tone: "blue" | "green" | "orange" | "purple" | "red";
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        display: "grid",
        gridTemplateColumns: "42px minmax(0, 1fr)",
        gap: 12,
        alignItems: "center",
        padding: 14,
        borderRadius: 14,
        background: appUi.surface,
        border: `1px solid ${appUi.border}`,
        boxShadow: appUi.shadowSoft,
        transition: "transform 160ms ease, box-shadow 160ms ease",
      }}
      onMouseEnter={(ev) => {
        ev.currentTarget.style.transform = "translateY(-2px)";
        ev.currentTarget.style.boxShadow = appUi.shadow;
      }}
      onMouseLeave={(ev) => {
        ev.currentTarget.style.transform = "translateY(0)";
        ev.currentTarget.style.boxShadow = appUi.shadowSoft;
      }}
    >
      <IconBubble tone={tone} size={42}>{icon}</IconBubble>
      <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <span style={{ color: appUi.text, fontSize: 12, fontWeight: 850 }}>{label}</span>
        <span style={{ color: appUi.muted, fontSize: 11.5, lineHeight: 1.35 }}>{hint}</span>
      </span>
    </Link>
  );
}

function RiskFlagTile({ flag }: { flag: RiskFlag }) {
  const tc = toneColours(flag.tone);
  return (
    <Link
      href={flag.href}
      style={{
        textDecoration: "none",
        border: `1px solid ${tc.border}`,
        background: flag.tone === "red" || flag.tone === "orange" ? tc.bg : appUi.surface,
        borderRadius: 14,
        padding: 13,
        display: "grid",
        gridTemplateColumns: "34px minmax(0, 1fr) auto",
        gap: 11,
        alignItems: "center",
        minWidth: 0,
        transition: "transform 160ms ease, box-shadow 160ms ease",
      }}
      onMouseEnter={(ev) => {
        ev.currentTarget.style.transform = "translateY(-2px)";
        ev.currentTarget.style.boxShadow = appUi.shadowSoft;
      }}
      onMouseLeave={(ev) => {
        ev.currentTarget.style.transform = "translateY(0)";
        ev.currentTarget.style.boxShadow = "none";
      }}
    >
      <span style={{ width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center", background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>
        <SmallIcon name={flag.icon} />
      </span>
      <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <span style={{ color: appUi.text, fontSize: 12.5, lineHeight: 1.2, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{flag.label}</span>
        <span style={{ color: appUi.muted, fontSize: 11.5, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{flag.detail}</span>
      </span>
      <span style={{ color: tc.text, fontSize: 13, lineHeight: 1.1, fontWeight: 900, whiteSpace: "nowrap" }}>{flag.value}</span>
    </Link>
  );
}

function AppHomeContent() {
  const searchParams = useSearchParams();
  const trackingTargetId = searchParams.get("trackPayment");
  const registerRequested = searchParams.get("register") === "1";
  const forceOnboardingRequested = searchParams.get("onboarding") === "1";
  const trackingTargetRef = useRef<HTMLDivElement | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventActions, setEventActions] = useState<EventActionRow[]>([]);
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
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [deleteConfirmEventId, setDeleteConfirmEventId] = useState<string | null>(null);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState("");
  const [focusProgress, setFocusProgress] = useState<FocusProgress | null>(null);
  const [focusLoading, setFocusLoading] = useState(false);
  const [activationState, setActivationState] = useState<OnboardingState | null>(null);
  const [demoModeActive, setDemoModeActive] = useState(false);
  const [forceOnboarding, setForceOnboarding] = useState(false);

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
    function syncForceOnboarding() {
      try {
        const requested = forceOnboardingRequested || localStorage.getItem("cc.force.onboarding") === "1";
        if (forceOnboardingRequested) localStorage.setItem("cc.force.onboarding", "1");
        setForceOnboarding(requested);
      } catch {
        setForceOnboarding(forceOnboardingRequested);
      }
    }
    syncForceOnboarding();
    window.addEventListener("storage", syncForceOnboarding);
    window.addEventListener("cc:force-onboarding-changed", syncForceOnboarding);
    return () => {
      window.removeEventListener("storage", syncForceOnboarding);
      window.removeEventListener("cc:force-onboarding-changed", syncForceOnboarding);
    };
  }, [forceOnboardingRequested]);

  function handleActivationStateChange(state: OnboardingState) {
    setActivationState(state);
    if (state === "COMPLETE") {
      try {
        localStorage.removeItem("cc.force.onboarding");
        window.dispatchEvent(new Event("cc:force-onboarding-changed"));
      } catch {}
      setForceOnboarding(false);
    }
  }

  useEffect(() => {
    let active = true;

    (async () => {
      const supabase = supabaseBrowser();

      try {
        const user = await getRequiredUser(supabase);
        // Keep the dashboard resilient while preserving the new notice-risk fields.
        const trackingColumns = "payment_status,submitted_date,expected_payment_date,submitted_amount,assessed_amount,paid_amount,disallowed_amount,balance_outstanding,last_chased_date,next_chase_date,client_response,dispute_reason,agreed_payment_date,last_action_type,last_action_date";
        const eventSelects = [
          `id,title,status,created_at,contract_type,event_number,event_reference,project_name,main_contractor,event_date,notice_period_days,notification_deadline,${trackingColumns},event_financial_summary,is_demo`,
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
          const result = await (supabase as any).from("events")
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
          const canTryFallback = /event_date|notice_period_days|notification_deadline|payment_status|submitted_date|expected_payment_date|submitted_amount|assessed_amount|paid_amount|disallowed_amount|balance_outstanding|last_chased_date|next_chase_date|client_response|dispute_reason|agreed_payment_date|last_action_type|last_action_date|event_financial_summary|is_demo|schema cache|relationship/i.test(message);
          if (!canTryFallback) throw result.error;
        }

        if (lastError && rows === null) throw lastError;

        if (!active) return;
        const eventRows = demoFilteredRows((rows ?? []) as EventRow[], demoModeActive);
        setEvents(eventRows);

        const actionRows = await (supabase as any)
          .from("event_actions")
          .select("event_id,action_type,action_date,created_at,metadata")
          .eq("user_id", user.id)
          .order("action_date", { ascending: true });

        if (!active) return;
        if (!actionRows.error) {
          setEventActions((actionRows.data ?? []) as EventActionRow[]);
        } else if (isOptionalSchemaError(actionRows.error)) {
          setEventActions([]);
        } else {
          console.warn("Could not load dashboard action history", actionRows.error);
          setEventActions([]);
        }

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
  }, [demoModeActive]);

  useEffect(() => {
    if (!trackingTargetId) return;
    setShowAll(true);
    setOpenTrackingId(trackingTargetId);
  }, [trackingTargetId]);

  useEffect(() => {
    if (registerRequested) setShowAll(true);
  }, [registerRequested]);

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

  const activeEnriched = useMemo(
    () => enriched.filter((row) => !isVoided(row.event.status)),
    [enriched]
  );

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
    const activeEvents = filteredEvents.filter((event) => !isVoided(event.status));
    const total = activeEvents.length;
    const drafts = activeEvents.filter((e) => normaliseCommercialStatus(e.status) === "draft").length;
    const inReview = activeEvents.filter((e) => normaliseCommercialStatus(e.status) === "review").length;
    const ready = activeEvents.filter((e) => {
      const status = normaliseCommercialStatus(e.status);
      return status === "ready" || status === "complete" || status === "submitted" || status === "accepted" || status === "paid";
    }).length;
    return { total, drafts, inReview, ready };
  }, [filteredEvents]);

  const focusAction = useMemo<FocusAction | null>(() => {
    const openRows = activeEnriched.filter((row) => !isCommerciallyClosed(row.status, row.event.payment_status));
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
  }, [activeEnriched]);

  const focusEvent = focusAction?.event ?? null;

  const focusItems: Array<{ label: string; done: boolean; kind: "done" | "warning" | "pending" }> = useMemo(() => {
    if (!focusProgress) return [] as Array<{ label: string; done: boolean; kind: "done" | "warning" | "pending" }>;
    return [
      { label: "Basis of Change", done: focusProgress.basis, kind: (focusProgress.basis ? "done" : "warning") as "done" | "warning" },
      { label: "Evidence", done: focusProgress.evidence, kind: (focusProgress.evidence ? "done" : "warning") as "done" | "warning" },
      { label: "Resources", done: focusProgress.resources, kind: (focusProgress.resources ? "done" : "warning") as "done" | "warning" },
      { label: "Prelims", done: focusProgress.prelims, kind: (focusProgress.prelims ? "done" : "warning") as "done" | "warning" },
      { label: "Review", done: focusProgress.review, kind: (focusProgress.review ? "done" : "pending") as "done" | "pending" },
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
    let awaitingAssessment = 0;
    let overdue = 0;
    let paid = 0;
    let notSubmitted = 0;

    for (const row of activeEnriched) {
      const value = row.value ?? 0;
      const closed = isCommerciallyClosed(row.status, row.event.payment_status);
      const paymentStatus = normalisePaymentStatus(row.event.payment_status);
      const balance = balanceOutstanding(row.event, value);
      totalValue += value;

      paid += paidAmount(row.event, value);
      if (!closed && isSubmissionOutstanding(row.status)) notSubmitted += value;
      if (!closed && row.status === "submitted" && paymentStatus === "submitted_for_payment") awaitingAssessment += submittedAmount(row.event, value);
      if (!closed && isUnpaidCe(row.status, row.event.payment_status)) unpaid += balance;
      if (!closed && isOverdueCe(row.event)) overdue += balance;
    }

    return { totalValue, awaitingAssessment, unpaid, overdue, paid, notSubmitted };
  }, [activeEnriched]);

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
          (supabase as any).from("event_basis")
            .select("happened_summary,cause_type,cause_summary,difference_from_plan,mechanism_tags,mitigation_summary")
            .eq("event_id", focusEvent.id)
            .maybeSingle(),
          (supabase as any).from("event_files").select("id", { count: "exact", head: true }).eq("event_id", focusEvent.id),
          (supabase as any).from("event_contract_files").select("id", { count: "exact", head: true }).eq("event_id", focusEvent.id),
          (supabase as any).from("event_resource_lines").select("id", { count: "exact", head: true }).eq("event_id", focusEvent.id),
          (supabase as any).from("event_prelim_lines").select("id", { count: "exact", head: true }).eq("event_id", focusEvent.id),
          (supabase as any).from("event_review_settings").select("id", { count: "exact", head: true }).eq("event_id", focusEvent.id),
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

    for (const row of activeEnriched) {
      const title = displayEventTitle(row.event);
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
  }, [activeEnriched]);

  const dashboardStages = useMemo<DashboardStage[]>(() => {
    const stageDefinitions: Array<Omit<DashboardStage, "count" | "value" | "avgDays"> & { matcher: (row: (typeof activeEnriched)[number]) => boolean }> = [
      { key: "draft", label: "Draft", tone: "neutral", matcher: (row) => row.status === "draft" },
      { key: "review", label: "Ready for Review", tone: "blue", matcher: (row) => row.status === "review" || row.status === "ready" },
      { key: "submitted", label: "Submitted", tone: "blue", matcher: (row) => row.status === "submitted" },
      { key: "assessment", label: "Awaiting Assessment", tone: "orange", matcher: (row) => row.status === "submitted" && normalisePaymentStatus(row.event.payment_status) === "submitted_for_payment" },
      { key: "negotiation", label: "Negotiation", tone: "orange", matcher: (row) => row.status === "rejected" || normalisePaymentStatus(row.event.payment_status) === "disputed_short_paid" },
      { key: "agreed", label: "Agreed", tone: "green", matcher: (row) => row.status === "accepted" || normalisePaymentStatus(row.event.payment_status) === "assessed" || normalisePaymentStatus(row.event.payment_status) === "part_paid" },
      { key: "paid", label: "Paid", tone: "green", matcher: (row) => isCommerciallyClosed(row.status, row.event.payment_status) && row.status !== "void" },
    ];

    const stageValue = (stageKey: string, row: (typeof activeEnriched)[number]) => {
      const value = row.value ?? 0;
      const paymentStatus = normalisePaymentStatus(row.event.payment_status);
      if (stageKey === "assessment") return submittedAmount(row.event, value);
      if (stageKey === "agreed") return assessedAmount(row.event, value);
      if (stageKey === "paid") return paidAmount(row.event, value);
      if (stageKey === "negotiation" && paymentStatus === "disputed_short_paid") return balanceOutstanding(row.event, value);
      return value;
    };

    return stageDefinitions.map((stage) => {
      const rows = activeEnriched.filter(stage.matcher);
      const ages = rows
        .map((row) => daysBetween(row.event.created_at))
        .filter((days): days is number => typeof days === "number" && Number.isFinite(days));
      const avgDays = ages.length ? Math.round(ages.reduce((sum, days) => sum + days, 0) / ages.length) : null;
      return {
        key: stage.key,
        label: stage.label,
        tone: stage.tone,
        count: rows.length,
        value: rows.reduce((sum, row) => sum + stageValue(stage.key, row), 0),
        avgDays,
      };
    });
  }, [activeEnriched]);

  const trendMonths = useMemo(() => recentMonthKeys(8), [activeEnriched.length]);

  const recoveryTrend = useMemo(() => {
    if (!activeEnriched.length) return [0, 0];
    return trendMonths.map((month) => {
      const monthEnd = endOfMonthFromKey(month);
      if (!monthEnd) return 0;
      return activeEnriched.reduce((sum, row) => {
        const created = dateOnly(row.event.created_at);
        return created && created.getTime() <= monthEnd.getTime() ? sum + (row.value ?? 0) : sum;
      }, 0);
    });
  }, [activeEnriched, trendMonths]);

  const recoveryTrendChange = useMemo(() => {
    const latest = recoveryTrend[recoveryTrend.length - 1] ?? 0;
    const previous = recoveryTrend[recoveryTrend.length - 2] ?? 0;
    if (previous <= 0 && latest <= 0) return "No change";
    if (previous <= 0) return "New recovery value";
    const change = Math.round(((latest - previous) / previous) * 100);
    if (change === 0) return "No change vs last month";
    return `${change > 0 ? "↑" : "↓"} ${Math.abs(change)}% vs last month`;
  }, [recoveryTrend]);

  const radarItems = useMemo(() => {
    const readyToSubmit = activeEnriched
      .filter((row) => row.status === "ready")
      .reduce((sum, row) => sum + (row.value ?? 0), 0);
    const awaitingReview = activeEnriched
      .filter((row) => row.status === "review" || row.status === "draft")
      .reduce((sum, row) => sum + (row.value ?? 0), 0);
    const noticeDeadline = activeEnriched
      .filter((row) => isSubmissionOutstanding(row.status) && (row.timeRisk.state === "overdue" || row.timeRisk.state === "due_soon"))
      .reduce((sum, row) => sum + (row.value ?? 0), 0);
    return [
      { label: "Ready to submit", value: readyToSubmit, tone: "blue" as const },
      { label: "Payment overdue", value: metrics.overdue, tone: "red" as const },
      { label: "Awaiting review", value: awaitingReview, tone: "orange" as const },
      { label: "Notice deadline", value: noticeDeadline, tone: "purple" as const },
    ];
  }, [activeEnriched, metrics.overdue]);

  const todayOpportunity = useMemo(() => {
    return activeEnriched.reduce((sum, row) => {
      if (isOverdueCe(row.event)) return sum + balanceOutstanding(row.event, row.value);
      if (isSubmissionOutstanding(row.status)) return sum + (row.value ?? 0);
      return sum;
    }, 0);
  }, [activeEnriched]);

  const projectSummaries = useMemo(() => {
    const groups = new Map<string, typeof activeEnriched>();
    for (const row of activeEnriched) {
      const project = row.event.project_name?.trim() || "Project not set";
      groups.set(project, [...(groups.get(project) ?? []), row]);
    }
    return Array.from(groups.entries())
      .map(([project, rows]) => {
        const recoverable = rows.reduce((sum, row) => sum + (row.value ?? 0), 0);
        const recovered = rows.reduce((sum, row) => sum + paidAmount(row.event, row.value), 0);
        const outstanding = rows.reduce((sum, row) => sum + (isCommerciallyClosed(row.status, row.event.payment_status) ? 0 : balanceOutstanding(row.event, row.value)), 0);
        const overdue = rows.filter((row) => isOverdueCe(row.event)).length;
        const paidScore = recoverable > 0 ? (recovered / recoverable) * 70 : 0;
        const outstandingPenalty = recoverable > 0 ? (outstanding / recoverable) * 20 : 0;
        const overduePenalty = Math.min(35, overdue * 12);
        const health = recoverable > 0
          ? Math.max(0, Math.min(100, Math.round(65 + paidScore - outstandingPenalty - overduePenalty)))
          : 0;
        return { project, recoverable, recovered, outstanding, overdue, health };
      })
      .sort((a, b) => b.recoverable - a.recoverable)
      .slice(0, 3);
  }, [activeEnriched]);

  const insightCards = useMemo(() => {
    const eventById = new Map(activeEnriched.map((row) => [row.event.id, row]));
    const paidActions = eventActions.filter((action) => {
      const paymentStatus = metadataString(action.metadata, "payment_status");
      return action.action_type === "paid" || paymentStatus === "paid";
    });
    const agreementActions = eventActions.filter((action) => {
      const ceStatus = metadataString(action.metadata, "ce_status") || metadataString(action.metadata, "status");
      const paymentStatus = metadataString(action.metadata, "payment_status");
      return (
        action.action_type === "status_accepted" ||
        ceStatus === "accepted" ||
        paymentStatus === "assessed" ||
        paymentStatus === "part_paid" ||
        paymentStatus === "paid"
      );
    });

    const paidThisMonth = activeEnriched.reduce((sum, row) => {
      const paid = paidAmount(row.event, row.value);
      const matchingPaidAction = paidActions.find((action) => action.event_id === row.event.id);
      const date = paid > 0 ? dateOnly(matchingPaidAction?.action_date || row.event.agreed_payment_date || row.event.last_action_date) : null;
      const now = new Date();
      if (date && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) return sum + paid;
      return sum;
    }, 0);
    const agreedRows = activeEnriched.filter((row) => isAgreedStatus(row.status) || ["assessed", "part_paid", "paid"].includes(normalisePaymentStatus(row.event.payment_status)));
    const avgAgreement = agreedRows.length
      ? Math.round(agreedRows.reduce((sum, row) => sum + Math.max(0, daysBetween(row.event.created_at, row.event.last_action_date || row.event.agreed_payment_date || row.event.submitted_date || new Date()) ?? 0), 0) / agreedRows.length)
      : 0;
    const paidRows = activeEnriched.filter((row) => normalisePaymentStatus(row.event.payment_status) === "paid");
    const avgPayment = paidRows.length
      ? Math.round(paidRows.reduce((sum, row) => sum + Math.max(0, daysBetween(row.event.submitted_date || row.event.created_at, row.event.last_action_date || new Date()) ?? 0), 0) / paidRows.length)
      : 0;
    const noticeRows = activeEnriched.filter((row) => row.timeRisk.deadline);
    const noticeCompliance = noticeRows.length
      ? Math.round((noticeRows.filter((row) => row.timeRisk.state !== "overdue").length / noticeRows.length) * 100)
      : null;
    const paidTrendFromActions = monthlySeries(
      paidActions,
      (action) => action.action_date || action.created_at,
      (action) => {
        const row = eventById.get(action.event_id);
        return metadataNumber(action.metadata, "paid_amount") ?? (row ? paidAmount(row.event, row.value) : 0);
      },
      { months: trendMonths }
    );
    const paidTrendFallback = monthlySeries(
      activeEnriched,
      (row) => normalisePaymentStatus(row.event.payment_status) === "paid" ? row.event.agreed_payment_date || row.event.last_action_date : null,
      (row) => paidAmount(row.event, row.value),
      { months: trendMonths }
    );
    const paidTrend = paidTrendFromActions.some(Boolean) ? paidTrendFromActions : paidTrendFallback;
    const agreementTrendFromActions = monthlyAverageSeries(
      agreementActions,
      (action) => action.action_date || action.created_at,
      (action) => {
        const row = eventById.get(action.event_id);
        return row ? Math.max(0, daysBetween(row.event.created_at, action.action_date || action.created_at || new Date()) ?? 0) : null;
      },
      trendMonths
    );
    const agreementTrendFallback = monthlyAverageSeries(
      agreedRows,
      (row) => row.event.last_action_date || row.event.agreed_payment_date || row.event.submitted_date || row.event.created_at,
      (row) => Math.max(0, daysBetween(row.event.created_at, row.event.last_action_date || row.event.agreed_payment_date || row.event.submitted_date || new Date()) ?? 0),
      trendMonths
    );
    const agreementTrend = agreementTrendFromActions.some(Boolean) ? agreementTrendFromActions : agreementTrendFallback;
    const paymentTrendFromActions = monthlyAverageSeries(
      paidActions,
      (action) => action.action_date || action.created_at,
      (action) => {
        const row = eventById.get(action.event_id);
        return row ? Math.max(0, daysBetween(row.event.submitted_date || row.event.created_at, action.action_date || action.created_at || new Date()) ?? 0) : null;
      },
      trendMonths
    );
    const paymentTrendFallback = monthlyAverageSeries(
      paidRows,
      (row) => row.event.agreed_payment_date || row.event.last_action_date,
      (row) => Math.max(0, daysBetween(row.event.submitted_date || row.event.created_at, row.event.last_action_date || row.event.agreed_payment_date || new Date()) ?? 0),
      trendMonths
    );
    const paymentTrend = paymentTrendFromActions.some(Boolean) ? paymentTrendFromActions : paymentTrendFallback;
    const noticeComplianceTrend = trendMonths.map((month) => {
      const rowsByMonth = noticeRows.filter((row) => {
        const deadline = row.timeRisk.deadline;
        return deadline && monthKey(deadline) === month;
      });
      if (!rowsByMonth.length) return 0;
      const compliant = rowsByMonth.filter((row) => row.timeRisk.state !== "overdue").length;
      return Math.round((compliant / rowsByMonth.length) * 100);
    });
    const flatSpark = [0, 0];
    return [
      { label: "Recoverable Value Over Time", value: money(metrics.totalValue), tone: "green" as const, spark: recoveryTrend },
      { label: "Money Recovered This Month", value: money(paidThisMonth), tone: "green" as const, spark: paidTrend.some(Boolean) ? paidTrend : flatSpark },
      { label: "Average Time to Agreement", value: avgAgreement ? `${avgAgreement} days` : "No data yet", tone: "purple" as const, spark: agreementTrend.some(Boolean) ? agreementTrend : flatSpark },
      { label: "Average Time to Payment", value: avgPayment ? `${avgPayment} days` : "No data yet", tone: "orange" as const, spark: paymentTrend.some(Boolean) ? paymentTrend : flatSpark },
      { label: "Notice Compliance", value: noticeCompliance === null ? "No notices yet" : `${noticeCompliance}%`, tone: "green" as const, spark: noticeComplianceTrend.some(Boolean) ? noticeComplianceTrend : flatSpark },
    ];
  }, [activeEnriched, eventActions, metrics.totalValue, recoveryTrend, trendMonths]);

  const riskFlags = useMemo<RiskFlag[]>(() => {
    const rows = activeEnriched.filter((row) => !isCommerciallyClosed(row.status, row.event.payment_status));
    const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
    const valueOf = (items: typeof rows) => items.reduce((sum, row) => sum + (row.value ?? 0), 0);
    const balanceOf = (items: typeof rows) => items.reduce((sum, row) => sum + balanceOutstanding(row.event, row.value), 0);
    const biggest = (items: typeof rows) => [...items].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
    const flags: RiskFlag[] = [];

    const overdue = rows.filter((row) => isOverdueCe(row.event));
    const rejected = rows.filter((row) => row.status === "rejected");
    const noticeRisk = rows.filter((row) => isSubmissionOutstanding(row.status) && (row.timeRisk.state === "overdue" || row.timeRisk.state === "due_soon"));
    const shortPaid = rows.filter((row) => {
      const paymentStatus = normalisePaymentStatus(row.event.payment_status);
      return paymentStatus === "disputed_short_paid" || Number(row.event.disallowed_amount ?? 0) > 0;
    });
    const ready = rows.filter((row) => row.status === "ready");
    const unissued = rows.filter((row) => isSubmissionOutstanding(row.status) && (row.value ?? 0) > 0);

    if (overdue.length) {
      const first = biggest(overdue);
      flags.push({
        key: "overdue",
        label: "Payment follow-up risk",
        detail: `${plural(overdue.length, "CE")} past expected payment`,
        value: money(balanceOf(overdue)),
        href: first ? paymentTrackingHref(first.event.id) : "/app/priorities",
        tone: "red",
        icon: "clock",
      });
    }

    if (rejected.length) {
      const first = biggest(rejected);
      flags.push({
        key: "rejected",
        label: "Rejected CE needs rebuttal",
        detail: `${plural(rejected.length, "event")} challenged by client`,
        value: money(valueOf(rejected)),
        href: first ? `/app/event/${first.event.id}/review?mode=rebuttal` : "/app/priorities",
        tone: "red",
        icon: "alert",
      });
    }

    if (shortPaid.length) {
      const first = biggest(shortPaid);
      flags.push({
        key: "short-paid",
        label: "Short-paid / disputed value",
        detail: `${plural(shortPaid.length, "CE")} needs commercial response`,
        value: money(balanceOf(shortPaid)),
        href: first ? paymentTrackingHref(first.event.id) : "/app/priorities",
        tone: "orange",
        icon: "money",
      });
    }

    if (noticeRisk.length) {
      const first = noticeRisk
        .slice()
        .sort((a, b) => (a.timeRisk.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.timeRisk.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER))[0];
      flags.push({
        key: "notice-risk",
        label: "Notice position exposed",
        detail: `${plural(noticeRisk.length, "event")} close to or past deadline`,
        value: first?.timeRisk.label ?? "Review",
        href: first ? `/app/event/${first.event.id}` : "/app/priorities",
        tone: "orange",
        icon: "alert",
      });
    }

    if (ready.length) {
      const first = biggest(ready);
      flags.push({
        key: "ready",
        label: "Ready packs not issued",
        detail: `${plural(ready.length, "pack")} ready for final review`,
        value: money(valueOf(ready)),
        href: first ? `/app/event/${first.event.id}/review` : "/app?register=1",
        tone: "blue",
        icon: "file",
      });
    }

    if (unissued.length) {
      const first = biggest(unissued);
      flags.push({
        key: "unissued",
        label: "Value still unissued",
        detail: `${plural(unissued.length, "CE")} sitting before submission`,
        value: money(valueOf(unissued)),
        href: first ? `/app/event/${first.event.id}` : "/app?register=1",
        tone: "purple",
        icon: "rocket",
      });
    }

    return flags.slice(0, 4);
  }, [activeEnriched]);

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

    if (demoModeActive) {
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, title: nextTitle } : e)));
      cancelRename();
      return;
    }

    try {
      setRenameSavingId(eventId);
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      const { error } = await (supabase as any).from("events").update({ title: nextTitle }).eq("id", eventId).eq("user_id", user.id);
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

    if (demoModeActive) {
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, project_name: nextProject } : e)));
      setProjectMoveValues((prev) => {
        const next = { ...prev };
        delete next[event.id];
        return next;
      });
      return;
    }

    try {
      setProjectMoveSavingId(event.id);
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, project_name: nextProject } : e)));

      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      const { error } = await (supabase as any).from("events").update({ project_name: nextProject }).eq("id", event.id).eq("user_id", user.id);
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

  async function unlinkConvertedEwns(supabase: any, eventId: string, userId: string) {
    const fullUpdate = await supabase
      .from("ewns")
      .update({ status: "open", converted_event_id: null, converted_at: null })
      .eq("converted_event_id", eventId)
      .eq("user_id", userId);

    if (!fullUpdate.error) return;
    if (!isOptionalSchemaError(fullUpdate.error)) {
      console.warn("Could not unlink converted EWNs before deleting CE", fullUpdate.error);
      return;
    }

    const fallbackUpdate = await supabase
      .from("ewns")
      .update({ status: "open", converted_event_id: null })
      .eq("converted_event_id", eventId)
      .eq("user_id", userId);

    if (fallbackUpdate.error && !isOptionalSchemaError(fallbackUpdate.error)) {
      console.warn("Could not unlink converted EWNs before deleting CE", fallbackUpdate.error);
    }
  }

  async function deleteRegisterEvent(event: EventRow) {
    if (deleteConfirmValue.trim().toLowerCase() !== "delete") return;

    if (demoModeActive) {
      setDeleteConfirmEventId(null);
      setDeleteConfirmValue("");
      return;
    }

    const previousEvents = events;

    try {
      setDeletingEventId(event.id);
      setEvents((prev) => prev.filter((item) => item.id !== event.id));

      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);

      await unlinkConvertedEwns(supabase, event.id, user.id);

      const fileRows = await (supabase as any).from("event_files").select("file_path").eq("event_id", event.id);
      const filePaths = Array.isArray(fileRows.data)
        ? fileRows.data
            .map((file: { file_path?: string | null }) => file.file_path)
            .filter((path: string | null | undefined): path is string => Boolean(path))
        : [];
      if (filePaths.length > 0) {
        const storageRemove = await supabase.storage.from("event-files").remove(filePaths);
        if (storageRemove.error) console.warn("Could not remove CE evidence files from storage", storageRemove.error);
      } else if (fileRows.error && !isOptionalSchemaError(fileRows.error)) {
        console.warn("Could not load CE evidence files for deletion", fileRows.error);
      }

      const contractFileRows = await (supabase as any).from("event_contract_files").select("file_path").eq("event_id", event.id);
      const contractFilePaths = Array.isArray(contractFileRows.data)
        ? contractFileRows.data
            .map((file: { file_path?: string | null }) => file.file_path)
            .filter((path: string | null | undefined): path is string => Boolean(path))
        : [];
      if (contractFilePaths.length > 0) {
        const contractStorageRemove = await supabase.storage.from("contract-files").remove(contractFilePaths);
        if (contractStorageRemove.error) console.warn("Could not remove CE contract files from storage", contractStorageRemove.error);
      } else if (contractFileRows.error && !isOptionalSchemaError(contractFileRows.error)) {
        console.warn("Could not load CE contract files for deletion", contractFileRows.error);
      }

      await optionalDeleteQuery((supabase as any).from("event_file_share_links").delete().eq("event_id", event.id), "evidence share links");
      await optionalDeleteQuery((supabase as any).from("event_actions").delete().eq("event_id", event.id), "action history");
      await optionalDeleteQuery((supabase as any).from("event_rebuttals").delete().eq("event_id", event.id), "commercial pushback");
      await optionalDeleteQuery((supabase as any).from("event_ai_drafts").delete().eq("event_id", event.id), "drafts");
      await optionalDeleteQuery((supabase as any).from("event_packs").delete().eq("event_id", event.id), "packs");
      await optionalDeleteQuery((supabase as any).from("event_files").delete().eq("event_id", event.id), "files");
      await optionalDeleteQuery((supabase as any).from("event_contract_files").delete().eq("event_id", event.id), "contract files");
      await optionalDeleteQuery((supabase as any).from("event_review_settings").delete().eq("event_id", event.id), "review settings");
      await optionalDeleteQuery((supabase as any).from("event_valuation_settings").delete().eq("event_id", event.id), "valuation settings");
      await optionalDeleteQuery((supabase as any).from("event_prelim_lines").delete().eq("event_id", event.id), "prelims");
      await optionalDeleteQuery((supabase as any).from("event_resource_lines").delete().eq("event_id", event.id), "resources");
      await optionalDeleteQuery((supabase as any).from("event_basis").delete().eq("event_id", event.id), "basis");

      const deleteEvent = await (supabase as any).from("events").delete().eq("id", event.id).eq("user_id", user.id);
      if (deleteEvent.error) throw deleteEvent.error;
      setDeleteConfirmEventId(null);
      setDeleteConfirmValue("");
    } catch (err) {
      console.warn("Failed to delete CE/VO", err);
      setEvents(previousEvents);
    } finally {
      setDeletingEventId(null);
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
      Object.assign(patch, applyDerivedPaymentTracking(previous || ({} as EventRow), patch, currentValue));
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

    if (demoModeActive) return;

    try {
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      const update = await updateEventTrackingWithFallback(supabase, eventId, user.id, patch);
      if (!update.saved) {
        if (hasCoreTrackingChange(next)) throw update.error || new Error("Failed to save CE register tracking.");
        console.warn("CE register optional tracking stayed local because this database schema rejected it", update.error);
        return;
      }

      if (update.partial) {
        console.warn("CE register tracking saved partially because this database schema does not support every recovery field yet.");
      }

      const actionInsert = await (supabase as any).from("event_actions").insert({
        event_id: eventId,
        user_id: user.id,
        action_type: patch.last_action_type || "tracking_updated",
        action_date: patch.last_action_date || actionToday,
        notes: recoveryActionSummary(patch),
        metadata: patch,
      });
      if (actionInsert.error) {
        console.warn("CE register tracking saved without action history", actionInsert.error);
      }

      void trackAnalyticsWithUser(supabase, "payment_status_updated", {
        event_id: eventId,
        action_type: patch.last_action_type || "tracking_updated",
        ce_status: patch.status || previous?.status || null,
        payment_status: patch.payment_status || previous?.payment_status || null,
        paid_amount: patch.paid_amount ?? null,
        assessed_amount: patch.assessed_amount ?? null,
        disallowed_amount: patch.disallowed_amount ?? null,
        balance_outstanding: patch.balance_outstanding ?? null,
      });
    } catch (err) {
      console.warn("Failed to update CE register tracking", err);
      if (previous && hasCoreTrackingChange(next)) setEvents((prev) => prev.map((e) => (e.id === eventId ? previous : e)));
    }
  }

  const shouldShowOnboarding = forceOnboarding || (!demoModeActive && !registerRequested && !loading && events.length === 0 && activationState !== "COMPLETE");

  if (shouldShowOnboarding) {
    return (
      <div style={{ background: appUi.bg, minHeight: "100vh" }}>
        <OnboardingActivationDashboard forceStart={forceOnboarding} onStateChange={handleActivationStateChange} />
      </div>
    );
  }

  return (
    <div style={{ background: appUi.bg, minHeight: "100vh" }}>
      <div style={{ width: "100%", margin: "0 auto", padding: "6px 0 44px" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <header style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", minHeight: 44 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
              <label style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <span style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>Project filter</span>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  style={{
                    height: 44,
                    minWidth: 156,
                    padding: "0 36px 0 14px",
                    borderRadius: 13,
                    border: `1px solid ${appUi.border}`,
                    background: appUi.surface,
                    color: appUi.text,
                    fontWeight: 750,
                    fontSize: 13,
                    cursor: "pointer",
                    appearance: "none",
                    boxShadow: appUi.shadowSoft,
                  }}
                >
                  <option value="all">All Projects</option>
                  {projectOptions.map((project) => (
                    <option key={project} value={project}>{project}</option>
                  ))}
                </select>
                <span aria-hidden="true" style={{ position: "absolute", right: 14, color: appUi.muted, fontSize: 11, pointerEvents: "none" }}>⌄</span>
              </label>
            </div>
          </header>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 18, alignItems: "stretch" }}>
            <DashboardTopCard
              title="Commercial Recovery Position"
              action={<StatusBadge tone={recoveryTrendChange.startsWith("↓") ? "red" : "green"}>{recoveryTrendChange}</StatusBadge>}
            >
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.62fr) minmax(220px, 0.38fr)", gap: 18, alignItems: "center" }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ color: appUi.muted, fontSize: 13, fontWeight: 700 }}>Recoverable Value</div>
                  <div style={{ color: appUi.text, fontSize: 46, lineHeight: 1, fontWeight: 900, letterSpacing: 0 }}>{loading ? "—" : money(metrics.totalValue)}</div>
                  <div style={{ color: appUi.muted, fontSize: 13, lineHeight: 1.45 }}>Across {activeEnriched.length} live commercial {activeEnriched.length === 1 ? "event" : "events"}</div>
                </div>
                <MiniSparkline values={recoveryTrend} tone="green" height={98} />
              </div>
              <div style={{ height: 1, background: appUi.border }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(100px, 1fr))", gap: 12 }}>
                {[
                  { label: "Awaiting Assessment", value: metrics.awaitingAssessment, tone: "blue" as const, icon: "clock" as const },
                  { label: "Awaiting Payment", value: metrics.unpaid, tone: "orange" as const, icon: "money" as const },
                  { label: "Overdue Recovery", value: metrics.overdue, tone: "red" as const, icon: "alert" as const },
                  { label: "Recovered", value: metrics.paid, tone: "green" as const, icon: "check" as const },
                  { label: "Potential Value Not Yet Submitted", value: metrics.notSubmitted, tone: "purple" as const, icon: "file" as const },
                ].map((item) => {
                  const tc = toneColours(item.tone);
                  return (
                    <div key={item.label} style={{ display: "grid", gap: 7, borderRight: `1px solid ${appUi.border}`, paddingRight: 8 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ color: appUi.muted, fontSize: 11, lineHeight: 1.25, fontWeight: 800 }}>{item.label}</span>
                        <span style={{ width: 23, height: 23, borderRadius: 999, display: "grid", placeItems: "center", color: tc.text, background: tc.bg, flexShrink: 0 }}><SmallIcon name={item.icon} /></span>
                      </div>
                      <div style={{ color: appUi.text, fontSize: 18, lineHeight: 1.05, fontWeight: 850 }}>{loading ? "—" : money(Math.max(0, item.value))}</div>
                    </div>
                  );
                })}
              </div>
            </DashboardTopCard>

            <DashboardTopCard title="Commercial Radar" action={<Link href="/app/priorities" style={{ color: appUi.blue, textDecoration: "none", fontSize: 12, fontWeight: 800 }}>View all opportunities →</Link>}>
              <div className="dashboard-radar-grid" style={{ display: "grid", gridTemplateColumns: "minmax(190px, 0.45fr) minmax(430px, 0.55fr)", gap: 22, alignItems: "center", minWidth: 0 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ color: appUi.muted, fontSize: 13, fontWeight: 750 }}>Today&apos;s Opportunity</div>
                  <div style={{ color: appUi.text, fontSize: 42, lineHeight: 1, fontWeight: 900 }}>{loading ? "—" : money(todayOpportunity)}</div>
                  <div style={{ color: appUi.muted, fontSize: 13, lineHeight: 1.45 }}>that could move forward today</div>
                </div>
                <OpportunityRadar items={radarItems} />
              </div>
            </DashboardTopCard>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(420px, 0.85fr)", gap: 18, alignItems: "stretch" }}>
            <DashboardTopCard title="Commercial Pipeline" action={<Link href="/app?register=1" style={{ color: appUi.blue, textDecoration: "none", fontSize: 12, fontWeight: 800 }}>View full register →</Link>}>
              <div className="dashboard-pipeline-stages" style={{ display: "grid", gridTemplateColumns: `repeat(${dashboardStages.length}, minmax(0, 1fr))`, gap: 10, position: "relative" }}>
                {dashboardStages.map((stage) => <PipelineStage key={stage.key} stage={stage} />)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: dashboardStages.map((stage) => `${Math.max(1, stage.value || stage.count)}fr`).join(" "), height: 8, borderRadius: 999, overflow: "hidden", background: appUi.soft }}>
                {dashboardStages.map((stage) => {
                  const tc = toneColours(stage.tone);
                  return <span key={stage.key} style={{ background: tc.text, minWidth: 10 }} />;
                })}
              </div>
            </DashboardTopCard>

            <DashboardTopCard title="Today's Priorities" action={<Link href="/app/priorities" style={{ color: appUi.blue, textDecoration: "none", fontSize: 12, fontWeight: 800 }}>View all →</Link>}>
              <div style={{ display: "grid" }}>
                {(actions.length ? actions.slice(0, 4) : []).map((action) => {
                  const tone = action.tone === "amber" ? "orange" : action.tone === "neutral" ? "blue" : action.tone;
                  const tc = toneColours(tone);
                  return (
                    <Link
                      key={action.id}
                      href={action.href}
                      style={{
                        textDecoration: "none",
                        display: "grid",
                        gridTemplateColumns: "34px minmax(0, 1fr) auto",
                        gap: 10,
                        alignItems: "center",
                        padding: "12px 0",
                        borderBottom: `1px solid ${appUi.border}`,
                      }}
                    >
                      <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: tc.bg, color: tc.text }}><SmallIcon name={action.tone === "red" ? "alert" : action.tone === "amber" ? "calendar" : "file"} /></span>
                      <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
                        <span style={{ color: appUi.text, fontSize: 12.5, lineHeight: 1.25, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{action.eyebrow}</span>
                        <span style={{ color: appUi.muted, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{action.title}</span>
                      </span>
                      <span style={{ display: "grid", justifyItems: "end", gap: 4, minWidth: 78 }}>
                        <span style={{ color: tc.text, fontSize: 12.5, fontWeight: 900, whiteSpace: "nowrap" }}>{action.cta} →</span>
                        <span style={{ color: appUi.muted, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{action.value !== null ? money(action.value) : "Value TBC"}</span>
                      </span>
                    </Link>
                  );
                })}
              {!actions.length ? <div style={{ color: appUi.muted, fontSize: 13, lineHeight: 1.5 }}>No live priorities yet. Create or submit a CE to start recovery tracking.</div> : null}
              </div>
            </DashboardTopCard>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(420px, 0.85fr)", gap: 18, alignItems: "stretch" }}>
            <DashboardTopCard title="Recovery Insights" action={<span style={{ color: appUi.blue, fontSize: 12, fontWeight: 800 }}>View all reports →</span>}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(120px, 1fr))", gap: 12 }}>
                {insightCards.map((card) => (
                  <div key={card.label} style={{ border: `1px solid ${appUi.border}`, borderRadius: 14, padding: 12, background: appUi.surface, display: "grid", gap: 8 }}>
                    <div style={{ color: appUi.muted, fontSize: 11, lineHeight: 1.25, fontWeight: 750 }}>{card.label}</div>
                    <div style={{ color: appUi.text, fontSize: 16, lineHeight: 1.1, fontWeight: 850 }}>{card.value}</div>
                    <MiniSparkline values={card.spark} tone={card.tone} height={48} />
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: appUi.muted, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 850 }}>Commercial risk flags</span>
                  <Link href="/app/priorities" style={{ color: appUi.blue, fontSize: 12, fontWeight: 800, textDecoration: "none" }}>Open priority board →</Link>
                </div>
                <div className="dashboard-risk-flags" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  {riskFlags.length ? riskFlags.map((flag) => (
                    <RiskFlagTile key={flag.key} flag={flag} />
                  )) : (
                    <div style={{ gridColumn: "1 / -1", border: `1px dashed ${appUi.border}`, borderRadius: 14, padding: "16px 14px", color: appUi.muted, fontSize: 13, lineHeight: 1.45 }}>
                      No material risk flags right now. New flags will appear here when a CE becomes overdue, rejected, short-paid, close to notice deadline or ready to issue.
                    </div>
                  )}
                </div>
              </div>
            </DashboardTopCard>

            <DashboardTopCard title="Projects Overview" action={<Link href="/app/projects" style={{ color: appUi.blue, textDecoration: "none", fontSize: 12, fontWeight: 800 }}>View all →</Link>}>
              <div style={{ display: "grid", gap: 10 }}>
                {projectSummaries.length ? projectSummaries.map((project) => (
                  <Link key={project.project} href={`/app/projects`} style={{ textDecoration: "none", border: `1px solid ${appUi.border}`, borderRadius: 14, padding: 13, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center" }}>
                    <span style={{ display: "grid", gap: 8, minWidth: 0 }}>
                      <span style={{ color: appUi.text, fontSize: 13, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.project}</span>
                      <span style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                        <span><b style={{ color: appUi.blue }}>{money(project.recoverable)}</b><small style={{ display: "block", color: appUi.muted }}>Recoverable</small></span>
                        <span><b style={{ color: appUi.green }}>{money(project.recovered)}</b><small style={{ display: "block", color: appUi.muted }}>Recovered</small></span>
                        <span><b style={{ color: appUi.orange }}>{money(project.outstanding)}</b><small style={{ display: "block", color: appUi.muted }}>Outstanding</small></span>
                        <span><b style={{ color: project.overdue ? appUi.red : appUi.text }}>{project.overdue}</b><small style={{ display: "block", color: appUi.muted }}>Overdue</small></span>
                      </span>
                    </span>
                    <RingProgress value={project.health} tone={project.overdue ? "orange" : "green"} label="Health" size={72} />
                  </Link>
                )) : <div style={{ color: appUi.muted, fontSize: 13 }}>Projects will appear once CEs are linked to a project.</div>}
              </div>
            </DashboardTopCard>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ color: appUi.text, fontSize: 12, fontWeight: 850, textTransform: "uppercase", letterSpacing: 0.65 }}>Quick Access</div>
            <div className="dashboard-quick-grid" style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(135px, 1fr))", gap: 12 }}>
              <QuickAccessTile href="/app?register=1" label="All Events" hint="View and manage CEs" icon={<SmallIcon name="file" />} tone="blue" />
              <QuickAccessTile href="/app/ewns" label="EWNs" hint="Early warning register" icon={<SmallIcon name="alert" />} tone="orange" />
              <QuickAccessTile href="/app/projects" label="Projects" hint="View all projects" icon={<SmallIcon name="building" />} tone="purple" />
              <QuickAccessTile href="/app?register=1" label="Evidence" hint="Upload and manage files" icon={<SmallIcon name="file" />} tone="green" />
              <QuickAccessTile href="/app/rates" label="Rate Cards" hint="Manage rates" icon={<SmallIcon name="money" />} tone="purple" />
              <QuickAccessTile href="/app?register=1" label="Submission Packs" hint="Generated packs" icon={<SmallIcon name="file" />} tone="blue" />
              <QuickAccessTile href="/app/priorities" label="Commercial Pushback" hint="Review challenges" icon={<SmallIcon name="rocket" />} tone="red" />
              <QuickAccessTile href="/app/priorities" label="Payment Tracking" hint="Track recovery status" icon={<SmallIcon name="calendar" />} tone="blue" />
            </div>
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
                border: `1px solid ${toneColours("purple").border}`,
                background: toneColours("purple").bg,
                color: appUi.purple,
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(109,74,255,0.08)",
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
                          const isExpanded = isTrackingTarget;
                          const voided = isVoided(row.event.status);
                          const paymentEditable = !voided && (isSubmittedOrAccepted(row.event.status) || isCommerciallyClosed(row.event.status, row.event.payment_status));
                          const rowBalance = balanceOutstanding(row.event, row.value);
                          const paymentDisplayTone = isOverdueCe(row.event) ? actionTone("red") : paymentTone(row.event.payment_status);
                          const showNoticeBadge = !voided && !isSubmittedOrAccepted(row.event.status) && !isCommerciallyClosed(row.event.status, row.event.payment_status);
                          const recoveryControlTone =
                            voided || isCommerciallyClosed(row.event.status, row.event.payment_status)
                              ? "green"
                              : row.event.status === "rejected" || isOverdueCe(row.event)
                              ? "red"
                              : isUnpaidCe(row.status, row.event.payment_status)
                              ? "blue"
                              : showNoticeBadge && row.timeRisk.state !== "safe"
                              ? "orange"
                              : "purple";
                          const recoveryControlColours = toneColours(recoveryControlTone);
                          const recoveryControlLabel =
                            voided
                              ? "Audit record"
                              : isCommerciallyClosed(row.event.status, row.event.payment_status)
                              ? "Recovery closed"
                              : row.event.status === "rejected"
                              ? "Rebuttal required"
                              : isOverdueCe(row.event)
                              ? "Payment overdue"
                              : isUnpaidCe(row.status, row.event.payment_status)
                              ? "Payment follow-up"
                              : showNoticeBadge && row.timeRisk.state !== "safe"
                              ? "Notice action"
                              : "Recovery control";
                          const recoveryControlDetail =
                            voided
                              ? "This CE / VO is void and kept for audit only. It is excluded from live recovery totals."
                              : isCommerciallyClosed(row.event.status, row.event.payment_status)
                              ? "Paid and commercially closed. Keep the record for audit, but no recovery action is needed."
                              : row.event.status === "rejected"
                              ? "Prepare the rebuttal position and address the reason the CE / VO has been rejected or discounted."
                              : isOverdueCe(row.event)
                              ? "The expected payment date has passed. Chase the outstanding value and record the response."
                              : isUnpaidCe(row.status, row.event.payment_status)
                              ? "Submitted or accepted value is still unpaid. Keep the follow-up dates and client response current."
                              : showNoticeBadge && row.timeRisk.state !== "safe"
                              ? "The notice position needs attention before the opportunity weakens."
                              : "Track assessment, chase dates, short payment and recovery action without changing the client-facing narrative.";
                          return (
                            <div
                              key={row.event.id}
                              ref={isTrackingTarget ? trackingTargetRef : null}
                              style={{
                                border: `1px solid ${isTrackingTarget ? toneColours("purple").border : c.border}`,
                                borderRadius: isExpanded ? 20 : 16,
                                padding: isExpanded ? 16 : "10px 12px",
                                background: voided ? c.soft : c.card,
                                display: "grid",
                                gap: isExpanded ? 14 : 0,
                                opacity: voided ? 0.68 : 1,
                                boxShadow: isTrackingTarget ? "0 0 0 3px rgba(109,74,255,0.08), 0 18px 46px rgba(15,23,42,0.06)" : "none",
                                transition: "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, opacity 160ms ease",
                              }}
                            >
                      <button
                        type="button"
                        onClick={() => setOpenTrackingId(isExpanded ? null : row.event.id)}
                        aria-expanded={isExpanded}
                        style={{
                          width: "100%",
                          border: 0,
                          background: "transparent",
                          padding: 0,
                          cursor: "pointer",
                          display: "grid",
                          gridTemplateColumns: "24px minmax(0, 1fr) auto",
                          gap: 10,
                          alignItems: "center",
                          textAlign: "left",
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 999,
                            display: "grid",
                            placeItems: "center",
                            border: `1px solid ${isExpanded ? toneColours("purple").border : c.border}`,
                            background: isExpanded ? toneColours("purple").bg : c.input,
                            color: isExpanded ? appUi.purple : c.sub,
                            fontSize: 12,
                            fontWeight: 800,
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 160ms ease",
                          }}
                        >
                          ▾
                        </span>
                        <span style={{ color: voided ? c.sub : c.text, fontSize: 14, lineHeight: 1.35, fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {displayEventTitle(row.event)}
                        </span>
                        <span style={{ display: "flex", gap: 7, alignItems: "center", justifyContent: "flex-end", minWidth: 0, whiteSpace: "nowrap" }}>
                          <span
                            title={row.value === null ? "CE value not calculated yet" : `CE value ${fullMoney(row.value)}`}
                            style={{
                              padding: "5px 9px",
                              borderRadius: 999,
                              border: `1px solid ${row.value === null ? c.border : toneColours("purple").border}`,
                              background: row.value === null ? c.input : toneColours("purple").bg,
                              color: row.value === null ? c.sub : appUi.purple,
                              fontSize: 11.5,
                              lineHeight: 1,
                              fontWeight: 800,
                            }}
                          >
                            {row.value === null ? "Value TBC" : money(row.value)}
                          </span>
                          <span style={{ padding: "5px 9px", borderRadius: 999, border: `1px solid ${st.bd}`, background: st.bg, color: st.tx, fontSize: 11.5, lineHeight: 1, fontWeight: 700 }}>
                            {getCommercialStatusLabel(row.event.status)}
                          </span>
                          {!voided ? (
                            <span style={{ padding: "5px 9px", borderRadius: 999, border: `1px solid ${paymentDisplayTone.bd}`, background: paymentDisplayTone.bg, color: paymentDisplayTone.tx, fontSize: 11.5, lineHeight: 1, fontWeight: 700 }}>
                              {isOverdueCe(row.event) ? "Overdue" : getPaymentStatusLabel(row.event.payment_status)}
                            </span>
                          ) : null}
                          {showNoticeBadge ? (
                            <span style={{ padding: "5px 9px", borderRadius: 999, border: `1px solid ${timeTone.bd}`, background: row.timeRisk.state === "safe" ? c.card : timeTone.bg, color: timeTone.tx, fontSize: 11.5, lineHeight: 1, fontWeight: 700 }}>
                              {row.timeRisk.deadline ? row.timeRisk.label : "No event date"}
                            </span>
                          ) : null}
                        </span>
                      </button>
                      {isExpanded ? (
                        <>
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 16, alignItems: "start", padding: "6px 2px 2px" }}>
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
                              <Link href={`/app/event/${row.event.id}`} style={{ color: voided ? c.sub : c.text, textDecoration: "none", fontSize: 16, fontWeight: 800, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: 0 }}>
                                {displayEventTitle(row.event)}
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
                            <div style={{ fontSize: 16, fontWeight: 800, color: appUi.purple }}>{fullMoney(row.value)}</div>
                          )}
                          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <span style={{ padding: "5px 9px", borderRadius: 999, border: `1px solid ${st.bd}`, background: st.bg, color: st.tx, fontSize: 11.5, fontWeight: 650 }}>
                              {getCommercialStatusLabel(row.event.status)}
                            </span>
                            {!voided ? (
                              <span style={{ padding: "5px 9px", borderRadius: 999, border: `1px solid ${(isOverdueCe(row.event) ? actionTone("red") : paymentTone(row.event.payment_status)).bd}`, background: (isOverdueCe(row.event) ? actionTone("red") : paymentTone(row.event.payment_status)).bg, color: (isOverdueCe(row.event) ? actionTone("red") : paymentTone(row.event.payment_status)).tx, fontSize: 11.5, fontWeight: 650 }}>
                                {isOverdueCe(row.event) ? "Overdue" : getPaymentStatusLabel(row.event.payment_status)}
                              </span>
                            ) : null}
                            {!isSubmittedOrAccepted(row.event.status) && !isCommerciallyClosed(row.event.status, row.event.payment_status) ? (
                              <span style={{ padding: "5px 9px", borderRadius: 999, border: `1px solid ${timeTone.bd}`, background: row.timeRisk.state === "safe" ? c.card : timeTone.bg, color: timeTone.tx, fontSize: 11.5, fontWeight: 650 }}>
                                {row.timeRisk.deadline ? row.timeRisk.label : "No event date"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                          gap: 10,
                        }}
                      >
                        {[
                          ["CE value", row.value === null ? "Value TBC" : fullMoney(row.value), "purple"],
                          ["Balance outstanding", fullMoney(rowBalance), rowBalance > 0 ? "orange" : "green"],
                          ["Commercial status", getCommercialStatusLabel(row.event.status), voided ? "neutral" : st.tx === c.redTx ? "red" : st.tx === c.greenTx ? "green" : "blue"],
                          ["Payment position", isOverdueCe(row.event) ? "Overdue" : getPaymentStatusLabel(row.event.payment_status), isOverdueCe(row.event) ? "red" : rowBalance > 0 ? "orange" : "green"],
                        ].map(([label, value, tone]) => {
                          const tc = toneColours(tone as "purple" | "orange" | "green" | "blue" | "red" | "neutral");
                          return (
                            <div key={label} style={{ border: `1px solid ${tc.border}`, background: tc.bg, borderRadius: 16, padding: "12px 13px", minHeight: 72, display: "grid", alignContent: "space-between", gap: 7 }}>
                              <span style={{ color: c.sub, fontSize: 11, lineHeight: 1, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</span>
                              <span style={{ color: tc.text, fontSize: 15, lineHeight: 1.15, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
                            </div>
                          );
                        })}
                      </div>

                      <details
                        open={isTrackingTarget}
                        onToggle={(e) => {
                          const isOpen = e.currentTarget.open;
                          setOpenTrackingId(isOpen ? row.event.id : openTrackingId === row.event.id ? null : openTrackingId);
                        }}
                        style={{
                          borderTop: `1px solid ${toneColours("purple").border}`,
                          paddingTop: 12,
                          display: "grid",
                          gap: 12,
                        }}
                      >
                        <summary style={{ cursor: "pointer", color: appUi.purple, fontSize: 12.5, fontWeight: 850, listStyle: "none" }}>
                          {isTrackingTarget ? "Managing payment tracking ▴" : "Manage tracking ▾"}
                        </summary>
                        <div style={{ display: "grid", gap: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", border: `1px solid ${recoveryControlColours.border}`, background: recoveryControlColours.bg, borderRadius: 16, padding: "12px 14px" }}>
                            <div>
                              <div style={{ color: recoveryControlColours.text, fontSize: 12, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".04em" }}>{recoveryControlLabel}</div>
                              <div style={{ color: c.sub, fontSize: 12.5, lineHeight: 1.45, marginTop: 3 }}>{recoveryControlDetail}</div>
                            </div>
                            {primaryAction.label === "Track payment" ? (
                              <button
                                type="button"
                                style={{ height: 40, border: `1px solid ${recoveryControlColours.text}`, background: recoveryControlColours.text, color: recoveryControlTone === "orange" || recoveryControlTone === "green" ? "#07111d" : "#fff", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "default", whiteSpace: "nowrap" }}
                              >
                                Tracker open
                              </button>
                            ) : (
                              <Link href={primaryAction.href} style={{ textDecoration: "none", display: "inline-flex", flex: "0 0 auto" }}>
                                <button style={{ height: 40, border: `1px solid ${recoveryControlColours.text}`, background: recoveryControlColours.text, color: recoveryControlTone === "orange" || recoveryControlTone === "green" ? "#07111d" : "#fff", borderRadius: 12, padding: "0 16px", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>{primaryAction.label}</button>
                              </Link>
                            )}
                          </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, alignItems: "end" }}>
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
                            {deleteConfirmEventId === row.event.id ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <span style={{ fontSize: 12, color: c.sub }}>Type delete to confirm</span>
                                <input
                                  value={deleteConfirmValue}
                                  onChange={(e) => setDeleteConfirmValue(e.target.value)}
                                  placeholder="delete"
                                  autoFocus
                                  style={{ height: 40, width: 110, border: `1px solid ${c.redBd}`, background: c.input, color: c.text, borderRadius: 12, padding: "0 10px", fontSize: 13 }}
                                />
                                <button
                                  onClick={() => void deleteRegisterEvent(row.event)}
                                  disabled={deletingEventId === row.event.id || deleteConfirmValue.trim().toLowerCase() !== "delete"}
                                  style={{
                                    height: 40,
                                    border: `1px solid ${c.redBd}`,
                                    background: deleteConfirmValue.trim().toLowerCase() === "delete" ? c.redBg : c.soft,
                                    color: c.redTx,
                                    borderRadius: 12,
                                    padding: "0 14px",
                                    fontWeight: 650,
                                    cursor: deletingEventId === row.event.id || deleteConfirmValue.trim().toLowerCase() !== "delete" ? "not-allowed" : "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {deletingEventId === row.event.id ? "Deleting..." : "Confirm delete"}
                                </button>
                                <button
                                  onClick={() => {
                                    setDeleteConfirmEventId(null);
                                    setDeleteConfirmValue("");
                                  }}
                                  style={{ height: 40, border: `1px solid ${c.border}`, background: c.input, color: c.text, borderRadius: 12, padding: "0 12px", fontWeight: 650, cursor: "pointer", whiteSpace: "nowrap" }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                              <button
                                onClick={() => void updateRegisterTracking(row.event.id, { status: voided ? "draft" : "void" })}
                                style={{
                                  height: 40,
                                  border: `1px solid ${c.border}`,
                                  background: voided ? c.input : c.soft,
                                  color: c.text,
                                  borderRadius: 12,
                                  padding: "0 14px",
                                  fontWeight: 650,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {voided ? "Reinstate CE/VO" : "Void CE/VO"}
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteConfirmEventId(row.event.id);
                                  setDeleteConfirmValue("");
                                }}
                                disabled={deletingEventId === row.event.id}
                                style={{
                                  height: 40,
                                  border: `1px solid ${c.redBd}`,
                                  background: c.redBg,
                                  color: c.redTx,
                                  borderRadius: 12,
                                  padding: "0 14px",
                                  fontWeight: 650,
                                  cursor: deletingEventId === row.event.id ? "not-allowed" : "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {deletingEventId === row.event.id ? "Deleting..." : "Delete CE/VO"}
                              </button>
                              </>
                            )}
                            <button onClick={() => startRename(row.event)} style={{ height: 40, border: `1px solid ${c.border}`, background: c.input, color: c.text, borderRadius: 12, padding: "0 14px", fontWeight: 650, cursor: "pointer", whiteSpace: "nowrap" }}>Rename</button>
                          </div>
                        </div>
                        </div>
                      </details>
                        </>
                      ) : null}
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
