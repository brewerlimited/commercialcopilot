import {
  BulletList,
  Card,
  Eyebrow,
  MutedCard,
  PageWrap,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  SiteShell,
  Stat,
  m,
} from "@/components/marketing";

const painPoints = [
  "Weak entitlement narrative that invites avoidable pushback",
  "Cause and effect not explained clearly enough",
  "Cost build-up held across disconnected notes and spreadsheets",
  "Evidence not structured in a way that supports the quotation",
  "Too much QS time spent rewriting, reformatting and defending",
];

const workflow = [
  {
    title: "1. Build the event properly",
    text: "Guide the user through Basis of Change, Evidence, Resources, Prelims + Fee and Review in a structured commercial sequence.",
  },
  {
    title: "2. Keep the numbers controlled",
    text: "Use deterministic labour, plant, material, prelim and fee logic so the commercial build-up stays auditable and consistent.",
  },
  {
    title: "3. Generate a stronger pack",
    text: "Produce a submission-ready structure that reads like a commercial pack, not a rushed internal draft.",
  },
];

const outputs = [
  {
    title: "Basis of Change narrative",
    text: "A cleaner factual structure showing what happened, why it matters and how the event changed the commercial position.",
  },
  {
    title: "Deterministic cost workbook",
    text: "Labour, plant, material, prelim and fee totals that stay grounded in user-controlled valuation inputs.",
  },
  {
    title: "Time impact summary",
    text: "Clear explanation of programme and sequencing effects where the event has delay or disruption consequences.",
  },
  {
    title: "Evidence-led review",
    text: "Checks for missing records, weak causation points and gaps between narrative, costs and supporting material.",
  },
  {
    title: "Pushback simulator",
    text: "Internal commercial peer review that anticipates objections and helps strengthen the CE before submission.",
  },
  {
    title: "Submission-ready output",
    text: "One Word document, one Excel workbook and a simple submission email structure rather than fragmented files.",
  },
];

const proof = [
  "Built for subcontractors who need stronger CE structure rather than generic AI copy.",
  "Designed around commercial clarity, causation and deterministic valuation logic.",
  "Created to help recover value faster and reduce avoidable back-and-forth.",
];

