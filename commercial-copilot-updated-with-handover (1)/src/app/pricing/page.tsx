import {
  BulletList,
  Card,
  Eyebrow,
  PageWrap,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  SiteShell,
  Stat,
  m,
} from "@/components/marketing";

const plans = [
  {
    name: "Starter",
    price: "From £600 / month",
    text: "For subcontractors who want a proper CE workflow, deterministic costing and a commercially stronger output structure.",
    items: [
      "Guided Basis, Evidence, Resources, Prelims + Fee and Review workflow",
      "Deterministic cost build-up with user-controlled inputs",
      "Commercial review checks before generation",
      "Word document, Excel workbook and submission email structure",
      "Best suited to early paid users and growing subcontractors",
    ],
  },
  {
    name: "Professional",
    price: "Custom",
    text: "For heavier users who need more credits, a deeper operational workflow and stronger internal consistency across multiple events.",
    items: [
      "Higher CE credit allocation",
      "Priority onboarding and support",
      "Stronger workflow standardisation across the team",
      "Expansion path for broader contract coverage",
      "Suited to civils and groundworks teams dealing with regular change",
    ],
  },
  {
    name: "Enterprise",
    price: "Talk to us",
    text: "For larger businesses looking at rollout, team governance, internal consistency and roadmap collaboration.",
    items: [
      "Team rollout planning",
      "Structured onboarding",
      "Commercial process alignment",
      "Future branded or tailored output discussions",
      "Closer roadmap input and commercial feedback loop",
    ],
  },
];

export default function PricingPage() {
  return (
    <SiteShell>
      <PageWrap>
        <section style={{ display: "grid", gap: 24 }}>
          <Eyebrow>Pricing</Eyebrow>
          <SectionTitle
            title="Pricing aligned with commercial value, not prompt usage"
            text="Commercial Co-Pilot is positioned as a structured CE workflow for subcontractors who want better recovery, faster preparation and more consistent submissions."
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
            <Stat label="Core plan target" value="£600/mo" />
            <Stat label="Credits used" value="On pack generation" />
            <Stat label="Output philosophy" value="1–3 files max" />
          </div>
        </section>

        <section style={{ paddingTop: 40, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>
          {plans.map((plan) => (
            <Card key={plan.name} title={plan.name}>
              <div style={{ fontSize: 30, lineHeight: 1, fontWeight: 900, letterSpacing: -0.9, color: m.black }}>{plan.price}</div>
              <div style={{ fontSize: 15, lineHeight: 1.65, color: m.sub }}>{plan.text}</div>
              <BulletList items={plan.items} />
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <PrimaryButton href="/contact">Book Demo</PrimaryButton>
                <SecondaryButton href="/login">Login</SecondaryButton>
              </div>
            </Card>
          ))}
        </section>

        <section style={{ paddingTop: 56, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.9fr)", gap: 24 }}>
          <Card
            title="Why the model is structured this way"
            text="The value is not in generating more files. The value is in helping the user build a clearer, more defensible commercial submission with less wasted QS time."
          >
            <BulletList
              items={[
                "Credits are intended to be consumed when the user generates a pack, not while they are drafting.",
                "Editable outputs keep the workflow commercially practical for real project teams.",
                "The structured creation process is the core product, not just the final document.",
              ]}
            />
          </Card>

          <Card
            title="Typical fit"
            text="Best suited to active subcontractors dealing with regular change, repeated CE drafting and ongoing commercial pressure to recover value properly."
          >
            <SecondaryButton href="/contact">Discuss your use case</SecondaryButton>
          </Card>
        </section>
      </PageWrap>
    </SiteShell>
  );
}
