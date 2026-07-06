import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUserFromRequest } from "@/lib/apiAuth";
import { checkAdminWithServiceRole, normalizeEmail } from "@/lib/adminAccess";

export const dynamic = "force-dynamic";

type ContractSource = "standard_logic" | "upload_contract";
type ResourceCategory = "labour" | "plant" | "material";
type TimeToggle = "yes" | "no" | "unsure";

type DemoResource = {
  category: ResourceCategory;
  item_name: string;
  unit: string;
  hours: number | null;
  qty: number;
  rate: number;
  notes: string;
  tags: string[];
  start_date: string;
  end_date: string;
  linked_event: string;
};

type DemoPrelim = {
  name: string;
  qty: number;
  unit: "day" | "week";
  rate: number;
  notes: string;
  prelim_type: "staff" | "prelim";
  start_date: string;
  end_date: string;
  linked_event: string;
};

type DemoEvidence = {
  category: string;
  file_name: string;
  description: string;
  evidence_date: string;
  relates_to: string;
};

type DemoEvent = {
  title: string;
  project_name: string;
  main_contractor: string;
  contract_type: string;
  contract_source: ContractSource;
  event_number: number;
  event_reference: string;
  status: string;
  payment_status: string;
  event_date: string;
  notice_period_days: number | null;
  submitted_date: string | null;
  expected_payment_date: string | null;
  last_action_type: string;
  last_action_date: string;
  delay_days: number;
  fee_percent: number;
  fee_basis: "defined_cost" | "defined_cost_plus_prelims";
  generated_pack?: boolean;
  contractor_response?: string;
  basis: {
    happened_summary: string;
    cause_type: string;
    cause_summary: string;
    difference_from_plan: string;
    mechanism_tags: string[];
    time_impact_toggle: TimeToggle;
    mitigation_summary: string;
  };
  resources: DemoResource[];
  prelims: DemoPrelim[];
  evidence: DemoEvidence[];
};

type DemoEwn = {
  title: string;
  project_name: string;
  main_contractor: string;
  contract_type: string;
  status: "open" | "monitoring" | "converted";
  event_date: string;
  location: string;
  what_happened: string;
  impact: string;
  required_action: string;
  evidence: string;
  convert_to_event_number?: number;
};

type EvidenceCategory = "instructions" | "photos" | "site_records" | "programme" | "cost_support";
const EVIDENCE_CATEGORIES: EvidenceCategory[] = ["instructions", "photos", "site_records", "programme", "cost_support"];

function normaliseEvidenceCategory(category: string): EvidenceCategory {
  const c = String(category || "").toLowerCase().trim();
  if (["instruction", "instructions", "drawing", "drawings", "email", "rfi", "communication"].includes(c)) return "instructions";
  if (["photo", "photos", "site_photo", "site_photos", "image"].includes(c)) return "photos";
  if (["site_record", "site_records", "allocation", "diary", "timesheet", "record"].includes(c)) return "site_records";
  if (["programme", "program", "delay", "programme_extract"].includes(c)) return "programme";
  if (["cost", "cost_support", "valuation", "allocation_cost", "cost_record"].includes(c)) return "cost_support";
  return "site_records";
}

function safeSlug(input: string) {
  return String(input || "demo")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "demo";
}

function evidenceCoverageForEvent(e: DemoEvent): DemoEvidence[] {
  const normalised = e.evidence.map((item) => ({ ...item, category: normaliseEvidenceCategory(item.category) }));
  const present = new Set(normalised.map((item) => item.category));
  const extras: DemoEvidence[] = [];
  const slug = safeSlug(e.event_reference || e.title);

  for (const category of EVIDENCE_CATEGORIES) {
    if (present.has(category)) continue;
    const label = category.replace(/_/g, " ");
    extras.push({
      category,
      file_name: `DEMO-${slug}-${category}.pdf`,
      description: `Seeded ${label} note for ${e.event_reference}: supports the site manager narrative, date records, resources and commercial position for demo testing.`,
      evidence_date: e.event_date,
      relates_to: `${e.event_reference} demo evidence coverage`,
    });
  }

  return [...normalised, ...extras];
}

const PROJECTS = [
  "Ainsworth Energy Recovery Facility",
  "Westgate Residential Block C",
];

const DEMO_SEED_MARKER = "commercial-copilot-demo-seed";

function isMissingOptionalTable(error: any) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("relation");
}

async function optionalQuery<T extends { error?: any }>(query: PromiseLike<T>) {
  const result = await query;
  if (result?.error && !isMissingOptionalTable(result.error)) throw result.error;
  return result;
}

function describeSupabaseError(error: any) {
  return [error?.message, error?.details, error?.hint, error?.code].filter(Boolean).join(" | ");
}

function asSeedRows(label: string, rows: any): any[] {
  const arr = Array.isArray(rows) ? rows : [rows];
  const invalidIndex = arr.findIndex((row) => !row || typeof row !== "object" || Array.isArray(row));
  if (invalidIndex !== -1) {
    throw new Error(`Demo seed internal error at ${label}: Supabase rows must be an array of plain objects. Invalid row index ${invalidIndex}.`);
  }
  return arr;
}


async function trySeedInsert(admin: ReturnType<typeof supabaseAdmin>, table: string, rows: any, label = table) {
  const arr = asSeedRows(`${label} insert`, rows);
  if (!arr.length) return { error: null, data: [] } as any;
  return ((admin as any).from(table) as any).insert(arr);
}

async function trySeedUpsert(admin: ReturnType<typeof supabaseAdmin>, table: string, rows: any, options?: { onConflict?: string }, label = table) {
  const arr = asSeedRows(`${label} upsert`, rows);
  if (!arr.length) return { error: null, data: [] } as any;
  return ((admin as any).from(table) as any).upsert(arr, options as any);
}

function isMissingColumn(error: any, column: string) {
  const msg = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  const hint = String(error?.hint || "").toLowerCase();
  const combined = `${msg} ${details} ${hint}`;
  return (
    combined.includes(column.toLowerCase()) &&
    (combined.includes("column") || combined.includes("schema cache") || combined.includes("could not find"))
  );
}

async function insertRowsWithOptionalUserId(admin: ReturnType<typeof supabaseAdmin>, table: string, rows: any[]) {
  if (!rows.length) return { error: null };
  const first = await trySeedInsert(admin, table, rows, `${table}`);
  if (!first.error) return first;

  // Some older/staging schemas do not have user_id on child tables. Newer schemas often do,
  // and RLS can hide demo child rows from the tester if user_id is absent. Try user_id first,
  // then fall back only when that column genuinely does not exist.
  if (isMissingColumn(first.error, "user_id")) {
    const stripped = rows.map(({ user_id, ...rest }) => rest);
    return trySeedInsert(admin, table, stripped, `${table} without user_id`);
  }

  return first;
}

async function insertRowsWithOptionalColumns(
  admin: ReturnType<typeof supabaseAdmin>,
  table: string,
  rows: any[],
  optionalColumns: string[]
) {
  if (!rows.length) return { error: null };

  let workingRows = rows;
  const removedColumns: string[] = [];

  for (let attempt = 0; attempt <= optionalColumns.length; attempt += 1) {
    const result = await trySeedInsert(admin, table, workingRows, `${table}`);
    if (!result.error) return { ...result, removedColumns } as any;

    const missingColumn = optionalColumns.find((column) => !removedColumns.includes(column) && isMissingColumn(result.error, column));
    if (!missingColumn) return result;

    removedColumns.push(missingColumn);
    workingRows = workingRows.map((row) => {
      const { [missingColumn]: _removed, ...rest } = row;
      return rest;
    });
  }

  return trySeedInsert(admin, table, workingRows, `${table}`);
}


const APP_RESOURCE_UNITS = ["hour", "day", "week", "each", "m", "m2", "m3", "t", "kg", "l", "sheet", "bag"] as const;
// Live tester databases may still have the older resource unit check constraint.
// The Resources UI can display the wider unit list, but demo seed rows must use
// the two units that have existed from the earliest app versions: hour and each.
// This avoids half-seeded demo accounts where the parent CE exists but child rows fail.
const LIVE_SAFE_RESOURCE_UNITS = ["hour", "each"] as const;
const RESOURCE_UNIT_FALLBACK_ORDER = ["hour", "each"] as const;

type ResourceInsertResult = {
  error: any | null;
  insertedRows: number;
  fallbackRows: number;
  unitFallbacks: { item_name: string; original_unit: string; inserted_unit: string }[];
};

function isUnitCheckError(error: any) {
  const combined = `${String(error?.message || "")} ${String(error?.details || "")} ${String(error?.hint || "")} ${String(error?.code || "")}`.toLowerCase();
  return combined.includes("event_resource_lines_unit_check") || (combined.includes("check constraint") && combined.includes("unit"));
}

