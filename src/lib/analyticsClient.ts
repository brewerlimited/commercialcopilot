"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

type AnalyticsMetadata = Record<string, unknown>;

const MAX_METADATA_KEYS = 24;
const MAX_STRING_LENGTH = 180;

function safeMetadata(metadata?: AnalyticsMetadata): AnalyticsMetadata {
  const clean: AnalyticsMetadata = {};
  const entries = Object.entries(metadata || {}).slice(0, MAX_METADATA_KEYS);

  for (const [key, value] of entries) {
    if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(key)) continue;
    if (value == null) {
      clean[key] = null;
    } else if (typeof value === "string") {
      clean[key] = value.slice(0, MAX_STRING_LENGTH);
    } else if (typeof value === "number" || typeof value === "boolean") {
      clean[key] = value;
    } else if (Array.isArray(value)) {
      clean[key] = value.slice(0, 12).map((item) =>
        typeof item === "string" ? item.slice(0, MAX_STRING_LENGTH) : item
      );
    }
  }

  return clean;
}

function getSessionId() {
  if (typeof window === "undefined") return null;
  try {
    const key = "ccp.analytics.session";
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return null;
  }
}

function pagePath() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search || ""}`;
}

function send(payload: AnalyticsMetadata, token?: string | null) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    ...payload,
    sessionId: getSessionId(),
    pagePath: pagePath(),
  });

  fetch("/api/analytics/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    keepalive: body.length < 60_000,
  }).catch(() => {
    // Analytics must never interrupt the product flow.
  });
}

export function trackAnalytics(eventName: string, metadata?: AnalyticsMetadata) {
  send({ eventName, metadata: safeMetadata(metadata) });
}

export async function trackAnalyticsWithUser(
  supabase: SupabaseClient,
  eventName: string,
  metadata?: AnalyticsMetadata
) {
  try {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token || null;
    send({ eventName, metadata: safeMetadata(metadata) }, token);
  } catch {
    trackAnalytics(eventName, metadata);
  }
}
