type AdminClient = any;

function cleanMessage(message: unknown) {
  return String(message || "Unknown error")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 500);
}

function cleanMetadata(input?: Record<string, unknown>) {
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input || {}).slice(0, 24)) {
    if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(key)) continue;
    if (value == null) metadata[key] = null;
    else if (typeof value === "string") metadata[key] = value.slice(0, 220);
    else if (typeof value === "number" || typeof value === "boolean") metadata[key] = value;
  }
  return metadata;
}

export async function recordServerAnalyticsEvent(
  admin: AdminClient,
  input: {
    userId?: string | null;
    eventName: string;
    pagePath?: string | null;
    eventId?: string | null;
    projectId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    const res = await (admin as any).from("analytics_events").insert({
      user_id: input.userId || null,
      event_name: input.eventName,
      page_path: input.pagePath || null,
      event_id: input.eventId || null,
      project_id: input.projectId || null,
      metadata: cleanMetadata(input.metadata),
    });
    if (res.error) throw res.error;
  } catch (error: any) {
    console.warn("[analytics] server event skipped", error?.message || error);
  }
}

export async function recordAiGenerationRun(
  admin: AdminClient,
  input: {
    userId?: string | null;
    eventId?: string | null;
    packId?: string | null;
    generationType: string;
    generationMode?: string | null;
    status: "success" | "failed" | "skipped";
    startedAt?: number;
    inputTokens?: number | null;
    outputTokens?: number | null;
    estimatedCostGbp?: number | null;
    errorType?: string | null;
    message?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    const res = await (admin as any).from("ai_generation_runs").insert({
      user_id: input.userId || null,
      event_id: input.eventId || null,
      pack_id: input.packId || null,
      generation_type: input.generationType,
      generation_mode: input.generationMode || null,
      status: input.status,
      duration_ms: input.startedAt ? Math.max(0, Date.now() - input.startedAt) : null,
      input_tokens: input.inputTokens || null,
      output_tokens: input.outputTokens || null,
      estimated_cost_gbp: input.estimatedCostGbp || null,
      error_type: input.errorType || null,
      sanitized_message: input.message ? cleanMessage(input.message) : null,
      metadata: cleanMetadata(input.metadata),
    });
    if (res.error) throw res.error;
  } catch (error: any) {
    console.warn("[analytics] ai_generation_runs skipped", error?.message || error);
  }
}

export async function recordAdminErrorEvent(
  admin: AdminClient,
  input: {
    userId?: string | null;
    route: string;
    eventName: string;
    errorType?: string | null;
    message?: string | null;
    retryCount?: number;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    const res = await (admin as any).from("admin_error_events").insert({
      user_id: input.userId || null,
      route: input.route,
      event_name: input.eventName,
      error_type: input.errorType || "error",
      sanitized_message: cleanMessage(input.message),
      retry_count: input.retryCount || 0,
      metadata: cleanMetadata(input.metadata),
    });
    if (res.error) throw res.error;
  } catch (error: any) {
    console.warn("[analytics] admin_error_events skipped", error?.message || error);
  }
}