function resourceRowForFallback(row: any, unit: string) {
  const originalUnit = String(row.unit || "");
  const originalQty = Number(row.qty ?? 1) || 1;
  const originalHours = Number(row.hours ?? 0) || 0;
  const originalRate = Number(row.rate ?? 0) || 0;
  const originalTotal = Number(row.total ?? 0) || (originalUnit === "hour" ? originalHours * originalQty * originalRate : originalQty * originalRate);

  if (unit === "hour") {
    const fallbackHours = originalUnit === "hour" ? originalHours || originalQty || 1 : originalQty || originalHours || 1;
    return {
      ...row,
      unit,
      hours: fallbackHours,
      qty: 1,
      total: originalTotal || fallbackHours * originalRate,
      notes: [row.notes, originalUnit && originalUnit !== unit ? `Demo seed note: original intended unit was ${originalUnit}; inserted as ${unit} to match the live database unit constraint.` : null]
        .filter(Boolean)
        .join("\n"),
    };
  }

  return {
    ...row,
    unit,
    hours: null,
    qty: originalQty || originalHours || 1,
    total: originalTotal || (originalQty || originalHours || 1) * originalRate,
    notes: [row.notes, originalUnit && originalUnit !== unit ? `Demo seed note: original intended unit was ${originalUnit}; inserted as ${unit} to match the live database unit constraint.` : null]
      .filter(Boolean)
      .join("\n"),
  };
}

async function insertResourceRowsWithUnitFallback(admin: ReturnType<typeof supabaseAdmin>, rows: any[]): Promise<ResourceInsertResult> {
  if (!rows.length) return { error: null, insertedRows: 0, fallbackRows: 0, unitFallbacks: [] };

  const invalidAppUnits = rows.filter((row) => !APP_RESOURCE_UNITS.includes(String(row.unit) as any));
  if (invalidAppUnits.length) {
    return {
      error: new Error(`Demo seed contains invalid app unit(s): ${invalidAppUnits.map((r) => `${r.item_name}:${r.unit}`).join(", ")}`),
      insertedRows: 0,
      fallbackRows: 0,
      unitFallbacks: [],
    };
  }

  const first = await insertRowsWithOptionalUserId(admin, "event_resource_lines", rows);
  if (!first.error) return { error: null, insertedRows: rows.length, fallbackRows: 0, unitFallbacks: [] };
  if (!isUnitCheckError(first.error)) return { error: first.error, insertedRows: 0, fallbackRows: 0, unitFallbacks: [] };

  let insertedRows = 0;
  let fallbackRows = 0;
  const unitFallbacks: { item_name: string; original_unit: string; inserted_unit: string }[] = [];

  for (const row of rows) {
    let rowInserted = false;
    const originalUnit = String(row.unit || "");
    const candidates = Array.from(new Set([originalUnit, ...RESOURCE_UNIT_FALLBACK_ORDER]));

    for (const unit of candidates) {
      const candidate = unit === originalUnit ? row : resourceRowForFallback(row, unit);
      const attempt = await insertRowsWithOptionalUserId(admin, "event_resource_lines", [candidate]);
      if (!attempt.error) {
        insertedRows += 1;
        if (unit !== originalUnit) {
          fallbackRows += 1;
          unitFallbacks.push({ item_name: String(row.item_name || "Resource line"), original_unit: originalUnit, inserted_unit: unit });
        }
        rowInserted = true;
        break;
      }
      if (!isUnitCheckError(attempt.error)) {
        return { error: attempt.error, insertedRows, fallbackRows, unitFallbacks };
      }
    }

    if (!rowInserted) {
      return {
        error: new Error(`Could not insert demo resource line "${row.item_name}". The live event_resource_lines_unit_check rejected every fallback unit: ${RESOURCE_UNIT_FALLBACK_ORDER.join(", ")}.`),
        insertedRows,
        fallbackRows,
        unitFallbacks,
      };
    }
  }

  return { error: null, insertedRows, fallbackRows, unitFallbacks };
}

async function upsertRowsWithOptionalUserId(
  admin: ReturnType<typeof supabaseAdmin>,
  table: string,
  rows: any[],
  options?: { onConflict?: string }
) {
  if (!rows.length) return { error: null };
  const first = await trySeedUpsert(admin, table, rows, options, `${table}`);
  if (!first.error) return first;
  if (isMissingColumn(first.error, "user_id")) {
    const stripped = rows.map(({ user_id, ...rest }) => rest);
    return trySeedUpsert(admin, table, stripped, options, `${table} without user_id`);
  }
  return first;
}

