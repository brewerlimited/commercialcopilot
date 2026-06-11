import Link from "next/link";
import type { ReactNode, CSSProperties } from "react";

export const m = {
  bg: "var(--background)",
  card: "var(--surface)",
  border: "var(--border)",
  text: "var(--foreground)",
  sub: "var(--text-muted)",
  muted: "var(--text-soft)",
  soft: "var(--surface-soft)",
  black: "var(--text-strong)",
  contrast: "var(--accent-contrast)",
};

const shellWidth = 1240;

const baseButton: CSSProperties = {
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 50,
  padding: "0 18px",
  borderRadius: 16,
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: 0,
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
    fontWeight: 600,
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "var(--topbar-bg)",
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
                fontWeight: 800,
                color: m.black,
              }}
            >
              CC
            </div>
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 800, letterSpacing: 0, color: m.black }}>Commercial Co-Pilot</div>
              <div style={{ fontSize: 12, color: m.sub }}>EWN, CE and recovery control.</div>
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
    fontWeight: 600,
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
        <div style={{ color: m.sub, fontSize: 14 }}>Commercial Co-Pilot — EWN, CE and recovery control for subcontractors.</div>
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
  return <section style={{ maxWidth: shellWidth, margin: "0 auto", padding: "48px 24px 0" }}>{children}</section>;
}

export function SectionTitle({ title, text, align = "left" }: { title: string; text?: string; align?: "left" | "center" }) {
  return (
    <div style={{ display: "grid", gap: 10, marginBottom: 24, textAlign: align }}>
      <h1 style={{ fontSize: 30, lineHeight: 1.16, letterSpacing: 0, fontWeight: 700, margin: 0, color: m.black }}>{title}</h1>
      {text ? (
        <p
          style={{
            margin: align === "center" ? "0 auto" : 0,
            fontSize: 16,
            lineHeight: 1.55,
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
    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.02em", color: m.sub, textTransform: "uppercase" }}>{children}</div>
  );
}

export function Card({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div
      style={{
        background: m.card,
        border: `1px solid ${m.border}`,
        borderRadius: 22,
        padding: 22,
        display: "grid",
        gap: 14,
        minHeight: "100%",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 650, color: m.black }}>{title}</div>
      {text ? <div style={{ fontSize: 14, lineHeight: 1.6, color: m.sub }}>{text}</div> : null}
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
        borderRadius: 22,
        padding: 22,
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
        color: m.contrast,
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
    <div style={{ margin: 0, display: "grid", gap: 10, color: m.sub, fontSize: 14, lineHeight: 1.6 }}>
      {items.map((item) => (
        <div key={item} style={{ display: "grid", gridTemplateColumns: "12px minmax(0,1fr)", gap: 10, alignItems: "start" }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: m.black, marginTop: 10, opacity: 0.55 }} />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: m.soft,
        border: `1px solid ${m.border}`,
        borderRadius: 20,
        padding: 16,
        minHeight: 92,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 13, color: m.sub, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, lineHeight: 1.08, color: m.black, fontWeight: 800, letterSpacing: 0 }}>{value}</div>
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
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: m.black }}>{title}</h2>
      <div style={{ display: "grid", gap: 10, fontSize: 15, lineHeight: 1.7, color: m.sub }}>{children}</div>
    </section>
  );
}