export default function HomePage() {
  return (
    <SiteShell>
      <PageWrap>
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 0.85fr)",
            gap: 24,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              background: m.card,
              border: `1px solid ${m.border}`,
              borderRadius: 28,
              padding: 32,
              display: "grid",
              gap: 24,
            }}
          >
            <div style={{ display: "grid", gap: 14 }}>
              <Eyebrow>Commercial Co-Pilot</Eyebrow>
              <h1
                style={{
                  margin: 0,
                  fontSize: 58,
                  lineHeight: 0.96,
                  letterSpacing: -2.2,
                  fontWeight: 900,
                  color: m.black,
                  maxWidth: 720,
                }}
              >
                Produce stronger Compensation Events with less friction.
              </h1>
              <p style={{ margin: 0, fontSize: 19, lineHeight: 1.65, color: m.sub, maxWidth: 760 }}>
                Built for NEC and JCT subcontractors. Structure the event properly, keep the cost build-up deterministic and generate a commercially coherent pack faster.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <PrimaryButton href="/contact">Book Demo</PrimaryButton>
              <SecondaryButton href="/pricing">View Pricing</SecondaryButton>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
              <Stat label="Target plan" value="£600/mo" />
              <Stat label="Output model" value="1–3 files" />
              <Stat label="Cost logic" value="Deterministic" />
            </div>
          </div>

          <div
            style={{
              background: m.card,
              border: `1px solid ${m.border}`,
              borderRadius: 28,
              padding: 24,
              display: "grid",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: m.black }}>Demo preview</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: m.sub }}>60–120 second walkthrough</div>
            </div>

            <MutedCard>
              <div
                style={{
                  minHeight: 332,
                  borderRadius: 18,
                  border: `1px solid ${m.border}`,
                  background: "#ffffff",
                  display: "grid",
                  placeItems: "center",
                  padding: 24,
                  textAlign: "center",
                }}
              >
                <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: m.black }}>Product walkthrough placeholder</div>
                  <div style={{ fontSize: 15, lineHeight: 1.65, color: m.sub }}>
                    Show event creation, review logic, pushback simulator and the final Word + Excel output so the value is obvious immediately.
                  </div>
                </div>
              </div>
            </MutedCard>

            <div style={{ display: "grid", gap: 10 }}>
              {[
                "Structured workflow instead of a blank page",
                "Commercial review checks before pack generation",
                "Outputs designed to look calm, clear and professional",
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 16,
                    border: `1px solid ${m.border}`,
                    background: m.soft,
                    color: m.sub,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ paddingTop: 72, display: "grid", gap: 24 }}>
          <SectionTitle
            title="Most CE frustration comes from structure, not effort"
            text="Subcontractors usually already have the facts. The problem is pulling them into a coherent narrative, valuation and evidence position quickly enough."
          />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 0.75fr)", gap: 24 }}>
            <Card title="Common failure points">
              <BulletList items={painPoints} />
            </Card>
            <Card
              title="Commercial effect"
              text="Weak structure leads to delay, under-recovery and unnecessary back-and-forth when the core issue is usually presentation of entitlement and cost."
            >
              <SecondaryButton href="/contact">See the workflow</SecondaryButton>
            </Card>
          </div>
        </section>

        <section style={{ paddingTop: 72, display: "grid", gap: 24 }}>
          <SectionTitle
            title="A guided workflow built for commercial teams"
            text="The product should feel supportive and linear. It helps the user build a stronger CE in the right order rather than asking them to assemble it themselves."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>
            {workflow.map((item) => (
              <Card key={item.title} title={item.title} text={item.text} />
            ))}
          </div>
        </section>

        <section style={{ paddingTop: 72, display: "grid", gap: 24 }}>
          <SectionTitle
            title="What the platform produces"
            text="Every part of the output exists to improve commercial clarity and reduce avoidable pushback."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>
            {outputs.map((item) => (
              <Card key={item.title} title={item.title} text={item.text} />
            ))}
          </div>
        </section>

        <section style={{ paddingTop: 72, display: "grid", gap: 24 }}>
          <SectionTitle
            title="The software only needs to improve one meaningful outcome"
            text="If it helps the user recover value faster, avoid underpricing or submit a stronger CE sooner, the subscription becomes commercially easy to justify."
          />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.9fr)", gap: 24 }}>
            <Card title="Illustrative recovery logic">
              <div style={{ display: "grid", gap: 12, color: m.sub, fontSize: 15, lineHeight: 1.65 }}>
                <div>If a typical CE is worth <strong style={{ color: m.black }}>£8,000</strong></div>
                <div>And the platform helps protect or recover just <strong style={{ color: m.black }}>5%</strong></div>
                <div>That is <strong style={{ color: m.black }}>£400</strong> on one event</div>
                <div>Across regular change, the commercial case becomes obvious quickly.</div>
              </div>
            </Card>
            <Card title="Why this positioning works" text="This is not sold as an AI writer. It is sold as a commercial workflow that helps subcontractors prepare clearer, more defensible change submissions.">
              <SecondaryButton href="/pricing">See pricing</SecondaryButton>
            </Card>
          </div>
        </section>

        <section style={{ paddingTop: 72, display: "grid", gap: 24 }}>
          <SectionTitle title="Why the product feels different" text="It is being built around commercial logic first. The UI stays calm, the workflow stays deliberate and the value stays tied to better recovery."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>
            {proof.map((item, idx) => (
              <Card key={item} title={`Positioning point ${idx + 1}`} text={item} />
            ))}
          </div>
        </section>

        <section style={{ paddingTop: 72 }}>
          <div
            style={{
              background: m.card,
              border: `1px solid ${m.border}`,
              borderRadius: 28,
              padding: 32,
              display: "grid",
              gap: 18,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, color: m.sub, textTransform: "uppercase", letterSpacing: 0.2 }}>
              Ready to see it live
            </div>
            <div style={{ fontSize: 38, lineHeight: 1.08, letterSpacing: -1, fontWeight: 900, color: m.black }}>
              Book a demo and see the full commercial workflow.
            </div>
            <div style={{ fontSize: 18, lineHeight: 1.65, color: m.sub, maxWidth: 760, margin: "0 auto" }}>
              Walk through event creation, cost build-up, review checks and the final pack structure in one focused session.
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              <PrimaryButton href="/contact">Book Demo</PrimaryButton>
              <SecondaryButton href="/login">Login</SecondaryButton>
            </div>
          </div>
        </section>
      </PageWrap>
    </SiteShell>
  );
}