function addDays(date: string, days: number | null) {
  if (!days) return null;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function money(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(v || 0);
}

function isPaymentStatusConstraintError(error: any) {
  const combined = `${String(error?.message || "")} ${String(error?.details || "")} ${String(error?.code || "")}`.toLowerCase();
  return combined.includes("events_payment_status_allowed") || (combined.includes("check constraint") && combined.includes("payment_status"));
}

function demoProjectKey(projectName: string, mainContractor: string | null | undefined) {
  return `${projectName.trim().toLowerCase()}__${String(mainContractor || "").trim().toLowerCase()}`;
}

function lineTotal(r: DemoResource) {
  if (r.unit === "hour") return Number(r.hours || 0) * Number(r.qty || 0) * Number(r.rate || 0);
  return Number(r.qty || 0) * Number(r.rate || 0);
}

function normaliseResourceForDemoInsert(r: DemoResource) {
  const originalTotal = lineTotal(r);
  const originalUnit = String(r.unit || "each");

  if (originalUnit === "hour") {
    return {
      unit: "hour",
      hours: Number(r.hours || 0),
      qty: Number(r.qty || 1),
      rate: Number(r.rate || 0),
      total: originalTotal,
      notes: r.notes,
    };
  }

  return {
    unit: "each",
    hours: null,
    qty: 1,
    rate: originalTotal,
    total: originalTotal,
    notes: [
      r.notes,
      originalUnit !== "each" ? `Demo seed note: original intended unit/quantity was ${r.qty} ${originalUnit} @ £${r.rate}; inserted as one line item to satisfy the live resource unit constraint while preserving the same total.` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function prelimDaily(prelim: DemoPrelim, workDaysPerWeek = 5) {
  const rate = Number(prelim.rate || 0);
  return prelim.unit === "week" ? rate / workDaysPerWeek : rate;
}

function financialSummary(e: DemoEvent) {
  const resources_total = e.resources.reduce((sum, r) => sum + lineTotal(r), 0);
  const prelims_total = e.prelims.reduce((sum, p) => sum + Number(p.qty || 0) * prelimDaily(p) * Number(e.delay_days || 0), 0);
  const feeBase = e.fee_basis === "defined_cost_plus_prelims" ? resources_total + prelims_total : resources_total;
  const fee_amount = feeBase * (Number(e.fee_percent || 0) / 100);
  return {
    seed_marker: DEMO_SEED_MARKER,
    resources_total,
    prelims_total,
    fee_percent: e.fee_percent,
    fee_basis: e.fee_basis,
    fee_amount,
    final_total: resources_total + prelims_total + fee_amount,
    delay_days: e.delay_days,
    updated_at: new Date().toISOString(),
  };
}

function packOutput(e: DemoEvent) {
  const value = financialSummary(e).final_total;
  return {
    client_output: {
      basis_of_change: {
        background: e.basis.happened_summary,
        change_to_contract_basis: e.basis.difference_from_plan,
        event_execution: e.basis.cause_summary,
        commercial_impact: `Seeded demo pack placeholder. Seeded valuation is ${money(value)} using the labour, plant, materials, subcontract and prelim records already loaded against this CE/variation. Use Force Generate to test the live OpenAI chain.`,
        contractual_position: e.contract_type.includes("nec")
          ? "NEC demo record. Live generation should test compensation event entitlement, Defined Cost, programme impact and notice/time-bar handling against the selected contract context."
          : "JCT demo record. Live generation should test instructed variation/change, direct loss and expense style reasoning and substantiation against the selected contract context.",
        conclusion: "Seeded output only. The record has been deliberately filled with enough operational detail to regenerate a stronger AI narrative.",
      },
      time_impact: {
        delay_days: e.delay_days,
        summary: e.basis.time_impact_toggle === "yes" ? `Seeded programme impact of ${e.delay_days} day(s), supported by the entered resources, prelims and evidence notes.` : "Programme impact requires review from seeded facts.",
      },
    },
    internal_commercial_intelligence: {
      commercial_pushback: [
        "Check the instruction/source record before relying on entitlement.",
        "Tie labour and plant records back to the affected work face and dates.",
        "Separate standing/rework cost from time-related prelims if challenged.",
      ],
      evidence_gaps: ["Replace seeded evidence notes with uploaded records for a real client submission."],
      strength_summary: "Seeded demo pack. Good enough to test review/download/rebuttal flows; regenerate for live AI wording.",
      internal_risk_notes: ["Do not issue seeded placeholder wording externally."],
    },
  };
}

const EVENTS: DemoEvent[] = [
  {
    title: "CE 001 - Revised drainage run and invert levels at North Gate",
    project_name: "Ainsworth Energy Recovery Facility",
    main_contractor: "Morrison Infrastructure",
    contract_type: "nec4_ecs_option_b",
    contract_source: "standard_logic",
    event_number: 1,
    event_reference: "CE 001",
    status: "submitted",
    payment_status: "submitted_for_payment",
    event_date: "2026-03-11",
    notice_period_days: 56,
    submitted_date: "2026-03-24",
    expected_payment_date: "2026-05-22",
    last_action_type: "submitted",
    last_action_date: "2026-03-24",
    delay_days: 4,
    fee_percent: 12.5,
    fee_basis: "defined_cost_plus_prelims",
    generated_pack: true,
    basis: {
      happened_summary: "Revised drainage drawing issued for North Gate after the drainage run had already started. Installed line and setting out did not match the new invert levels. Gang stopped the run, lifted two short sections, adjusted chamber position and re-set bedding before continuing. Entrance access had to stay open with cones and banksman control.",
      cause_type: "client_instruction",
      cause_summary: "Change came from revised drainage information issued by the client team after work had commenced. Site manager instructed the gang to keep the entrance live and complete the correction in one visit so follow-on surfacing was not held longer than needed.",
      difference_from_plan: "Planned work was straight install to the earlier levels. Actual work required abortive install, lift and relay, chamber adjustment, extra trimming, additional bedding and extra supervision/interface time at a live access point.",
      mechanism_tags: ["rework_abortive", "restricted_access", "additional_handling"],
      time_impact_toggle: "yes",
      mitigation_summary: "Gang remained in the area, kept arisings local, protected the entrance and completed the change over two shifts. Records available: revised drawing, diary notes, photos and allocation records.",
    },
    resources: [
      { category: "labour", item_name: "Drainage gang", unit: "hour", hours: 9, qty: 4, rate: 42, notes: "Lift and relay affected pipework, reset chamber, trim bedding and maintain live entrance control.", tags: ["rework_abortive", "restricted_access"], start_date: "2026-03-11", end_date: "2026-03-12", linked_event: "North Gate drainage" },
      { category: "labour", item_name: "Banksman", unit: "hour", hours: 9, qty: 1, rate: 37, notes: "Entrance traffic and pedestrian control while drainage was corrected.", tags: ["restricted_access"], start_date: "2026-03-11", end_date: "2026-03-12", linked_event: "North Gate access" },
      { category: "plant", item_name: "13t excavator", unit: "hour", hours: 9, qty: 1, rate: 78, notes: "Re-excavation, lift and relay support, bedding trim and local handling of arisings.", tags: ["additional_handling"], start_date: "2026-03-11", end_date: "2026-03-12", linked_event: "North Gate drainage" },
      { category: "plant", item_name: "6t dumper", unit: "hour", hours: 6, qty: 1, rate: 38, notes: "Move bedding and arisings around restricted entrance area.", tags: ["additional_handling"], start_date: "2026-03-12", end_date: "2026-03-12", linked_event: "North Gate drainage" },
      { category: "plant", item_name: "Traffic management set", unit: "day", hours: null, qty: 2, rate: 95, notes: "Cones, barriers and temporary access control kept in place while the entrance stayed live during drainage correction.", tags: ["restricted_access"], start_date: "2026-03-11", end_date: "2026-03-12", linked_event: "North Gate access" },
      { category: "material", item_name: "Additional bedding stone", unit: "t", hours: null, qty: 18, rate: 34, notes: "Extra bedding/surround due to relay and revised invert levels.", tags: ["material_extra"], start_date: "2026-03-12", end_date: "2026-03-12", linked_event: "North Gate drainage" },
    ],
    prelims: [
      { name: "Site manager", qty: 1, unit: "day", rate: 420, notes: "11/03/2026 to 14/03/2026 - entrance coordination, diary records, client interface and daily briefings.", prelim_type: "staff", start_date: "2026-03-11", end_date: "2026-03-14", linked_event: "North Gate drainage" },
      { name: "Working supervisor", qty: 1, unit: "day", rate: 360, notes: "11/03/2026 to 14/03/2026 - gang control, access interface and QA records.", prelim_type: "staff", start_date: "2026-03-11", end_date: "2026-03-14", linked_event: "North Gate drainage" },
    ],
    evidence: [
      { category: "drawing", file_name: "DEMO-North-Gate-revised-drainage-markup.pdf", description: "Revised drainage markup showing altered invert levels and chamber position.", evidence_date: "2026-03-11", relates_to: "Revised drainage instruction" },
      { category: "site_photo", file_name: "DEMO-North-Gate-lifted-pipework.jpg", description: "Photos of lifted section and bedding correction at entrance.", evidence_date: "2026-03-12", relates_to: "Abortive/rework record" },
    ],
  },
  {
    title: "CE 002 - Standing time due to delayed permit for service corridor excavation",
    project_name: "Ainsworth Energy Recovery Facility",
    main_contractor: "Morrison Infrastructure",
    contract_type: "nec4_ecs_option_b",
    contract_source: "standard_logic",
    event_number: 2,
    event_reference: "CE 002",
    status: "rejected",
    payment_status: "not_applied",
    event_date: "2026-02-06",
    notice_period_days: 56,
    submitted_date: "2026-02-20",
    expected_payment_date: null,
    last_action_type: "status_rejected",
    last_action_date: "2026-04-18",
    delay_days: 2,
    fee_percent: 12.5,
    fee_basis: "defined_cost_plus_prelims",
    generated_pack: true,
    contractor_response: "Rejected. The subcontractor should have allowed for normal permit delays and has not demonstrated that the resources could not be redeployed elsewhere on site.",
    basis: {
      happened_summary: "Service corridor excavation could not start because the permit and isolation confirmation were not released at the planned start. Gang, 8t excavator and dumper were on site, briefed and set up. Team waited while permit was chased, then moved to minor housekeeping only. Productive excavation was lost for the shift.",
      cause_type: "access_or_permit_restriction",
      cause_summary: "The permit/clearance was controlled by the client/main contractor team. The workface was planned and resourced but the required release was not available when resources arrived.",
      difference_from_plan: "Planned output was one full shift service corridor excavation. Actual output was no productive excavation, with partial standing and resequencing into low-value housekeeping.",
      mechanism_tags: ["standing_time", "restricted_access", "resequencing"],
      time_impact_toggle: "yes",
      mitigation_summary: "Supervisor chased permit, recorded waiting time and moved operatives to housekeeping where possible. Plant remained allocated to the corridor and could not be sensibly redeployed due to programme/access constraints.",
    },
    resources: [
      { category: "labour", item_name: "Groundworkers", unit: "hour", hours: 7.5, qty: 3, rate: 40, notes: "Held for permit release and limited to non-productive housekeeping.", tags: ["standing_time"], start_date: "2026-02-06", end_date: "2026-02-06", linked_event: "Service corridor permit" },
      { category: "labour", item_name: "Supervisor", unit: "hour", hours: 7.5, qty: 1, rate: 48, notes: "Chased permit, kept records, re-briefed gang and coordinated resequence.", tags: ["standing_time", "records"], start_date: "2026-02-06", end_date: "2026-02-06", linked_event: "Service corridor permit" },
      { category: "plant", item_name: "8t excavator", unit: "hour", hours: 7.5, qty: 1, rate: 61, notes: "Allocated to service corridor excavation and unavailable for productive digging.", tags: ["standing_time"], start_date: "2026-02-06", end_date: "2026-02-06", linked_event: "Service corridor permit" },
      { category: "plant", item_name: "6t dumper", unit: "hour", hours: 7.5, qty: 1, rate: 38, notes: "Allocated to excavation and stood with excavator.", tags: ["standing_time"], start_date: "2026-02-06", end_date: "2026-02-06", linked_event: "Service corridor permit" },
      { category: "material", item_name: "Subcontract support - permit / utility standby", unit: "day", hours: null, qty: 1, rate: 525, notes: "Utility standby visit arranged around planned permit release.", tags: ["standing_time"], start_date: "2026-02-06", end_date: "2026-02-06", linked_event: "Service corridor permit" },
    ],
    prelims: [
      { name: "Site supervisor", qty: 1, unit: "day", rate: 340, notes: "06/02/2026 to 07/02/2026 - permit chasing, records, resequencing and client updates.", prelim_type: "staff", start_date: "2026-02-06", end_date: "2026-02-07", linked_event: "Service corridor permit" },
      { name: "Welfare and site overhead allowance", qty: 1, unit: "day", rate: 110, notes: "06/02/2026 to 07/02/2026 - resources retained on site during lost shift and remobilisation.", prelim_type: "prelim", start_date: "2026-02-06", end_date: "2026-02-07", linked_event: "Service corridor permit" },
    ],
    evidence: [
      { category: "allocation", file_name: "DEMO-Service-Corridor-allocation-06-02-2026.pdf", description: "Allocation record showing gang and plant held for service corridor works.", evidence_date: "2026-02-06", relates_to: "Standing time" },
      { category: "email", file_name: "DEMO-Permit-release-chase-email.pdf", description: "Email/Teams chase for permit and isolation release.", evidence_date: "2026-02-06", relates_to: "Permit not released" },
    ],
  },
  {
    title: "CE 003 - Additional concrete breakout to transformer base",
    project_name: "Ainsworth Energy Recovery Facility",
    main_contractor: "Morrison Infrastructure",
    contract_type: "nec4_ecs_option_b",
    contract_source: "standard_logic",
    event_number: 3,
    event_reference: "CE 003",
    status: "draft",
    payment_status: "not_applied",
    event_date: "2026-05-08",
    notice_period_days: 56,
    submitted_date: null,
    expected_payment_date: null,
    last_action_type: "updated",
    last_action_date: "2026-05-10",
    delay_days: 1,
    fee_percent: 12.5,
    fee_basis: "defined_cost_plus_prelims",
    basis: {
      happened_summary: "Existing concrete base found under made ground in transformer area. Not shown on the clearance sketch issued to site. Gang exposed the obstruction while trimming to formation. Supervisor was told to break out enough to allow duct install and reduced level dig to continue.",
      cause_type: "site_condition",
      cause_summary: "Obstruction was below surface and not identified in the site information used for the planned excavation. Works changed from normal dig/trim to saw cut, breakout, load away and re-trim.",
      difference_from_plan: "Planned work was standard excavation to formation. Actual work needed breaker attachment, additional hand trimming, arisings handling, concrete disposal and slower work around remaining edges.",
      mechanism_tags: ["different_plant", "additional_handling", "rework_abortive"],
      time_impact_toggle: "unsure",
      mitigation_summary: "Only the required section was broken out. Duct route kept open and remaining concrete edge marked for review. Records: photos, diary note and disposal tickets to be uploaded.",
    },
    resources: [
      { category: "labour", item_name: "Operatives", unit: "hour", hours: 8, qty: 2, rate: 39, notes: "Assist breakout, banksman control, trimming and segregation of concrete arisings.", tags: ["additional_handling"], start_date: "2026-05-08", end_date: "2026-05-08", linked_event: "Transformer base" },
      { category: "plant", item_name: "Breaker attachment", unit: "day", hours: null, qty: 1, rate: 180, notes: "Concrete breakout to buried obstruction.", tags: ["different_plant"], start_date: "2026-05-08", end_date: "2026-05-08", linked_event: "Transformer base" },
      { category: "plant", item_name: "5t excavator", unit: "day", hours: null, qty: 1, rate: 310, notes: "Breakout support, loading and re-trim.", tags: ["different_plant"], start_date: "2026-05-08", end_date: "2026-05-08", linked_event: "Transformer base" },
      { category: "material", item_name: "Concrete disposal", unit: "each", hours: null, qty: 2, rate: 165, notes: "Concrete arisings disposal allowance from obstruction breakout.", tags: ["disposal"], start_date: "2026-05-08", end_date: "2026-05-08", linked_event: "Transformer base" },
    ],
    prelims: [
      { name: "Supervisor", qty: 1, unit: "day", rate: 340, notes: "08/05/2026 - instruction record, obstruction management, photo record and client update.", prelim_type: "staff", start_date: "2026-05-08", end_date: "2026-05-08", linked_event: "Transformer base" },
    ],
    evidence: [
      { category: "site_photo", file_name: "DEMO-Transformer-base-obstruction-photos.jpg", description: "Photos of buried concrete obstruction exposed during reduced level dig.", evidence_date: "2026-05-08", relates_to: "Different site condition" },
      { category: "diary", file_name: "DEMO-Site-diary-transformer-base.pdf", description: "Diary entry noting supervisor instruction to break out sufficient area to proceed.", evidence_date: "2026-05-08", relates_to: "Instruction / record" },
    ],
  },
  {
    title: "VAR 001 - Late partition set-out change to Level 04 apartments",
    project_name: "Westgate Residential Block C",
    main_contractor: "Harwood Developments",
    contract_type: "jct_d_and_b_2016",
    contract_source: "standard_logic",
    event_number: 1,
    event_reference: "VAR 001",
    status: "paid",
    payment_status: "paid",
    event_date: "2026-02-12",
    notice_period_days: null,
    submitted_date: "2026-02-28",
    expected_payment_date: "2026-04-03",
    last_action_type: "paid",
    last_action_date: "2026-04-10",
    delay_days: 3,
    fee_percent: 10,
    fee_basis: "defined_cost_plus_prelims",
    generated_pack: true,
    basis: {
      happened_summary: "Architect issued revised Level 04 setting out moving bathroom partitions in plots 4.06 to 4.10. Metal stud had already started and materials were distributed to plots. Some track had to be removed, re-set and boards re-cut.",
      cause_type: "design_change",
      cause_summary: "Change followed revised architect information. Site team were instructed to implement the new layout to avoid holding follow-on MEP works.",
      difference_from_plan: "Original setting out was based on previous coordinated drawings. Revised layout caused abortive stud work, extra labour to re-set tracks, additional board wastage and out-of-sequence waste handling.",
      mechanism_tags: ["rework_abortive", "resequencing", "additional_handling"],
      time_impact_toggle: "yes",
      mitigation_summary: "Works kept within the same week by splitting the gang and prioritising plots needed by MEP. Records: revised drawing, supervisor marked-up plan, photos and waste notes.",
    },
    resources: [
      { category: "labour", item_name: "Drylining operatives", unit: "hour", hours: 8, qty: 4, rate: 38, notes: "Remove/re-set track and re-board affected partition zones in plots 4.06-4.10.", tags: ["rework_abortive"], start_date: "2026-02-12", end_date: "2026-02-14", linked_event: "Level 04 plots" },
      { category: "labour", item_name: "Finishing supervisor", unit: "hour", hours: 6, qty: 1, rate: 48, notes: "Set-out coordination, checking and handover to MEP.", tags: ["coordination"], start_date: "2026-02-12", end_date: "2026-02-14", linked_event: "Level 04 plots" },
      { category: "material", item_name: "Plasterboard and metal track", unit: "each", hours: null, qty: 1, rate: 1450, notes: "Additional board/track and wastage from re-cut sections.", tags: ["material_extra"], start_date: "2026-02-14", end_date: "2026-02-14", linked_event: "Level 04 plots" },
      { category: "plant", item_name: "Material hoist allowance", unit: "day", hours: null, qty: 1, rate: 220, notes: "Additional distribution and waste removal window.", tags: ["additional_handling"], start_date: "2026-02-14", end_date: "2026-02-14", linked_event: "Level 04 plots" },
    ],
    prelims: [
      { name: "Finishing supervisor", qty: 1, unit: "day", rate: 330, notes: "12/02/2026 to 14/02/2026 - plot coordination, QA and access sequencing.", prelim_type: "staff", start_date: "2026-02-12", end_date: "2026-02-14", linked_event: "Level 04 plots" },
    ],
    evidence: [
      { category: "drawing", file_name: "DEMO-Level-04-revised-setting-out.pdf", description: "Revised architect set-out for plots 4.06-4.10.", evidence_date: "2026-02-12", relates_to: "Revised design information" },
      { category: "photo", file_name: "DEMO-Level-04-partition-rework.jpg", description: "Photos showing track removed and re-set in affected plots.", evidence_date: "2026-02-13", relates_to: "Abortive/rework" },
    ],
  },
  {
    title: "VAR 002 - Façade bracket clashes with revised steel edge angle",
    project_name: "Westgate Residential Block C",
    main_contractor: "Harwood Developments",
    contract_type: "jct_d_and_b_2016",
    contract_source: "standard_logic",
    event_number: 2,
    event_reference: "VAR 002",
    status: "submitted",
    payment_status: "submitted_for_payment",
    event_date: "2026-01-26",
    notice_period_days: null,
    submitted_date: "2026-02-17",
    expected_payment_date: "2026-03-22",
    last_action_type: "payment_updated",
    last_action_date: "2026-04-05",
    delay_days: 5,
    fee_percent: 10,
    fee_basis: "defined_cost_plus_prelims",
    generated_pack: true,
    basis: {
      happened_summary: "Façade install at east elevation stopped when brackets clashed with revised steel edge angle. Fixing positions did not match the bracket schedule on site. Installer held mast climber position while detail was checked and brackets were re-drilled/packed locally.",
      cause_type: "design_coordination",
      cause_summary: "Clash arose from revised steel detail not coordinated with façade bracket setting out. Planned install sequence could not continue safely until fixings were confirmed.",
      difference_from_plan: "Planned work was continuous bracket/fix install. Actual work included stoppage, checking, local re-drilling, packing and return visits to complete missed bays.",
      mechanism_tags: ["standing_time", "resequencing", "restricted_access"],
      time_impact_toggle: "yes",
      mitigation_summary: "Crew moved to two available bays where possible, but mast climber position limited alternatives. Records: RFI, photos, marked-up bracket schedule and daily allocation.",
    },
    resources: [
      { category: "labour", item_name: "Façade fixing gang", unit: "hour", hours: 16, qty: 3, rate: 45, notes: "Hold, re-check, re-drill, pack and complete return works to east elevation bays.", tags: ["standing_time", "rework_abortive"], start_date: "2026-01-26", end_date: "2026-01-30", linked_event: "East elevation" },
      { category: "plant", item_name: "Mast climber", unit: "day", hours: null, qty: 2, rate: 380, notes: "Held in position while detail resolved and return bay completed.", tags: ["standing_time", "restricted_access"], start_date: "2026-01-26", end_date: "2026-01-27", linked_event: "East elevation" },
      { category: "material", item_name: "Packers and fixings", unit: "each", hours: null, qty: 1, rate: 620, notes: "Additional fixings/packers following revised steel detail.", tags: ["material_extra"], start_date: "2026-01-29", end_date: "2026-01-29", linked_event: "East elevation" },
      { category: "material", item_name: "Subcontract support - engineer check / setting out visit", unit: "each", hours: null, qty: 1, rate: 450, notes: "Additional setting out check following bracket clash.", tags: ["coordination"], start_date: "2026-01-28", end_date: "2026-01-28", linked_event: "East elevation" },
    ],
    prelims: [
      { name: "Façade supervisor", qty: 1, unit: "day", rate: 360, notes: "26/01/2026 to 30/01/2026 - clash coordination, RFI support and return planning.", prelim_type: "staff", start_date: "2026-01-26", end_date: "2026-01-30", linked_event: "East elevation" },
      { name: "Access coordinator", qty: 1, unit: "day", rate: 290, notes: "26/01/2026 to 30/01/2026 - mast climber movement planning and access hold record.", prelim_type: "staff", start_date: "2026-01-26", end_date: "2026-01-30", linked_event: "East elevation" },
    ],
    evidence: [
      { category: "rfi", file_name: "DEMO-East-elevation-bracket-clash-RFI.pdf", description: "RFI and sketch showing revised steel edge angle clash.", evidence_date: "2026-01-27", relates_to: "Design coordination" },
      { category: "allocation", file_name: "DEMO-Facade-allocation-east-elevation.pdf", description: "Allocation record showing fixing gang and mast climber affected.", evidence_date: "2026-01-26", relates_to: "Standing time / rework" },
    ],
  },
  {
    title: "VAR 003 - Out of sequence fire stopping to risers before inspection",
    project_name: "Westgate Residential Block C",
    main_contractor: "Harwood Developments",
    contract_type: "jct_d_and_b_2016",
    contract_source: "standard_logic",
    event_number: 3,
    event_reference: "VAR 003",
    status: "draft",
    payment_status: "not_applied",
    event_date: "2026-05-06",
    notice_period_days: null,
    submitted_date: null,
    expected_payment_date: null,
    last_action_type: "updated",
    last_action_date: "2026-05-09",
    delay_days: 2,
    fee_percent: 10,
    fee_basis: "defined_cost_plus_prelims",
    basis: {
      happened_summary: "Site requested fire stopping to north core risers ahead of planned inspection date. Area was not fully cleared and some MEP penetrations were still being adjusted. Operatives worked around other trades and returned to complete missed openings.",
      cause_type: "acceleration_or_out_of_sequence",
      cause_summary: "Request was made to support inspection/hand-over sequence. Works were brought forward from planned date and carried out around incomplete builder's work/MEP interfaces.",
      difference_from_plan: "Planned work was one clean visit to completed risers. Actual work required fragmented visits, waiting on access, additional protection and return to incomplete penetrations.",
      mechanism_tags: ["resequencing", "restricted_access", "standing_time"],
      time_impact_toggle: "unsure",
      mitigation_summary: "Supervisor agreed a hit list by riser and kept photo records of completed openings. Team returned next day for missed penetrations. Records: WhatsApp/site instruction, photos and QA sheets.",
    },
    resources: [
      { category: "labour", item_name: "Fire stopping operatives", unit: "hour", hours: 7.5, qty: 2, rate: 42, notes: "Fragmented visit, protection and return to incomplete riser penetrations.", tags: ["resequencing", "restricted_access"], start_date: "2026-05-06", end_date: "2026-05-07", linked_event: "North core risers" },
      { category: "labour", item_name: "Supervisor", unit: "hour", hours: 4, qty: 1, rate: 48, notes: "Hit list, coordination with MEP and QA photo records.", tags: ["coordination"], start_date: "2026-05-06", end_date: "2026-05-07", linked_event: "North core risers" },
      { category: "material", item_name: "Fire stopping consumables", unit: "each", hours: null, qty: 1, rate: 390, notes: "Additional consumables/wastage from fragmented access and return openings.", tags: ["material_extra"], start_date: "2026-05-07", end_date: "2026-05-07", linked_event: "North core risers" },
      { category: "plant", item_name: "Podium steps / access towers", unit: "day", hours: null, qty: 2, rate: 55, notes: "Access equipment retained for return visit.", tags: ["restricted_access"], start_date: "2026-05-06", end_date: "2026-05-07", linked_event: "North core risers" },
    ],
    prelims: [
      { name: "Finishing supervisor", qty: 1, unit: "day", rate: 330, notes: "06/05/2026 to 07/05/2026 - hit list coordination, access control, QA record and return planning.", prelim_type: "staff", start_date: "2026-05-06", end_date: "2026-05-07", linked_event: "North core risers" },
    ],
    evidence: [
      { category: "instruction", file_name: "DEMO-North-core-fire-stopping-request.pdf", description: "WhatsApp/site request to bring riser fire stopping forward for inspection.", evidence_date: "2026-05-06", relates_to: "Out of sequence instruction" },
      { category: "qa", file_name: "DEMO-Fire-stopping-QA-hit-list.pdf", description: "QA/hit list showing incomplete and return openings.", evidence_date: "2026-05-07", relates_to: "Return visit / fragmented works" },
    ],
  },
  {
    title: "CE 010 - ST94 steel rehandling and delayed measured works",
    project_name: "Ainsworth Energy Recovery Facility",
    main_contractor: "Morrison Infrastructure",
    contract_type: "nec4_ecs_option_b",
    contract_source: "standard_logic",
    event_number: 10,
    event_reference: "CE010",
    status: "draft",
    payment_status: "not_applied",
    event_date: "2025-11-24",
    notice_period_days: 56,
    submitted_date: null,
    expected_payment_date: null,
    last_action_type: "updated",
    last_action_date: "2026-01-29",
    delay_days: 3,
    fee_percent: 12.5,
    fee_basis: "defined_cost_plus_prelims",
    basis: {
      happened_summary: "Steel fixing resources attended to progress the ST94 measured works between 24/11 and 27/11 but the workface was not available as planned. The ST94 reinforcement had to be moved multiple times at the Contractor's request before the gang could proceed, setting-out marks were not available for the operatives to work to, and Contractor's plant/machinery remained within the work area. The received subcontractor CE records three operatives affected for 35 hours each.",
      cause_type: "access_or_permit_restriction",
      cause_summary: "The disruption arose from Contractor-controlled coordination and access matters: repeated relocation/rehandling of the ST94 reinforcement, missing setting-out marks and plant left within the work area. These issues prevented the steel fixing gang from progressing the planned measured work productively during the affected period.",
      difference_from_plan: "The planned basis was that the ST94 reinforcement would be available at the correct workface, the setting-out marks would be in place and the area would be clear for fixing. The actual position required the gang to wait, assist with repeated movement/rehandling of the ST94 steel, work around an obstructed area and lose planned productive fixing time.",
      mechanism_tags: ["standing_time", "additional_handling", "restricted_access", "missing_information"],
      time_impact_toggle: "yes",
      mitigation_summary: "The gang remained available on site whilst access and setting-out issues associated with the ST94 works were resolved. Operatives assisted with movement/rehandling of the reinforcement where required and attempted to progress alternative activities where possible pending release of a workable fixing area.",
    },
    resources: [
      { category: "labour", item_name: "Tyler - steel fixer / carpenter SF", unit: "hour", hours: 35, qty: 1, rate: 32, notes: "Affected operative from received CE010. 35 hours recorded due to repeated ST94 steel movement/rehandling, missing setting-out marks and obstruction within the work area between 24/11 and 27/11.", tags: ["standing_time", "additional_handling", "restricted_access"], start_date: "2025-11-24", end_date: "2025-11-27", linked_event: "ST94 steel fixing works" },
      { category: "labour", item_name: "S Wren - steel fixer / carpenter SF", unit: "hour", hours: 35, qty: 1, rate: 32, notes: "Affected operative from received CE010. Labour retained against ST94 measured works while the steel was moved multiple times and the workface was not available for productive fixing.", tags: ["standing_time", "additional_handling", "restricted_access"], start_date: "2025-11-24", end_date: "2025-11-27", linked_event: "ST94 steel fixing works" },
      { category: "labour", item_name: "T Wren - steel fixer / carpenter SF", unit: "hour", hours: 35, qty: 1, rate: 32, notes: "Affected operative from received CE010. 35 hours recorded for disrupted steel fixing due to ST94 rehandling, no setting-out marks and Contractor's plant/machinery left in the work area.", tags: ["standing_time", "missing_information", "restricted_access"], start_date: "2025-11-24", end_date: "2025-11-27", linked_event: "ST94 steel fixing works" },
      { category: "plant", item_name: "Telehandler / lifting support", unit: "hour", hours: 12, qty: 1, rate: 58, notes: "Intermittent lifting support for repeated ST94 reinforcement movement, rehandling and workface clearance during the affected period.", tags: ["additional_handling", "restricted_access"], start_date: "2025-11-24", end_date: "2025-11-27", linked_event: "ST94 steel fixing works" },
      { category: "plant", item_name: "MEWP / access equipment standby", unit: "day", hours: null, qty: 2, rate: 120, notes: "Access equipment retained while setting-out marks and workface availability were resolved.", tags: ["standing_time", "restricted_access"], start_date: "2025-11-24", end_date: "2025-11-27", linked_event: "ST94 steel fixing works" },
    ],
    prelims: [
      { name: "Site supervisor", qty: 1, unit: "day", rate: 340, notes: "24/11/2025 to 27/11/2025 - coordination of affected gang, workface access issues, steel rehandling records and client/main contractor interface.", prelim_type: "staff", start_date: "2025-11-24", end_date: "2025-11-27", linked_event: "ST94 steel fixing works" },
    ],
    evidence: [
      { category: "valuation", file_name: "CE010-original-subcontractor-quotation.xlsx", description: "Original subcontractor CE showing three operatives at 35 hours each at £32/hour, total labour £3,360 before fee.", evidence_date: "2026-01-29", relates_to: "Original subcontractor CE" },
      { category: "site_record", file_name: "CE010-ST94-rehandling-and-access-note.pdf", description: "Record basis: ST94 steel moved multiple times at Contractor request, setting-out marks unavailable, Contractor machinery/plant left within the work area and inability to work productively between 24/11 and 27/11.", evidence_date: "2025-11-27", relates_to: "Cause and affected period" },
      { category: "allocation", file_name: "CE010-steel-fixing-labour-record.pdf", description: "Labour record supporting Tyler, S Wren and T Wren at 35 hours each on the affected ST94 steel fixing works.", evidence_date: "2025-11-27", relates_to: "Labour hours" },
    ],
  }
];


function demoDate(offsetDays: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function offsetDemoDate(date: string, dayDelta: number) {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  d.setUTCDate(d.getUTCDate() + dayDelta);
  return d.toISOString().slice(0, 10);
}

function shiftNestedDemoDates(event: DemoEvent, newEventDate: string) {
  const oldTime = new Date(`${event.event_date}T00:00:00Z`).getTime();
  const newTime = new Date(`${newEventDate}T00:00:00Z`).getTime();
  if (Number.isNaN(oldTime) || Number.isNaN(newTime)) return;
  const dayDelta = Math.round((newTime - oldTime) / 86400000);

  event.event_date = newEventDate;
  for (const resource of event.resources) {
    resource.start_date = offsetDemoDate(resource.start_date, dayDelta);
    resource.end_date = offsetDemoDate(resource.end_date, dayDelta);
  }
  for (const prelim of event.prelims) {
    prelim.start_date = offsetDemoDate(prelim.start_date, dayDelta);
    prelim.end_date = offsetDemoDate(prelim.end_date, dayDelta);
  }
  for (const evidence of event.evidence) {
    evidence.evidence_date = offsetDemoDate(evidence.evidence_date, dayDelta);
  }
}

const DEMO_EVENT_REALISM: Record<string, Partial<DemoEvent>> = {
  "CE 001": {
    status: "submitted",
    payment_status: "submitted_for_payment",
    event_date: demoDate(-16),
    submitted_date: demoDate(-7),
    expected_payment_date: demoDate(21),
    last_action_type: "submitted",
    last_action_date: demoDate(-7),
    generated_pack: false,
  },
  "CE 002": {
    status: "rejected",
    payment_status: "not_applied",
    event_date: demoDate(-24),
    submitted_date: demoDate(-14),
    expected_payment_date: null,
    last_action_type: "status_rejected",
    last_action_date: demoDate(-2),
    generated_pack: false,
  },
  "CE 003": {
    status: "draft",
    payment_status: "not_applied",
    event_date: demoDate(-3),
    submitted_date: null,
    expected_payment_date: null,
    last_action_type: "updated",
    last_action_date: demoDate(-1),
    generated_pack: false,
  },
  "VAR 001": {
    status: "paid",
    payment_status: "paid",
    event_date: demoDate(-45),
    submitted_date: demoDate(-34),
    expected_payment_date: demoDate(-10),
    last_action_type: "paid",
    last_action_date: demoDate(-5),
    generated_pack: false,
  },
  "VAR 002": {
    status: "accepted",
    payment_status: "submitted_for_payment",
    event_date: demoDate(-31),
    submitted_date: demoDate(-18),
    expected_payment_date: demoDate(12),
    last_action_type: "accepted",
    last_action_date: demoDate(-4),
    generated_pack: false,
  },
  "VAR 003": {
    status: "ready",
    payment_status: "not_applied",
    event_date: demoDate(-5),
    submitted_date: null,
    expected_payment_date: null,
    last_action_type: "updated",
    last_action_date: demoDate(-1),
    generated_pack: false,
  },
  "CE010": {
    status: "submitted",
    payment_status: "submitted_for_payment",
    event_date: demoDate(-38),
    submitted_date: demoDate(-26),
    expected_payment_date: demoDate(-4),
    last_action_type: "payment_updated",
    last_action_date: demoDate(-4),
    generated_pack: false,
  },
};

for (const event of EVENTS) {
  const override = DEMO_EVENT_REALISM[event.event_reference];
  if (!override) continue;
  const nextEventDate = typeof override.event_date === "string" ? override.event_date : event.event_date;
  if (nextEventDate !== event.event_date) shiftNestedDemoDates(event, nextEventDate);
  Object.assign(event, override);
}

const EWNS: DemoEwn[] = [
  {
    title: "EWN - HV route clearance not confirmed at south duct crossing",
    project_name: "Ainsworth Energy Recovery Facility",
    main_contractor: "Morrison Infrastructure",
    contract_type: "nec4_ecs_option_b",
    status: "open",
    event_date: "2026-04-28",
    location: "South duct crossing / HV corridor",
    what_happened: "HV route clearance has not been confirmed for the duct crossing planned next week. Trial holes show services closer to the dig line than marked on latest permit sketch.",
    impact: "Risk of excavation being held or changed to hand/VAC method. Could affect duct install sequence and follow-on backfill.",
    required_action: "Confirm HV clearance and excavation method before gang is committed. Issue revised permit sketch if exclusion zone changes.",
    evidence: "Permit sketch, trial hole photos, supervisor diary note and service scan record.",
  },
  {
    title: "EWN - Transformer base obstruction may require further breakout",
    project_name: "Ainsworth Energy Recovery Facility",
    main_contractor: "Morrison Infrastructure",
    contract_type: "nec4_ecs_option_b",
    status: "converted",
    event_date: "2026-05-08",
    location: "Transformer base excavation",
    what_happened: "Concrete obstruction exposed below made ground during reduced level dig. It is not shown on the clearance sketch issued to site.",
    impact: "Normal excavation has slowed and breaker attachment may be required if obstruction continues along duct route.",
    required_action: "Confirm whether to break out the concrete and agree record basis for additional time/plant/disposal.",
    evidence: "Photos, site diary, clearance sketch and disposal tickets to follow.",
    convert_to_event_number: 3,
  },
  {
    title: "EWN - Tile approval delay may hold bathroom follow-on works",
    project_name: "Westgate Residential Block C",
    main_contractor: "Harwood Developments",
    contract_type: "jct_d_and_b_2016",
    status: "monitoring",
    event_date: "2026-03-18",
    location: "Level 05 bathrooms",
    what_happened: "Bathroom tile approval still outstanding. Tiling start is due next week and materials cannot be ordered until finish selection is confirmed.",
    impact: "Potential delay to bathroom tiling, sanitaryware install and final clean sequence if approval slips beyond this week.",
    required_action: "Confirm tile/grout approval or issue alternative selection by Friday so procurement can proceed.",
    evidence: "Submittal tracker, email chase and 3-week lookahead.",
  },
  {
    title: "EWN - Lift lobby ceiling zones not clear for close up",
    project_name: "Westgate Residential Block C",
    main_contractor: "Harwood Developments",
    contract_type: "jct_d_and_b_2016",
    status: "converted",
    event_date: "2026-04-22",
    location: "Level 03 lift lobby",
    what_happened: "Ceiling close up requested but MEP containment and access panels are not complete. Drylining team asked to work around incomplete zones.",
    impact: "Risk of out-of-sequence boarding, temporary trims and return visits once MEP areas are complete.",
    required_action: "Confirm agreed incomplete areas and basis for return visit/extra attendance before close-up works continue.",
    evidence: "Lookahead, site photos and MEP snag list.",
    convert_to_event_number: 3,
  },
];



const DEMO_EWN_REALISM: Record<string, Partial<DemoEwn>> = {
  "EWN - HV route clearance not confirmed at south duct crossing": {
    status: "open",
    event_date: demoDate(-2),
  },
  "EWN - Transformer base obstruction may require further breakout": {
    status: "converted",
    event_date: demoDate(-3),
  },
  "EWN - Tile approval delay may hold bathroom follow-on works": {
    status: "monitoring",
    event_date: demoDate(-9),
  },
  "EWN - Lift lobby ceiling zones not clear for close up": {
    status: "converted",
    event_date: demoDate(-14),
  },
};

for (const ewn of EWNS) {
  const override = DEMO_EWN_REALISM[ewn.title];
  if (override) Object.assign(ewn, override);
}

async function isAdminEmail(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return checkAdminWithServiceRole(supabaseAdmin(), normalized);
}

async function collectExistingDemoEventIds(admin: any, userId: string) {
  const ids = new Set<string>();
  const eventTitles = EVENTS.map((event) => event.title);
  const eventReferences = EVENTS.map((event) => event.event_reference);

  const queries = [
    (admin as any).from("events").select("id").eq("user_id", userId).in("project_name", PROJECTS),
    (admin as any).from("events").select("id").eq("user_id", userId).in("title", eventTitles),
    (admin as any).from("events").select("id").eq("user_id", userId).in("event_reference", eventReferences),
    (admin as any).from("events").select("id").eq("user_id", userId).eq("event_financial_summary->>seed_marker", DEMO_SEED_MARKER),
  ];

  for (const query of queries) {
    const result = await query;
    if (result.error) {
      if (isMissingOptionalTable(result.error) || isMissingColumn(result.error, "event_financial_summary")) continue;
      throw result.error;
    }
    for (const row of result.data || []) {
      if (row?.id) ids.add(row.id);
    }
  }

  return Array.from(ids);
}

function assertNoDuplicateDemoResourceRows(rows: any[]) {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const row of rows) {
    const key = [
      row.event_id,
      row.category,
      row.item_name,
      row.start_date || "",
      row.end_date || "",
      row.linked_event || "",
      row.notes || "",
    ].join("||").toLowerCase();

    if (seen.has(key)) {
      duplicates.push(`${row.item_name} / ${row.linked_event || "General activity"} / ${row.start_date || "no date"}`);
    }
    seen.add(key);
  }

  if (duplicates.length) {
    throw new Error(`Demo seed contains duplicate resource activity rows: ${duplicates.join("; ")}`);
  }
}

function normaliseDemoActivityName(value: string | null | undefined) {
  return String(value || "General activity").trim().toLowerCase();
}

function assertLabourPlantActivityCoverage(events: DemoEvent[]) {
  const mismatches: string[] = [];

  for (const event of events) {
    const labourActivities = new Set(
      event.resources
        .filter((resource) => resource.category === "labour")
        .map((resource) => normaliseDemoActivityName(resource.linked_event))
    );
    const plantActivities = new Set(
      event.resources
        .filter((resource) => resource.category === "plant")
        .map((resource) => normaliseDemoActivityName(resource.linked_event))
    );

    for (const activity of labourActivities) {
      if (!plantActivities.has(activity)) mismatches.push(`${event.event_reference}: plant missing for "${activity}"`);
    }

    for (const activity of plantActivities) {
      if (!labourActivities.has(activity)) mismatches.push(`${event.event_reference}: labour missing for "${activity}"`);
    }
  }

  if (mismatches.length) {
    throw new Error(`Demo seed labour/plant activity coverage mismatch: ${mismatches.join("; ")}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await getAuthUserFromRequest(req);
    if (!adminUser?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminEmail(adminUser.email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const targetEmail = normalizeEmail(body?.targetEmail || body?.email || adminUser.email);
    if (!targetEmail) return NextResponse.json({ error: "Missing target email" }, { status: 400 });

    const admin = supabaseAdmin() as any;
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (users.error) throw users.error;
    const target = ((users.data as { users?: Array<{ id?: string; email?: string | null }> } | null)?.users ?? []).find((u: { id?: string; email?: string | null }) => normalizeEmail(u.email) === targetEmail);
    if (!target?.id) return NextResponse.json({ error: `No Supabase auth user found for ${targetEmail}` }, { status: 404 });

    assertLabourPlantActivityCoverage(EVENTS);
    assertNoDuplicateDemoResourceRows(
      EVENTS.flatMap((event) => event.resources.map((resource) => ({
        ...resource,
        event_id: `${event.project_name}:${event.event_number}`,
      })))
    );

    const oldIds = await collectExistingDemoEventIds(admin, target.id);

    const oldEwnIds = new Set<string>();
    const ewnTitles = EWNS.map((ewn) => ewn.title);
    const existingEwnQueries = [
      (admin as any).from("ewns").select("id").eq("user_id", target.id).in("project_name", PROJECTS),
      (admin as any).from("ewns").select("id").eq("user_id", target.id).in("title", ewnTitles),
      oldIds.length ? (admin as any).from("ewns").select("id").eq("user_id", target.id).in("converted_event_id", oldIds) : null,
    ].filter(Boolean);

    for (const query of existingEwnQueries) {
      const result = await query;
      if (result.error) {
        if (isMissingOptionalTable(result.error) || isMissingColumn(result.error, "converted_event_id")) continue;
        throw result.error;
      }
      for (const row of result.data || []) {
        if (row?.id) oldEwnIds.add(row.id);
      }
    }

    if (oldEwnIds.size) {
      const ewnDelete = await (admin as any).from("ewns").delete().eq("user_id", target.id).in("id", Array.from(oldEwnIds));
      if (ewnDelete.error) throw ewnDelete.error;
    }

    if (oldIds.length) {
      await optionalQuery((admin as any).from("event_file_share_links").delete().in("event_id", oldIds));
      await optionalQuery((admin as any).from("event_actions").delete().in("event_id", oldIds));
      await optionalQuery((admin as any).from("event_rebuttals").delete().in("event_id", oldIds));
      await optionalQuery((admin as any).from("event_ai_drafts").delete().in("event_id", oldIds));
      await optionalQuery((admin as any).from("event_packs").delete().in("event_id", oldIds));
      await optionalQuery((admin as any).from("event_files").delete().in("event_id", oldIds));
      await optionalQuery((admin as any).from("event_contract_files").delete().in("event_id", oldIds));
      await optionalQuery((admin as any).from("event_review_settings").delete().in("event_id", oldIds));
      await optionalQuery((admin as any).from("event_valuation_settings").delete().in("event_id", oldIds));
      await optionalQuery((admin as any).from("event_prelim_lines").delete().in("event_id", oldIds));
      await optionalQuery((admin as any).from("event_resource_lines").delete().in("event_id", oldIds));
      await optionalQuery((admin as any).from("event_basis").delete().in("event_id", oldIds));
      const eventDelete = await (admin as any).from("events").delete().in("id", oldIds).eq("user_id", target.id);
      if (eventDelete.error) throw eventDelete.error;
    }

    await optionalQuery((admin as any).from("projects").delete().eq("user_id", target.id).in("project_name", PROJECTS));

    const now = new Date().toISOString();
    const demoProjects = Array.from(
      new Map(
        EVENTS.map((event) => [
          demoProjectKey(event.project_name, event.main_contractor),
          {
            user_id: target.id,
            project_name: event.project_name,
            main_contractor: event.main_contractor,
            contract_type: event.contract_type,
            status: "live",
            updated_at: now,
          },
        ])
      ).values()
    );
    const projectInsert = await (admin as any).from("projects")
      .upsert(demoProjects, { onConflict: "user_id,project_name,main_contractor" })
      .select("id,project_name,main_contractor");
    if (projectInsert.error) throw new Error(`Demo seed failed while creating projects: ${describeSupabaseError(projectInsert.error)}`);
    const projectIds = new Map<string, string>(
      (projectInsert.data || []).map((project: { id: string; project_name: string; main_contractor?: string | null }) => [
        demoProjectKey(project.project_name, project.main_contractor),
        project.id,
      ])
    );

    const eventIds = new Map<string, string>();

    const eventRows = EVENTS.map((e) => {
      const id = crypto.randomUUID();
      eventIds.set(`${e.project_name}:${e.event_number}`, id);
      const summary = financialSummary(e);
      return {
        id,
        user_id: target.id,
        title: e.title,
        project_name: e.project_name,
        main_contractor: e.main_contractor,
        project_id: projectIds.get(demoProjectKey(e.project_name, e.main_contractor)),
        status: e.status,
        contract_type: e.contract_type,
        contract_source: e.contract_source,
        event_number: e.event_number,
        event_reference: e.event_reference,
        event_date: e.event_date,
        notice_period_days: e.notice_period_days,
        notification_deadline: addDays(e.event_date, e.notice_period_days),
        payment_status: e.payment_status,
        submitted_date: e.submitted_date,
        expected_payment_date: e.expected_payment_date,
        last_action_type: e.last_action_type,
        last_action_date: e.last_action_date,
        delay_days: e.delay_days,
        event_financial_summary: summary,
        created_at: `${e.event_date}T09:00:00.000Z`,
        updated_at: now,
      };
    });

    let eventsInsert = await trySeedInsert(admin, "events", eventRows, "events");
    if (eventsInsert.error && isPaymentStatusConstraintError(eventsInsert.error)) {
      const legacyEventRows = eventRows.map((row) => ({
        ...row,
        payment_status: row.payment_status === "submitted_for_payment" ? "applied" : row.payment_status,
      }));
      eventsInsert = await trySeedInsert(admin, "events", legacyEventRows, "events with legacy payment status");
    }
    if (eventsInsert.error) throw new Error(`Demo seed failed while inserting events: ${describeSupabaseError(eventsInsert.error)}`);

    const basisRows = EVENTS.map((e) => ({ user_id: target.id, event_id: eventIds.get(`${e.project_name}:${e.event_number}`), ...e.basis, updated_at: now }));
    const basisInsert = await insertRowsWithOptionalUserId(admin, "event_basis", basisRows);
    if (basisInsert.error) throw basisInsert.error;

    const resourceRows = EVENTS.flatMap((e) => {
      const eventId = eventIds.get(`${e.project_name}:${e.event_number}`);
      return e.resources.map((r, index) => {
        const safe = normaliseResourceForDemoInsert(r);
        return {
          event_id: eventId,
          user_id: target.id,
          category: r.category,
          item_name: r.item_name,
          unit: safe.unit,
          hours: safe.hours,
          qty: safe.qty,
          rate: safe.rate,
          total: safe.total,
          notes: safe.notes,
          tags: r.tags,
          start_date: r.start_date,
          end_date: r.end_date,
          linked_event: r.linked_event,
          created_at: `${r.start_date}T${String(9 + (index % 6)).padStart(2, "0")}:15:00.000Z`,
        };
      });
    });
    assertLabourPlantActivityCoverage(EVENTS);
    assertNoDuplicateDemoResourceRows(resourceRows);
    const resourceInsert = await insertResourceRowsWithUnitFallback(admin, resourceRows);
    if (resourceInsert.error) throw resourceInsert.error;

    const valuationRows = EVENTS.map((e) => ({
      event_id: eventIds.get(`${e.project_name}:${e.event_number}`),
      user_id: target.id,
      fee_percent: e.fee_percent,
      fee_basis: e.fee_basis,
      work_days_per_week: 5,
      updated_at: now,
    }));
    const valuationInsert = await upsertRowsWithOptionalUserId(admin, "event_valuation_settings", valuationRows, { onConflict: "event_id" });
    if (valuationInsert.error) throw valuationInsert.error;

    const prelimRows = EVENTS.flatMap((e) => {
      const eventId = eventIds.get(`${e.project_name}:${e.event_number}`);
      return e.prelims.map((p, index) => ({
        event_id: eventId,
        user_id: target.id,
        name: p.name,
        qty: p.qty,
        unit: p.unit,
        rate: p.rate,
        notes: [p.notes, `Date range: ${p.start_date} to ${p.end_date}.`, `Linked event: ${p.linked_event}.`].join("\n"),
        prelim_type: p.prelim_type,
        created_at: `${p.start_date}T${String(10 + (index % 5)).padStart(2, "0")}:00:00.000Z`,
      }));
    });
    const prelimInsert = await insertRowsWithOptionalUserId(admin, "event_prelim_lines", prelimRows);
    if (prelimInsert.error) throw prelimInsert.error;

    const reviewRows = EVENTS.map((e) => ({
      event_id: eventIds.get(`${e.project_name}:${e.event_number}`),
      user_id: target.id,
      include_basis: true,
      include_entitlement: true,
      include_time_impact: true,
      include_evidence_register: true,
      include_cost_summary: true,
      include_prelims_fee: true,
      include_risk_notes: true,
      include_excel: true,
      include_pdf: false,
      qualifications_notes: `Demo record for ${e.event_reference}. Seeded facts include site-style inputs, resource dates, prelim notes and evidence notes. Replace demo evidence with real uploads for live use.`,
      updated_at: now,
    }));
    const reviewInsert = await upsertRowsWithOptionalUserId(admin, "event_review_settings", reviewRows, { onConflict: "event_id" });
    if (reviewInsert.error) throw reviewInsert.error;

    const evidenceRows = EVENTS.flatMap((e) => {
      const eventId = eventIds.get(`${e.project_name}:${e.event_number}`);
      return evidenceCoverageForEvent(e).map((f) => ({
        event_id: eventId,
        user_id: target.id,
        category: normaliseEvidenceCategory(f.category),
        file_name: f.file_name,
        file_path: `demo/${target.id}/${eventId}/${f.file_name}`,
        file_size: 128000,
        mime_type: f.file_name.endsWith(".jpg") ? "image/jpeg" : "application/pdf",
        description: f.description,
        evidence_date: f.evidence_date,
        relates_to: f.relates_to,
        created_at: `${f.evidence_date}T08:45:00.000Z`,
      }));
    });
    await optionalQuery(insertRowsWithOptionalUserId(admin, "event_files", evidenceRows));

    const packEvents: DemoEvent[] = [];
    // Do not seed event_packs for demo/tester accounts.
    // Demo users must experience the real flow: Generate Pack -> saved output -> Download Pack.
    // Seeding event_packs makes fresh demo accounts show Download Pack immediately, which hides the generation/credit flow.
    for (const e of packEvents) {
      const eventId = eventIds.get(`${e.project_name}:${e.event_number}`);
      if (!eventId) continue;
      const summary = financialSummary(e);
      const packInsert = await ((admin as any).from("event_packs") as any)
        .insert([{
          event_id: eventId,
          user_id: target.id,
          delay_days: e.delay_days,
          defined_cost: summary.resources_total,
          prelim_cost: summary.prelims_total,
          fee_amount: summary.fee_amount,
          total_value: summary.final_total,
          readiness_score: 84,
          pack_version: 1,
          created_at: `${(e.submitted_date || e.event_date)}T14:30:00.000Z`,
        }])
        .select("id")
        .single();

      if (packInsert.error) {
        if (isMissingOptionalTable(packInsert.error)) continue;
        throw packInsert.error;
      }

      const draftInsert = await trySeedInsert(admin, "event_ai_drafts", [{
        event_id: eventId,
        user_id: target.id,
        pack_id: (packInsert.data as any)?.id || null,
        draft_payload: {
          seeded_demo: true,
          event_title: e.title,
          event_reference: e.event_reference,
          basis: e.basis,
          resources: e.resources,
          prelims: e.prelims,
          evidence: e.evidence,
          financial_summary: summary,
        },
        draft_output: packOutput(e),
        status: "draft_generated",
        created_at: `${(e.submitted_date || e.event_date)}T14:35:00.000Z`,
        updated_at: now,
      }], "event_ai_drafts");
      if (draftInsert.error && !isMissingOptionalTable(draftInsert.error)) throw new Error(`Demo seed failed while inserting event_ai_drafts: ${describeSupabaseError(draftInsert.error)}`);
    }

    for (const e of EVENTS.filter((x) => x.contractor_response)) {
      const eventId = eventIds.get(`${e.project_name}:${e.event_number}`);
      if (!eventId) continue;
      await optionalQuery(trySeedUpsert(admin, "event_rebuttals", [{
        event_id: eventId,
        user_id: target.id,
        contractor_response: e.contractor_response,
        rebuttal_subject: `Response to assessment - ${e.event_reference}`,
        rebuttal_body: "Demo rebuttal placeholder. Regenerate this rebuttal to test the live AI using the seeded rejection wording and underlying event data.",
        key_points: [
          "Permit/access restriction was outside the subcontractor's direct control.",
          "Resources were allocated to the specific work face and could not be productively redeployed.",
          "Allocation, permit chase and diary records should be checked before issuing final wording.",
        ],
        risk_note: "Seeded demo only. Use live generation for final rebuttal wording.",
        created_at: "2026-04-18T12:00:00.000Z",
        updated_at: now,
      }], { onConflict: "event_id" }, "event_rebuttals"));
    }

    const ewnRows = EWNS.map((ewn) => {
      const convertedId = ewn.convert_to_event_number
        ? eventIds.get(`${ewn.project_name}:${ewn.convert_to_event_number}`) || null
        : null;
      return {
        user_id: target.id,
        title: ewn.title,
        project_id: projectIds.get(demoProjectKey(ewn.project_name, ewn.main_contractor)),
        project_name: ewn.project_name,
        main_contractor: ewn.main_contractor,
        contract_type: ewn.contract_type,
        status: ewn.status,
        converted_event_id: convertedId,
        converted_at: convertedId ? `${ewn.event_date}T16:15:00.000Z` : null,
        event_date: ewn.event_date,
        location: ewn.location,
        what_happened: ewn.what_happened,
        impact: ewn.impact,
        required_action: ewn.required_action,
        evidence_summary: ewn.evidence,
        created_at: `${ewn.event_date}T08:30:00.000Z`,
        updated_at: now,
      };
    });
    const ewnInsert = await insertRowsWithOptionalColumns(admin, "ewns", ewnRows, [
      "converted_event_id",
      "converted_at",
      "contract_reference",
      "main_contractor",
      "contract_type",
      "location",
      "what_happened",
      "impact",
      "required_action",
      "evidence_summary",
    ]);
    if (ewnInsert.error) throw ewnInsert.error;

    // Final guard: demo seed must never leave generated pack rows behind.
    // If any earlier version, optional trigger, or partial retry inserted pack rows,
    // remove them for the freshly seeded demo events so Review starts at Generate Pack.
    const seededEventIds = Array.from(eventIds.values()).filter(Boolean);
    if (seededEventIds.length) {
      await optionalQuery((admin as any).from("event_ai_drafts").delete().in("event_id", seededEventIds).eq("user_id", target.id));
      await optionalQuery((admin as any).from("event_packs").delete().in("event_id", seededEventIds).eq("user_id", target.id));
    }

    await optionalQuery(trySeedUpsert(admin, "profiles", [{
      id: target.id,
      credits_remaining: 3,
      ewn_credits_remaining: 20,
      ewn_credits_limit: 20,
      updated_at: now,
    }], { onConflict: "id" }, "profiles"));

    await optionalQuery(trySeedUpsert(admin, "user_credits", [{
      user_id: target.id,
      credits_remaining: 3,
      updated_at: now,
    }], { onConflict: "user_id" }, "user_credits"));

    const resourceCount = await (admin as any).from("event_resource_lines")
      .select("id", { count: "exact", head: true })
      .in("event_id", seededEventIds);
    if (resourceCount.error) throw resourceCount.error;

    const prelimCount = await (admin as any).from("event_prelim_lines")
      .select("id", { count: "exact", head: true })
      .in("event_id", seededEventIds);
    if (prelimCount.error) throw prelimCount.error;

    if ((resourceCount.count || 0) !== resourceRows.length) {
      throw new Error(`Demo seed verification failed: ${resourceCount.count || 0} resource row(s) exist after seeding. Expected ${resourceRows.length}.`);
    }
    if ((prelimCount.count || 0) !== prelimRows.length) {
      throw new Error(`Demo seed verification failed: ${prelimCount.count || 0} prelim row(s) exist after seeding. Expected ${prelimRows.length}.`);
    }

    const totalSeededValue = EVENTS.reduce((sum, e) => sum + financialSummary(e).final_total, 0);

    return NextResponse.json({
      success: true,
      targetEmail,
      eventsCreated: EVENTS.length,
      ewnsCreated: EWNS.length,
      resourceLinesCreated: resourceCount.count || resourceInsert.insertedRows,
      resourceLinesAttempted: resourceRows.length,
      resourceUnitFallbackRows: resourceInsert.fallbackRows,
      resourceUnitFallbacks: resourceInsert.unitFallbacks,
      prelimLinesCreated: prelimCount.count || prelimRows.length,
      prelimLinesAttempted: prelimRows.length,
      evidenceRowsCreated: evidenceRows.length,
      totalSeededValue: Math.round(totalSeededValue),
      packsSeeded: 0,
      ceCreditsGranted: 3,
    });
  } catch (error: any) {
    console.error("Demo seed failed", error);
    return NextResponse.json({ error: error?.message || "Demo seed failed" }, { status: 500 });
  }
}
