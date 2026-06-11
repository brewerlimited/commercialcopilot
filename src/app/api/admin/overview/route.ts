import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkAdminWithServiceRole, normalizeEmail } from "@/lib/adminAccess";

export const dynamic = "force-dynamic";

type EventSummary = { final_total?: number | null };
type AdminEventRow = { user_id: string | null; created_at: string | null; event_financial_summary: unknown };
type AdminPackRow = { user_id: string | null; created_at: string | null; total_value: number | null };
type AdminCreditRow = { user_id: string | null; credits_remaining: number | null };
type AdminBillingRow = { user_id: string | null; amount: number | null; status: string | null; created_at: string | null };

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

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase public env vars are not configured");

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error) throw error;
  return data.user || null;
}

async function isAdminEmail(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const admin = supabaseAdmin();
  return checkAdminWithServiceRole(admin, normalized);
}

async function listAllUsers() {
  const admin = supabaseAdmin();
  const perPage = 200;
  let page = 1;
  const users: any[] = [];
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await isAdminEmail(user.email);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = supabaseAdmin();
    const [users, eventsRes, packsRes, creditsRes, billingRes, feedbackRes] = await Promise.all([
      listAllUsers(),
      admin.from("events").select("user_id,created_at,event_financial_summary"),
      admin.from("event_packs").select("user_id,created_at,total_value"),
      admin.from("user_credits").select("user_id,credits_remaining"),
      admin.from("billing_transactions").select("user_id,amount,status,created_at").neq("status", "void"),
      admin.from("feedback").select("id,user_id,user_email,page_url,feedback_type,message,status,created_at").order("created_at", { ascending: false }).limit(50),
    ]);

    if (eventsRes.error && !/relation .*events.* does not exist/i.test(eventsRes.error.message)) throw eventsRes.error;
    if (packsRes.error && !/relation .*event_packs.* does not exist/i.test(packsRes.error.message)) throw packsRes.error;
    if (creditsRes.error && !/relation .*user_credits.* does not exist/i.test(creditsRes.error.message)) throw creditsRes.error;
    if (billingRes.error && !/relation .*billing_transactions.* does not exist/i.test(billingRes.error.message)) throw billingRes.error;
    if (feedbackRes.error && !/relation .*feedback.* does not exist/i.test(feedbackRes.error.message)) throw feedbackRes.error;

    const events = (eventsRes.data ?? []) as AdminEventRow[];
    const packs = (packsRes.data ?? []) as AdminPackRow[];
    const credits = (creditsRes.data ?? []) as AdminCreditRow[];
    const billing = (billingRes.data ?? []) as AdminBillingRow[];
    const feedback = (feedbackRes.data ?? []) as FeedbackRow[];

    const rows = users.map((u: any) => {
      const userId = u.id;
      const userEvents = events.filter((e) => e.user_id === userId);
      const userPacks = packs.filter((p) => p.user_id === userId);
      const creditRow = credits.find((c) => c.user_id === userId);
      const paidBilling = billing.filter((b) => b.user_id === userId && b.status === "paid");

      const totalCeValue = userEvents.reduce((sum: number, e) => {
        const summary = (e.event_financial_summary || {}) as EventSummary;
        return sum + (typeof summary.final_total === "number" ? summary.final_total : 0);
      }, 0);

      const revenue = paidBilling.reduce((sum: number, t) => sum + Number(t.amount || 0), 0);
      const lastActivity = [
        ...userEvents.map((e) => e.created_at).filter(Boolean),
        ...userPacks.map((p) => p.created_at).filter(Boolean),
        ...paidBilling.map((b) => b.created_at).filter(Boolean),
      ].sort().at(-1) ?? null;

      const metadata = u.user_metadata || {};
      const appMeta = u.app_metadata || {};
      const fullName = metadata.full_name || metadata.name || metadata.fullName || u.email || "Unknown user";
      const company = metadata.company || metadata.company_name || metadata.organisation || null;
      const subscription = appMeta.plan || metadata.plan || metadata.subscription_plan || "—";

      return {
        id: userId,
        name: fullName,
        email: u.email,
        company,
        subscription,
        ceCount: userEvents.length,
        creditsUsed: userPacks.length,
        creditsRemaining: Number(creditRow?.credits_remaining || 0),
        totalCeValue,
        revenue,
        lastActivity,
      };
    });

    const totals = {
      users: rows.length,
      ceCount: rows.reduce((sum, row) => sum + row.ceCount, 0),
      creditsUsed: rows.reduce((sum, row) => sum + row.creditsUsed, 0),
      ceValue: rows.reduce((sum, row) => sum + row.totalCeValue, 0),
      revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    };

    return NextResponse.json({ rows, totals, feedback });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load admin overview" }, { status: 500 });
  }
}
