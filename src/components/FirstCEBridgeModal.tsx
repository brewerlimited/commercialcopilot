"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { appUi, toneColours } from "@/components/appUi";

type BridgeSlide = {
  eyebrow: string;
  title: string;
  copy: string;
  tone: "purple" | "blue" | "green" | "orange" | "red";
  bullets: string[];
  panel: ReactNode;
};

function Pill({ children, tone = "purple" }: { children: ReactNode; tone?: "purple" | "blue" | "green" | "orange" | "red" }) {
  const colours = toneColours(tone);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 30,
        borderRadius: 999,
        border: `1px solid ${colours.border}`,
        background: colours.bg,
        color: colours.text,
        padding: "0 12px",
        fontSize: 12,
        fontWeight: 850,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function MiniCard({ label, value, tone = "purple" }: { label: string; value: string; tone?: "purple" | "blue" | "green" | "orange" | "red" }) {
  const colours = toneColours(tone);
  return (
    <div style={{ border: `1px solid ${colours.border}`, background: colours.bg, borderRadius: 18, padding: 14, minHeight: 86 }}>
      <div style={{ color: appUi.muted, fontSize: 11, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ marginTop: 9, color: colours.text, fontSize: 20, lineHeight: 1.1, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function FirstRecordPanel({ title }: { title?: string | null }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          border: `1px solid ${toneColours("purple").border}`,
          background: "rgba(255,255,255,.92)",
          borderRadius: 20,
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Pill tone="purple">Draft CE / VO</Pill>
          <Pill tone="blue">CE number assigned</Pill>
        </div>
        <div style={{ color: appUi.text, fontSize: 18, lineHeight: 1.22, fontWeight: 900, wordBreak: "break-word" }}>
          {title || "Your first CE / VO"}
        </div>
        <div style={{ borderTop: `1px solid ${appUi.border}`, paddingTop: 11, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: appUi.muted, fontSize: 12.5, fontWeight: 750 }}>
            <span>Status</span>
            <span style={{ color: appUi.purple }}>Draft</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: appUi.muted, fontSize: 12.5, fontWeight: 750 }}>
            <span>Next action</span>
            <span style={{ color: appUi.blue }}>Basis of Change</span>
          </div>
        </div>
      </div>
      <MiniCard label="What happens next" value="Build the case" tone="green" />
    </div>
  );
}

function FlowPanel() {
  const items = [
    ["1", "New CE", "purple"],
    ["2", "Basis", "blue"],
    ["3", "Evidence", "green"],
    ["4", "Resources", "orange"],
    ["5", "Prelims", "blue"],
    ["6", "Review", "purple"],
  ] as const;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map(([number, label, tone]) => {
        const colours = toneColours(tone);
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 11, border: `1px solid ${colours.border}`, background: colours.bg, borderRadius: 16, padding: "11px 12px" }}>
            <span style={{ width: 30, height: 30, borderRadius: 999, display: "grid", placeItems: "center", background: colours.text, color: "#fff", fontSize: 12, fontWeight: 900 }}>{number}</span>
            <strong style={{ color: appUi.text, fontSize: 13 }}>{label}</strong>
          </div>
        );
      })}
    </div>
  );
}

function MoneyPanel() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Pill tone="purple">CE Register</Pill>
        <Pill tone="blue">Projects tab</Pill>
      </div>
      <MiniCard label="Submitted" value="£18,450" tone="blue" />
      <MiniCard label="Assessed" value="£15,200" tone="orange" />
      <MiniCard label="Paid" value="£0" tone="red" />
      <MiniCard label="Balance" value="£15,200" tone="purple" />
    </div>
  );
}

