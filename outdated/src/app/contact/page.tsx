import { BulletList, Card, Eyebrow, PageWrap, PrimaryButton, SectionTitle, SiteShell, m } from "@/components/marketing";

export default function ContactPage() {
  return (
    <SiteShell>
      <PageWrap>
        <section style={{ display: "grid", gap: 24 }}>
          <Eyebrow>Book a demo</Eyebrow>
          <SectionTitle
            title="See the workflow in a live session"
            text="Use this page as the core CTA destination. Keep it simple, direct and focused on booking a conversation with the right commercial users."
          />
        </section>

        <section style={{ paddingTop: 20, display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)", gap: 24 }}>
          <Card
            title="What the demo should cover"
            text="A strong demo should show the product as a calm commercial workflow rather than a list of features."
          >
            <BulletList
              items={[
                "Creating a CE and selecting the contract logic",
                "Building Basis of Change clearly and quickly",
                "Adding evidence and deterministic resource lines",
                "Showing Review checks and pushback simulator logic",
                "Previewing the final Word + Excel output structure",
              ]}
            />
          </Card>

          <Card title="Current booking route" text="Replace this with Calendly, a form or your preferred booking flow when ready.">
            <div style={{ display: "grid", gap: 12, color: m.sub, fontSize: 15, lineHeight: 1.65 }}>
              <div><strong style={{ color: m.black }}>Email</strong>: hello@commercialcopilot.co.uk</div>
              <div><strong style={{ color: m.black }}>Purpose</strong>: demos, pilot access and pricing discussions</div>
              <div><strong style={{ color: m.black }}>Best next step</strong>: route all public CTA buttons here for now</div>
            </div>
            <div style={{ paddingTop: 6 }}>
              <PrimaryButton href="mailto:hello@commercialcopilot.co.uk">Email to book demo</PrimaryButton>
            </div>
          </Card>
        </section>
      </PageWrap>
    </SiteShell>
  );
}
