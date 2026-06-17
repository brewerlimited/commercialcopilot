import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { SiteShell } from "@/components/marketing";

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
  lavender: "#d8c8ff",
  lavenderText: "#6d4cc2",
  pink: "#ffc7db",
  pinkText: "#b43f6f",
};

const trustBadges = ["NEC3", "NEC4", "JCT", "Subcontractor Focused", "Built by Quantity Surveyors", "Evidence Led Recovery"];

const workflow = [
  ["Site Issue", palette.orange, palette.orangeText],
  ["Early Warning Notice", palette.green, palette.greenText],
  ["Compensation Event", palette.blue, palette.blueText],
  ["Defined Cost Build-Up", palette.lavender, palette.lavenderText],
  ["Contractual Position", palette.pink, palette.pinkText],
  ["Submission Pack", palette.blue, palette.blueText],
  ["Payment Tracking", palette.green, palette.greenText],
];

const features = [
  {
    title: "EWN Register",
    text: "Never miss a notice or lose track of early warning issues.",
    tone: "green",
  },
  {
    title: "CE / VO Management",
    text: "Track every event from first record through to submission and agreement.",
    tone: "blue",
  },
  {
    title: "Defined Cost / Loss & Expense",
    text: "Build auditable labour, plant, material, subcontract and prelims cost support.",
    tone: "orange",
  },
  {
    title: "Contractual Position",
    text: "Structure NEC and JCT arguments around entitlement, causation and assessment.",
    tone: "lavender",
  },
  {
    title: "Commercial Pushback",
    text: "Prepare responses to the common reasons submissions are challenged, rejected or discounted.",
    tone: "pink",
  },
  {
    title: "Payment Tracking",
    text: "Track submitted, agreed, unpaid and overdue value.",
    tone: "green",
  },
];

const productTabs = ["Dashboard", "EWN Register", "CE Register", "Submission Packs", "Commercial Pushback", "Payment Tracking"];

const pastel: Record<string, { bg: string; text: string; border: string }> = {
  green: { bg: "#effcf6", text: palette.greenText, border: "#c8f3df" },
  orange: { bg: "#fff5ef", text: palette.orangeText, border: "#ffd8bf" },
  blue: { bg: "#f0f8ff", text: palette.blueText, border: "#cfe8ff" },
  lavender: { bg: "#f7f3ff", text: palette.lavenderText, border: "#e3d8ff" },
  pink: { bg: "#fff2f7", text: palette.pinkText, border: "#ffd3e3" },
};

type PastelStyle = (typeof pastel)[keyof typeof pastel];

export default function HomePage() {
  return (
    <SiteShell>
      <main style={{ background: "#ffffff", color: palette.ink }}>
        <Hero />
        <TrustStrip />
        <KeyMessage />
        <Workflow />
        <Features />
        <Product />
        <BuiltForSubcontractors />
        <FinalCta />
      </main>
    </SiteShell>
  );
}

