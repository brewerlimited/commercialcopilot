"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { displayEventTitle } from "@/lib/eventReference";
import { readFinalTotal } from "@/lib/financialSummary";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";
import {
  calculateTimeRisk,
  formatDateShort,
  normaliseCommercialStatus,
  normalisePaymentStatus,
} from "@/lib/commercialControl";
import { AppCard, AppPageHeader, IconBubble, SmallIcon, appUi, toneColours } from "@/components/appUi";

type EventRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at?: string | null;
  event_date?: string | null;
  notice_period_days?: number | null;
  notification_deadline?: string | null;
  payment_status?: string | null;
  submitted_date?: string | null;
  expected_payment_date?: string | null;
  last_action_date?: string | null;
  project_name?: string | null;
  main_contractor?: string | null;
  event_financial_summary?: unknown;
};

type Priority = {
  id: string;
  eventId: string;
  title: string;
  detail: string;
  label: string;
  value: number | null;
  href: string;
  cta: string;
  tone: "red" | "orange" | "blue" | "purple" | "green";
  severity: number;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}

function money(v: number | null) {
  if (v === null) return "Add value";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number.isFinite(v) ? v : 0);
}

function dateOnly(dateLike?: string | null) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysSince(dateLike?: string | null) {
  const d = dateOnly(dateLike);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - d.getTime()) / 86400000));
}

function isSubmittedOrAccepted(status?: string | null) {
  const s = normaliseCommercialStatus(status);
  return s === "submitted" || s === "accepted";
}

function isPaid(event: EventRow) {
  return normaliseCommercialStatus(event.status) === "paid" || normalisePaymentStatus(event.payment_status) === "paid";
}

function isOverduePayment(event: EventRow) {
  if (!isSubmittedOrAccepted(event.status) || isPaid(event)) return false;
  const expected = dateOnly(event.expected_payment_date);
  if (!expected) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expected.getTime() < today.getTime();
}

function eventValue(event: EventRow) {
  return readFinalTotal(event.event_financial_summary);
}

function buildPriorities(events: EventRow[]) {
  const priorities: Priority[] = [];

  for (const event of events) {
    const status = normaliseCommercialStatus(event.status);
    if (status === "void" || isPaid(event)) continue;

    const title = displayEventTitle(event);
    const value = eventValue(event);
    const actionAge = daysSince(event.last_action_date || event.created_at);
    const actionAgeText = actionAge === null ? "No recent action date." : `No action for ${actionAge} ${actionAge === 1 ? "day" : "days"}.`;

    if (isOverduePayment(event)) {
      priorities.push({
        id: `${event.id}-payment-overdue`,
        eventId: event.id,
        title,
        label: "Payment overdue",
        detail: `Expected payment ${formatDateShort(event.expected_payment_date)}. ${actionAgeText}`,
        value,
        href: `/app?trackPayment=${encodeURIComponent(event.id)}`,
        cta: "Track payment",
        tone: "red",
        severity: 1,
      });
      continue;
    }

    if (status === "rejected") {
      priorities.push({
        id: `${event.id}-rejected`,
        eventId: event.id,
        title,
        label: "Rejected CE",
        detail: `Prepare the commercial rebuttal position. ${actionAgeText}`,
        value,
        href: `/app/event/${event.id}/review?mode=rebuttal`,
        cta: "Open rebuttal",
        tone: "red",
        severity: 2,
      });
      continue;
    }

    if (isSubmittedOrAccepted(status)) {
      priorities.push({
        id: `${event.id}-unpaid`,
        eventId: event.id,
        title,
        label: status === "accepted" ? "Accepted / unpaid" : "Submitted / unpaid",
        detail: `${status === "accepted" ? "Accepted" : "Submitted"} ${event.submitted_date ? formatDateShort(event.submitted_date) : "for payment"}. ${actionAgeText}`,
        value,
        href: `/app?trackPayment=${encodeURIComponent(event.id)}`,
        cta: "Track payment",
        tone: "blue",
        severity: 3,
      });
      continue;
    }

    const timeRisk = calculateTimeRisk({
      eventDate: event.event_date ?? null,
      noticePeriodDays: event.notice_period_days ?? null,
      notificationDeadline: event.notification_deadline ?? null,
    });

    if (timeRisk.state === "overdue" || timeRisk.state === "due_soon") {
      priorities.push({
        id: `${event.id}-notice`,
        eventId: event.id,
        title,
        label: timeRisk.state === "overdue" ? "Notice risk" : "Notice expires soon",
        detail: `${timeRisk.detail || timeRisk.label}. ${timeRisk.deadline ? `Deadline ${formatDateShort(timeRisk.deadline)}.` : ""}`,
        value,
        href: `/app/event/${event.id}`,
        cta: "Open CE",
        tone: timeRisk.state === "overdue" ? "red" : "orange",
        severity: 4,
      });
      continue;
    }

    if (status === "ready" || status === "review") {
      priorities.push({
        id: `${event.id}-ready`,
        eventId: event.id,
        title,
        label: status === "ready" ? "Ready to submit" : "Review needed",
        detail: status === "ready" ? "Value is built and should be reviewed for issue." : "Complete the review before submission.",
        value,
        href: `/app/event/${event.id}/review`,
        cta: "Review",
        tone: "blue",
        severity: 5,
      });
    }
  }

  return priorities.sort((a, b) => a.severity - b.severity || (b.value ?? 0) - (a.value ?? 0));
}

