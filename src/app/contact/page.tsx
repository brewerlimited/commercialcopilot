import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/marketing";

export const metadata: Metadata = {
  title: "Book demo or activate trial credits",
  description: "Book a Commercial Co-Pilot demo or ask about trial credits for subcontractor commercial recovery workflows.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Book a Commercial Co-Pilot demo or activate trial credits",
    description: "See the EWN, CE / VO, cost build-up, submission pack and payment tracking workflow, or ask about trial credits.",
    url: "/contact",
  },
};

const palette = {
  ink: "#0f172a",
  muted: "#596579",
  soft: "#f6f8fb",
  line: "rgba(15, 23, 42, 0.09)",
  blueBg: "#f0f8ff",
  blueText: "#2563a8",
  greenBg: "#effcf6",
  greenText: "#137657",
  orangeBg: "#fff5ef",
  orangeText: "#b45309",
  lavenderBg: "#f3f6fa",
  lavenderText: "#334155",
};

const demoItems = [
  "Creating a CE and selecting the contract logic",
  "Building the Basis of Change clearly and quickly",
  "Adding evidence, labour, plant, material and prelim support",
  "Checking entitlement, valuation support and likely pushback",
  "Previewing the final submission pack and Excel cost output",
  "Tracking submitted, unpaid and overdue value",
];

const trialItems = [
  "Create an account straight away and explore the workspace",
  "Ask us to enable trial credits when you are ready to generate packs",
  "Confirm whether NEC, JCT or both best match your current work",
  "Agree the right next step for your subcontractor team",
];

const flow = ["EWN", "CE / VO", "Evidence", "Cost build-up", "Review", "Pack", "Payment"];

function wrap(style: CSSProperties = {}): CSSProperties {
  return { maxWidth: 1240, margin: "0 auto", padding: "0 24px", ...style };
}

function pill(tone: "blue" | "green" | "orange" | "lavender"): CSSProperties {
  const styles = {
    blue: { bg: palette.blueBg, color: palette.blueText, border: "#cfe8ff" },
    green: { bg: palette.greenBg, color: palette.greenText, border: "#c8f3df" },
    orange: { bg: palette.orangeBg, color: palette.orangeText, border: "#ffd8bf" },
    lavender: { bg: palette.lavenderBg, color: palette.lavenderText, border: "#d7dee8" },
  }[tone];

  return {
    width: "fit-content",
    borderRadius: 999,
    border: `1px solid ${styles.border}`,
    background: styles.bg,
    color: styles.color,
    padding: "8px 12px",
    fontSize: 12,
    lineHeight: 1.2,
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: "0.02em",
  };
}

function Button({ href, children, tone = "dark" }: { href: string; children: ReactNode; tone?: "dark" | "light" }) {
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
        fontWeight: 850,
        fontSize: 14,
        background: isDark ? palette.ink : "#ffffff",
        color: isDark ? "#ffffff" : palette.ink,
        border: `1px solid ${isDark ? palette.ink : palette.line}`,
        boxShadow: isDark ? "0 12px 26px rgba(15,23,42,0.18)" : "0 10px 24px rgba(15,23,42,0.06)",
      }}
    >
      {children}
    </Link>
  );
}