function Hero() {
  return (
    <section style={{ borderBottom: `1px solid ${palette.line}`, background: "linear-gradient(180deg, #ffffff 0%, #fbfcff 100%)" }}>
      <div style={wrap({ maxWidth: 1380, paddingTop: 68, paddingBottom: 42 })}>
        <div className="home-hero-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.82fr) minmax(0, 1.18fr)", gap: 56, alignItems: "center" }}>
          <div style={{ display: "grid", gap: 24, minWidth: 0 }}>
            <div style={{ display: "grid", gap: 16 }}>
              <h1 style={{ margin: 0, maxWidth: 650, fontSize: "clamp(38px, 4.4vw, 60px)", lineHeight: 1, letterSpacing: 0, fontWeight: 800 }}>
                Commercial management software for subcontractors.
              </h1>
              <h2 style={{ margin: 0, maxWidth: 620, fontSize: "clamp(25px, 2.45vw, 36px)", lineHeight: 1.14, letterSpacing: 0, fontWeight: 700, color: "#263349" }}>
                Produce stronger CEs and variations. Recover more of the money you are entitled to.
              </h2>
              <p style={{ margin: 0, maxWidth: 650, color: palette.muted, fontSize: 18, lineHeight: 1.7 }}>
                Track EWNs, build compensation events, create submission packs, defend entitlement and manage recovery through to payment.
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
    ["Recoverable Value", "£40,815", "All saved CE totals.", pastel.blue],
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
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 820,
        marginLeft: "auto",
        borderRadius: 34,
        padding: 8,
        background: "linear-gradient(135deg, rgba(185,221,255,0.72), rgba(255,199,219,0.34), rgba(158,230,198,0.5))",
        boxShadow: "0 30px 90px rgba(15, 23, 42, 0.15)",
      }}
    >
      <div style={{ borderRadius: 26, background: "#fbfdff", border: `1px solid ${palette.line}`, overflow: "hidden", minHeight: 430, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
          <div>
            <div style={{ color: palette.muted, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>Recovery Control Panel</div>
            <div style={{ marginTop: 9, maxWidth: 430, fontSize: 25, lineHeight: 1.1, fontWeight: 800, color: palette.ink }}>
              See what value is live, what is stuck, and what needs action to get paid.
            </div>
          </div>
          <div style={{ border: `1px solid ${palette.line}`, borderRadius: 14, padding: "10px 13px", background: "#ffffff", color: palette.muted, fontSize: 12, fontWeight: 800 }}>All Projects</div>
        </div>

        <div className="home-hero-stats" style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          {stats.map(([label, value, note, colours]) => (
            <div key={label as string} style={{ border: `1px solid ${(colours as typeof pastel.blue).border}`, background: (colours as typeof pastel.blue).bg, borderRadius: 18, padding: 15 }}>
              <div style={{ color: palette.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
              <div style={{ marginTop: 16, fontSize: 25, lineHeight: 1, fontWeight: 800, color: palette.ink }}>{value}</div>
              <div style={{ marginTop: 10, color: palette.muted, fontSize: 11, lineHeight: 1.35 }}>{note}</div>
            </div>
          ))}
        </div>

        <div className="home-hero-action-grid" style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1.35fr 0.65fr", gap: 14 }}>
          <div style={{ border: `1px solid ${palette.line}`, borderRadius: 20, background: "#ffffff", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: palette.ink }}>Recovery actions</div>
                <div style={{ marginTop: 4, color: palette.muted, fontSize: 12 }}>Items that can move value towards payment.</div>
              </div>
              <span style={pill("blue")}>Open CE register</span>
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 9 }}>
              {actions.map(([status, title, value, colours]) => (
                <div key={title as string} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, border: `1px solid ${(colours as typeof pastel.blue).border}`, background: (colours as typeof pastel.blue).bg, borderRadius: 15, padding: "12px 13px" }}>
                  <div>
                    <div style={{ color: (colours as typeof pastel.blue).text, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>{status}</div>
                    <div style={{ marginTop: 5, color: palette.ink, fontSize: 13, lineHeight: 1.25, fontWeight: 800 }}>{title}</div>
                  </div>
                  <div style={{ color: palette.ink, fontSize: 15, fontWeight: 800 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ border: `1px solid ${pastel.lavender.border}`, borderRadius: 18, background: pastel.lavender.bg, padding: 15 }}>
              <div style={{ color: palette.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Event Status</div>
              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                {["Draft", "Submitted", "Accepted", "Paid"].map((item, index) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, color: palette.ink, fontSize: 12, fontWeight: 800 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: [palette.blue, palette.orange, palette.green, palette.lavender][index] }} />
                      {item}
                    </span>
                    <span>{[3, 4, 2, 1][index]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ border: `1px solid ${palette.line}`, borderRadius: 18, background: "#ffffff", padding: 15 }}>
              <div style={{ color: palette.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Next Action</div>
              <div style={{ marginTop: 10, color: palette.ink, fontSize: 14, lineHeight: 1.3, fontWeight: 800 }}>Chase payment for CE 010</div>
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
      <div style={wrap({ paddingTop: 22, paddingBottom: 28 })}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {trustBadges.map((badge, index) => (
            <span key={badge} style={{ ...pill(["blue", "green", "orange", "lavender", "pink", "green"][index] as keyof typeof pastel), padding: "10px 13px" }}>
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function KeyMessage() {
  return (
    <section style={{ background: palette.soft, borderBlock: `1px solid ${palette.line}` }}>
      <div style={wrap({ paddingTop: 82, paddingBottom: 82 })}>
        <div style={{ maxWidth: 1010, margin: "0 auto", textAlign: "center", display: "grid", gap: 22 }}>
          <div style={pill("pink")}>The commercial recovery gap</div>
          <h2 style={sectionHeadline({ maxWidth: 920, margin: "0 auto" })}>
            The money is usually in the records. The loss is usually in the follow-through.
          </h2>
          <p style={{ margin: "0 auto", maxWidth: 850, color: palette.muted, fontSize: 19, lineHeight: 1.75 }}>
            Subcontractors often already have the facts, labour, plant, instructions and site records.
          </p>
          <p style={{ margin: "0 auto", maxWidth: 920, color: palette.ink, fontSize: 22, lineHeight: 1.55, fontWeight: 650 }}>
            The hard part is turning them into clear, priced and defensible CE / VO submissions quickly enough to avoid discounting, rejection or delay.
          </p>
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section id="how-it-works" style={{ background: "#ffffff" }}>
      <div style={wrap({ paddingTop: 88, paddingBottom: 70 })}>
        <SectionHeader eyebrow="One event. Start to finish." title="Everything linked. Nothing lost." text="Commercial Co-Pilot keeps each step connected from the first site issue through to recovery." />
        <div style={{ marginTop: 34, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {workflow.map(([label, bg, text], index) => (
            <div key={label} style={{ position: "relative", border: `1px solid ${palette.line}`, borderRadius: 22, padding: 18, background: "#ffffff", boxShadow: "0 12px 30px rgba(15,23,42,0.05)" }}>
              <div style={{ width: 46, height: 46, borderRadius: 16, background: bg, color: text, display: "grid", placeItems: "center", fontWeight: 800 }}>{index + 1}</div>
              <div style={{ marginTop: 14, fontSize: 15, lineHeight: 1.35, fontWeight: 800 }}>{label}</div>
              {index < workflow.length - 1 ? <div style={{ position: "absolute", right: 14, top: 26, color: palette.muted, fontWeight: 800 }}>→</div> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" style={{ background: palette.soft, borderBlock: `1px solid ${palette.line}` }}>
      <div style={wrap({ paddingTop: 86, paddingBottom: 86 })}>
        <SectionHeader eyebrow="Features" title="Commercial recovery tools for the work subcontractors actually do." text="Not generic project management. A focused system for notices, events, entitlement, cost support, submissions and payment." />
        <div style={{ marginTop: 34, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 18 }}>
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Product() {
  return (
    <section id="outputs" style={{ background: "#ffffff" }}>
      <div style={wrap({ paddingTop: 88, paddingBottom: 86 })}>
        <SectionHeader eyebrow="Product" title="Everything you need. From site issue to payment." text="A modern commercial control workspace for EWNs, CEs, submission packs, pushback and payment recovery." />
        <div style={{ marginTop: 34, display: "grid", gridTemplateColumns: "minmax(300px, 0.82fr) minmax(340px, 1.18fr)", gap: 24, alignItems: "stretch" }}>
          <div style={{ display: "grid", gap: 12 }}>
            {productTabs.map((item, index) => (
              <div key={item} style={{ border: `1px solid ${palette.line}`, borderRadius: 18, padding: 18, background: index === 0 ? "#f7fbff" : "#ffffff", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 36, height: 36, borderRadius: 13, background: [palette.blue, palette.green, palette.orange, palette.lavender, palette.pink, palette.green][index], display: "grid", placeItems: "center", fontWeight: 800 }}>{index + 1}</span>
                <span style={{ fontWeight: 800 }}>{item}</span>
              </div>
            ))}
          </div>
          <div style={{ border: `1px solid ${palette.line}`, borderRadius: 28, background: "#ffffff", boxShadow: "0 20px 60px rgba(15,23,42,0.08)", padding: 24, display: "grid", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ color: palette.muted, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>Submission Pack</div>
                <div style={{ marginTop: 5, fontSize: 24, fontWeight: 800 }}>Change to Contract Basis</div>
              </div>
              <span style={pill("green")}>Entitlement supported</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0,1fr)", gap: 18 }}>
              <div style={{ display: "grid", gap: 8 }}>
                {["Background", "Change to Contract Basis", "Defined Cost", "Programme", "Commercial Impact", "Conclusion"].map((item, index) => (
                  <div key={item} style={{ borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 700, background: index === 1 ? "#f0f8ff" : palette.soft, color: index === 1 ? palette.blueText : palette.muted }}>{item}</div>
                ))}
              </div>
              <div style={{ border: `1px solid ${palette.line}`, borderRadius: 20, padding: 22, background: "#ffffff", display: "grid", gap: 12 }}>
                <p style={{ margin: 0, color: palette.ink, lineHeight: 1.65 }}>
                  The original basis for the subcontract works involved a planned sequence supported by agreed access, labour and plant.
                </p>
                <p style={{ margin: 0, color: palette.muted, lineHeight: 1.65 }}>
                  The event changed that basis. The submission links the instruction, site records, cost build-up and contractual position into one recoverable pack.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <span style={pill("blue")}>NEC / JCT ready</span>
                  <span style={pill("orange")}>Defined Cost linked</span>
                  <span style={pill("pink")}>Pushback checked</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BuiltForSubcontractors() {
  return (
    <section id="about" style={{ background: palette.soft, borderBlock: `1px solid ${palette.line}` }}>
      <div style={wrap({ paddingTop: 86, paddingBottom: 86 })}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 34, alignItems: "center" }}>
          <div style={{ borderRadius: 30, background: "#ffffff", border: `1px solid ${palette.line}`, padding: 20, boxShadow: "0 18px 50px rgba(15,23,42,0.07)" }}>
            <div style={{ borderRadius: 22, minHeight: 320, background: "linear-gradient(135deg, #fff5ef, #f0f8ff 48%, #effcf6)", display: "grid", placeItems: "center", padding: 24 }}>
              <div style={{ maxWidth: 420, display: "grid", gap: 14 }}>
                {["Site records", "Notices", "Compensation events", "Variations", "Evidence", "Commercial recovery", "Payment"].map((item, index) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.72)", border: `1px solid ${palette.line}`, borderRadius: 16, padding: "11px 13px", fontWeight: 800 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 10, background: [palette.green, palette.orange, palette.blue, palette.lavender, palette.pink, palette.green, palette.orange][index] }} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gap: 20 }}>
            <div style={pill("lavender")}>Built for subcontractor commercial teams</div>
            <h2 style={sectionHeadline()}>Built around the reality of subcontractor commercial management.</h2>
            <p style={{ margin: 0, color: palette.muted, fontSize: 18, lineHeight: 1.75 }}>
              Commercial Co-Pilot is designed around site records, notices, compensation events, variations, evidence, commercial recovery and payment.
            </p>
            <div style={{ display: "grid", gap: 10, color: palette.ink, fontSize: 17, lineHeight: 1.6, fontWeight: 650 }}>
              <div>Not generic project management.</div>
              <div>Not generic writing software.</div>
              <div>Commercial management software built specifically for subcontractors.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section style={{ background: "#ffffff" }}>
      <div style={wrap({ paddingTop: 88, paddingBottom: 96 })}>
        <div style={{ borderRadius: 34, padding: "46px 32px", background: "linear-gradient(135deg, #f0f8ff, #fff5ef 48%, #effcf6)", border: `1px solid ${palette.line}`, textAlign: "center", display: "grid", gap: 18 }}>
          <h2 style={{ ...sectionHeadline({ margin: "0 auto" }), maxWidth: 760 }}>Stop losing recoverable money.</h2>
          <p style={{ margin: "0 auto", maxWidth: 650, color: palette.muted, fontSize: 20, lineHeight: 1.65 }}>
            Track notices. Build stronger submissions. Recover more.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
            <Button href="/contact" tone="dark">Watch 2 Minute Demo</Button>
            <Button href="/login" tone="light">Request Free Trial</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div style={{ maxWidth: 780, display: "grid", gap: 14 }}>
      <div style={pill("blue")}>{eyebrow}</div>
      <h2 style={sectionHeadline()}>{title}</h2>
      <p style={{ margin: 0, color: palette.muted, fontSize: 18, lineHeight: 1.7 }}>{text}</p>
    </div>
  );
}

function FeatureCard({ title, text, tone }: { title: string; text: string; tone: string }) {
  const colours = pastel[tone];
  return (
    <article style={{ border: `1px solid ${palette.line}`, borderRadius: 24, padding: 24, background: "#ffffff", minHeight: 214, boxShadow: "0 14px 34px rgba(15,23,42,0.04)", display: "grid", alignContent: "start", gap: 18 }}>
      <div style={{ width: 52, height: 52, borderRadius: 18, background: colours.bg, border: `1px solid ${colours.border}`, color: colours.text, display: "grid", placeItems: "center", fontWeight: 800 }}>{title.slice(0, 2)}</div>
      <div style={{ display: "grid", gap: 9 }}>
        <h3 style={{ margin: 0, fontSize: 20, lineHeight: 1.2, fontWeight: 800 }}>{title}</h3>
        <p style={{ margin: 0, color: palette.muted, fontSize: 15, lineHeight: 1.7 }}>{text}</p>
      </div>
    </article>
  );
}

function Button({ href, children, tone }: { href: string; children: ReactNode; tone: "dark" | "light" }) {
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
        background: tone === "dark" ? palette.ink : "#ffffff",
        color: tone === "dark" ? "#ffffff" : palette.ink,
        border: `1px solid ${tone === "dark" ? palette.ink : palette.line}`,
        boxShadow: tone === "dark" ? "0 12px 26px rgba(15,23,42,0.18)" : "0 10px 24px rgba(15,23,42,0.06)",
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
    fontWeight: 800,
  };
}

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
    fontSize: "clamp(34px, 4.2vw, 58px)",
    lineHeight: 1.04,
    letterSpacing: 0,
    fontWeight: 800,
    ...extra,
  };
}
