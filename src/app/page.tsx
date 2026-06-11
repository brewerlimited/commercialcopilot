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
  "Recoverable events sitting in diaries, emails and site records for too long",
  "CE / VO narratives that are too easy to reject, discount or push back",
  "Cause, entitlement, programme effect and cost not tied together clearly enough",
  "Submitted value chased separately from the CE history",
  "Too much QS and commercial manager time spent rewriting weak submissions",
];

const workflow = [
  {
    title: "1. Capture the recoverable event",
    text: "Log the issue, carry EWN details into the CE workflow and structure the facts, entitlement position, evidence, resources, prelims, fee and review checks before the submission is issued.",
  },
  {
    title: "2. Produce a stronger CE faster",
    text: "Build a clearer narrative and auditable valuation from controlled labour, plant, material, subcontract, prelim and fee inputs, reducing the time spent pulling the pack together.",
  },
  {
    title: "3. Manage the recovery to payment",
    text: "Keep submitted, unpaid, overdue, rejected, accepted and recovered value visible from the same commercial control dashboard.",
  },
];

const outputs = [
  {
    title: "Recovery assistant",
    text: "Surfaces live value, overdue money and the next action needed to move each CE towards recovery.",
  },
  {
    title: "CE / VO producer",
    text: "Guided Basis of Change, Evidence, Resources, Prelims + Fee and Review flow for stronger, better supported submission packs.",
  },
  {
    title: "Controlled valuation build-up",
    text: "Labour, plant, material, subcontract, prelim and fee totals grounded in user-controlled commercial inputs.",
  },
  {
    title: "Evidence-led review",
    text: "Checks for missing records, weak causation points and gaps between narrative, costs and supporting material.",
  },
  {
    title: "Commercial pushback check",
    text: "Internal commercial review points that anticipate objections and help strengthen the CE before submission.",
  },
  {
    title: "Payment tracking",
    text: "Submitted, accepted, unpaid, overdue and paid value tracked against the CE history rather than a disconnected spreadsheet.",
  },
];