function CheckList({ items, tone = "green" }: { items: string[]; tone?: "green" | "blue" | "orange" }) {
  const colour = tone === "blue" ? palette.blueText : tone === "orange" ? palette.orangeText : palette.greenText;
  const bg = tone === "blue" ? palette.blueBg : tone === "orange" ? palette.orangeBg : palette.greenBg;
  const border = tone === "blue" ? "#cfe8ff" : tone === "orange" ? "#ffd8bf" : "#c8f3df";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item) => (
        <div key={item} style={{ display: "grid", gridTemplateColumns: "24px minmax(0,1fr)", gap: 12, alignItems: "start", color: palette.ink, fontSize: 15, lineHeight: 1.55, fontWeight: 700 }}>
          <span aria-hidden style={{ width: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", background: bg, border: `1px solid ${border}`, color: colour, fontSize: 14, fontWeight: 900 }}>✓</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({ children, accent = "blue" }: { children: ReactNode; accent?: "blue" | "green" | "orange" }) {
  const border = accent === "green" ? "#c8f3df" : accent === "orange" ? "#ffd8bf" : "#cfe8ff";

  return (
    <article
      className="home-hover-card"
      style={{
        border: `1px solid ${border}`,
        borderRadius: 28,
        background: "#ffffff",
        padding: 28,
        boxShadow: "0 18px 50px rgba(15,23,42,0.06)",
        display: "grid",
        gap: 18,
        minHeight: "100%",
      }}
    >
      {children}
    </article>
  );
}

export default function ContactPage() {
  const mailto = "mailto:hello@commercialcopilot.co.uk?subject=Commercial%20Co-Pilot%20demo%20or%20trial%20credits";

  return (
    <SiteShell>
      <main style={{ background: "#ffffff", color: palette.ink }}>
        <section
          className="home-hero-section"
          style={{
            borderBottom: `1px solid ${palette.line}`,
            background: [
              "radial-gradient(circle at 14% 18%, rgba(158,230,198,0.32), transparent 30%)",
              "radial-gradient(circle at 76% 12%, rgba(185,221,255,0.42), transparent 34%)",
              "radial-gradient(circle at 88% 72%, rgba(255,179,138,0.22), transparent 30%)",
              "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)",
            ].join(", "),
          }}
        >
          <div style={wrap({ paddingTop: 82, paddingBottom: 68 })}>
            <div className="marketing-contact-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.95fr) minmax(360px, 0.55fr)", gap: 42, alignItems: "center" }}>
              <div style={{ display: "grid", gap: 22, minWidth: 0 }}>
                <div style={pill("orange")}>Demo or trial credits</div>
                <h1 style={{ margin: 0, maxWidth: 840, fontSize: "clamp(40px, 5vw, 72px)", lineHeight: 1, letterSpacing: 0, fontWeight: 900 }}>
                  See the workflow. Then decide if it fits your commercial team.
                </h1>
                <p style={{ margin: 0, maxWidth: 760, color: palette.muted, fontSize: 20, lineHeight: 1.65, fontWeight: 600 }}>
                  Create an account whenever you want to look around. Use this page to book the two minute demo, ask about trial credits, or check whether Commercial Co-Pilot is right for your subcontractor workflow.
                </p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Button href={mailto}>Email to book demo / credits</Button>
                  <Button href="/login" tone="light">Create Account</Button>
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
                <div style={pill("green")}>What to include</div>
                <div style={{ display: "grid", gap: 14 }}>
                  {[
                    ["Company", "Your company name and role"],
                    ["Contracts", "NEC, JCT or both"],
                    ["Use case", "Demo, trial credits or pricing discussion"],
                    ["Volume", "Typical EWNs, CEs / VOs or live projects"],
                  ].map(([label, text]) => (
                    <div key={label} style={{ border: `1px solid ${palette.line}`, borderRadius: 16, background: palette.soft, padding: "13px 14px" }}>
                      <div style={{ color: palette.muted, fontSize: 12, fontWeight: 850, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
                      <div style={{ marginTop: 4, color: palette.ink, fontSize: 16, lineHeight: 1.35, fontWeight: 850 }}>{text}</div>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section style={wrap({ paddingTop: 70, paddingBottom: 24 })}>
          <div className="marketing-contact-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)", gap: 22, alignItems: "stretch" }}>
            <Panel accent="blue">
              <div style={pill("blue")}>What the demo covers</div>
              <h2 style={{ margin: 0, fontSize: "clamp(28px, 3vw, 44px)", lineHeight: 1.06, fontWeight: 900 }}>
                A practical look at the full recovery process.
              </h2>
              <p style={{ margin: 0, color: palette.muted, fontSize: 17, lineHeight: 1.7 }}>
                From first notice through to payment follow-up, the walkthrough shows how the records, cost support and commercial position stay connected.
              </p>
              <CheckList items={demoItems} tone="blue" />
            </Panel>

            <Panel accent="green">
              <div style={pill("green")}>Account and credits</div>
              <h2 style={{ margin: 0, fontSize: "clamp(28px, 3vw, 44px)", lineHeight: 1.06, fontWeight: 900 }}>
                You can create an account now. Credits unlock the fuller workflow.
              </h2>
              <p style={{ margin: 0, color: palette.muted, fontSize: 17, lineHeight: 1.7 }}>
                The app is accessible once you create an account. Trial credits are what let you test the higher-value pack generation and recovery workflow properly.
              </p>
              <CheckList items={trialItems} tone="green" />
            </Panel>
          </div>
        </section>

        <section style={wrap({ paddingTop: 28, paddingBottom: 82 })}>
          <div
            className="home-hover-card"
            style={{
              borderRadius: 30,
              border: `1px solid ${palette.line}`,
              background: "linear-gradient(135deg, #f0f8ff, #fff5ef 48%, #effcf6)",
              padding: "34px 28px",
              display: "grid",
              gap: 24,
              boxShadow: "0 18px 50px rgba(15,23,42,0.07)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={pill("lavender")}>Workflow covered</div>
                <h2 style={{ margin: 0, fontSize: "clamp(28px, 3.2vw, 48px)", lineHeight: 1.05, fontWeight: 900 }}>
                  One conversation around the whole commercial chain.
                </h2>
              </div>
              <Button href={mailto}>Contact to arrange credits</Button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
              {flow.map((item, index) => (
                <div key={item} className="home-widget" style={{ border: `1px solid ${palette.line}`, borderRadius: 18, background: "#ffffff", padding: 16, minHeight: 104 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 12, background: [palette.greenBg, palette.blueBg, palette.orangeBg, palette.lavenderBg][index % 4], display: "grid", placeItems: "center", color: palette.ink, fontSize: 13, fontWeight: 900 }}>
                    {index + 1}
                  </div>
                  <div style={{ marginTop: 14, color: palette.ink, fontSize: 15, lineHeight: 1.3, fontWeight: 850 }}>{item}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
