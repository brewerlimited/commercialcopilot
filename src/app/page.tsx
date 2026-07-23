import Link from "next/link";
import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { SiteShell } from "@/components/marketing";

export const metadata: Metadata = {
  title: "Commercial recovery software for subcontractors",
  description:
    "Track EWNs, build stronger CEs and variations, support entitlement, price cost build-ups and manage commercial recovery through to payment.",
  alternates: {
    canonical: "/",
  },
};

const palette = {
  ink: "#0f172a",
  muted: "#596579",
  soft: "#f6f8fb",
  panel: "#ffffff",
  line: "rgba(15, 23, 42, 0.09)",
  green: "#9ee6c6",
  greenText: "#137657",
  orange: "#ffb38a",
  orangeText: "#b45309",
  blue: "#b9ddff",
  blueText: "#2563a8",
  lavender: "#eee8ff",
  lavenderText: "#6d4aff",
  pink: "#ffd6c7",
  pinkText: "#a3402f",
};

const trustBadges = ["NEC3", "NEC4", "JCT", "Subcontractor focused", "Built by Quantity Surveyors", "Evidence-led recovery"];

const pastel: Record<string, { bg: string; text: string; border: string }> = {
  green: { bg: "#effcf6", text: palette.greenText, border: "#c8f3df" },
  orange: { bg: "#fff5ef", text: palette.orangeText, border: "#ffd8bf" },
  blue: { bg: "#f0f8ff", text: palette.blueText, border: "#cfe8ff" },
  lavender: { bg: "#f6f2ff", text: palette.lavenderText, border: "#ded3ff" },
  pink: { bg: "#fff4ee", text: palette.pinkText, border: "#ffd6c7" },
};

type PastelStyle = (typeof pastel)[keyof typeof pastel];

const inputItems = [
  "2 operatives retained",
  "13t excavator stood",
  "2-day delay",
  "Site photographs",
  "Supervisor instruction",
  "Allocation records",
];

const outputItems = [
  "Contractual Position",
  "Defined Cost Build-Up",
  "Programme Impact",
  "Commercial Pushback",
  "Rebuttal",
  "Excel Submission Pack",
  "Payment Tracking",
];

const proofLabels = [
  ["EWN and notice tracking", "green"],
  ["Evidence register", "blue"],
  ["Labour, plant and material build-up", "orange"],
  ["Project rate cards", "lavender"],
  ["Seven commercial narrative sections", "blue"],
  ["Contractual Position", "pink"],
  ["Commercial Pushback", "orange"],
  ["Rebuttal", "pink"],
  ["Excel submission pack", "blue"],
  ["Payment status", "green"],
  ["Recovery actions", "lavender"],
];

const proofPoints = [
  "Built by Quantity Surveyors",
  "Designed for NEC and JCT subcontractors",
  "Every output remains reviewable",
  "Commercial teams retain control before issue",
];

export default function HomePage() {
  return (
    <SiteShell>
      <main style={{ background: "#ffffff", color: palette.ink }}>
        <Hero />
        <TrustStrip />
        <InputOutput />
        <KeyMessage />
        <ThreeJobs />
        <CommercialPriorities />
        <ProductProof />
        <BuiltFromSubcontractorSide />
        <FinalCta />
      </main>
    </SiteShell>
  );
}

