export type FinancialSummary = {
  resources_total: number;
  prelims_total: number;
  fee_percent: number;
  fee_basis: "defined_cost" | "defined_cost_plus_prelims";
  fee_amount: number;
  final_total: number;
  delay_days: number;
  updated_at: string;
};

type SupabaseLike = {
  from: (table: string) => any;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function clampWorkDays(value: unknown) {
  const n = Math.round(toNumber(value, 5));
  return Math.max(1, Math.min(7, n || 5));
}

export function readFinalTotal(summary: unknown): number | null {
  if (!summary || typeof summary !== "object") return null;
  const raw = (summary as any).final_total;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function hasFinancialSummary(summary: unknown): boolean {
  return readFinalTotal(summary) !== null;
}

export async function recalculateEventFinancialSummary(
  supabase: SupabaseLike,
  eventId: string,
  userId?: string
): Promise<FinancialSummary> {
  const eventQuery = supabase
    .from("events")
    .select("id,user_id,delay_days")
    .eq("id", eventId)
    .maybeSingle();

  const [eventRes, resourceRes, prelimRes, valuationRes] = await Promise.all([
    eventQuery,
    supabase.from("event_resource_lines").select("total").eq("event_id", eventId),
    supabase.from("event_prelim_lines").select("qty,unit,rate").eq("event_id", eventId),
    supabase
      .from("event_valuation_settings")
      .select("fee_percent,fee_basis,work_days_per_week")
      .eq("event_id", eventId)
      .maybeSingle(),
  ]);

  if (eventRes.error) throw eventRes.error;
  if (resourceRes.error) throw resourceRes.error;
  if (prelimRes.error) throw prelimRes.error;
  if (valuationRes.error) throw valuationRes.error;

  const event = eventRes.data as any;
  if (!event) throw new Error("Event not found");
  if (userId && event.user_id !== userId) throw new Error("Event not found");

  const resourcesTotal = ((resourceRes.data ?? []) as any[]).reduce(
    (sum, row) => sum + toNumber(row.total, 0),
    0
  );

  const valuation = (valuationRes.data ?? {}) as any;
  const workDaysPerWeek = clampWorkDays(valuation.work_days_per_week);
  const delayDays = toNumber(event.delay_days, 0);

  const prelimsDaily = ((prelimRes.data ?? []) as any[]).reduce((sum, row) => {
    const qty = toNumber(row.qty, 0);
    const rate = toNumber(row.rate, 0);
    const dailyRate = row.unit === "week" ? rate / workDaysPerWeek : rate;
    return sum + qty * dailyRate;
  }, 0);

  const prelimsTotal = prelimsDaily * delayDays;
  const feePercent = toNumber(valuation.fee_percent, 12.5);
  const feeBasis =
    valuation.fee_basis === "defined_cost_plus_prelims"
      ? "defined_cost_plus_prelims"
      : "defined_cost";
  const feeBase = feeBasis === "defined_cost_plus_prelims" ? resourcesTotal + prelimsTotal : resourcesTotal;
  const feeAmount = feeBase * (feePercent / 100);

  const summary: FinancialSummary = {
    resources_total: resourcesTotal,
    prelims_total: prelimsTotal,
    fee_percent: feePercent,
    fee_basis: feeBasis,
    fee_amount: feeAmount,
    final_total: resourcesTotal + prelimsTotal + feeAmount,
    delay_days: delayDays,
    updated_at: new Date().toISOString(),
  };

  let updateQuery = supabase.from("events").update({ event_financial_summary: summary }).eq("id", eventId);
  if (userId) updateQuery = updateQuery.eq("user_id", userId);
  const updateRes = await updateQuery;
  if (updateRes.error) {
    const message = String(updateRes.error.message || "");
    const missingSummaryColumn = /event_financial_summary/i.test(message) && /does not exist|schema cache|column/i.test(message);
    if (!missingSummaryColumn) throw updateRes.error;
    console.warn("event_financial_summary column missing; financial summary was calculated but not saved.");
  }

  return summary;
}