const proof = [
  "Built for subcontractors who need recoverable CE / VO submissions rather than generic document output.",
  "Designed around causation, entitlement, deterministic valuation and payment recovery.",
  "Created to reduce commercial input, speed up submissions and improve the chance of recovering value.",
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
              <Eyebrow>CE recovery and commercial control for subcontractors</Eyebrow>
              <h1
                style={{
                  margin: 0,
                  fontSize: 44,
                  lineHeight: 1.04,
                  letterSpacing: 0,
                  fontWeight: 700,
                  color: m.black,
                  maxWidth: 720,
                }}
              >
                Produce stronger CEs and variations. Recover more of the money you are entitled to.
              </h1>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: m.sub, maxWidth: 760 }}>
                Commercial Co-Pilot helps NEC and JCT subcontractors turn site events into better structured CE / VO submissions faster, with clearer entitlement, auditable cost build-ups, less senior commercial rewriting and tracking through to payment.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <PrimaryButton href="/contact">Book Demo</PrimaryButton>
              <SecondaryButton href="/pricing">Early access testing</SecondaryButton>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
              <Stat label="Primary role" value="Recovery assistant" />
              <Stat label="Core output" value="Better CE / VO packs" />
              <Stat label="Also" value="Commercial management" />
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
              <div style={{ fontSize: 16, fontWeight: 700, color: m.black }}>What it helps you do</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: m.sub }}>From site event to paid CE</div>
            </div>

            <MutedCard>
              <div
                style={{
                  minHeight: 280,
                  borderRadius: 18,
                  border: `1px solid ${m.border}`,
                  background: m.card,
                  display: "grid",
                  placeItems: "center",
                  padding: 24,
                  textAlign: "center",
                }}
              >
                <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.black }}>A CE recovery workflow and commercial management tool</div>
                  <div style={{ fontSize: 15, lineHeight: 1.65, color: m.sub }}>
                    Capture the issue, build the entitlement case, price the resources, produce the submission pack, check the weak points, manage the register and keep chasing the value until it is accepted and paid.
                  </div>
                </div>
              </div>
            </MutedCard>

            <div style={{ display: "grid", gap: 10 }}>
              {[
                "Stronger CE / VO packs produced faster",
                "Less senior commercial time spent rewriting",
                "Submitted, unpaid and overdue value managed to recovery",
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

        <section style={{ paddingTop: 56, display: "grid", gap: 24 }}>
          <SectionTitle
            title="The money is usually in the records. The loss is usually in the follow-through."
            text="Subcontractors often have the facts, labour, plant, instructions and site records. The hard part is turning them into a clear, priced and defensible CE / VO quickly enough to avoid discounting, rejection or delay."
          />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 0.75fr)", gap: 24 }}>
            <Card title="Common failure points">
              <BulletList items={painPoints} />
            </Card>
            <Card
              title="Commercial effect"
              text="Weak structure leads to delay, under-recovery and unnecessary back-and-forth. Commercial Co-Pilot tightens the link between event, entitlement, cost, programme effect, commercial management and payment action."
            >
              <SecondaryButton href="/contact">See the workflow</SecondaryButton>
            </Card>
          </div>
        </section>

        <section style={{ paddingTop: 56, display: "grid", gap: 24 }}>
          <SectionTitle
            title="A guided recovery workflow built for subcontractors"
            text="It is part recovery assistant, part CE producer and part commercial management tool. It helps the user move from EWN to CE / VO, valuation, submission, register control and payment without relying on disconnected spreadsheets and notes."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>
            {workflow.map((item) => (
              <Card key={item.title} title={item.title} text={item.text} />
            ))}
          </div>
        </section>

        <section style={{ paddingTop: 56, display: "grid", gap: 24 }}>
          <SectionTitle
            title="What Commercial Co-Pilot helps produce and recover"
            text="Every part of the workflow is there to improve commercial clarity, protect entitlement, reduce avoidable pushback and keep the money visible after submission."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>
            {outputs.map((item) => (
              <Card key={item.title} title={item.title} text={item.text} />
            ))}
          </div>
        </section>

        <section style={{ paddingTop: 56, display: "grid", gap: 24 }}>
          <SectionTitle
            title="The commercial case is simple: save time and recover more value"
            text="If it helps a subcontractor submit stronger CEs sooner, reduce senior commercial input or recover value that would otherwise be delayed or discounted, the subscription is easy to justify."
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
            <Card title="Why this positioning works" text="This is not just a document tool or a basic register. It is a commercial recovery workflow that helps subcontractors produce stronger CEs, defend value and keep submitted money moving.">
              <SecondaryButton href="/pricing">See pricing</SecondaryButton>
            </Card>
          </div>
        </section>

        <section style={{ paddingTop: 56, display: "grid", gap: 24 }}>
          <SectionTitle title="Why the product feels different" text="It is built around commercial recovery first, while still giving teams the management control they need. The workflow stays deliberate and the value stays tied to stronger submissions, faster production and better payment follow-up."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>
            {proof.map((item, idx) => (
              <Card key={item} title={`Positioning point ${idx + 1}`} text={item} />
            ))}
          </div>
        </section>

        <section style={{ paddingTop: 56 }}>
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
            <div style={{ fontSize: 12, fontWeight: 700, color: m.sub, textTransform: "uppercase", letterSpacing: "0.02em" }}>
              Ready to see it live
            </div>
            <div style={{ fontSize: 30, lineHeight: 1.18, letterSpacing: 0, fontWeight: 700, color: m.black }}>
              Book a demo and see how Commercial Co-Pilot helps turn site events into stronger, better-managed CEs.
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.6, color: m.sub, maxWidth: 760, margin: "0 auto" }}>
              Walk through EWN capture, CE / VO production, valuation, review checks, commercial register control and payment tracking in one focused session.
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