export default function PrioritiesPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const supabase = supabaseBrowser();
        const user = await getRequiredUser(supabase);
        const { data, error } = await (supabase as any)
          .from("events")
          .select("id,title,status,created_at,event_date,notice_period_days,notification_deadline,payment_status,submitted_date,expected_payment_date,last_action_date,project_name,main_contractor,event_financial_summary")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (active) setEvents((data ?? []) as EventRow[]);
      } catch (error) {
        if (isAuthErrorMessage(errorMessage(error))) {
          window.location.href = "/login";
          return;
        }
        console.error("Failed to load priorities", error);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const priorities = useMemo(() => buildPriorities(events), [events]);
  const totalValue = priorities.reduce((sum, item) => sum + (item.value ?? 0), 0);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <AppPageHeader
        eyebrow="Commercial radar"
        title="Today's priorities"
        description="The live recovery actions most likely to move value towards submission, agreement or payment."
        actions={<Link href="/app" style={{ color: appUi.blue, fontSize: 13, fontWeight: 800, textDecoration: "none" }}>Back to dashboard →</Link>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <AppCard style={{ padding: 18 }}>
          <div style={{ color: appUi.muted, fontSize: 11, fontWeight: 850, textTransform: "uppercase", letterSpacing: 0.6 }}>Open priorities</div>
          <div style={{ marginTop: 12, color: appUi.text, fontSize: 28, lineHeight: 1, fontWeight: 900 }}>{loading ? "—" : priorities.length}</div>
        </AppCard>
        <AppCard style={{ padding: 18 }} tone="blue">
          <div style={{ color: appUi.muted, fontSize: 11, fontWeight: 850, textTransform: "uppercase", letterSpacing: 0.6 }}>Value in focus</div>
          <div style={{ marginTop: 12, color: appUi.blue, fontSize: 28, lineHeight: 1, fontWeight: 900 }}>{loading ? "—" : money(totalValue)}</div>
        </AppCard>
        <AppCard style={{ padding: 18 }} tone="red">
          <div style={{ color: appUi.muted, fontSize: 11, fontWeight: 850, textTransform: "uppercase", letterSpacing: 0.6 }}>Urgent items</div>
          <div style={{ marginTop: 12, color: appUi.red, fontSize: 28, lineHeight: 1, fontWeight: 900 }}>{loading ? "—" : priorities.filter((item) => item.severity <= 2).length}</div>
        </AppCard>
      </div>

      <AppCard style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 22, color: appUi.muted, fontWeight: 750 }}>Loading priorities...</div>
        ) : priorities.length === 0 ? (
          <div style={{ padding: 28, color: appUi.muted, fontSize: 14, lineHeight: 1.6 }}>No live priorities. Submitted, unpaid, overdue, rejected and ready-to-submit items will appear here automatically.</div>
        ) : (
          priorities.map((item) => {
            const tc = toneColours(item.tone);
            return (
              <Link
                key={item.id}
                href={item.href}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px minmax(0, 1fr) auto",
                  gap: 14,
                  alignItems: "center",
                  padding: "18px 20px",
                  borderBottom: `1px solid ${appUi.border}`,
                  textDecoration: "none",
                  background: "var(--surface)",
                }}
              >
                <IconBubble tone={item.tone} size={40}>
                  <SmallIcon name={item.tone === "red" ? "alert" : item.tone === "orange" ? "clock" : "file"} />
                </IconBubble>
                <span style={{ minWidth: 0, display: "grid", gap: 5 }}>
                  <span style={{ color: tc.text, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.55 }}>{item.label}</span>
                  <span style={{ color: appUi.text, fontSize: 15, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                  <span style={{ color: appUi.muted, fontSize: 13, lineHeight: 1.45 }}>{item.detail}</span>
                </span>
                <span style={{ display: "grid", justifyItems: "end", gap: 6 }}>
                  <span style={{ color: appUi.text, fontSize: 16, fontWeight: 900 }}>{money(item.value)}</span>
                  <span style={{ color: tc.text, fontSize: 12, fontWeight: 850 }}>{item.cta} →</span>
                </span>
              </Link>
            );
          })
        )}
      </AppCard>
    </div>
  );
}