function Hero() {
  return (
    <section
      className="home-hero-section"
      style={{
        borderBottom: `1px solid ${palette.line}`,
        background: [
          "radial-gradient(circle at 12% 18%, rgba(158,230,198,0.24), transparent 30%)",
          "radial-gradient(circle at 72% 10%, rgba(185,221,255,0.34), transparent 34%)",
          "linear-gradient(180deg, #f8fbff 0%, #fbfdff 52%, #ffffff 100%)",
        ].join(", "),
      }}
    >
      <div style={wrap({ maxWidth: 1360, paddingTop: 58, paddingBottom: 36 })}>
        <div
          className="home-hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.78fr) minmax(0, 1.22fr)",
            gap: 52,
            alignItems: "center",
          }}
        >
          <div className="home-hero-copy" style={{ display: "grid", gap: 22, minWidth: 0 }}>
            <div style={pill("orange")}>Commercial management software for subcontractors.</div>
            <div style={{ display: "grid", gap: 17 }}>
              <h1
                style={{
                  margin: 0,
                  maxWidth: 620,
                  fontSize: "clamp(43px, 5.1vw, 74px)",
                  lineHeight: 0.98,
                  letterSpacing: 0,
                  fontWeight: 650,
                }}
              >
                Build the case. Defend the value. Get paid.
              </h1>
              <p style={{ margin: 0, maxWidth: 650, color: palette.muted, fontSize: 19, lineHeight: 1.65, fontWeight: 400 }}>
                Capture site issues, build priced CE and variation submissions, prepare for commercial pushback and track recovery through to payment.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <Button href="/contact" tone="dark">Watch 2 Minute Demo</Button>
              <Button href="/login" tone="light">Start Free Trial</Button>
            </div>
          </div>

          <div className="home-hero-visual-wrap">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  const stats: Array<[string, string, string, PastelStyle]> = [
    ["Recoverable Value", "£40,815", "All saved CE / VO totals.", pastel.blue],
    ["Awaiting Payment", "£20,212", "Submitted, not yet paid.", pastel.orange],
    ["Overdue Recovery", "£4,928", "Past due date.", pastel.pink],
    ["Recovered", "£4,580", "Paid and completed.", pastel.green],
  ];

  const actions: Array<[string, string, string, PastelStyle]> = [
    ["Payment overdue", "CE 010 - ST94 steel rehandling", "£4,928", pastel.pink],
    ["Accepted / unpaid", "VAR 002 - Facade bracket clashes", "£7,964", pastel.blue],
    ["Submitted / unpaid", "CE 001 - Revised drainage run", "£7,320", pastel.green],
  ];

  return (
    <div
      className="home-hero-product"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 820,
        marginLeft: "auto",
        borderRadius: 34,
        padding: 8,
        background: "linear-gradient(135deg, rgba(185,221,255,0.76), rgba(255,179,138,0.25), rgba(158,230,198,0.42))",
        boxShadow: "0 30px 90px rgba(15, 23, 42, 0.15)",
      }}
    >
      <div style={{ borderRadius: 26, background: "#fbfdff", border: `1px solid ${palette.line}`, overflow: "hidden", minHeight: 412, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
          <div>
            <div style={eyebrowStyle}>Recovery control panel</div>
            <div style={{ marginTop: 9, maxWidth: 430, fontSize: 24, lineHeight: 1.12, fontWeight: 650, color: palette.ink }}>
              See what value is live, what is stuck, and what needs action to get paid.
            </div>
          </div>
          <div style={{ border: `1px solid ${palette.line}`, borderRadius: 14, padding: "10px 13px", background: "#ffffff", color: palette.muted, fontSize: 12, fontWeight: 650 }}>
            All Projects
          </div>
        </div>

        <div className="home-hero-stats" style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          {stats.map(([label, value, note, colours]) => (
            <div key={label} className="home-widget home-stat-widget" style={{ border: `1px solid ${colours.border}`, background: colours.bg, borderRadius: 18, padding: 15 }}>
              <div style={{ color: palette.muted, fontSize: 10, fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
              <div style={{ marginTop: 16, fontSize: 25, lineHeight: 1, fontWeight: 700, color: palette.ink }}>{value}</div>
              <div style={{ marginTop: 10, color: palette.muted, fontSize: 11, lineHeight: 1.35 }}>{note}</div>
            </div>
          ))}
        </div>

        <div className="home-hero-action-grid" style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1.35fr 0.65fr", gap: 14 }}>
          <div className="home-widget" style={{ border: `1px solid ${palette.line}`, borderRadius: 20, background: "#ffffff", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 650, color: palette.ink }}>Recovery actions</div>
                <div style={{ marginTop: 4, color: palette.muted, fontSize: 12 }}>Items that can move value towards payment.</div>
              </div>
              <span style={pill("blue")}>Open CE register</span>
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 9 }}>
              {actions.map(([status, title, value, colours]) => (
                <div key={title} className="home-widget home-action-row" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, border: `1px solid ${colours.border}`, background: colours.bg, borderRadius: 15, padding: "12px 13px" }}>
                  <div>
                    <div style={{ color: colours.text, fontSize: 10, fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.04em" }}>{status}</div>
                    <div style={{ marginTop: 5, color: palette.ink, fontSize: 13, lineHeight: 1.25, fontWeight: 650 }}>{title}</div>
                  </div>
                  <div style={{ color: palette.ink, fontSize: 15, fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div className="home-widget" style={{ border: `1px solid ${pastel.lavender.border}`, borderRadius: 18, background: pastel.lavender.bg, padding: 15 }}>
              <div style={{ color: palette.muted, fontSize: 10, fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.04em" }}>Event Status</div>
              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                {["Draft", "Submitted", "Accepted", "Paid"].map((item, index) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, color: palette.ink, fontSize: 12, fontWeight: 650 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: [palette.blue, palette.orange, palette.green, palette.lavender][index] }} />
                      {item}
                    </span>
                    <span>{[3, 4, 2, 1][index]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="home-widget" style={{ border: `1px solid ${palette.line}`, borderRadius: 18, background: "#ffffff", padding: 15 }}>
              <div style={{ color: palette.muted, fontSize: 10, fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.04em" }}>Next action</div>
              <div style={{ marginTop: 10, color: palette.ink, fontSize: 14, lineHeight: 1.3, fontWeight: 650 }}>Chase payment for CE 010</div>
              <div style={{ marginTop: 6, color: palette.muted, fontSize: 12, lineHeight: 1.4 }}>Outstanding £4,928.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustStrip() {
  return (
    <section style={{ background: "#ffffff" }}>
      <div style={wrap({ paddingTop: 20, paddingBottom: 26 })}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {trustBadges.map((badge, index) => (
            <span key={badge} className="home-badge" style={{ ...pill(["blue", "green", "orange", "blue", "lavender", "green"][index] as keyof typeof pastel), padding: "9px 13px" }}>
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function InputOutput() {
  return (
    <section id="features" style={{ background: palette.soft, borderBlock: `1px solid ${palette.line}` }}>
      <div style={wrap({ paddingTop: 74, paddingBottom: 76 })}>
        <SectionHeader
          eyebrow="See the workflow"
          title="From a site issue to a priced, defensible submission."
          text="Commercial Co-Pilot connects the facts, evidence, resources and contractual position so the commercial team can review one complete event rather than rebuild the story across emails, spreadsheets and folders."
        />

        <div className="home-comparison-grid" style={{ marginTop: 30, display: "grid", gridTemplateColumns: "minmax(0, 0.92fr) minmax(0, 1.08fr)", gap: 18, alignItems: "stretch" }}>
          <article className="home-hover-card" style={productCard()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={eyebrowStyle}>Site event input</div>
                <h3 style={cardTitle()}>Uncharted service encountered</h3>
              </div>
              <span style={pill("orange")}>Site issue</span>
            </div>
            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              {inputItems.map((item) => (
                <div key={item} style={miniRecord("orange")}>{item}</div>
              ))}
            </div>
          </article>

          <article className="home-hover-card" style={{ ...productCard(), borderColor: pastel.green.border, background: "linear-gradient(135deg, #ffffff 0%, #f6fffb 100%)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={eyebrowStyle}>Commercial Co-Pilot output</div>
                <h3 style={cardTitle()}>One connected recovery pack</h3>
              </div>
              <span style={pill("green")}>Reviewable</span>
            </div>
            <div style={{ marginTop: 20, display: "grid", gap: 9 }}>
              {outputItems.map((item, index) => (
                <div key={item} style={{ display: "grid", gridTemplateColumns: "34px 1fr", alignItems: "center", gap: 12, border: `1px solid ${palette.line}`, borderRadius: 15, background: "#ffffff", padding: "10px 12px" }}>
                  <span style={{ width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center", background: [pastel.blue.bg, pastel.orange.bg, pastel.green.bg, pastel.lavender.bg][index % 4], color: [pastel.blue.text, pastel.orange.text, pastel.green.text, pastel.lavender.text][index % 4], fontWeight: 700 }}>
                    {index + 1}
                  </span>
                  <span style={{ color: palette.ink, fontSize: 15, fontWeight: 650 }}>{item}</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div style={{ marginTop: 22 }}>
          <Button href="/contact" tone="dark">Watch the full 2-minute workflow</Button>
        </div>
      </div>
    </section>
  );
}

function KeyMessage() {
  return (
    <section style={{ background: "#ffffff" }}>
      <div style={wrap({ paddingTop: 86, paddingBottom: 86 })}>
        <div style={{ maxWidth: 940, margin: "0 auto", textAlign: "center", display: "grid", gap: 20 }}>
          <div style={{ margin: "0 auto", ...pill("orange") }}>The commercial recovery gap</div>
          <h2 style={sectionHeadline({ maxWidth: 820, margin: "0 auto" })}>
            The money is usually in the records. The loss is usually in the follow-through.
          </h2>
          <p style={{ margin: "0 auto", maxWidth: 780, color: palette.muted, fontSize: 19, lineHeight: 1.75, fontWeight: 400 }}>
            Site teams often already have the facts, labour, plant, instructions and photographs. Commercial Co-Pilot turns that record into a structured recovery workflow before value is diluted, delayed or forgotten.
          </p>
        </div>
      </div>
    </section>
  );
}

function ThreeJobs() {
  const jobs = [
    {
      number: "01",
      title: "Capture the commercial event.",
      text: "Record the issue, notice position, project context and supporting evidence while the facts are still available. Keep EWNs, instructions, photographs, diaries and programme records linked to the event.",
      tags: ["New CE / EWN page", "Evidence page", "Notice status", "Commercial dates"],
      tone: "blue",
    },
    {
      number: "02",
      title: "Build and defend the submission.",
      text: "Price labour, plant, materials, subcontract and preliminaries using project rate cards. Build the contractual case, programme effect, commercial pushback and rebuttal in one reviewable workflow.",
      tags: ["Resource build-up", "Rate cards", "Contractual Position", "Commercial Pushback", "Rebuttal"],
      tone: "orange",
    },
    {
      number: "03",
      title: "Track the value through to payment.",
      text: "See what is draft, ready for review, submitted, awaiting assessment, under negotiation, agreed, unpaid and overdue.",
      tags: ["Recovery dashboard", "Pipeline statuses", "Overdue recovery", "Next commercial action"],
      tone: "green",
    },
  ];

  return (
    <section id="how-it-works" style={{ background: palette.soft, borderBlock: `1px solid ${palette.line}` }}>
      <div style={wrap({ paddingTop: 84, paddingBottom: 84 })}>
        <SectionHeader
          eyebrow="How it works"
          title="Three jobs. One commercial recovery workflow."
          text="From the first site record through to final payment, every stage remains connected."
        />
        <div style={{ marginTop: 34, display: "grid", gap: 18 }}>
          {jobs.map((job, index) => (
            <article
              key={job.number}
              className="home-hover-card home-product-grid"
              style={{
                display: "grid",
                gridTemplateColumns: index % 2 === 0 ? "minmax(0, 0.82fr) minmax(340px, 1.18fr)" : "minmax(340px, 1.18fr) minmax(0, 0.82fr)",
                gap: 22,
                alignItems: "stretch",
                border: `1px solid ${palette.line}`,
                borderRadius: 28,
                background: "#ffffff",
                padding: 20,
                boxShadow: "0 18px 50px rgba(15,23,42,0.055)",
              }}
            >
              {index % 2 === 1 ? <ProductFrame tags={job.tags} tone={job.tone} /> : null}
              <div style={{ display: "grid", alignContent: "center", gap: 16, padding: 12 }}>
                <div style={pill(job.tone as keyof typeof pastel)}>Job {job.number}</div>
                <h3 style={{ margin: 0, color: palette.ink, fontSize: "clamp(28px, 3vw, 42px)", lineHeight: 1.08, fontWeight: 650 }}>{job.title}</h3>
                <p style={{ margin: 0, color: palette.muted, fontSize: 17, lineHeight: 1.72, maxWidth: 660 }}>{job.text}</p>
              </div>
              {index % 2 === 0 ? <ProductFrame tags={job.tags} tone={job.tone} /> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CommercialPriorities() {
  const priorities = [
    {
      label: "Priority 1 - Notice deadline",
      title: "Notice expires tomorrow",
      event: "CE-018 - Uncharted service",
      detail: "£18,450 potential value at risk",
      action: "Issue notice",
      tone: "pink",
    },
    {
      label: "Priority 2 - Contractor assessment",
      title: "Assessment requires a response",
      event: "CE-014 - Revised drainage layout",
      detail: "Submitted £68,500 - assessed £42,300 - difference £26,200",
      action: "Open pushback",
      tone: "orange",
    },
    {
      label: "Priority 3 - Submission ready",
      title: "Generated pack ready for review",
      event: "CE-026 - Workface unavailable",
      detail: "£31,800",
      action: "Review submission",
      tone: "blue",
    },
    {
      label: "Priority 4 - Overdue payment",
      title: "Agreed value remains unpaid",
      event: "CE-009 - Temporary access works",
      detail: "£44,870 - 38 days outstanding",
      action: "Open payment action",
      tone: "green",
    },
  ];

  return (
    <section style={{ background: "#ffffff" }}>
      <div style={wrap({ paddingTop: 84, paddingBottom: 84 })}>
        <div className="home-comparison-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.78fr) minmax(420px, 1.22fr)", gap: 28, alignItems: "center" }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={pill("lavender")}>Commercial control</div>
            <h2 style={sectionHeadline()}>Know what needs action before value slips.</h2>
            <p style={{ margin: 0, color: palette.muted, fontSize: 18, lineHeight: 1.75 }}>
              Commercial Co-Pilot surfaces the notices, submissions, assessments, evidence gaps and overdue payments that need attention next, so recoverable value does not sit unnoticed.
            </p>
          </div>

          <article className="home-hover-card" style={{ border: `1px solid ${palette.line}`, borderRadius: 30, background: "#ffffff", padding: 22, boxShadow: "0 20px 60px rgba(15,23,42,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 14 }}>
              <div>
                <div style={eyebrowStyle}>Example product panel</div>
                <h3 style={cardTitle({ fontSize: 24 })}>Example Commercial Priorities</h3>
              </div>
              <span style={pill("blue")}>Example only</span>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {priorities.map((priority) => {
                const colours = pastel[priority.tone];
                return (
                  <div
                    key={priority.label}
                    className="home-widget"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      gap: 14,
                      alignItems: "center",
                      border: `1px solid ${colours.border}`,
                      borderLeft: `5px solid ${colours.text}`,
                      borderRadius: 18,
                      background: colours.bg,
                      padding: "15px 16px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: colours.text, fontSize: 11, lineHeight: 1.2, fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.04em" }}>{priority.label}</div>
                      <div style={{ marginTop: 7, color: palette.ink, fontSize: 18, lineHeight: 1.18, fontWeight: 650 }}>{priority.title}</div>
                      <div style={{ marginTop: 5, color: palette.muted, fontSize: 14, lineHeight: 1.4, fontWeight: 600 }}>{priority.event}</div>
                      <div style={{ marginTop: 7, color: palette.ink, fontSize: 15, lineHeight: 1.35, fontWeight: 650 }}>{priority.detail}</div>
                    </div>
                    <span style={{ ...pill(priority.tone as keyof typeof pastel), whiteSpace: "nowrap" }}>{priority.action} -&gt;</span>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function ProductFrame({ tags, tone }: { tags: string[]; tone: string }) {
  const colours = pastel[tone];
  return (
    <div style={{ border: `1px solid ${colours.border}`, borderRadius: 24, background: `linear-gradient(145deg, ${colours.bg}, #ffffff 62%)`, padding: 18, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={eyebrowStyle}>Product view</div>
        <span style={pill(tone as keyof typeof pastel)}>Live workflow</span>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {tags.map((tag, index) => (
          <div key={tag} className="home-widget" style={{ display: "grid", gridTemplateColumns: "38px 1fr auto", alignItems: "center", gap: 12, border: `1px solid ${palette.line}`, borderRadius: 16, background: "#ffffff", padding: "11px 12px" }}>
            <span style={{ width: 38, height: 38, borderRadius: 14, display: "grid", placeItems: "center", background: [pastel.blue.bg, pastel.green.bg, pastel.orange.bg, pastel.lavender.bg, pastel.pink.bg][index % 5], color: [pastel.blue.text, pastel.green.text, pastel.orange.text, pastel.lavender.text, pastel.pink.text][index % 5], fontWeight: 700 }}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span style={{ color: palette.ink, fontSize: 15, fontWeight: 650 }}>{tag}</span>
            <span style={{ color: colours.text, fontSize: 13, fontWeight: 650 }}>Linked</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductProof() {
  return (
    <section id="outputs" style={{ background: "#ffffff" }}>
      <div style={wrap({ paddingTop: 86, paddingBottom: 84 })}>
        <div className="home-product-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.88fr) minmax(360px, 1.12fr)", gap: 26, alignItems: "center" }}>
          <div style={{ display: "grid", gap: 18 }}>
            <div style={pill("lavender")}>One connected commercial event</div>
            <h2 style={sectionHeadline()}>One event. Fully priced, supported and tracked.</h2>
            <p style={{ margin: 0, color: palette.muted, fontSize: 18, lineHeight: 1.75 }}>
              Each event carries the commercial record from first notice through to priced submission, pushback and payment.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
              {["Priced.", "Supported.", "Defended.", "Tracked."].map((item, index) => (
                <span key={item} style={{ ...pill(["blue", "green", "orange", "lavender"][index] as keyof typeof pastel), fontSize: 15, padding: "10px 14px" }}>{item}</span>
              ))}
            </div>
          </div>

          <div className="home-hover-card" style={{ border: `1px solid ${palette.line}`, borderRadius: 30, background: "#ffffff", padding: 24, boxShadow: "0 20px 60px rgba(15,23,42,0.075)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              {proofLabels.map(([label, tone]) => {
                const colours = pastel[tone];
                return (
                  <div key={label} style={{ border: `1px solid ${colours.border}`, borderRadius: 16, background: colours.bg, padding: "13px 14px", color: colours.text, fontSize: 14, lineHeight: 1.35, fontWeight: 650 }}>
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BuiltFromSubcontractorSide() {
  return (
    <section id="about" style={{ background: "#ffffff" }}>
      <div style={wrap({ paddingTop: 86, paddingBottom: 86 })}>
        <div className="home-comparison-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.92fr) minmax(0, 1.08fr)", gap: 28, alignItems: "center" }}>
          <div style={{ display: "grid", gap: 18 }}>
            <div style={pill("green")}>Built from the subcontractor side</div>
            <h2 style={sectionHeadline()}>Built around real subcontractor commercial work.</h2>
            <div style={{ display: "grid", gap: 15, color: palette.muted, fontSize: 18, lineHeight: 1.72 }}>
              <p style={{ margin: 0 }}>
                Commercial Co-Pilot was created from the day-to-day reality of preparing EWNs, compensation events, variations, cost build-ups, rebuttals and payment recovery on live construction projects.
              </p>
              <p style={{ margin: 0 }}>It is designed to support commercial judgement, not replace it.</p>
            </div>
          </div>
          <div style={{ border: `1px solid ${palette.line}`, borderRadius: 28, background: "linear-gradient(135deg, #ffffff, #f8fbff)", padding: 24, display: "grid", gap: 12, boxShadow: "0 18px 50px rgba(15,23,42,0.06)" }}>
            {proofPoints.map((item, index) => (
              <div key={item} className="home-widget" style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${palette.line}`, borderRadius: 16, background: "#ffffff", padding: "14px 15px", color: palette.ink, fontSize: 15, lineHeight: 1.35, fontWeight: 650 }}>
                <span style={{ width: 32, height: 32, borderRadius: 12, background: [pastel.blue.bg, pastel.green.bg, pastel.orange.bg, pastel.lavender.bg][index], color: [pastel.blue.text, pastel.green.text, pastel.orange.text, pastel.lavender.text][index], display: "grid", placeItems: "center", fontWeight: 700 }}>✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section style={{ background: "#ffffff" }}>
      <div style={wrap({ paddingTop: 26, paddingBottom: 94 })}>
        <div style={{ borderRadius: 34, padding: "44px 32px", background: "linear-gradient(135deg, #f0f8ff, #fff5ef 52%, #effcf6)", border: `1px solid ${palette.line}`, textAlign: "center", display: "grid", gap: 18 }}>
          <h2 style={{ ...sectionHeadline({ margin: "0 auto" }), maxWidth: 760 }}>Build stronger submissions. Follow the value through.</h2>
          <p style={{ margin: "0 auto", maxWidth: 650, color: palette.muted, fontSize: 19, lineHeight: 1.65 }}>
            Capture the issue, build the commercial case and keep recovery visible through to payment.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
            <Button href="/login" tone="dark">Start Free Trial</Button>
            <Button href="/contact" tone="light">Watch 2 Minute Demo</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div style={{ maxWidth: 790, display: "grid", gap: 14 }}>
      <div style={pill("blue")}>{eyebrow}</div>
      <h2 style={sectionHeadline()}>{title}</h2>
      <p style={{ margin: 0, color: palette.muted, fontSize: 18, lineHeight: 1.72, fontWeight: 400 }}>{text}</p>
    </div>
  );
}

function Button({ href, children, tone }: { href: string; children: ReactNode; tone: "dark" | "light" }) {
  const isDark = tone === "dark";

  return (
    <Link
      className="home-cta"
      href={href}
      style={{
        minHeight: 52,
        padding: "0 20px",
        borderRadius: 16,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        fontWeight: 650,
        fontSize: 14,
        background: isDark ? palette.ink : "#ffffff",
        color: isDark ? "#ffffff" : palette.ink,
        border: `1px solid ${isDark ? palette.ink : palette.line}`,
        boxShadow: isDark ? "0 12px 26px rgba(15,23,42,0.16)" : "0 10px 24px rgba(15,23,42,0.055)",
      }}
    >
      {children}
    </Link>
  );
}

function pill(tone: keyof typeof pastel): CSSProperties {
  const colours = pastel[tone];
  return {
    width: "fit-content",
    borderRadius: 999,
    border: `1px solid ${colours.border}`,
    background: colours.bg,
    color: colours.text,
    padding: "8px 11px",
    fontSize: 12,
    lineHeight: 1.2,
    fontWeight: 650,
  };
}

function miniRecord(tone: keyof typeof pastel): CSSProperties {
  const colours = pastel[tone];
  return {
    border: `1px solid ${colours.border}`,
    background: colours.bg,
    borderRadius: 15,
    padding: "12px 13px",
    color: palette.ink,
    fontSize: 14,
    lineHeight: 1.35,
    fontWeight: 600,
  };
}

function productCard(extra?: CSSProperties): CSSProperties {
  return {
    border: `1px solid ${palette.line}`,
    borderRadius: 28,
    background: "#ffffff",
    boxShadow: "0 18px 50px rgba(15,23,42,0.055)",
    padding: 24,
    ...extra,
  };
}

function cardTitle(extra?: CSSProperties): CSSProperties {
  return {
    margin: "8px 0 0",
    color: palette.ink,
    fontSize: 25,
    lineHeight: 1.15,
    fontWeight: 650,
    ...extra,
  };
}

const eyebrowStyle: CSSProperties = {
  color: palette.muted,
  fontSize: 11,
  fontWeight: 650,
  textTransform: "uppercase",
  letterSpacing: "0.045em",
};

function wrap(extra?: CSSProperties): CSSProperties {
  return {
    maxWidth: 1240,
    width: "100%",
    boxSizing: "border-box",
    margin: "0 auto",
    paddingLeft: 24,
    paddingRight: 24,
    ...extra,
  };
}

function sectionHeadline(extra?: CSSProperties): CSSProperties {
  return {
    margin: 0,
    color: palette.ink,
    fontSize: "clamp(32px, 3.8vw, 54px)",
    lineHeight: 1.06,
    letterSpacing: 0,
    fontWeight: 650,
    ...extra,
  };
}