export default function FirstCEBridgeModal({
  eventId,
  eventTitle,
  manualOpen = false,
  onManualClose,
}: {
  eventId?: string;
  eventTitle?: string | null;
  manualOpen?: boolean;
  onManualClose?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const slides = useMemo<BridgeSlide[]>(
    () => [
      {
        eyebrow: "First CE created",
        title: "Your recovery record is now live.",
        copy: "This is now a real CE / VO record in your workspace. The next job is to turn it from a title into a priced, evidenced and defensible recovery pack.",
        tone: "purple",
        bullets: ["The title stays visible in registers and reports.", "The CE number follows this record through the workflow.", "Everything you add next feeds the final submission pack."],
        panel: <FirstRecordPanel title={eventTitle} />,
      },
      {
        eyebrow: "The workflow",
        title: "Build the commercial case before you issue it.",
        copy: "The app is deliberately staged so facts, evidence, cost and commercial position stay joined up. Work left to right; the readiness panel will show what is still missing.",
        tone: "blue",
        bullets: ["Basis records what changed and why it matters.", "Evidence proves the event and supports entitlement.", "Resources and prelims build the valuation support."],
        panel: <FlowPanel />,
      },
      {
        eyebrow: "Evidence and cost",
        title: "Keep the record, the resource and the value connected.",
        copy: "Strong CEs usually fail less because the evidence, site activity and cost build-up all tell the same story.",
        tone: "green",
        bullets: ["Upload instructions, diaries, photos, programmes and cost records.", "Create site activities before adding labour, plant and materials.", "Use notes to explain why each cost was caused by the change."],
        panel: (
          <div style={{ display: "grid", gap: 10 }}>
            <MiniCard label="Evidence" value="5 sections" tone="green" />
            <MiniCard label="Resources" value="Labour + plant" tone="orange" />
            <MiniCard label="Cost output" value="Excel tabs" tone="blue" />
          </div>
        ),
      },
      {
        eyebrow: "Review",
        title: "Check what could stop payment before the pack goes out.",
        copy: "The review page is where you sense-check entitlement, valuation support, gaps and likely pushback before generating the final pack.",
        tone: "orange",
        bullets: ["Commercial readiness updates as the CE is completed.", "Likely pushback stays internal until the pack is generated.", "The submission output is built from the records you entered."],
        panel: (
          <div style={{ display: "grid", gap: 10 }}>
            <MiniCard label="Readiness" value="94%" tone="green" />
            <MiniCard label="Warnings" value="2" tone="orange" />
            <MiniCard label="Pack" value="Ready to review" tone="purple" />
          </div>
        ),
      },
      {
        eyebrow: "Payment tracking",
        title: "The work does not stop when the CE is submitted.",
        copy: "Once the CE / VO has been sent, the payment tracker keeps submitted, assessed, paid, short-paid and overdue value visible without changing the client-facing narrative. You access it from the CE Register or from the same CE list inside a project.",
        tone: "red",
        bullets: ["Open payment tracking from the CE Register or Projects tab.", "Record submitted, assessed and paid amounts.", "Track balance outstanding, chase dates and client response.", "Short paid and paid status can update from the figures you enter."],
        panel: <MoneyPanel />,
      },
      {
        eyebrow: "Dashboard",
        title: "Use the dashboard as the daily recovery control panel.",
        copy: "The dashboard is where payment risk, notice risk, ready submissions and project-level recovery health are surfaced so the next commercial action is obvious.",
        tone: "purple",
        bullets: ["Commercial radar shows value that can move forward.", "Priorities point to the next action, not just totals.", "Project health keeps live recovery visible by job."],
        panel: (
          <div style={{ display: "grid", gap: 10 }}>
            <MiniCard label="Radar" value="Actions" tone="purple" />
            <MiniCard label="Priorities" value="Live risks" tone="red" />
            <MiniCard label="Projects" value="Health" tone="green" />
          </div>
        ),
      },
    ],
    [eventTitle]
  );

  const active = slides[index];
  const colours = toneColours(active.tone);

  useEffect(() => {
    if (manualOpen) {
      setOpen(true);
      return;
    }
    if (searchParams.get("firstCe") !== "1") return;
    if (!eventId) return;
    try {
      if (window.localStorage.getItem(`cc.first-ce-bridge.${eventId}`) === "done") return;
    } catch {
      // Ignore storage failures; the modal can still teach the workflow.
    }
    setOpen(true);
  }, [eventId, manualOpen, searchParams]);

  const close = () => {
    try {
      if (eventId) window.localStorage.setItem(`cc.first-ce-bridge.${eventId}`, "done");
      window.localStorage.setItem("cc.onboarding.dashboardGuidePending", "1");
    } catch {
      // Non-blocking.
    }
    setOpen(false);
    if (manualOpen) {
      onManualClose?.();
      return;
    }
    if (!eventId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("firstCe");
    const next = params.toString();
    router.replace(next ? `/app/event/${eventId}?${next}` : `/app/event/${eventId}`, { scroll: false });
  };

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="First CE guide" style={{ position: "fixed", inset: 0, zIndex: 80, display: "grid", placeItems: "center", padding: 24, background: "rgba(9, 17, 32, .38)", backdropFilter: "blur(10px)" }}>
      <div style={{ width: "min(980px, 100%)", borderRadius: 30, border: `1px solid ${appUi.border}`, background: appUi.surface, boxShadow: "0 30px 100px rgba(9,17,32,.22)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.45fr) minmax(260px, .75fr)", gap: 0 }}>
          <section style={{ padding: 32 }}>
            <Pill tone={active.tone}>{active.eyebrow}</Pill>
            <h2 style={{ margin: "18px 0 0", color: appUi.text, fontSize: 38, lineHeight: 1.02, letterSpacing: "-.02em", fontWeight: 900 }}>{active.title}</h2>
            <p style={{ margin: "16px 0 0", color: appUi.muted, fontSize: 17, lineHeight: 1.6, maxWidth: 660 }}>{active.copy}</p>
            <div style={{ marginTop: 26, display: "grid", gap: 10 }}>
              {active.bullets.map((bullet) => (
                <div key={bullet} style={{ display: "flex", alignItems: "flex-start", gap: 10, color: appUi.text, fontSize: 14.5, lineHeight: 1.5, fontWeight: 650 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 999, display: "grid", placeItems: "center", background: colours.bg, color: colours.text, border: `1px solid ${colours.border}`, flex: "0 0 auto", fontSize: 12, fontWeight: 900 }}>✓</span>
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 32, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 7 }}>
                {slides.map((slide, slideIndex) => {
                  const dotColours = toneColours(slide.tone);
                  return <span key={slide.title} style={{ width: slideIndex === index ? 28 : 8, height: 8, borderRadius: 999, background: slideIndex === index ? dotColours.text : appUi.border, transition: "width .2s ease" }} />;
                })}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={close} style={{ height: 44, borderRadius: 14, border: `1px solid ${appUi.border}`, background: appUi.surface, color: appUi.muted, padding: "0 16px", fontWeight: 850, cursor: "pointer" }}>Skip for now</button>
                {index > 0 ? (
                  <button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} style={{ height: 44, borderRadius: 14, border: `1px solid ${appUi.border}`, background: appUi.input, color: appUi.text, padding: "0 16px", fontWeight: 850, cursor: "pointer" }}>Back</button>
                ) : null}
                <button type="button" onClick={() => (index === slides.length - 1 ? close() : setIndex((value) => value + 1))} style={{ height: 44, borderRadius: 14, border: `1px solid ${appUi.purple}`, background: appUi.purple, color: "#fff", padding: "0 18px", fontWeight: 900, cursor: "pointer" }}>
                  {index === slides.length - 1 ? "Start building" : "Next"}
                </button>
              </div>
            </div>
          </section>
          <aside style={{ background: `linear-gradient(160deg, ${colours.bg}, rgba(255,255,255,.92))`, borderLeft: `1px solid ${appUi.border}`, padding: 28, display: "grid", alignContent: "center" }}>
            <div style={{ border: `1px solid ${colours.border}`, borderRadius: 24, background: "rgba(255,255,255,.82)", padding: 18, boxShadow: "0 16px 45px rgba(15, 23, 42, .08)" }}>
              {active.panel}
            </div>
            <Link href="/app" onClick={close} style={{ marginTop: 16, color: appUi.purple, textDecoration: "none", textAlign: "center", fontSize: 13, fontWeight: 850 }}>
              Open dashboard guide after this
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
