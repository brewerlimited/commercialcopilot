import Link from "next/link";
import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { SiteShell } from "@/components/marketing";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Early access pricing for Commercial Co-Pilot, commercial management and recovery software for subcontractors managing EWNs, CEs and variations.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Commercial Co-Pilot pricing",
    description: "Early access pricing for subcontractors who want stronger CE / VO packs, better evidence discipline and clearer payment recovery tracking.",
    url: "/pricing",
  },
};

const palette = {
  ink: "#0f172a",
  muted: "#596579",
  soft: "#f6f8fb",
  line: "rgba(15, 23, 42, 0.09)",
  blue: "#cfe8ff",
  blueBg: "#f0f8ff",
  blueText: "#2563a8",
  greenBg: "#effcf6",
  greenText: "#137657",
  orangeBg: "#fff5ef",
  orangeText: "#b45309",
  pinkBg: "#fff4ee",
  pinkText: "#a3402f",
};

const plans = [
  {
    name: "Starter",
    price: "Early access",
    note: "Best for tester accounts",
    text: "For subcontractors proving the workflow on live EWNs, CEs / VOs, resources, prelims, packs and payment recovery.",
    items: [
      "Guided EWN, CE / VO and evidence workflow",
      "Labour, plant, material, subcontract and prelim build-ups",
      "Recovery checks before pack issue",
      "Excel submission pack output",
      "Payment tracking for submitted and overdue value",
    ],
  },
  {
    name: "Professional",
    price: "£199/month",
    note: "Recommended",
    text: "For commercial teams that need more capacity, cleaner operating discipline and a repeatable change recovery process.",
    highlight: true,
    items: [
      "Higher pack generation allowance",
      "Priority onboarding and support",
      "Project-level recovery reporting",
      "Team workflow standardisation",
      "Expansion path for broader contract coverage",
    ],
  },
  {
    name: "Enterprise",
    price: "Talk to us",
    note: "For wider rollout",
    text: "For larger subcontractors planning governance, adoption, internal consistency and closer implementation support.",
    items: [
      "Rollout planning",
      "Structured onboarding",
      "Commercial process alignment",
      "Output and governance discussions",
      "Closer product direction input",
    ],
  },
];

const proof = [
  ["Charge point", "Pack generation", "Credits are consumed when a recovery pack is produced, not while records are being built."],
  ["Core value", "Recovery control", "The system is priced around reducing wasted commercial time and protecting recoverable value."],
  ["Best fit", "Regular EWNs & CEs", "Most useful where subcontractors deal with live notices, CEs, VOs, evidence and payment follow-up."],
];

function wrap(style: CSSProperties = {}): CSSProperties {
  return { maxWidth: 1240, margin: "0 auto", padding: "0 24px", ...style };
}

function Button({ href, children, tone = "dark" }: { href: string; children: ReactNode; tone?: "dark" | "light" }) {
  const dark = tone === "dark";
  return (
    <Link
      href={href}
      style={{
        minHeight: 52,
        padding: "0 20px",
        borderRadius: 16,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        fontWeight: 800,
        fontSize: 14,
        background: dark ? palette.ink : "#ffffff",
        color: dark ? "#ffffff" : palette.ink,
        border: `1px solid ${dark ? palette.ink : palette.line}`,
        boxShadow: dark ? "0 12px 26px rgba(15,23,42,0.18)" : "0 10px 24px rgba(15,23,42,0.06)",
      }}
    >
      {children}
    </Link>
  );
}

