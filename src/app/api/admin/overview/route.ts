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

type AccessRequestRow = {
  id: string;
  early_access_request_email: string | null;
  early_access_requested_at: string | null;
  early_access_request_note: string | null;
  early_access_request_status: string | null;
  account_status: string | null;
  source: "request" | "signup";
};

type ProfileAccessRow = {
  id: string;
  account_status: string | null;
  subscription_status: string | null;
  is_admin_unlimited: boolean | null;
  early_access_request_email: string | null;
  early_access_requested_at: string | null;
  early_access_request_note: string | null;
  early_access_request_status: string | null;
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

type AnalyticsEventRow = {
  event_name: string;
  page_path: string | null;
  user_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type AnalyticsSessionRow = {
  user_id: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  landing_page: string | null;
  device: string | null;
  country: string | null;
  started_at: string;
};

type AnalyticsPageviewRow = {
  page_path: string | null;
  user_id: string | null;
  created_at: string;
};

type AiGenerationRunRow = {
  generation_type: string | null;
  status: string | null;
  duration_ms: number | null;
  estimated_cost_gbp: number | null;
  created_at: string;
};

type AdminErrorEventRow = {
  route: string | null;
  event_name: string | null;
  error_type: string | null;
  sanitized_message: string | null;
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
  const admin = supabaseAdmin() as any;
  return checkAdminWithServiceRole(admin, normalized);
}

async function listAllUsers() {
  const admin = supabaseAdmin() as any;
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

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function isRecoverableAnalyticsError(error: any) {
  const message = String(error?.message || error?.details || error?.hint || "").toLowerCase();
  const code = String(error?.code || "").toUpperCase();
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("does not exist") ||
    message.includes("could not find") ||
    message.includes("schema cache")
  );
}

async function optionalAnalyticsQuery<T>(
  label: string,
  query: PromiseLike<{ data: T | null; count?: number | null; error: any }>,
  fallbackData: T
) {
  const res = await query;
  if (!res.error) return { ...res, skipped: false as const, warning: null as string | null };
  if (!isRecoverableAnalyticsError(res.error)) throw res.error;
  return {
    data: fallbackData,
    count: 0,
    error: null,
    skipped: true as const,
    warning: `${label}: ${res.error.message || "analytics source unavailable"}`,
  };
}

function countBy<T>(rows: T[], getKey: (row: T) => string | null | undefined, fallback = "Unknown") {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = (getKey(row) || fallback).trim() || fallback;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function uniqueCount(values: Array<string | null | undefined>) {
  return new Set(values.filter(Boolean)).size;
}

function sourceLabel(row: AnalyticsSessionRow) {
  if (row.utm_source) return row.utm_source;
  const ref = row.referrer || "";
  if (!ref) return "Direct";
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "");
    if (host.includes("linkedin")) return "LinkedIn";
    if (host.includes("google")) return "Google";
    if (host.includes("bing")) return "Bing";
    return host;
  } catch {
    return "Referral";
  }
}

async function loadAnalytics(admin: any) {
  const since30 = daysAgo(30);
  const since7 = daysAgo(7);
  const today = new Date().toISOString().slice(0, 10);

  const [eventsRes, sessionsRes, pageviewsRes, visitorsTodayRes, visitorsMonthRes, aiRunsRes, errorsRes] = await Promise.all([
    optionalAnalyticsQuery<AnalyticsEventRow[]>(
      "analytics_events",
      (admin as any).from("analytics_events").select("event_name,page_path,user_id,created_at,metadata").gte("created_at", since30).order("created_at", { ascending: false }).limit(1500),
      []
    ),
    optionalAnalyticsQuery<AnalyticsSessionRow[]>(
      "analytics_sessions",
      (admin as any).from("analytics_sessions").select("user_id,utm_source,utm_campaign,referrer,landing_page,device,country,started_at").gte("started_at", since30).order("started_at", { ascending: false }).limit(1500),
      []
    ),
    optionalAnalyticsQuery<AnalyticsPageviewRow[]>(
      "analytics_pageviews",
      (admin as any).from("analytics_pageviews").select("page_path,user_id,created_at").gte("created_at", since30).order("created_at", { ascending: false }).limit(1500),
      []
    ),
    optionalAnalyticsQuery<null>(
      "analytics_visitors_today",
      (admin as any).from("analytics_visitors").select("id", { count: "exact", head: true }).gte("last_seen_at", `${today}T00:00:00.000Z`),
      null
    ),
    optionalAnalyticsQuery<null>(
      "analytics_visitors_month",
      (admin as any).from("analytics_visitors").select("id", { count: "exact", head: true }).gte("last_seen_at", since30),
      null
    ),
    optionalAnalyticsQuery<AiGenerationRunRow[]>(
      "ai_generation_runs",
      (admin as any).from("ai_generation_runs").select("generation_type,status,duration_ms,estimated_cost_gbp,created_at").gte("created_at", since30).order("created_at", { ascending: false }).limit(500),
      []
    ),
    optionalAnalyticsQuery<AdminErrorEventRow[]>(
      "admin_error_events",
      (admin as any).from("admin_error_events").select("route,event_name,error_type,sanitized_message,created_at").gte("created_at", since7).order("created_at", { ascending: false }).limit(50),
      []
    ),
  ]);

  const results = [eventsRes, sessionsRes, pageviewsRes, visitorsTodayRes, visitorsMonthRes, aiRunsRes, errorsRes];
  const analyticsWarnings = results.map((res) => res.warning).filter(Boolean);
  if (eventsRes.skipped && sessionsRes.skipped && pageviewsRes.skipped && visitorsTodayRes.skipped && visitorsMonthRes.skipped) {
    return { available: false, reason: "Analytics SQL has not been run yet." };
  }

  const events = (eventsRes.data ?? []) as AnalyticsEventRow[];
  const sessions = (sessionsRes.data ?? []) as AnalyticsSessionRow[];
  const pageviews = (pageviewsRes.data ?? []) as AnalyticsPageviewRow[];
  const aiRuns = (aiRunsRes.data ?? []) as AiGenerationRunRow[];
  const errors = (errorsRes.data ?? []) as AdminErrorEventRow[];

  const eventCounts = countBy(events, (row) => row.event_name);
  const eventCount = (name: string) => events.filter((row) => row.event_name === name).length;
  const usersWithPack = uniqueCount(events.filter((row) => row.event_name === "pack_generation_completed").map((row) => row.user_id));
  const usersWithCe = uniqueCount(events.filter((row) => row.event_name === "ce_created").map((row) => row.user_id));
  const usersWithProject = uniqueCount(events.filter((row) => row.event_name === "project_created").map((row) => row.user_id));
  const successfulRuns = aiRuns.filter((row) => row.status === "success").length;
  const failedRuns = aiRuns.filter((row) => row.status === "failed").length;
  const durationRows = aiRuns.filter((row) => typeof row.duration_ms === "number");
  const avgDurationMs = durationRows.length
    ? Math.round(durationRows.reduce((sum, row) => sum + Number(row.duration_ms || 0), 0) / durationRows.length)
    : 0;
  const estimatedCostGbp = aiRuns.reduce((sum, row) => sum + Number(row.estimated_cost_gbp || 0), 0);

  return {
    available: true,
    warnings: analyticsWarnings,
    headline: {
      visitorsToday: visitorsTodayRes.count || 0,
      visitors30Days: visitorsMonthRes.count || 0,
      sessions30Days: sessions.length,
      pageviews30Days: pageviews.length,
      demoClicks: eventCount("demo_clicked"),
      pricingViews: pageviews.filter((row) => row.page_path?.startsWith("/pricing")).length,
      trialStarts: eventCount("trial_started"),
      signupCompleted: eventCount("signup_completed"),
      activatedTrials: usersWithPack,
    },
    funnel: [
      { label: "Visitors", value: visitorsMonthRes.count || 0 },
      { label: "Demo clicks", value: eventCount("demo_clicked") },
      { label: "Pricing views", value: pageviews.filter((row) => row.page_path?.startsWith("/pricing")).length },
      { label: "Trial starts", value: eventCount("trial_started") },
      { label: "Projects created", value: eventCount("project_created") },
      { label: "CEs created", value: eventCount("ce_created") },
      { label: "Packs generated", value: eventCount("pack_generation_completed") },
    ],
    acquisition: {
      sources: countBy(sessions, sourceLabel),
      campaigns: countBy(sessions, (row) => row.utm_campaign, "No campaign"),
      devices: countBy(sessions, (row) => row.device),
      countries: countBy(sessions, (row) => row.country, "Unknown country"),
    },
    pages: countBy(pageviews, (row) => row.page_path),
    featureAdoption: {
      projectCreatedUsers: usersWithProject,
      ceCreatedUsers: usersWithCe,
      ewnCreated: eventCount("ewn_created"),
      evidenceUploaded: eventCount("evidence_uploaded"),
      packGenerated: eventCount("pack_generation_completed"),
      packDownloaded: eventCount("pack_downloaded"),
      rebuttalGenerated: eventCount("rebuttal_generated"),
      paymentStatusUpdated: eventCount("payment_status_updated"),
    },
    ai: {
      totalRuns: aiRuns.length,
      successfulRuns,
      failedRuns,
      avgDurationMs,
      estimatedCostGbp,
      byType: countBy(aiRuns, (row) => row.generation_type),
    },
    reliability: {
      errors,
      byType: countBy(errors, (row) => row.error_type || row.event_name || row.route),
    },
    eventCounts,
  };
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

    const admin = supabaseAdmin() as any;
    const [users, eventsRes, packsRes, creditsRes, billingRes, feedbackRes, profilesRes] = await Promise.all([
      listAllUsers(),
      (admin as any).from("events").select("user_id,created_at,event_financial_summary"),
      (admin as any).from("event_packs").select("user_id,created_at,total_value"),
      (admin as any).from("user_credits").select("user_id,credits_remaining"),
      (admin as any).from("billing_transactions").select("user_id,amount,status,created_at").neq("status", "void"),
      (admin as any).from("feedback").select("id,user_id,user_email,page_url,feedback_type,message,status,created_at").order("created_at", { ascending: false }).limit(50),
      (admin as any).from("profiles")
        .select("id,account_status,subscription_status,is_admin_unlimited,early_access_request_email,early_access_requested_at,early_access_request_note,early_access_request_status"),
    ]);

    if (eventsRes.error && !/relation .*events.* does not exist/i.test(eventsRes.error.message)) throw eventsRes.error;
    if (packsRes.error && !/relation .*event_packs.* does not exist/i.test(packsRes.error.message)) throw packsRes.error;
    if (creditsRes.error && !/relation .*user_credits.* does not exist/i.test(creditsRes.error.message)) throw creditsRes.error;
    if (billingRes.error && !/relation .*billing_transactions.* does not exist/i.test(billingRes.error.message)) throw billingRes.error;
    if (feedbackRes.error && !/relation .*feedback.* does not exist/i.test(feedbackRes.error.message)) throw feedbackRes.error;
    if (
      profilesRes.error &&
      !/relation .*profiles.* does not exist/i.test(profilesRes.error.message) &&
      !/column .*early_access/i.test(profilesRes.error.message)
    ) {
      throw profilesRes.error;
    }

    const events = (eventsRes.data ?? []) as AdminEventRow[];
    const packs = (packsRes.data ?? []) as AdminPackRow[];
    const credits = (creditsRes.data ?? []) as AdminCreditRow[];
    const billing = (billingRes.data ?? []) as AdminBillingRow[];
    const feedback = (feedbackRes.data ?? []) as FeedbackRow[];
    const profiles = (profilesRes.error ? [] : (profilesRes.data ?? [])) as ProfileAccessRow[];
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    const accessRequests = users
      .map((u: any): AccessRequestRow | null => {
        const profile = profilesById.get(u.id);
        const status = profile?.account_status || "pending_activation";
        const requestStatus = profile?.early_access_request_status || "not_requested";
        const subscriptionStatus = profile?.subscription_status || "inactive";
        const approved =
          Boolean(profile?.is_admin_unlimited) ||
          status === "trial_active" ||
          status === "active" ||
          subscriptionStatus === "active" ||
          subscriptionStatus === "trialing";

        if (approved || status === "suspended" || requestStatus === "declined") return null;
        if (requestStatus !== "requested" && requestStatus !== "reviewing" && status !== "pending_activation") return null;

        return {
          id: u.id,
          early_access_request_email: profile?.early_access_request_email || u.email || null,
          early_access_requested_at: profile?.early_access_requested_at || u.created_at || null,
          early_access_request_note: profile?.early_access_request_note || null,
          early_access_request_status: requestStatus === "not_requested" ? "signup_pending" : requestStatus,
          account_status: status,
          source: requestStatus === "requested" || requestStatus === "reviewing" ? "request" : "signup",
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => String(b.early_access_requested_at || "").localeCompare(String(a.early_access_requested_at || "")))
      .slice(0, 80) as AccessRequestRow[];

    const analytics = await loadAnalytics(admin).catch((error: any) => ({
      available: false,
      reason: error?.message || "Analytics unavailable",
    }));

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

    return NextResponse.json({ rows, totals, feedback, analytics, accessRequests });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load admin overview" }, { status: 500 });
  }
}
