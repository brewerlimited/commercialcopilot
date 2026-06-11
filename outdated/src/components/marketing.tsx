import Link from "next/link";
import type { ReactNode, CSSProperties } from "react";

export const m = {
  bg: "#f6f7fb",
  card: "#ffffff",
  border: "#e5e7eb",
  text: "#111827",
  sub: "#475569",
  muted: "#64748b",
  soft: "#f8fafc",
  black: "#0f172a",
};

const shellWidth = 1200;

const baseButton: CSSProperties = {
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  padding: "0 18px",
  borderRadius: 14,
  fontWeight: 800,
  fontSize: 14,
  letterSpacing: -0.1,
  whiteSpace: "nowrap",
};

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: m.bg, color: m.text }}>
      <TopBar />
      {children}
      <SiteFooter />
    </main>
  );
}

export function TopBar() {
  const linkStyle: CSSProperties = {
    textDecoration: "none",
    color: m.sub,
    fontSize: 14,
    fontWeight: 700,
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "rgba(246,247,251,0.92)",
        backdropFilter: "blur(10px)",
        borderBottom: `1px solid ${m.border}`,
      }}
    >
      <div
        style={{
          maxWidth: shellWidth,
          margin: "0 auto",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ textDecoration: "none", color: m.text }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              aria-hidden
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                border: `1px solid ${m.border}`,
                background: m.card,
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                color: m.black,
              }}
            >
              CC
            </div>
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 900, letterSpacing: -0.2, color: m.black }}>Commercial Co-Pilot</div>
              <div style={{ fontSize: 12, color: m.sub }}>Clause-ready drafting. Deterministic costing.</div>
            </div>
          </div>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <nav style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Link href="/pricing" style={linkStyle}>Pricing</Link>
            <Link href="/terms" style={linkStyle}>Terms</Link>
            <Link href="/privacy" style={linkStyle}>Privacy</Link>
            <Link href="/disclaimer" style={linkStyle}>Disclaimer</Link>
            <Link href="/contact" style={linkStyle}>Contact</Link>
          </nav>
          <Link
            href="/login"
            style={{
              ...baseButton,
              border: `1px solid ${m.border}`,
              background: m.card,
              color: m.black,
            }}
          >
            Login
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const linkStyle: CSSProperties = {
    textDecoration: "none",
    color: m.sub,
    fontWeight: 700,
    fontSize: 14,
  };

  return (
    <footer style={{ borderTop: `1px solid ${m.border}`, marginTop: 80 }}>
      <div
        style={{
          maxWidth: shellWidth,
          margin: "0 auto",
          padding: "24px 20px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ color: m.sub, fontSize: 14 }}>Commercial Co-Pilot — structured commercial drafting for subcontractors.</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link href="/pricing" style={linkStyle}>Pricing</Link>
          <Link href="/terms" style={linkStyle}>Terms</Link>
          <Link href="/privacy" style={linkStyle}>Privacy</Link>
          <Link href="/disclaimer" style={linkStyle}>Disclaimer</Link>
          <Link href="/contact" style={linkStyle}>Contact</Link>
        </div>
      </div>
    </footer>
  );
}

export function PageWrap({ children }: { children: ReactNode }) {
  return <section style={{ maxWidth: shellWidth, margin: "0 auto", padding: "56px 20px 0" }}>{children}</section>;
}

export function SectionTitle({ title, text, align = "left" }: { title: string; text?: string; align?: "left" | "center" }) {
  return (
    <div style={{ display: "grid", gap: 10, marginBottom: 24, textAlign: align }}>
      <h1 style={{ fontSize: 42, lineHeight: 1.04, letterSpacing: -1.2, fontWeight: 900, margin: 0, color: m.black }}>{title}</h1>
      {text ? (
        <p
          style={{
            margin: align === "center" ? "0 auto" : 0,
            fontSize: 18,
            lineHeight: 1.6,
            color: m.sub,
            maxWidth: 760,
          }}
        >
          {text}
        </p>
      ) : null}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.2, color: m.sub, textTransform: "uppercase" }}>{children}</div>
  );
}

export function Card({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div
      style={{
        background: m.card,
        border: `1px solid ${m.border}`,
        borderRadius: 22,
        padding: 24,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 800, color: m.black }}>{title}</div>
      {text ? <div style={{ fontSize: 15, lineHeight: 1.65, color: m.sub }}>{text}</div> : null}
      {children}
    </div>
  );
}

export function MutedCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: m.soft,
        border: `1px solid ${m.border}`,
        borderRadius: 20,
        padding: 20,
      }}
    >
      {children}
    </div>
  );
}

export function PrimaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        ...baseButton,
        background: m.black,
        color: "#fff",
        border: `1px solid ${m.black}`,
      }}
    >
      {children}
    </Link>
  );
}

export function SecondaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        ...baseButton,
        border: `1px solid ${m.border}`,
        background: m.card,
        color: m.black,
      }}
    >
      {children}
    </Link>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 10, color: m.sub, fontSize: 15, lineHeight: 1.6 }}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: m.soft,
        border: `1px solid ${m.border}`,
        borderRadius: 18,
        padding: 18,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 13, color: m.sub, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 28, lineHeight: 1, color: m.black, fontWeight: 900, letterSpacing: -0.8 }}>{value}</div>
    </div>
  );
}

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <SiteShell>
      <PageWrap>
        <SectionTitle title={title} text={intro} />
        <div
          style={{
            background: m.card,
            border: `1px solid ${m.border}`,
            borderRadius: 24,
            padding: 28,
            display: "grid",
            gap: 24,
            maxWidth: 920,
          }}
        >
          {children}
        </div>
      </PageWrap>
    </SiteShell>
  );
}

export function LegalBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: m.black }}>{title}</h2>
      <div style={{ display: "grid", gap: 10, fontSize: 15, lineHeight: 1.7, color: m.sub }}>{children}</div>
    </section>
  );
}
