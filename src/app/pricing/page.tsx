import { Eyebrow, PageWrap, PrimaryButton, SecondaryButton, SectionTitle, SiteShell, Stat, m } from "@/components/marketing";

const plans = [
  {
    name: "Starter",
    price: "Early access testing",
    text: "For subcontractors helping shape a commercially serious workflow for EWNs, CEs / VOs, disciplined deterministic costing, submission packs and recovery tracking.",
    items: [
      "Guided EWN, CE / VO, Evidence, Resources, Prelims + Fee and Review workflow",
      "Deterministic cost build-up with user-controlled inputs",
      "Commercial review checks before generation",
      "Excel submission pack, narrative outputs and commercial recovery workflow",
      "Best suited to selected testers and growing subcontractors",
    ],
    cta: "Book Demo",
    href: "/contact",
    featured: true,
    note: "Testing phase",
  },
  {
    name: "Professional",
    price: "Custom",
    text: "For teams running a higher volume of change who need more credits, stronger operating consistency and a cleaner internal CE process across multiple submissions.",
    items: [
      "Higher CE credit allocation",
      "Priority onboarding and support",
      "Stronger workflow standardisation across the team",
      "Expansion path for broader contract coverage",
      "Suited to civils and groundworks teams dealing with regular change",
    ],
    cta: "Discuss fit",
    href: "/contact",
    featured: false,
    note: "For heavier usage",
  },
  {
    name: "Enterprise",
    price: "Talk to us",
    text: "For larger businesses considering wider rollout, governance, internal consistency and a closer relationship around implementation and product direction.",
    items: [
      "Team rollout planning",
      "Structured onboarding",
      "Commercial process alignment",
      "Future branded or tailored output discussions",
      "Closer roadmap input and commercial feedback loop",
    ],
    cta: "Contact us",
    href: "/contact",
    featured: false,
    note: "For rollout planning",
  },
];

function BulletList({ items }: { items: string[] }) {
  return (
    <div style={{ margin: 0, display: "grid", gap: 12, color: m.sub, fontSize: 14, lineHeight: 1.65 }}>
      {items.map((item) => (
        <div key={item} style={{ display: "grid", gridTemplateColumns: "12px minmax(0,1fr)", gap: 10, alignItems: "start" }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: m.black, marginTop: 9, opacity: 0.55 }} />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function PricingCard({
  name,
  price,
  text,
  items,
  cta,
  href,
  featured,
  note,
}: {
  name: string;
  price: string;
  text: string;
  items: string[];
  cta: string;
  href: string;
  featured?: boolean;
  note: string;
}) {
  return (
    <div
      style={{
        background: m.card,
        border: `1px solid ${featured ? "#cbd5e1" : m.border}`,
        borderRadius: 26,
        padding: 26,
        display: "grid",
        gridTemplateRows: "auto auto minmax(220px,1fr) auto",
        gap: 20,
        minHeight: "100%",
        boxShadow: featured ? "0 8px 24px rgba(15,23,42,0.05)" : "0 1px 2px rgba(15,23,42,0.03)",
      }}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 18, fontWeight: 650, letterSpacing: 0, color: m.black }}>{name}</div>
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: `1px solid ${featured ? "#cbd5e1" : m.border}`,
              background: featured ? m.soft : m.card,
              fontSize: 12,
              fontWeight: 600,
              color: m.sub,
              whiteSpace: "nowrap",
            }}
          >
            {note}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, alignContent: "start", minHeight: 126 }}>
          <div style={{ fontSize: 30, lineHeight: 1.08, fontWeight: 700, letterSpacing: 0, color: m.black }}>{price}</div>
          <div style={{ fontSize: 14, lineHeight: 1.68, color: m.sub, maxWidth: 360 }}>{text}</div>
        </div>
      </div>

      <div style={{ height: 1, background: m.border, opacity: 0.75 }} />

      <div style={{ display: "grid", alignContent: "start" }}>
        <BulletList items={items} />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", paddingTop: 4 }}>
        <PrimaryButton href={href}>{cta}</PrimaryButton>
        <SecondaryButton href="/login">Login</SecondaryButton>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <SiteShell>
      <PageWrap>
        <section style={{ display: "grid", gap: 22 }}>
          <Eyebrow>Pricing</Eyebrow>
          <SectionTitle
            title="Early access for subcontractor commercial teams"
            text="Commercial Co-Pilot is built for subcontractors who want to manage EWNs, CEs, valuations, submission packs and payment recovery in one controlled workflow."
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
            <Stat label="Pricing" value="TBC" />
            <Stat label="Credits used" value="On pack generation" />
            <Stat label="Product phase" value="Early testing" />
          </div>
        </section>

        <section
          style={{
            paddingTop: 42,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 20,
            alignItems: "stretch",
          }}
        >
          {plans.map((plan) => (
            <PricingCard key={plan.name} {...plan} />
          ))}
        </section>

        <section
          style={{
            paddingTop: 56,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.92fr)",
            gap: 24,
          }}
        >
          <div
            style={{
              background: m.card,
              border: `1px solid ${m.border}`,
              borderRadius: 24,
              padding: 26,
              display: "grid",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 650, color: m.black }}>Why the model is structured this way</div>
            <div style={{ fontSize: 15, lineHeight: 1.68, color: m.sub, maxWidth: 720 }}>
              The value is not in generating more files. The value is in helping the user control commercial issues from early warning through to submission, payment and recovery with less wasted QS time.
            </div>
            <BulletList
              items={[
                "Credits are intended to be consumed when the user generates a pack, not while they are drafting.",
                "Editable outputs keep the workflow commercially practical for real project teams.",
                "The structured commercial process is the core product, not just the final document.",
              ]}
            />
          </div>

          <div
            style={{
              background: m.card,
              border: `1px solid ${m.border}`,
              borderRadius: 24,
              padding: 26,
              display: "grid",
              gap: 16,
              alignContent: "start",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 650, color: m.black }}>Typical fit</div>
            <div style={{ fontSize: 15, lineHeight: 1.68, color: m.sub }}>
              Best suited to active subcontractors dealing with regular change, repeated CE / VO submissions, EWNs and ongoing pressure to recover value properly.
            </div>
            <div style={{ paddingTop: 4 }}>
              <SecondaryButton href="/contact">Discuss your use case</SecondaryButton>
            </div>
          </div>
        </section>
      </PageWrap>
    </SiteShell>
  );
}
