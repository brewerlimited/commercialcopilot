import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/apiAuth";
import { matchesConfiguredAdminEmail } from "@/lib/adminAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BOT_RE = /bot|crawler|spider|crawling|preview|monitor|uptime|headless|vercel-screenshot/i;
const MAX_METADATA_KEYS = 24;

type AnalyticsBody = {
  eventName?: string;
  pagePath?: string;
  sessionId?: string | null;
  eventId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
};

function json(status: number, payload: Record<string, unknown>) {
  return NextResponse.json(payload, { status });
}

function shouldCapture(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const vercelEnv = process.env.VERCEL_ENV || "development";
  const allowNonProduction = process.env.ANALYTICS_CAPTURE_NON_PRODUCTION === "true";

  if (!allowNonProduction) {
    if (host.includes("localhost") || host.includes("127.0.0.1")) return { ok: false, reason: "localhost" };
    if (vercelEnv && vercelEnv !== "production") return { ok: false, reason: "non_production" };
  }

  const ua = req.headers.get("user-agent") || "";
  if (!ua || BOT_RE.test(ua)) return { ok: false, reason: "bot_or_empty_user_agent" };
  if (!process.env.ANALYTICS_HASH_SALT) return { ok: false, reason: "missing_hash_salt" };

  return { ok: true, reason: "capture" };
}

function getIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

function currentDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function visitorHash(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  const raw = `${getIp(req)}|${ua}|${process.env.ANALYTICS_HASH_SALT}|${currentDateKey()}`;
  return createHash("sha256").update(raw).digest("hex");
}

function shortText(value: unknown, max = 220) {
  if (typeof value !== "string") return null;
  return value.slice(0, max);
}

function cleanEventName(name: unknown) {
  const value = typeof name === "string" ? name.trim().toLowerCase() : "";
  if (!/^[a-z0-9_.-]{2,80}$/.test(value)) return null;
  return value;
}

function cleanMetadata(input: unknown) {
  const clean: Record<string, unknown> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return clean;

  for (const [key, value] of Object.entries(input as Record<string, unknown>).slice(0, MAX_METADATA_KEYS)) {
    if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(key)) continue;
    if (value == null) clean[key] = null;
    else if (typeof value === "string") clean[key] = value.slice(0, 220);
    else if (typeof value === "number" || typeof value === "boolean") clean[key] = value;
    else if (Array.isArray(value)) {
      clean[key] = value.slice(0, 12).map((item) => (typeof item === "string" ? item.slice(0, 120) : item));
    }
  }

  return clean;
}

function parseUtm(url: string) {
  try {
    const parsed = new URL(url, "https://commercialcopilot.co.uk");
    return {
      source: parsed.searchParams.get("utm_source"),
      medium: parsed.searchParams.get("utm_medium"),
      campaign: parsed.searchParams.get("utm_campaign"),
      content: parsed.searchParams.get("utm_content"),
      term: parsed.searchParams.get("utm_term"),
    };
  } catch {
    return { source: null, medium: null, campaign: null, content: null, term: null };
  }
}

function deviceFromUa(ua: string) {
  const lower = ua.toLowerCase();
  const device = /mobile|iphone|android/.test(lower) ? "mobile" : /ipad|tablet/.test(lower) ? "tablet" : "desktop";
  const browser = lower.includes("edg/") ? "Edge" : lower.includes("chrome/") ? "Chrome" : lower.includes("safari/") ? "Safari" : lower.includes("firefox/") ? "Firefox" : "Other";
  const os = lower.includes("windows") ? "Windows" : lower.includes("mac os") ? "macOS" : lower.includes("android") ? "Android" : lower.includes("iphone") || lower.includes("ipad") ? "iOS" : "Other";
  return { device, browser, os };
}

async function getOptionalUser(req: NextRequest) {
  try {
    return await getAuthUserFromRequest(req);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const capture = shouldCapture(req);
    if (!capture.ok) return json(202, { ok: false, skipped: true, reason: capture.reason });

    const body = (await req.json().catch(() => ({}))) as AnalyticsBody;
    const eventName = cleanEventName(body.eventName);
    if (!eventName) return json(202, { ok: false, skipped: true, reason: "invalid_event_name" });

    const user = await getOptionalUser(req);
    if (matchesConfiguredAdminEmail(user?.email)) {
      return json(202, { ok: false, skipped: true, reason: "admin_traffic" });
    }

    const admin = supabaseAdmin() as any;
    const now = new Date().toISOString();
    const pagePath = shortText(body.pagePath, 500) || "/";
    const referrer = shortText(req.headers.get("referer"), 500);
    const utm = parseUtm(pagePath);
    const ua = req.headers.get("user-agent") || "";
    const device = deviceFromUa(ua);
    const hash = visitorHash(req);
    const sessionExternalId = shortText(body.sessionId, 120) || createHash("sha256").update(`${hash}|${pagePath}|${currentDateKey()}`).digest("hex");

    const visitorRes = await (admin as any).from("analytics_visitors").upsert(
      {
        visitor_hash: hash,
        first_source: utm.source,
        first_campaign: utm.campaign,
        country_code: req.headers.get("x-vercel-ip-country") || null,
        device_type: device.device,
        last_seen_at: now,
      },
      { onConflict: "visitor_hash" }
    ).select("id").single();
    if (visitorRes.error) throw visitorRes.error;

    const visitorId = (visitorRes.data as any)?.id;
    const sessionRes = await (admin as any).from("analytics_sessions").upsert(
      {
        external_session_id: sessionExternalId,
        visitor_id: visitorId,
        user_id: user?.id || null,
        landing_page: pagePath,
        exit_page: pagePath,
        referrer,
        utm_source: utm.source,
        utm_medium: utm.medium,
        utm_campaign: utm.campaign,
        utm_content: utm.content,
        utm_term: utm.term,
        device: device.device,
        browser: device.browser,
        operating_system: device.os,
        country: req.headers.get("x-vercel-ip-country") || null,
        ended_at: now,
      },
      { onConflict: "external_session_id" }
    ).select("id").single();
    if (sessionRes.error) throw sessionRes.error;

    const sessionId = (sessionRes.data as any)?.id;
    const metadata = cleanMetadata(body.metadata);
    const eventInsert = await (admin as any).from("analytics_events").insert({
      session_id: sessionId,
      visitor_id: visitorId,
      user_id: user?.id || null,
      event_name: eventName,
      page_path: pagePath,
      event_id: shortText(body.eventId, 80),
      project_id: shortText(body.projectId, 80),
      metadata,
    }).select("id").single();
    if (eventInsert.error) throw eventInsert.error;

    if (eventName === "page_viewed") {
      const pageInsert = await (admin as any).from("analytics_pageviews").insert({
        session_id: sessionId,
        visitor_id: visitorId,
        user_id: user?.id || null,
        page_path: pagePath,
        page_title: shortText(metadata.title, 220),
        referrer,
      });
      if (pageInsert.error) throw pageInsert.error;
    }

    return json(202, { ok: true });
  } catch (error: any) {
    console.warn("[analytics] skipped", error?.message || error);
    return json(202, { ok: false, skipped: true, reason: "analytics_unavailable" });
  }
}
