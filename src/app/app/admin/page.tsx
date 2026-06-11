"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";
import { checkAdminWithClient } from "@/lib/adminAccess";

type AdminRow = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  subscription: string;
  ceCount: number;
  creditsUsed: number;
  creditsRemaining: number;
  totalCeValue: number;
  revenue: number;
  lastActivity: string | null;
};

type FeedbackRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  page_url: string | null;
  feedback_type: string;
  message: string;
  status: string;
  created_at: string;
};

type AdminPayload = {
  rows: AdminRow[];
  feedback: FeedbackRow[];
  totals: {
    users: number;
    ceCount: number;
    creditsUsed: number;
    ceValue: number;
    revenue: number;
  };
};

const c = {
  card: "var(--surface)",
  input: "var(--surface-input)",
  border: "var(--border)",
  text: "var(--foreground)",
  sub: "var(--text-muted)",
  soft: "var(--surface-soft)",
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
  redText: "var(--red-text)",
  greenText: "var(--green-text)",
};

function money(v: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(v) ? v : 0);
}

function niceDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: 20,
        padding: 18,
        display: "grid",
        gap: 8,
        minHeight: 118,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: c.sub }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 0, color: c.black }}>{value}</div>
      {hint ? <div style={{ fontSize: 12, lineHeight: 1.5, color: c.sub }}>{hint}</div> : null}
    </div>
  );
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [seedEmail, setSeedEmail] = useState("");
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [payload, setPayload] = useState<AdminPayload>({
    rows: [],
    feedback: [],
    totals: { users: 0, ceCount: 0, creditsUsed: 0, ceValue: 0, revenue: 0 },
  });

  useEffect(() => {
    (async () => {
      try {
        const supabase = supabaseBrowser();
        let user;
        try {
          user = await getRequiredUser(supabase);
        } catch (e: any) {
          if (isAuthErrorMessage(e?.message)) {
            window.location.href = "/login";
            return;
          }
          throw e;
        }

        const email = user.email || "";
        const allowed = await checkAdminWithClient(supabase, email);

        if (!allowed) {
          setForbidden(true);
          setLoading(false);
          return;
        }

        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        const res = await fetch("/api/admin/overview", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load admin overview");
        setPayload(json);
      } catch (e: any) {
        setError(e?.message || "Failed to load admin dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payload.rows;
    return payload.rows.filter((row) =>
      [row.name, row.email, row.company || "", row.subscription || ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [payload.rows, query]);


  async function seedDemoData() {
    try {
      setSeeding(true);
      setSeedStatus(null);
      const supabase = supabaseBrowser();
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      const res = await fetch("/api/admin/seed-demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ targetEmail: seedEmail.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to seed demo data");
      const fallbackNote = Number(json.resourceUnitFallbackRows || 0) > 0
        ? ` ${json.resourceUnitFallbackRows} resource unit(s) were auto-normalised to satisfy the live database unit constraint.`
        : "";
      setSeedStatus(`Seeded ${json.eventsCreated} CEs/variations, ${json.ewnsCreated} EWNs, ${json.resourceLinesCreated || 0}/${json.resourceLinesAttempted || 0} resource lines, ${json.prelimLinesCreated || 0}/${json.prelimLinesAttempted || 0} prelim lines and ${json.evidenceRowsCreated || 0} evidence notes for ${json.targetEmail}. Total demo value: ${money(Number(json.totalSeededValue || 0))}.${fallbackNote}`);
    } catch (e: any) {
      setSeedStatus(e?.message || "Failed to seed demo data");
    } finally {
      setSeeding(false);
    }
  }


  if (loading) {
    return <div style={{ padding: 24, color: c.sub }}>Loading admin dashboard…</div>;
  }

  if (forbidden) {
    return (
      <div style={{ maxWidth: 820, display: "grid", gap: 18 }}>
        <section style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 24, display: "grid", gap: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 0, color: c.black }}>Admin dashboard</div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: c.sub, maxWidth: 620 }}>
            Your account is not currently listed as an admin user. Add your login email to the <strong>admin_users</strong> table and then refresh this page.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1280 }}>
      <section style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 24, display: "grid", gap: 8 }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 0, color: c.black }}>Admin dashboard</div>
        <div style={{ fontSize: 13, lineHeight: 1.65, color: c.sub, maxWidth: 780 }}>
          Internal view of users, CE activity, credits usage and customer value across Commercial Co-Pilot.
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 14 }}>
        <StatCard label="Users" value={String(payload.totals.users)} hint="All registered accounts" />
        <StatCard label="CEs created" value={String(payload.totals.ceCount)} hint="Total events in the system" />
        <StatCard label="Credits used" value={String(payload.totals.creditsUsed)} hint="Generated pack count" />
        <StatCard label="Total CE value" value={money(payload.totals.ceValue)} hint="Sum of final CE values" />
        <StatCard label="Revenue" value={money(payload.totals.revenue)} hint="Paid subscriptions and credit purchases" />
      </section>

      <section style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 20, display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: c.black }}>Demo data seed</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub }}>Create or reset the fabricated NEC/JCT demo projects for a tester account. Leave blank to seed your own account.</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={seedEmail}
            onChange={(e) => setSeedEmail(e.target.value)}
            placeholder="tester@email.com"
            style={{ width: 320, maxWidth: "100%", height: 42, borderRadius: 14, border: `1px solid ${c.border}`, background: c.soft, padding: "0 14px", fontSize: 14, color: c.text, outline: "none" }}
          />
          <button
            type="button"
            onClick={seedDemoData}
            disabled={seeding}
            style={{ height: 42, borderRadius: 14, border: `1px solid ${seeding ? c.border : c.black}`, background: seeding ? c.soft : c.black, color: seeding ? c.sub : c.blackContrast, padding: "0 16px", fontWeight: 700, cursor: seeding ? "not-allowed" : "pointer" }}
          >
            {seeding ? "Seeding…" : "Seed demo data"}
          </button>
        </div>
        {seedStatus ? <div style={{ fontSize: 13, lineHeight: 1.55, color: seedStatus.toLowerCase().includes("failed") || seedStatus.toLowerCase().includes("no supabase") ? c.redText : c.greenText }}>{seedStatus}</div> : null}
      </section>

      <section style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 20, display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: c.black }}>Feedback</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub }}>Latest tester feedback submitted through the in-app feedback button.</div>
        </div>

        <div style={{ overflowX: "auto", border: `1px solid ${c.border}`, borderRadius: 18 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
            <thead>
              <tr style={{ background: c.soft }}>
                {["Date", "User", "Type", "Message", "Page", "Status"].map((label) => (
                  <th key={label} style={{ textAlign: "left", padding: "14px 16px", fontSize: 12, color: c.sub, fontWeight: 700, borderBottom: `1px solid ${c.border}` }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payload.feedback.map((item) => (
                <tr key={item.id}>
                  <td style={{ padding: "15px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.text, whiteSpace: "nowrap" }}>{niceDate(item.created_at)}</td>
                  <td style={{ padding: "15px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.text }}>{item.user_email || "—"}</td>
                  <td style={{ padding: "15px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.text, whiteSpace: "nowrap" }}>{item.feedback_type}</td>
                  <td style={{ padding: "15px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 13, lineHeight: 1.55, color: c.text, minWidth: 280 }}>{item.message}</td>
                  <td style={{ padding: "15px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 12, color: c.sub, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.page_url || "—"}</td>
                  <td style={{ padding: "15px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 12, color: c.black, whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", border: `1px solid ${c.border}`, background: c.soft, borderRadius: 999, padding: "5px 9px", fontWeight: 700 }}>{item.status || "New"}</span>
                  </td>
                </tr>
              ))}
              {payload.feedback.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: "center", color: c.sub, fontSize: 13 }}>No feedback has been submitted yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 20, display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: c.black }}>Users</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub }}>Track activity, usage and value per customer.</div>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email or company"
            style={{
              width: 320,
              maxWidth: "100%",
              height: 42,
              borderRadius: 14,
              border: `1px solid ${c.border}`,
              background: c.soft,
              padding: "0 14px",
              fontSize: 14,
              color: c.text,
              outline: "none",
            }}
          />
        </div>

        {error ? <div style={{ fontSize: 13, color: c.redText }}>{error}</div> : null}

        <div style={{ overflowX: "auto", border: `1px solid ${c.border}`, borderRadius: 18 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
            <thead>
              <tr style={{ background: c.soft }}>
                {[
                  "User",
                  "Company",
                  "Plan",
                  "CEs",
                  "Credits used",
                  "Credits left",
                  "Total CE value",
                  "Revenue",
                  "Last active",
                ].map((label) => (
                  <th key={label} style={{ textAlign: "left", padding: "14px 16px", fontSize: 12, color: c.sub, fontWeight: 700, borderBottom: `1px solid ${c.border}` }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: "15px 16px", borderBottom: `1px solid ${c.border}` }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: c.black }}>{row.name}</div>
                      <div style={{ fontSize: 12, color: c.sub }}>{row.email}</div>
                    </div>
                  </td>
                  <td style={{ padding: "15px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.text }}>{row.company || "—"}</td>
                  <td style={{ padding: "15px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.text }}>{row.subscription || "—"}</td>
                  <td style={{ padding: "15px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.text }}>{row.ceCount}</td>
                  <td style={{ padding: "15px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.text }}>{row.creditsUsed}</td>
                  <td style={{ padding: "15px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.text }}>{row.creditsRemaining}</td>
                  <td style={{ padding: "15px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 13, fontWeight: 700, color: c.black }}>{money(row.totalCeValue)}</td>
                  <td style={{ padding: "15px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 13, fontWeight: 700, color: c.black }}>{money(row.revenue)}</td>
                  <td style={{ padding: "15px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.text }}>{niceDate(row.lastActivity)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 24, textAlign: "center", color: c.sub, fontSize: 13 }}>No users found for the current search.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