function Pill({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "orange" | "pink" }) {
  const styles = {
    blue: { bg: palette.blueBg, color: palette.blueText, border: "#cfe8ff" },
    green: { bg: palette.greenBg, color: palette.greenText, border: "#c8f3df" },
    orange: { bg: palette.orangeBg, color: palette.orangeText, border: "#ffd8bf" },
    pink: { bg: palette.pinkBg, color: palette.pinkText, border: "#ffd6c7" },
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 34,
        padding: "0 13px",
        borderRadius: 999,
        border: `1px solid ${styles.border}`,
        background: styles.bg,
        color: styles.color,
        fontSize: 12,
        fontWeight: 850,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function PlanCard({ plan }: { plan: (typeof plans)[number] }) {
  const primaryCta = plan.name === "Enterprise" ? "Discuss Fit" : plan.name === "Professional" ? "Start Free Trial" : "Watch Demo";
  const primaryHref = plan.name === "Professional" ? "/login" : "/contact";

  return (
    <article
      className="pricing-card home-hover-card"
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: "100%",
        borderRadius: 26,
        border: `1px solid ${plan.highlight ? "#cfe8ff" : palette.line}`,
        background: plan.highlight
          ? "linear-gradient(180deg, #ffffff 0%, #f0f8ff 100%)"
          : "#ffffff",
        padding: 28,
        boxShadow: plan.highlight ? "0 22px 60px rgba(37,99,235,0.10)" : "0 12px 34px rgba(15,23,42,0.05)",
        display: "grid",
        gridTemplateRows: "auto auto 1fr auto",
        gap: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 850, color: palette.ink }}>{plan.name}</div>
          <div style={{ marginTop: 8 }}>
            <Pill tone={plan.highlight ? "blue" : "green"}>{plan.note}</Pill>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 36, lineHeight: 1, fontWeight: 900, color: palette.ink }}>{plan.price}</div>
        <p style={{ margin: 0, color: palette.muted, fontSize: 15, lineHeight: 1.65 }}>{plan.text}</p>
      </div>

      <div style={{ display: "grid", gap: 12, alignContent: "start", color: palette.muted, fontSize: 14, lineHeight: 1.55 }}>
        {plan.items.map((item) => (
          <div key={item} style={{ display: "grid", gridTemplateColumns: "18px minmax(0,1fr)", gap: 10, alignItems: "start" }}>
            <span aria-hidden style={{ width: 18, height: 18, borderRadius: 999, display: "grid", placeItems: "center", background: plan.highlight ? "#dbeafe" : palette.soft, color: palette.ink, fontSize: 12, fontWeight: 900 }}>✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", paddingTop: 6 }}>
        <Button href={primaryHref} tone={plan.highlight ? "dark" : "light"}>{primaryCta}</Button>
        <Button href="/contact" tone="light">Ask a Question</Button>
      </div>
    </article>
  );
}

export default function PricingPage() {
  return (
    <SiteShell>
      <main style={{ background: "#ffffff", color: palette.ink }}>
        <section
          style={{
            borderBottom: `1px solid ${palette.line}`,
            background: [
              "radial-gradient(circle at 16% 20%, rgba(185,221,255,0.44), transparent 30%)",
              "radial-gradient(circle at 84% 18%, rgba(255,214,199,0.34), transparent 30%)",
              "linear-gradient(180deg, #fbfdff 0%, #ffffff 100%)",
            ].join(", "),
          }}
        >
          <div style={wrap({ paddingTop: 82, paddingBottom: 64 })}>
            <div className="pricing-hero-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.95fr) minmax(360px, 0.55fr)", gap: 42, alignItems: "center" }}>
              <div style={{ display: "grid", gap: 22 }}>
                <Pill tone="orange">Pricing for early contractor testing</Pill>
                <h1 style={{ margin: 0, maxWidth: 820, fontSize: "clamp(40px, 5vw, 70px)", lineHeight: 1, letterSpacing: 0, fontWeight: 900 }}>
                  Commercial recovery software should pay for itself in avoided waste.
                </h1>
                <p style={{ margin: 0, maxWidth: 760, color: palette.muted, fontSize: 20, lineHeight: 1.65, fontWeight: 600 }}>
                  Commercial Co-Pilot is being shaped with subcontractors during early contractor testing. The focus is simple: reduce wasted commercial time, strengthen submissions and keep recoverable money visible through to payment.
                </p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Button href="/contact">Watch 2 Minute Demo</Button>
                  <Button href="/login" tone="light">Start Free Trial</Button>
                </div>
              </div>

              <aside
                className="home-hover-card"
                style={{
                  borderRadius: 28,
                  border: "1px solid rgba(185,221,255,0.7)",
                  background: "#ffffff",
                  boxShadow: "0 24px 70px rgba(15,23,42,0.10)",
                  padding: 28,
                  display: "grid",
                  gap: 18,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 850, color: palette.blueText, textTransform: "uppercase", letterSpacing: "0.04em" }}>Current phase</div>
                <div style={{ fontSize: 34, lineHeight: 1.05, fontWeight: 900, color: palette.ink }}>Early access</div>
                <p style={{ margin: 0, color: palette.muted, fontSize: 15, lineHeight: 1.65 }}>
                  We are prioritising the right subcontractor workflows before wider rollout. Demo access and trial setup are currently handled by request.
                </p>
                <div style={{ height: 1, background: palette.line }} />
                <div style={{ display: "grid", gap: 10 }}>
                  {[
                    ["Credits used", "Pack generation", palette.blueBg],
                    ["Drafting", "No credit burn", palette.greenBg],
                    ["Ideal for", "Regular EWNs and CEs / VOs", palette.orangeBg],
                  ].map(([label, value, bg]) => (
                    <div
                      key={label}
                      style={{
                        display: "grid",
                        gap: 4,
                        border: `1px solid ${palette.line}`,
                        borderRadius: 16,
                        background: String(bg),
                        padding: "13px 14px",
                      }}
                    >
                      <span style={{ color: palette.muted, fontSize: 12, fontWeight: 850, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
                      <span style={{ color: palette.ink, fontSize: 16, lineHeight: 1.25, fontWeight: 850 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section style={wrap({ paddingTop: 58, paddingBottom: 20 })}>
          <div className="pricing-stats" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
            {proof.map(([label, value, text], index) => (
              <div key={label} className="home-hover-card" style={{ border: `1px solid ${index === 0 ? "#cfe8ff" : palette.line}`, borderRadius: 22, background: index === 0 ? palette.blueBg : "#ffffff", padding: 22, minHeight: 150 }}>
                <div style={{ color: index === 0 ? palette.blueText : palette.muted, fontSize: 12, fontWeight: 850, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                <div style={{ marginTop: 16, color: palette.ink, fontSize: 25, lineHeight: 1.1, fontWeight: 900 }}>{value}</div>
                <div style={{ marginTop: 10, color: palette.muted, fontSize: 14, lineHeight: 1.6 }}>{text}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={wrap({ paddingTop: 34, paddingBottom: 74 })}>
          <div className="pricing-plans" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20, alignItems: "stretch" }}>
            {plans.map((plan) => (
              <PlanCard key={plan.name} plan={plan} />
            ))}
          </div>
        </section>

        <section style={{ background: palette.soft, borderBlock: `1px solid ${palette.line}` }}>
          <div style={wrap({ paddingTop: 70, paddingBottom: 76 })}>
            <div className="pricing-info-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.9fr)", gap: 24 }}>
              <div style={{ display: "grid", gap: 14 }}>
                <Pill tone="blue">Why this matters</Pill>
                <h2 style={{ margin: 0, fontSize: "clamp(30px, 3.4vw, 50px)", lineHeight: 1.05, fontWeight: 900 }}>
                  The cost is usually not the software. It is missed recovery, repeated admin and slow payment follow-through.
                </h2>
                <p style={{ margin: 0, color: palette.muted, fontSize: 18, lineHeight: 1.65, maxWidth: 760 }}>
                  Pricing will be designed around the value of turning live records into stronger submissions and keeping submitted money moving, rather than charging users while they are still organising the facts.
                </p>
              </div>
              <div style={{ borderRadius: 28, border: "1px solid rgba(185,221,255,0.7)", background: "#ffffff", padding: 24, boxShadow: "0 18px 50px rgba(15,23,42,0.06)", display: "grid", gap: 12 }}>
                {[
                  ["01", "Less wasted QS time", "Records, cost lines and recovery checks stay connected.", palette.blueBg],
                  ["02", "Stronger CE / VO packs", "Entitlement, evidence and valuation support are built into the pack.", palette.orangeBg],
                  ["03", "Better recovery visibility", "Submitted, unpaid and overdue value stays visible until closed.", palette.greenBg],
                ].map(([step, title, text, bg]) => (
                  <div
                    key={title}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "46px minmax(0, 1fr)",
                      gap: 14,
                      alignItems: "start",
                      border: `1px solid ${palette.line}`,
                      borderRadius: 18,
                      background: String(bg),
                      padding: 16,
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: "#ffffff",
                        border: `1px solid ${palette.line}`,
                        display: "grid",
                        placeItems: "center",
                        color: palette.ink,
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      {step}
                    </div>
                    <div style={{ display: "grid", gap: 5 }}>
                      <div style={{ color: palette.ink, fontSize: 16, fontWeight: 850 }}>{title}</div>
                      <div style={{ color: palette.muted, fontSize: 14, lineHeight: 1.55 }}>{text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
