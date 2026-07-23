import { getContractFamily, getContractLabel, getFeeBasisLabel, getCostLabel } from "@/lib/contracts";
import { type CompanyProfile, companyDisplayName, companyLegalName } from "@/lib/companyProfile";
export type ExportEventMeta = {
  title: string;
  contractType?: string | null;
  contractSource?: string | null;
  projectName?: string | null;
  mainContractor?: string | null;
  delayDays?: number;
  generatedAt?: string;
  instructionRef?: string | null;
  ceRef?: string | null;
  programmeRef?: string | null;
};

export type ExportBasis = {
  happened_summary?: string;
  cause_type?: string | null;
  cause_summary?: string;
  difference_from_plan?: string;
  mechanism_tags?: string[];
  mitigation_summary?: string;
  time_impact_toggle?: string;
};

export type ExportResourceLine = {
  category: string;
  item_name: string;
  unit: string;
  qty: number;
  hours?: number | null;
  rate: number;
  total: number;
  notes?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  linked_event?: string | null;
};

export type ExportPrelimLine = {
  name: string;
  qty: number;
  unit: string;
  rate: number;
  notes?: string | null;
  prelim_type?: "staff" | "prelim" | null;
};

export type ExportValuation = {
  fee_percent: number;
  fee_basis: "defined_cost" | "defined_cost_plus_prelims";
  work_days_per_week?: number;
};

export type ExportReviewSettings = {
  include_basis?: boolean;
  include_entitlement?: boolean;
  include_time_impact?: boolean;
  include_evidence_register?: boolean;
  include_cost_summary?: boolean;
  include_prelims_fee?: boolean;
  include_risk_notes?: boolean;
  include_commercial_pushback?: boolean;
  include_excel?: boolean;
  include_pdf?: boolean;
  qualifications_notes?: string;
};

export type ExportFileCounts = {
  instructions: number;
  photos: number;
  site_records: number;
  programme: number;
  cost_support: number;
};

export type ExportEvidenceFile = {
  file_name: string;
  category?: string | null;
  description?: string | null;
  relates_to?: string | null;
  evidence_date?: string | null;
  signed_url?: string | null;
};

export type WorkbookPayload = {
  meta: ExportEventMeta;
  companyProfile?: CompanyProfile;
  basis: ExportBasis;
  resources: ExportResourceLine[];
  prelims: ExportPrelimLine[];
  valuation: ExportValuation;
  review: ExportReviewSettings;
  fileCounts: ExportFileCounts;
  evidence?: ExportEvidenceFile[];
  readiness: number;
  warnings: number;
  blockers: number;
};

export type AiDraftSections = {
  background?: string;
  change_to_contract_basis?: string;
  effect_on_defined_cost?: string;
  effect_on_programme?: string;
  commercial_impact?: string;
  contractual_position?: string;
  assumptions?: string;
  risks_and_qualifications?: string;
  conclusion?: string;
};

function getClientDraft(aiDraft: any): AiDraftSections | undefined {
  if (!aiDraft || typeof aiDraft !== "object") return undefined;
  if (aiDraft.client_output && typeof aiDraft.client_output === "object") return aiDraft.client_output as AiDraftSections;
  return aiDraft as AiDraftSections;
}

function aiText(aiDraft: any, key: keyof AiDraftSections) {
  const draft = getClientDraft(aiDraft);
  return String(draft?.[key] ?? "").trim();
}

function normaliseNarrativeForExcel(content?: string) {
  return String(content ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function splitNarrativeBlocks(content?: string) {
  const text = normaliseNarrativeForExcel(content);
  if (!text) return [];

  const blocks = text
    .split(/\n{2,}/g)
    .map((block) => block.trim())
    .filter(Boolean);

  // Keep explicit paragraph/bullet spacing, but prevent a single massive Excel row.
  // Excel row heights are capped; separate blocks make longer AI narratives visible.
  const expanded: string[] = [];
  for (const block of blocks.length ? blocks : [text]) {
    if (block.length <= 1400) {
      expanded.push(block);
      continue;
    }

    const sentences = block.split(/(?<=[.!?;])\s+(?=[A-Z0-9])/g);
    let current = "";
    for (const sentence of sentences) {
      const next = current ? `${current} ${sentence}` : sentence;
      if (next.length > 1200 && current) {
        expanded.push(current.trim());
        current = sentence;
      } else {
        current = next;
      }
    }
    if (current.trim()) expanded.push(current.trim());
  }

  return expanded;
}

function aiSectionRows(title: string, content?: string, cols = 4): Row[] {
  const blocks = splitNarrativeBlocks(content);
  if (blocks.length === 0) return [];

  return [
    [],
    [{ value: title, style: "section", mergeAcross: cols - 1 }],
    ...blocks.map((block) => [{ value: block, style: "body", mergeAcross: cols - 1 }]),
  ];
}

function hasAnyAiDraftText(aiDraft?: any) {
  const draft = getClientDraft(aiDraft);
  return Boolean(draft && Object.values(draft).some((v) => String(v ?? "").trim()));
}

type Cell = {
  value?: string | number;
  style?: string;
  mergeAcross?: number;
  type?: "String" | "Number";
  href?: string;
  formula?: string;
  cachedValue?: string | number;
};

type Row = Cell[];

type Sheet = {
  name: string;
  columns?: number[];
  rows: Row[];
};

const SHEET_NAMES = {
  summary: "01 Summary",
  narrative: "02 Commercial Narrative",
  costSummary: "03 Cost Summary",
  labour: "04 Labour",
  plant: "05 Plant",
  materials: "06 Materials",
  subcontract: "07 Subcontract",
  prelims: "08 Preliminaries & Fee",
  programme: "09 Programme Impact",
  evidence: "10 Evidence Register",
} as const;

type ColumnMode = "auto" | "fixed" | "wrap";

type ColumnRule = {
  mode: ColumnMode;
  min: number;
  max?: number;
  padding?: number;
  width?: number;
};

const STAFF_KEYWORDS = [
  "project manager",
  "quantity surveyor",
  "commercial manager",
  "site manager",
  "site supervisor",
  "foreman",
  "engineer",
  "planner",
  "administrator",
  "admin",
  "qs",
  "pm",
];

function sanitizeXmlText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u0084\u0086-\u009F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function money(n: number) {
  const v = Number(n);
  return Number.isFinite(v) ? Number(v.toFixed(2)) : 0;
}

function displayDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normaliseText(value?: string | null) {
  return (value ?? "").trim();
}

function clientText(value?: string | null) {
  return normaliseText(value)
    .replace(/\bDemo seed note:\s*/gi, "")
    .replace(/\bSeeded\s+[a-z ]+\s+note:\s*/gi, "")
    .replace(/\bFor demo testing\.?\s*/gi, "")
    .replace(/\bDemo testing\.?\s*/gi, "")
    .trim();
}

function clientFileName(value?: string | null) {
  return clientText(value).replace(/^DEMO[-_\s]+/i, "").trim();
}

function titleWithoutReference(title?: string | null, ceRef?: string | null) {
  const cleanTitle = clientText(title) || "Compensation Event";
  const cleanRef = clientText(ceRef);
  if (!cleanRef) return cleanTitle;
  const escaped = cleanRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return cleanTitle
    .replace(new RegExp(`^${escaped}\\s*[—-]\\s*`, "i"), "")
    .replace(new RegExp(`^${escaped}\\b\\s*`, "i"), "")
    .trim() || cleanTitle;
}

function exportTitle(payload: WorkbookPayload) {
  const title = titleWithoutReference(payload.meta.title, payload.meta.ceRef);
  return payload.meta.ceRef ? `${payload.meta.ceRef} — ${title}` : title;
}

function sheetDisplayTitle(sheetName: string) {
  return String(sheetName || "").replace(/^\d+\s+/, "").trim();
}

function byHierarchy(a: ExportResourceLine, b: ExportResourceLine) {
  return `${a.linked_event ?? ""}|${a.start_date ?? ""}|${a.notes ?? ""}|${a.item_name}`.localeCompare(
    `${b.linked_event ?? ""}|${b.start_date ?? ""}|${b.notes ?? ""}|${b.item_name}`
  );
}

function looksLikeStaff(itemName: string, notes?: string | null) {
  const text = `${itemName} ${notes ?? ""}`.toLowerCase();
  return STAFF_KEYWORDS.some((k) => text.includes(k));
}

function normaliseResourceCategory(line: Pick<ExportResourceLine, "category" | "item_name" | "notes">) {
  const raw = String(line.category || "").toLowerCase().trim();
  const text = `${line.item_name || ""} ${line.notes || ""}`.toLowerCase();

  if (raw === "equipment") return "plant";
  if (raw === "materials") return "material";
  if (raw === "charge" || raw === "charges") return "subcontract";

  // Third-party support and standby charges are frequently typed as materials.
  // Classify obvious subcontract/charge lines onto the Subcontract tab so the
  // issued pack does not call third-party support a material Defined Cost item.
  if (
    raw === "material" &&
    /\b(subcontract|third[-\s]?party|utility|permit|standby|specialist|supplier attendance|attendance charge|call[-\s]?out)\b/.test(text)
  ) {
    return "subcontract";
  }

  return raw;
}

function isCategory(line: ExportResourceLine, category: "labour" | "plant" | "material" | "subcontract") {
  return normaliseResourceCategory(line) === category;
}

function hourlyQuantity(line: ExportResourceLine) {
  const hours = Number(line.hours) || 0;
  const qty = Number(line.qty) || 0;
  const rate = Number(line.rate) || 0;
  const total = Number(line.total) || 0;

  if (String(line.unit || "").toLowerCase() !== "hour") {
    return { headcount: "", hoursPerPerson: "", totalQty: qty || 0 };
  }

  const hoursPerPerson = hours || qty || 0;
  let headcount = qty || 1;

  // Legacy rows sometimes carried hours but left qty as 1 while total reflected
  // multiple operatives. Derive the missing headcount from total/rate/hours so
  // the exported workbook reconciles to the stored CE value.
  if (hoursPerPerson > 0 && rate > 0 && total > 0) {
    const inferred = total / (hoursPerPerson * rate);
    if (Number.isFinite(inferred) && inferred > 0 && Math.abs(inferred - headcount) > 0.01) {
      headcount = inferred;
    }
  }

  return {
    headcount: moneyless(headcount),
    hoursPerPerson: moneyless(hoursPerPerson),
    totalQty: headcount * hoursPerPerson,
  };
}

function moneyless(n: number) {
  const value = Number(n);
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(3));
}

function calcPrelimsTotal(prelims: ExportPrelimLine[], workDaysPerWeek = 5, delayDays = 0) {
  const wd = Math.max(1, Math.min(7, Number(workDaysPerWeek) || 5));
  const dd = Math.max(0, Number(delayDays) || 0);
  return prelims.reduce((sum, line) => {
    const qty = Number(line.qty) || 0;
    const rate = Number(line.rate) || 0;
    const dailyRate = String(line.unit || "").toLowerCase() === "week" ? rate / wd : rate;
    return sum + qty * dailyRate * dd;
  }, 0);
}

function groupLabel(line: ExportResourceLine) {
  return {
    activity: clientText(line.linked_event) || "General activity",
    date: displayDate(line.start_date),
    task: clientText(line.notes) || "General notes",
  };
}

function titleRows(title: string, subtitle: string, cols: number): Row[] {
  return [
    [{ value: title, style: "title", mergeAcross: cols - 1 }],
    [{ value: subtitle, style: "subtitle", mergeAcross: cols - 1 }],
    [],
  ];
}

function companyHeaderRows(profile: CompanyProfile | undefined, cols: number): Row[] {
  const clean = profile || {};
  const displayName = companyDisplayName(clean);
  const legalName = companyLegalName(clean);
  const name = legalName || displayName || "Subcontractor";
  const trading = displayName && displayName !== legalName ? displayName : "";
  const role = clean.role || "Subcontractor";
  const logo = clean.logo_url || "";
  const address = clean.address || "";
  const email = clean.email || "";
  const phone = clean.phone || "";
  const regBits = [clean.vat_number ? `VAT: ${clean.vat_number}` : "", clean.company_registration_number ? `Company no: ${clean.company_registration_number}` : ""].filter(Boolean);

  const rows: Row[] = [];
  const hasLogo = Boolean(String(logo).trim());

  // Summary sheet only: leave space for the embedded logo above the company profile.
  // Other sheets do not call this helper, keeping the workbook clean and preserving the normal green section styling.
  if (hasLogo) rows.push([{ value: "", style: "logoCell", mergeAcross: cols - 1 }]);

  rows.push([{ value: name, style: "brandTitle", mergeAcross: cols - 1 }]);

  const identityLine = [trading, role].filter(Boolean).join(" · ");
  const mergedDetailCell = (value: string, style = "brandDetail") => [
    { value, style, mergeAcross: cols - 1 },
  ];

  if (identityLine) rows.push(mergedDetailCell(identityLine, "brandSub"));
  if (address) rows.push(mergedDetailCell(address));
  const contactLine = [email, phone].filter(Boolean).join(" | ");
  if (contactLine) rows.push(mergedDetailCell(contactLine));
  if (regBits.length) rows.push(mergedDetailCell(regBits.join(" | ")));

  rows.push([]);
  return rows;
}

function submittedBy(payload: WorkbookPayload) {
  return companyLegalName(payload.companyProfile) || companyDisplayName(payload.companyProfile) || "Subcontractor";
}

function evidenceTotal(payload: WorkbookPayload) {
  return Object.values(payload.fileCounts || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function noticePosition(payload: WorkbookPayload) {
  const days = Number(payload.meta.delayDays) || 0;
  if (days > 0) return "Time impact recorded";
  if (evidenceTotal(payload) > 0) return "Evidence attached";
  return "To be confirmed";
}

function requestedAction(payload: WorkbookPayload) {
  const contract = getContractLabel(payload.meta.contractType);
  return `Please assess ${payload.meta.ceRef || "this compensation event / variation"} under ${contract || "the contract"} and include the agreed value in the next payment cycle.`;
}

function executiveExcerpt(value?: string | null, fallback = "See Commercial Narrative sheet for full details.") {
  const blocks = splitNarrativeBlocks(clientText(value));
  const first = blocks[0] || fallback;
  return first.length > 520 ? `${first.slice(0, 517).trim()}...` : first;
}

function costBreakdown(payload: WorkbookPayload, aiDraft?: AiDraftSections) {
  const labour = payload.resources.filter((x) => isCategory(x, "labour") && !looksLikeStaff(x.item_name, x.notes));
  const plant = payload.resources.filter((x) => isCategory(x, "plant"));
  const materials = payload.resources.filter((x) => isCategory(x, "material"));
  const charges = payload.resources.filter((x) => isCategory(x, "subcontract"));
  const nonStaffPrelims = payload.prelims.filter((x) => (x.prelim_type ?? "prelim") !== "staff");
  const staffPrelims = payload.prelims.filter((x) => (x.prelim_type ?? "prelim") === "staff");
  const staffPrelimsTotal = calcPrelimsTotal(staffPrelims, payload.valuation.work_days_per_week, payload.meta.delayDays);
  const otherPrelimsTotal = calcPrelimsTotal(nonStaffPrelims, payload.valuation.work_days_per_week, payload.meta.delayDays);
  const prelimsTotal = staffPrelimsTotal + otherPrelimsTotal;
  const definedCost = payload.resources.reduce((sum, x) => sum + (Number(x.total) || 0), 0);
  const feeBase = payload.valuation.fee_basis === "defined_cost_plus_prelims" ? definedCost + prelimsTotal : definedCost;
  const feeAmount = feeBase * ((Number(payload.valuation.fee_percent) || 0) / 100);
  const total = definedCost + prelimsTotal + feeAmount;
  const prelimsIncluded = Boolean(payload.review.include_prelims_fee);
  const prelimsSheetForRefs = prelimsIncluded ? buildPrelimsSheet(payload, aiDraft) : null;

  return {
    labour,
    plant,
    materials,
    charges,
    nonStaffPrelims,
    staffPrelims,
    staffPrelimsTotal,
    otherPrelimsTotal,
    prelimsTotal,
    definedCost,
    feeBase,
    feeAmount,
    total,
    prelimsSheetForRefs,
    labourTotal: labour.reduce((s, x) => s + (Number(x.total) || 0), 0),
    plantTotal: plant.reduce((s, x) => s + (Number(x.total) || 0), 0),
    materialTotal: materials.reduce((s, x) => s + (Number(x.total) || 0), 0),
    chargesTotal: charges.reduce((s, x) => s + (Number(x.total) || 0), 0),
  };
}

function buildStructuredRows(lines: ExportResourceLine[], itemLabel: string): Row[] {
  const rows: Row[] = [];
  const sorted = [...lines].sort(byHierarchy);
  let lastActivity = "";
  let lastDate = "";

  for (const line of sorted) {
    const g = groupLabel(line);
    if (g.activity !== lastActivity) {
      rows.push([{ value: g.activity, style: "group", mergeAcross: 8 }]);
      lastActivity = g.activity;
      lastDate = "";
    }
    if (g.date !== lastDate) {
      rows.push([{ value: `Date: ${g.date || "—"}`, style: "subgroup", mergeAcross: 8 }]);
      lastDate = g.date;
    }

    const isHourly = String(line.unit || "").toLowerCase() === "hour";
    const hourly = hourlyQuantity(line);
    const qtyOrHours = isHourly ? hourly.totalQty : Number(line.qty) || 0;
    rows.push([
      { value: clientText(line.item_name) || itemLabel, style: "item" },
      { value: isHourly ? hourly.headcount : "", style: "cell", type: isHourly ? "Number" : "String" },
      { value: isHourly ? hourly.hoursPerPerson : "", style: "cell", type: isHourly ? "Number" : "String" },
      { value: qtyOrHours, style: "cell", type: "Number" },
      { value: line.unit || "", style: "cell" },
      { value: money(Number(line.rate) || 0), style: "currency", type: "Number" },
      // Formula added later once the final Excel row number is known.
      { value: money(qtyOrHours * (Number(line.rate) || 0)), cachedValue: money(Number(line.total) || qtyOrHours * (Number(line.rate) || 0)), style: "currency", type: "Number" },
      { value: normaliseText(line.end_date) || "", style: "cell" },
      { value: clientText(line.notes) || "", style: "cellWrap" },
    ]);
  }

  if (rows.length === 0) {
    rows.push([{ value: "No lines entered.", style: "muted", mergeAcross: 8 }]);
  }

  return rows;
}

function buildSummarySheet(payload: WorkbookPayload, aiDraft?: AiDraftSections): Sheet {
  const costs = costBreakdown(payload, aiDraft);
  const contractFamily = getContractFamily(payload.meta.contractType);
  const costSummaryIncluded = Boolean(payload.review.include_cost_summary || payload.review.include_prelims_fee);
  const totalFormula = costSummaryIncluded ? sheetFormulaRef(SHEET_NAMES.costSummary, findFirstCellRef(buildCostSummarySheet(payload, aiDraft), "Total CE value", "B", "totalLabel")) : undefined;
  const evidenceCount = evidenceTotal(payload);
  const cleanTitle = titleWithoutReference(payload.meta.title, payload.meta.ceRef);

  const rows: Row[] = [
    ...companyHeaderRows(payload.companyProfile, 6),
    [{ value: "COMPENSATION EVENT / VARIATION QUOTATION", style: "coverKicker", mergeAcross: 5 }],
    [{ value: payload.meta.ceRef || "CE / VO", style: "coverRef", mergeAcross: 5 }],
    [{ value: cleanTitle, style: "coverTitle", mergeAcross: 5 }],
    [],
    [{ value: "Project", style: "metaLabel" }, { value: clientText(payload.meta.projectName) || "See project records", style: "value", mergeAcross: 1 }, { value: "Main Contractor", style: "metaLabel" }, { value: clientText(payload.meta.mainContractor) || "See project records", style: "value", mergeAcross: 1 }],
    [{ value: "Contract", style: "metaLabel" }, { value: getContractLabel(payload.meta.contractType) || "—", style: "value", mergeAcross: 1 }, { value: "Contract family", style: "metaLabel" }, { value: contractFamily, style: "value", mergeAcross: 1 }],
    [{ value: "Submitting party", style: "metaLabel" }, { value: submittedBy(payload), style: "value", mergeAcross: 1 }, { value: "Submission date", style: "metaLabel" }, { value: displayDate(payload.meta.generatedAt || new Date().toISOString()), style: "value", mergeAcross: 1 }],
    [{ value: "Revision", style: "metaLabel" }, { value: "P01", style: "value", mergeAcross: 1 }, { value: "Status", style: "metaLabel" }, { value: "Submitted for assessment", style: "value", mergeAcross: 1 }],
    [],
    [{ value: "CE VALUE", style: "summaryCardLabel", mergeAcross: 1 }, { value: "TIME IMPACT", style: "summaryCardLabel", mergeAcross: 1 }, { value: "NOTICE POSITION", style: "summaryCardLabel", mergeAcross: 1 }],
    [{ value: money(costs.total), cachedValue: money(costs.total), formula: totalFormula, style: "summaryCardCurrency", type: "Number", mergeAcross: 1 }, { value: `${Number(payload.meta.delayDays) || 0} working day${Number(payload.meta.delayDays) === 1 ? "" : "s"}`, style: "summaryCardValue", mergeAcross: 1 }, { value: noticePosition(payload), style: "summaryCardValue", mergeAcross: 1 }],
    [{ value: "Excluding VAT unless stated otherwise.", style: "summaryCardNote", mergeAcross: 1 }, { value: "Based on the recorded event position.", style: "summaryCardNote", mergeAcross: 1 }, { value: evidenceCount ? `${evidenceCount} evidence record${evidenceCount === 1 ? "" : "s"} included.` : "Evidence to be confirmed.", style: "summaryCardNote", mergeAcross: 1 }],
    [],
    [{ value: "Executive event summary", style: "section", mergeAcross: 5 }],
    [{ value: executiveExcerpt(aiText(aiDraft, "background") || payload.basis.happened_summary, "Event summary to be confirmed."), style: "body", mergeAcross: 5 }],
    [],
    [{ value: "Contractual route", style: "section", mergeAcross: 5 }],
    [{ value: executiveExcerpt(aiText(aiDraft, "change_to_contract_basis"), "The contractual route is set out in the Commercial Narrative sheet."), style: "body", mergeAcross: 5 }],
    [],
    [{ value: "Requested action", style: "section", mergeAcross: 5 }],
    [{ value: requestedAction(payload), style: "requestBox", mergeAcross: 5 }],
    [],
    [{ value: "Pack contents", style: "section", mergeAcross: 5 }],
    [{ value: "Commercial Narrative", style: "label" }, { value: payload.review.include_basis ? "Included" : "Excluded", style: "value" }, { value: "Cost schedules", style: "label" }, { value: payload.review.include_cost_summary ? "Included" : "Excluded", style: "value" }, { value: "Evidence Register", style: "label" }, { value: payload.review.include_evidence_register ? "Included" : "Excluded", style: "value" }],
    [{ value: "Programme Impact", style: "label" }, { value: payload.review.include_time_impact ? "Included" : "Excluded", style: "value" }, { value: "Preliminaries & Fee", style: "label" }, { value: payload.review.include_prelims_fee ? "Included" : "Excluded", style: "value" }, { value: "Evidence records", style: "label" }, { value: evidenceCount, style: "value", type: "Number" }],
  ];

  return { name: SHEET_NAMES.summary, columns: [120, 120, 120, 120, 120, 120], rows };
}

function buildCostSummarySheet(payload: WorkbookPayload, aiDraft?: AiDraftSections): Sheet {
  const costs = costBreakdown(payload, aiDraft);
  const costSummaryIncluded = Boolean(payload.review.include_cost_summary);
  const labourFormula = costSummaryIncluded && costs.labour.length ? sheetFormulaRef(SHEET_NAMES.labour, resourceSheetTotalCell(costs.labour, "Labour")) : undefined;
  const plantFormula = costSummaryIncluded && costs.plant.length ? sheetFormulaRef(SHEET_NAMES.plant, resourceSheetTotalCell(costs.plant, "Plant")) : undefined;
  const materialFormula = costSummaryIncluded && costs.materials.length ? sheetFormulaRef(SHEET_NAMES.materials, resourceSheetTotalCell(costs.materials, "Material")) : undefined;
  const chargesFormula = costSummaryIncluded && costs.charges.length ? sheetFormulaRef(SHEET_NAMES.subcontract, resourceSheetTotalCell(costs.charges, "Subcontract / charge")) : undefined;
  const prelimsFormula = costs.prelimsSheetForRefs ? sheetFormulaRef(SHEET_NAMES.prelims, findFirstCellRef(costs.prelimsSheetForRefs, "Prelims total", "E", "totalLabel")) : undefined;
  const feeFormula = costs.prelimsSheetForRefs ? sheetFormulaRef(SHEET_NAMES.prelims, findFirstCellRef(costs.prelimsSheetForRefs, `Fee (${payload.valuation.fee_percent || 0}%)`, "B")) : undefined;

  const rows: Row[] = [
    ...titleRows(exportTitle(payload), "Cost Summary", 5),
    [{ value: "Cost heading", style: "header" }, { value: "Amount", style: "header" }, { value: "Source", style: "header", mergeAcross: 2 }],
    [{ value: "Labour", style: "label" }, { value: money(costs.labourTotal), cachedValue: money(costs.labourTotal), formula: labourFormula, style: "currency", type: "Number" }, { value: costs.labour.length ? SHEET_NAMES.labour : "No labour lines exported", style: "value", mergeAcross: 2 }],
    [{ value: "Plant", style: "label" }, { value: money(costs.plantTotal), cachedValue: money(costs.plantTotal), formula: plantFormula, style: "currency", type: "Number" }, { value: costs.plant.length ? SHEET_NAMES.plant : "No plant lines exported", style: "value", mergeAcross: 2 }],
    [{ value: "Materials", style: "label" }, { value: money(costs.materialTotal), cachedValue: money(costs.materialTotal), formula: materialFormula, style: "currency", type: "Number" }, { value: costs.materials.length ? SHEET_NAMES.materials : "No material lines exported", style: "value", mergeAcross: 2 }],
    [{ value: "Subcontract / charges", style: "label" }, { value: money(costs.chargesTotal), cachedValue: money(costs.chargesTotal), formula: chargesFormula, style: "currency", type: "Number" }, { value: costs.charges.length ? SHEET_NAMES.subcontract : "No subcontract / charge lines exported", style: "value", mergeAcross: 2 }],
    [{ value: "Defined Cost subtotal", style: "totalLabel" }, { value: money(costs.definedCost), cachedValue: money(costs.definedCost), formula: "SUM(B5:B8)", style: "total", type: "Number" }, { value: getCostLabel(payload.meta.contractType), style: "value", mergeAcross: 2 }],
    [],
    [{ value: "Staff preliminaries", style: "label" }, { value: money(costs.staffPrelimsTotal), cachedValue: money(costs.staffPrelimsTotal), style: "currency", type: "Number" }, { value: "Time-related staff preliminaries", style: "value", mergeAcross: 2 }],
    [{ value: "Other preliminaries", style: "label" }, { value: money(costs.otherPrelimsTotal), cachedValue: money(costs.otherPrelimsTotal), style: "currency", type: "Number" }, { value: "Other time-related preliminaries", style: "value", mergeAcross: 2 }],
    [{ value: "Prelims total", style: "totalLabel" }, { value: money(costs.prelimsTotal), cachedValue: money(costs.prelimsTotal), formula: prelimsFormula, style: "total", type: "Number" }, { value: costs.prelimsSheetForRefs ? SHEET_NAMES.prelims : "No preliminaries exported", style: "value", mergeAcross: 2 }],
    [],
    [{ value: "Fee basis", style: "label" }, { value: money(costs.feeBase), cachedValue: money(costs.feeBase), formula: payload.valuation.fee_basis === "defined_cost_plus_prelims" ? "B9+B13" : "B9", style: "currency", type: "Number" }, { value: getFeeBasisLabel(payload.meta.contractType, payload.valuation.fee_basis), style: "value", mergeAcross: 2 }],
    [{ value: `Fee (${payload.valuation.fee_percent || 0}%)`, style: "label" }, { value: money(costs.feeAmount), cachedValue: money(costs.feeAmount), formula: feeFormula || `B15*${(Number(payload.valuation.fee_percent) || 0) / 100}`, style: "currency", type: "Number" }, { value: "Contract fee applied to selected basis", style: "value", mergeAcross: 2 }],
    [{ value: "Total CE value", style: "totalLabel" }, { value: money(costs.total), cachedValue: money(costs.total), formula: "B9+B13+B16", style: "total", type: "Number" }, { value: "Excluding VAT unless stated otherwise", style: "totalLabel", mergeAcross: 2 }],
    [],
    [{ value: "Activity summary", style: "section", mergeAcross: 4 }],
    [{ value: "Activity", style: "header" }, { value: "Value", style: "header" }, { value: "% of direct cost", style: "header" }, { value: "Notes", style: "header", mergeAcross: 1 }],
  ];

  const activityMap = new Map<string, number>();
  for (const line of payload.resources) {
    const activity = clientText(line.linked_event) || "General activity";
    activityMap.set(activity, (activityMap.get(activity) || 0) + (Number(line.total) || 0));
  }

  Array.from(activityMap.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([activity, value]) => {
      rows.push([
        { value: activity, style: "cellWrap" },
        { value: money(value), style: "currency", type: "Number" },
        { value: costs.definedCost > 0 ? `${((value / costs.definedCost) * 100).toFixed(1)}%` : "0.0%", style: "value" },
        { value: "", style: "value", mergeAcross: 1 },
      ]);
    });

  return { name: SHEET_NAMES.costSummary, columns: [220, 110, 180, 130, 120], rows };
}

function buildBasisSheet(payload: WorkbookPayload, aiDraft?: AiDraftSections): Sheet {
  const hasDraft = hasAnyAiDraftText(aiDraft);
  const rows: Row[] = [
    ...titleRows(exportTitle(payload), "Commercial Narrative", 4),
  ];

  // This tab is the client-facing Basis of Change page. The main content must come
  // from the generated JSON draft, not just the raw form inputs. The raw inputs are
  // retained underneath as a source/input record for traceability.
  if (hasDraft) {
    rows.push(...aiSectionRows("Background", aiText(aiDraft, "background"), 4));
    rows.push(...aiSectionRows("Change to Contract Basis", aiText(aiDraft, "change_to_contract_basis"), 4));
    rows.push(...aiSectionRows("Effect on Defined Cost / Loss and Expense", aiText(aiDraft, "effect_on_defined_cost"), 4));
    rows.push(...aiSectionRows("Effect on Programme", aiText(aiDraft, "effect_on_programme"), 4));
    rows.push(...aiSectionRows("Contractual Position", aiText(aiDraft, "contractual_position"), 4));
    rows.push(...aiSectionRows("Assumptions", aiText(aiDraft, "assumptions"), 4));
    rows.push(...aiSectionRows("Conclusion", aiText(aiDraft, "conclusion"), 4));
  } else {
    rows.push(
      [{ value: "Generated narrative not available", style: "section", mergeAcross: 3 }],
      [{ value: "No AI draft output was found for this pack. Generate the pack again to populate the client-facing Basis of Change narrative.", style: "body", mergeAcross: 3 }],
    );
  }

  const qualifications = clientText(payload.review.qualifications_notes);
  if (qualifications) {
    rows.push(
      [],
      [{ value: "Qualifications", style: "section", mergeAcross: 3 }],
      [{ value: qualifications, style: "body", mergeAcross: 3 }],
    );
  }

  return { name: SHEET_NAMES.narrative, columns: [180, 220, 220, 220], rows };
}

function buildSheetFromLines(name: string, lines: ExportResourceLine[], itemLabel: string, payload: WorkbookPayload): Sheet {
  const sheetTotal = lines.reduce((sum, line) => sum + (Number(line.total) || 0), 0);
  const rows: Row[] = [
    ...titleRows(exportTitle(payload), sheetDisplayTitle(name), 9),
    [{ value: itemLabel, style: "header" }, { value: "Headcount", style: "header" }, { value: "Hours per person", style: "header" }, { value: "Total qty / hrs", style: "header" }, { value: "Unit", style: "header" }, { value: "Rate", style: "header" }, { value: "Cost", style: "header" }, { value: "End / ref", style: "header" }, { value: "Notes", style: "header" }],
  ];

  const firstCostRowNumber = rows.length + 1;
  rows.push(...buildStructuredRows(lines, itemLabel));
  const lastEnteredCostRowNumber = rows.length;

  // Apply quantity x rate formulas only to actual entered cost rows.
  // Do not put formulas into spare/blank rows; blank formula rows were producing #VALUE! in client workbooks.
  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const costCell = row?.[6];
    if (rowNumber >= firstCostRowNumber && row?.[0]?.style === "item" && costCell?.style === "currency" && row?.[3] && row?.[5]) {
      costCell.formula = lineCostFormula(rowNumber);
      costCell.cachedValue = Number(costCell.cachedValue ?? costCell.value ?? 0) || 0;
      costCell.type = "Number";
    }
  });

  rows.push([]);
  const totalFormula = lastEnteredCostRowNumber >= firstCostRowNumber
    ? sumFormula(`G${firstCostRowNumber}`, `G${lastEnteredCostRowNumber}`)
    : undefined;
  rows.push([{ value: `${name} total`, style: "totalLabel", mergeAcross: 5 }, { value: money(sheetTotal), cachedValue: money(sheetTotal), formula: totalFormula, style: "total", type: "Number" }, { value: "", style: "totalLabel", mergeAcross: 2 }]);

  // Leave clean blank space for competent QS/commercial users to add their own extra rows manually.
  // These rows are intentionally blank and contain no formulas so they cannot break the Summary page.
  for (let i = 0; i < 8; i += 1) {
    rows.push([
      { value: "", style: "cellWrap" },
      { value: "", style: "cell" },
      { value: "", style: "cell" },
      { value: "", style: "cell" },
      { value: "", style: "cell" },
      { value: "", style: "currency" },
      { value: "", style: "currency" },
      { value: "", style: "cell" },
      { value: "", style: "cellWrap" },
    ]);
  }

  return { name, columns: [230, 70, 90, 90, 65, 80, 95, 85, 300], rows };
}

function buildPrelimsSheet(payload: WorkbookPayload, aiDraft?: AiDraftSections): Sheet {
  const staffPrelims = payload.prelims.filter((line) => (line.prelim_type ?? "prelim") === "staff");
  const nonStaffPrelims = payload.prelims.filter((line) => (line.prelim_type ?? "prelim") !== "staff");
  const staffPrelimsTotal = staffPrelims.reduce((sum, line) => sum + calcPrelimsTotal([line], payload.valuation.work_days_per_week, payload.meta.delayDays), 0);
  const otherPrelimsTotal = calcPrelimsTotal(nonStaffPrelims, payload.valuation.work_days_per_week, payload.meta.delayDays);
  const prelimsTotal = staffPrelimsTotal + otherPrelimsTotal;
  const definedCost = payload.resources.reduce((sum, x) => sum + (Number(x.total) || 0), 0);
  const feeBase = payload.valuation.fee_basis === "defined_cost_plus_prelims" ? definedCost + prelimsTotal : definedCost;
  const feeAmount = feeBase * ((Number(payload.valuation.fee_percent) || 0) / 100);
  const costLabel = getCostLabel(payload.meta.contractType);
  const feeBasisLabel = getFeeBasisLabel(payload.meta.contractType, payload.valuation.fee_basis);
  const workDaysPerWeek = Math.max(1, Math.min(7, Number(payload.valuation.work_days_per_week) || 5));
  const delayDays = Math.max(0, Number(payload.meta.delayDays) || 0);

  const rows: Row[] = [
    ...titleRows(exportTitle(payload), "Preliminaries & Fee", 6),
    [{ value: "Item", style: "header" }, { value: "Qty", style: "header" }, { value: "Unit", style: "header" }, { value: "Rate", style: "header" }, { value: "Cost", style: "header" }, { value: "Notes", style: "header" }],
  ];

  let staffCostStartRow = 0;
  let staffCostEndRow = 0;
  let otherCostStartRow = 0;
  let otherCostEndRow = 0;

  const writePrelimRows = (lines: ExportPrelimLine[], emptyLabel: string) => {
    const firstRow = rows.length + 1;

    if (lines.length === 0) {
      rows.push([{ value: emptyLabel, style: "muted", mergeAcross: 5 }]);
    } else {
      for (const line of lines) {
        const qty = Number(line.qty) || 0;
        const rate = Number(line.rate) || 0;
        const dailyRate = String(line.unit || "").toLowerCase() === "week" ? rate / workDaysPerWeek : rate;
        const claimedQty = String(line.unit || "").toLowerCase() === "week"
          ? qty * (delayDays / workDaysPerWeek)
          : qty * delayDays;
        const lineTotal = claimedQty * rate;
        const rowNumber = rows.length + 1;
        rows.push([
          { value: clientText(line.name) || "Prelim item", style: "cellWrap" },
          { value: moneyless(claimedQty), style: "cell", type: "Number" },
          { value: line.unit || "", style: "cell" },
          { value: money(rate), style: "currency", type: "Number" },
          { value: money(lineTotal), cachedValue: money(lineTotal), formula: prelimCostFormula(rowNumber), style: "currency", type: "Number" },
          { value: [clientText(line.notes), delayDays > 0 ? `Based on ${qty} ${line.unit || "unit"} per day/week equivalent over ${delayDays} day(s).` : ""].filter(Boolean).join(" "), style: "cellWrap" },
        ]);
      }
    }

    return { start: firstRow, end: rows.length };
  };

  rows.push([{ value: "Staff Preliminaries", style: "section", mergeAcross: 5 }]);
  const staffRange = writePrelimRows(staffPrelims, "No staff preliminaries entered.");
  staffCostStartRow = staffRange.start;
  staffCostEndRow = staffRange.end;

  rows.push([], [{ value: "Other Preliminaries", style: "section", mergeAcross: 5 }]);
  const otherRange = writePrelimRows(nonStaffPrelims, "No other prelim items entered.");
  otherCostStartRow = otherRange.start;
  otherCostEndRow = otherRange.end;

  rows.push([]);
  const staffTotalRow = rows.length + 1;
  rows.push([{ value: "Staff prelims total", style: "label", mergeAcross: 3 }, { value: money(staffPrelimsTotal), cachedValue: money(staffPrelimsTotal), formula: sumFormula(`E${staffCostStartRow}`, `E${staffCostEndRow}`), style: "currency", type: "Number" }, { value: "", style: "label" }]);
  const otherTotalRow = rows.length + 1;
  rows.push([{ value: "Other prelims total", style: "label", mergeAcross: 3 }, { value: money(otherPrelimsTotal), cachedValue: money(otherPrelimsTotal), formula: sumFormula(`E${otherCostStartRow}`, `E${otherCostEndRow}`), style: "currency", type: "Number" }, { value: "", style: "label" }]);
  const prelimsTotalRow = rows.length + 1;
  rows.push([{ value: "Prelims total", style: "totalLabel", mergeAcross: 3 }, { value: money(prelimsTotal), cachedValue: money(prelimsTotal), formula: `E${staffTotalRow}+E${otherTotalRow}`, style: "total", type: "Number" }, { value: "", style: "totalLabel" }]);

  rows.push(
    [],
    [{ value: "Summary", style: "section", mergeAcross: 5 }],
  );
  const definedCostRow = rows.length + 1;
  const definedCostFormulaParts = [
    payload.resources.filter((x) => isCategory(x, "labour") && !looksLikeStaff(x.item_name, x.notes)).length
      ? sheetFormulaRef(SHEET_NAMES.labour, resourceSheetTotalCell(payload.resources.filter((x) => isCategory(x, "labour") && !looksLikeStaff(x.item_name, x.notes)), "Labour"))
      : "",
    payload.resources.filter((x) => isCategory(x, "plant")).length
      ? sheetFormulaRef(SHEET_NAMES.plant, resourceSheetTotalCell(payload.resources.filter((x) => isCategory(x, "plant")), "Plant"))
      : "",
    payload.resources.filter((x) => isCategory(x, "material")).length
      ? sheetFormulaRef(SHEET_NAMES.materials, resourceSheetTotalCell(payload.resources.filter((x) => isCategory(x, "material")), "Material"))
      : "",
    payload.resources.filter((x) => isCategory(x, "subcontract")).length
      ? sheetFormulaRef(SHEET_NAMES.subcontract, resourceSheetTotalCell(payload.resources.filter((x) => isCategory(x, "subcontract")), "Subcontract / charge"))
      : "",
  ].filter(Boolean);
  const definedCostFormula = payload.review.include_cost_summary && definedCostFormulaParts.length
    ? definedCostFormulaParts.join("+")
    : undefined;
  rows.push([{ value: costLabel, style: "label" }, { value: money(definedCost), cachedValue: money(definedCost), formula: definedCostFormula, style: "currency", type: "Number" }, { value: "", style: "label", mergeAcross: 4 }]);
  rows.push([{ value: "Staff prelims", style: "label" }, { value: money(staffPrelimsTotal), cachedValue: money(staffPrelimsTotal), formula: `E${staffTotalRow}`, style: "currency", type: "Number" }, { value: "", style: "label", mergeAcross: 4 }]);
  rows.push([{ value: "Other prelims", style: "label" }, { value: money(otherPrelimsTotal), cachedValue: money(otherPrelimsTotal), formula: `E${otherTotalRow}`, style: "currency", type: "Number" }, { value: "", style: "label", mergeAcross: 4 }]);
  rows.push([{ value: "Prelims total", style: "label" }, { value: money(prelimsTotal), cachedValue: money(prelimsTotal), formula: `E${prelimsTotalRow}`, style: "currency", type: "Number" }, { value: "", style: "label", mergeAcross: 4 }]);
  const feeRow = rows.length + 1;
  const feeBaseFormula = payload.valuation.fee_basis === "defined_cost_plus_prelims" ? `B${definedCostRow}+B${definedCostRow + 3}` : `B${definedCostRow}`;
  rows.push([{ value: `Fee (${payload.valuation.fee_percent || 0}%)`, style: "label" }, { value: money(feeAmount), cachedValue: money(feeAmount), formula: `(${feeBaseFormula})*${(Number(payload.valuation.fee_percent) || 0) / 100}`, style: "currency", type: "Number" }, { value: feeBasisLabel, style: "value", mergeAcross: 4 }]);
  rows.push([{ value: "Total CE value", style: "totalLabel" }, { value: money(definedCost + prelimsTotal + feeAmount), cachedValue: money(definedCost + prelimsTotal + feeAmount), formula: `B${definedCostRow}+B${definedCostRow + 3}+B${feeRow}`, style: "total", type: "Number" }, { value: "", style: "totalLabel", mergeAcross: 4 }]);

  // Blank non-formula rows only. If the QS wants to add extra prelims they can do so manually.
  for (let i = 0; i < 6; i += 1) {
    rows.push([
      { value: "", style: "cellWrap" },
      { value: "", style: "cell" },
      { value: "", style: "cell" },
      { value: "", style: "currency" },
      { value: "", style: "currency" },
      { value: "", style: "cellWrap" },
    ]);
  }

  return { name: SHEET_NAMES.prelims, columns: [220, 70, 70, 80, 90, 310], rows };
}

function buildTimeRiskSheet(payload: WorkbookPayload, aiDraft?: AiDraftSections): Sheet {
  const rows: Row[] = [
    ...titleRows(exportTitle(payload), "Programme Impact", 4),
    [{ value: "Delay days", style: "label" }, { value: Number(payload.meta.delayDays) || 0, style: "value", type: "Number" }, { value: "Programme impact", style: "label" }, { value: payload.basis.time_impact_toggle === "yes" ? "Identified" : "To be confirmed", style: "value" }],
    [{ value: "Programme records", style: "label" }, { value: payload.fileCounts.programme, style: "value", type: "Number" }, { value: "Site records", style: "label" }, { value: payload.fileCounts.site_records, style: "value", type: "Number" }],
    [],
    [{ value: "Programme substantiation", style: "section", mergeAcross: 3 }],
    [{ value: "Programme reference", style: "label" }, { value: clientText(payload.meta.programmeRef) || "To be confirmed", style: "value" }, { value: "Instruction / notice ref", style: "label" }, { value: clientText(payload.meta.instructionRef) || "To be confirmed", style: "value" }],
    [{ value: "Affected activity", style: "label" }, { value: clientText(payload.basis.difference_from_plan) || "To be confirmed", style: "body", mergeAcross: 2 }],
    [{ value: "Critical-path effect", style: "label" }, { value: payload.basis.time_impact_toggle === "yes" ? "Programme impact identified by the CE basis; confirm critical-path effect by reference to programme evidence." : "Not confirmed from current records.", style: "body", mergeAcross: 2 }],
    [{ value: "Supporting evidence", style: "label" }, { value: `Programme files: ${payload.fileCounts.programme}; site records: ${payload.fileCounts.site_records}`, style: "value", mergeAcross: 2 }],
  ];

  const programmeNarrative = aiText(aiDraft, "effect_on_programme");
  if (programmeNarrative) {
    rows.push(...aiSectionRows("Effect on Programme", programmeNarrative, 4));
  } else {
    rows.push(
      [],
      [{ value: "Effect on Programme", style: "section", mergeAcross: 3 }],
      [{ value: "No generated programme narrative was found for this pack. Generate the pack again to populate this section from the AI JSON output.", style: "body", mergeAcross: 3 }],
    );
  }

  rows.push(...aiSectionRows("Assumptions", aiText(aiDraft, "assumptions"), 4));
  rows.push(...aiSectionRows("Conclusion", aiText(aiDraft, "conclusion"), 4));

  return { name: SHEET_NAMES.programme, columns: [160, 120, 160, 260], rows };
}

function estimateTextLength(value: unknown) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return 0;

  let score = 0;
  for (const ch of text) {
    if (/[A-Z]/.test(ch)) score += 1.15;
    else if (/[mwMW@#%&]/.test(ch)) score += 1.2;
    else if (/[ilI.,'` ]/.test(ch)) score += 0.55;
    else if (/\d/.test(ch)) score += 0.95;
    else score += 1;
  }
  return Math.ceil(score);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getColumnRules(sheetName: string, columnCount: number): ColumnRule[] {
  if (sheetName === SHEET_NAMES.summary) {
    return [
      { mode: "fixed", min: 120, width: 120 },
      { mode: "fixed", min: 120, width: 120 },
      { mode: "fixed", min: 120, width: 120 },
      { mode: "fixed", min: 120, width: 120 },
      { mode: "fixed", min: 120, width: 120 },
      { mode: "fixed", min: 120, width: 120 },
    ];
  }

  if (sheetName === SHEET_NAMES.costSummary) {
    return [
      { mode: "fixed", min: 220, width: 220 },
      { mode: "fixed", min: 110, width: 110 },
      { mode: "fixed", min: 180, width: 180 },
      { mode: "fixed", min: 130, width: 130 },
      { mode: "fixed", min: 120, width: 120 },
    ];
  }

  if (sheetName === SHEET_NAMES.narrative) {
    return [
      { mode: "fixed", min: 170, width: 170 },
      { mode: "wrap", min: 165, max: 165 },
      { mode: "wrap", min: 165, max: 165 },
      { mode: "wrap", min: 165, max: 165 },
    ];
  }

  if (sheetName === SHEET_NAMES.labour || sheetName === SHEET_NAMES.plant || sheetName === SHEET_NAMES.materials || sheetName === SHEET_NAMES.subcontract) {
    return [
      { mode: "auto", min: 145, max: 220, padding: 14 },
      { mode: "fixed", min: 70, width: 70 },
      { mode: "fixed", min: 90, width: 90 },
      { mode: "fixed", min: 90, width: 90 },
      { mode: "auto", min: 65, max: 90, padding: 8 },
      { mode: "fixed", min: 80, width: 80 },
      { mode: "fixed", min: 95, width: 95 },
      { mode: "auto", min: 85, max: 110, padding: 8 },
      { mode: "wrap", min: 300, max: 340 },
    ];
  }

  if (sheetName === SHEET_NAMES.prelims) {
    return [
      { mode: "auto", min: 150, max: 220, padding: 12 },
      { mode: "fixed", min: 70, width: 70 },
      { mode: "auto", min: 65, max: 95, padding: 8 },
      { mode: "fixed", min: 85, width: 85 },
      { mode: "fixed", min: 100, width: 100 },
      { mode: "wrap", min: 310, max: 360 },
    ];
  }

  if (sheetName === SHEET_NAMES.programme) {
    return [
      { mode: "fixed", min: 150, width: 150 },
      { mode: "fixed", min: 110, width: 110 },
      { mode: "fixed", min: 150, width: 150 },
      { mode: "wrap", min: 240, max: 260 },
    ];
  }

  if (sheetName === SHEET_NAMES.evidence) {
    return [
      { mode: "fixed", min: 70, width: 70 },
      { mode: "fixed", min: 125, width: 125 },
      { mode: "wrap", min: 360, max: 390 },
      { mode: "fixed", min: 105, width: 105 },
      { mode: "wrap", min: 220, max: 250 },
      { mode: "fixed", min: 80, width: 80 },
    ];
  }

  if (sheetName === "Audit") {
    return [
      { mode: "fixed", min: 170, width: 170 },
      { mode: "fixed", min: 130, width: 130 },
      { mode: "fixed", min: 170, width: 170 },
      { mode: "fixed", min: 130, width: 130 },
    ];
  }

  return Array.from({ length: columnCount }, () => ({ mode: "auto", min: 100, max: 180, padding: 10 }));
}

function computeSheetColumns(sheet: Sheet) {
  const columnCount = Math.max(
    sheet.columns?.length || 0,
    ...sheet.rows.map((row) => row.reduce((count, cell) => count + 1 + Math.max(0, cell?.mergeAcross || 0), 0)),
    0
  );

  const rules = getColumnRules(sheet.name, columnCount);
  const widths = Array.from({ length: columnCount }, (_, i) => rules[i]?.width || rules[i]?.min || sheet.columns?.[i] || 100);

  for (const row of sheet.rows) {
    let colIndex = 0;
    for (const cell of row) {
      const span = 1 + Math.max(0, cell?.mergeAcross || 0);
      if (span === 1 && cell && cell.value !== undefined) {
        const rule = rules[colIndex] || { mode: "auto", min: 100, max: 180, padding: 10 };
        if (rule.mode === "auto") {
          const contentWidth = estimateTextLength(cell.value) * 7 + (rule.padding || 10);
          const maxWidth = rule.max || 220;
          widths[colIndex] = clamp(Math.max(widths[colIndex], contentWidth), rule.min, maxWidth);
        } else if (rule.mode === "wrap") {
          widths[colIndex] = Math.max(widths[colIndex], rule.min);
        } else if (rule.mode === "fixed" && rule.width) {
          widths[colIndex] = rule.width;
        }
      }
      colIndex += span;
    }
  }

  return widths.map((w, i) => {
    const rule = rules[i];
    if (!rule) return w;
    if (rule.mode === "fixed") return rule.width || rule.min;
    if (rule.mode === "wrap") return clamp(w, rule.min, rule.max || rule.min);
    return clamp(w, rule.min, rule.max || w);
  });
}

function estimateRowHeight(row: Row, columnWidths: number[]) {
  if (!row || row.length === 0) return 18;
  let height = 20;
  let colIndex = 0;

  for (const cell of row) {
    const span = 1 + Math.max(0, cell?.mergeAcross || 0);
    const style = cell?.style || "";
    const text = String(cell?.value ?? "").trim();
    const mergedWidth = columnWidths.slice(colIndex, colIndex + span).reduce((a, b) => a + b, 0);

    if (style === "logoCell") {
      height = Math.max(height, 72);
    } else if (style === "coverTitle") {
      height = Math.max(height, 38);
    } else if (style === "coverRef") {
      height = Math.max(height, 34);
    } else if (style === "summaryCardCurrency" || style === "summaryCardValue") {
      height = Math.max(height, 30);
    } else if (style === "summaryCardLabel" || style === "summaryCardNote" || style === "metaLabel") {
      height = Math.max(height, 24);
    } else if (style === "requestBox") {
      height = Math.max(height, 46);
    } else if (style === "title") {
      height = Math.max(height, 28);
    } else if (style === "subtitle") {
      height = Math.max(height, 22);
    } else if ((style === "body" || style === "cellWrap" || style === "task" || style === "item" || style === "brandDetail" || style === "brandSub" || style === "value" || style === "subtitle") && text) {
      const approxLineCapacity = Math.max(14, Math.floor(mergedWidth / 7.2));
      const explicitLines = text.split(/\n/).reduce((sum, line) => {
        const lineLength = estimateTextLength(line);
        return sum + Math.max(1, Math.ceil(lineLength / approxLineCapacity));
      }, 0);
      const lines = Math.max(1, explicitLines);
      const lineHeight = style === "body" ? 16 : 15;
      // AI narrative sections can now be deliberately longer and more operationally detailed.
      // Keep wrapped row heights large enough so the client-facing Excel output does not look cut off.
      const maxWrappedHeight = style === "body" ? 405 : 220;
      height = Math.max(height, Math.min(maxWrappedHeight, 8 + lines * lineHeight));
    }

    colIndex += span;
  }

  return Math.round(height);
}

function columnXml(width: number) {
  const ssWidth = Math.max(40, width) * 0.75;
  return `<Column ss:AutoFitWidth="0" ss:Width="${ssWidth.toFixed(2)}"/>`;
}

function cellXml(cell: Cell) {
  if (!cell || (cell.value === undefined && !cell.style && cell.mergeAcross === undefined && !cell.href && !cell.formula)) return "<Cell/>";
  const style = cell.style ? ` ss:StyleID="${sanitizeXmlText(cell.style)}"` : "";
  const merge = typeof cell.mergeAcross === "number" && cell.mergeAcross > 0 ? ` ss:MergeAcross="${cell.mergeAcross}"` : "";
  const href = cell.href ? ` ss:HRef="${sanitizeXmlText(cell.href)}"` : "";
  const formula = cell.formula ? ` ss:Formula="${sanitizeXmlText(cell.formula)}"` : "";
  const rawValue = cell.value ?? "";
  const type = cell.type || (typeof rawValue === "number" ? "Number" : "String");
  const value = type === "Number" ? rawValue : sanitizeXmlText(rawValue);
  return `<Cell${style}${merge}${href}${formula}><Data ss:Type="${type}">${value}</Data></Cell>`;
}

function rowXml(row: Row, columnWidths: number[]) {
  if (!row || row.length === 0) return "<Row/>";
  const height = estimateRowHeight(row, columnWidths);
  return `<Row ss:AutoFitHeight="0" ss:Height="${height}">${row.map(cellXml).join("")}</Row>`;
}

function worksheetXml(sheet: Sheet) {
  const computedColumns = computeSheetColumns(sheet);
  const columns = computedColumns.map(columnXml).join("");
  const rows = sheet.rows.map((row) => rowXml(row, computedColumns)).join("\n");
  return `<Worksheet ss:Name="${sanitizeXmlText(sheet.name)}"><Table>${columns}${rows}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><Selected/><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios><FreezePanes/><FrozenNoSplit/><SplitHorizontal>3</SplitHorizontal><TopRowBottomPane>3</TopRowBottomPane><ActivePane>2</ActivePane><Panes><Pane><Number>3</Number></Pane><Pane><Number>2</Number><ActiveRow>4</ActiveRow></Pane></Panes></WorksheetOptions></Worksheet>`;
}


function buildEvidenceSheet(payload: WorkbookPayload): Sheet | null {
  if (!payload.review.include_evidence_register) return null;
  const evidence = payload.evidence ?? [];

  const rows: Row[] = [
    ...titleRows(exportTitle(payload), "Evidence Register", 6),
    [
      { value: "Ref", style: "header" },
      { value: "Category", style: "header" },
      { value: "Evidence description", style: "header" },
      { value: "Evidence date", style: "header" },
      { value: "Related issue", style: "header" },
      { value: "Link", style: "header" },
    ],
  ];

  if (evidence.length === 0) {
    rows.push([{ value: "No evidence files included.", style: "muted", mergeAcross: 5 }]);
  } else {
    evidence.forEach((file, index) => {
      rows.push([
        { value: `E${String(index + 1).padStart(2, "0")}`, style: "cell" },
        { value: normaliseText(file.category)?.replaceAll("_", " ") || "—", style: "evidenceCategory" },
        { value: [clientText(file.description) || "Supporting evidence record.", clientFileName(file.file_name) ? `File: ${clientFileName(file.file_name)}` : ""].filter(Boolean).join("\n"), style: "cellWrap" },
        { value: displayDate(file.evidence_date) || "", style: "cell" },
        { value: clientText(file.relates_to) || "", style: "cellWrap" },
        file.signed_url
          ? { value: "View", style: "link", href: file.signed_url }
          : { value: "—", style: "muted" },
      ]);
    });
  }

  return {
    name: SHEET_NAMES.evidence,
    columns: [70, 125, 360, 105, 220, 80],
    rows,
  };
}

function workbookXml(sheets: Sheet[], companyName = "Commercial Co-Pilot") {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Commercial Co-Pilot</Author>
  <Company>${sanitizeXmlText(companyName || "Commercial Co-Pilot")}</Company>
 </DocumentProperties>
 <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
  <ProtectStructure>False</ProtectStructure>
  <ProtectWindows>False</ProtectWindows>
 </ExcelWorkbook>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#111827"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="title"><Font ss:Bold="1" ss:Size="16" ss:Color="#111827"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="brandTitle"><Font ss:Bold="1" ss:Size="18" ss:Color="#111827"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="brandSub"><Font ss:Bold="1" ss:Size="10" ss:Color="#334155"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="brandDetail"><Font ss:Size="10" ss:Color="#475569"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="logoCell"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="subtitle"><Font ss:Size="10" ss:Color="#475569"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="section"><Font ss:Bold="1" ss:Size="11" ss:Color="#209A5C"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#209A5C"/></Borders></Style>
  <Style ss:ID="header"><Font ss:Bold="1" ss:Size="10" ss:Color="#111827"/><Interior ss:Color="#EEF2F7" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/></Borders></Style>
  <Style ss:ID="label"><Font ss:Bold="1" ss:Size="10" ss:Color="#475569"/><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="value"><Font ss:Size="10" ss:Color="#111827"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="body"><Font ss:Size="10" ss:Color="#111827"/><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
  <Style ss:ID="currency"><Font ss:Size="10" ss:Color="#111827"/><NumberFormat ss:Format="\u00a3#,##0.00"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/></Style>
  <Style ss:ID="totalLabel"><Font ss:Bold="1" ss:Size="10" ss:Color="#111827"/><Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/></Style>
  <Style ss:ID="total"><Font ss:Bold="1" ss:Size="11" ss:Color="#111827"/><NumberFormat ss:Format="\u00a3#,##0.00"/><Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/></Style>
  <Style ss:ID="group"><Font ss:Bold="1" ss:Size="10" ss:Color="#111827"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/></Style>
  <Style ss:ID="subgroup"><Font ss:Bold="1" ss:Italic="1" ss:Size="10" ss:Color="#334155"/></Style>
  <Style ss:ID="task"><Font ss:Italic="1" ss:Size="10" ss:Color="#475569"/><Alignment ss:WrapText="1"/></Style>
  <Style ss:ID="item"><Font ss:Size="10" ss:Color="#111827"/><Alignment ss:WrapText="1"/></Style>
  <Style ss:ID="cell"><Font ss:Size="10" ss:Color="#111827"/></Style>
  <Style ss:ID="cellWrap"><Font ss:Size="10" ss:Color="#111827"/><Alignment ss:WrapText="1" ss:Vertical="Top"/></Style>
  <Style ss:ID="muted"><Font ss:Italic="1" ss:Size="10" ss:Color="#64748B"/></Style>
  <Style ss:ID="link"><Font ss:Bold="1" ss:Size="10" ss:Color="#2563EB" ss:Underline="Single"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
  <Style ss:ID="coverKicker"><Font ss:Bold="1" ss:Size="9" ss:Color="#475569"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="coverRef"><Font ss:Bold="1" ss:Size="14" ss:Color="#111827"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="coverTitle"><Font ss:Bold="1" ss:Size="20" ss:Color="#111827"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="metaLabel"><Font ss:Bold="1" ss:Size="10" ss:Color="#475569"/><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="summaryCardLabel"><Font ss:Bold="1" ss:Size="9" ss:Color="#475569"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/></Style>
  <Style ss:ID="summaryCardValue"><Font ss:Bold="1" ss:Size="14" ss:Color="#111827"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/></Style>
  <Style ss:ID="summaryCardCurrency"><Font ss:Bold="1" ss:Size="14" ss:Color="#111827"/><NumberFormat ss:Format="\u00a3#,##0.00"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/></Style>
  <Style ss:ID="summaryCardNote"><Font ss:Size="10" ss:Color="#475569"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/></Style>
  <Style ss:ID="requestBox"><Font ss:Bold="1" ss:Size="12" ss:Color="#111827"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="evidenceCategory"><Font ss:Bold="1" ss:Size="10" ss:Color="#334155"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
 </Styles>
 ${sheets.map(worksheetXml).join("\n")}
</Workbook>`;
}

function buildCeWorkbookSheets(payload: WorkbookPayload, aiDraft?: AiDraftSections): Sheet[] {
  const review = payload.review || {};
  // Staff prelims are exported on the Prelims + Fee sheet only, not the Labour sheet.
  const labour = payload.resources.filter((x) => isCategory(x, "labour") && !looksLikeStaff(x.item_name, x.notes));
  const plant = payload.resources.filter((x) => isCategory(x, "plant"));
  const material = payload.resources.filter((x) => isCategory(x, "material"));
  const charges = payload.resources.filter((x) => isCategory(x, "subcontract"));

  const sheets: Sheet[] = [buildSummarySheet(payload, aiDraft)];

  if (review.include_basis) sheets.push(buildBasisSheet(payload, aiDraft));

  if (review.include_cost_summary || review.include_prelims_fee) {
    sheets.push(buildCostSummarySheet(payload, aiDraft));
  }

  if (review.include_cost_summary) {
    if (labour.length) sheets.push(buildSheetFromLines(SHEET_NAMES.labour, labour, "Labour", payload));
    if (plant.length) sheets.push(buildSheetFromLines(SHEET_NAMES.plant, plant, "Plant", payload));
    if (material.length) sheets.push(buildSheetFromLines(SHEET_NAMES.materials, material, "Material", payload));
    if (charges.length) sheets.push(buildSheetFromLines(SHEET_NAMES.subcontract, charges, "Subcontract / charge", payload));
  }

  if (review.include_prelims_fee) sheets.push(buildPrelimsSheet(payload, aiDraft));
  if (review.include_time_impact) sheets.push(buildTimeRiskSheet(payload, aiDraft));

  const evidenceSheet = buildEvidenceSheet(payload);
  if (evidenceSheet) sheets.push(evidenceSheet);

  return sheets;
}

export function buildCeWorkbookXml(payload: WorkbookPayload, aiDraft?: AiDraftSections) {
  const exportCompanyName = companyLegalName(payload.companyProfile) || companyDisplayName(payload.companyProfile) || "Commercial Co-Pilot";
  return workbookXml(buildCeWorkbookSheets(payload, aiDraft), exportCompanyName);
}

function safeSheetName(name: string) {
  return String(name || "Sheet").replace(/[\/\?\*\[\]:]/g, " ").slice(0, 31) || "Sheet";
}

function columnName(index: number) {
  let n = index;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function quoteSheetName(name: string) {
  return `'${safeSheetName(name).replace(/'/g, "''")}'`;
}

function sheetFormulaRef(sheetName: string, cellRef: string) {
  return `${quoteSheetName(sheetName)}!${cellRef}`;
}

function sumFormula(startCell: string, endCell: string) {
  return `SUM(${startCell}:${endCell})`;
}

function lineCostFormula(rowNumber: number) {
  return `D${rowNumber}*F${rowNumber}`;
}

function prelimCostFormula(rowNumber: number) {
  return `B${rowNumber}*D${rowNumber}`;
}

function resourceSheetTotalCell(lines: ExportResourceLine[], itemLabel: string) {
  // buildSheetFromLines layout is:
  // 1-3 title rows, 4 header row, then structured rows, then one blank row, then the total row.
  // The Summary and Prelims sheets must point at the actual total cell on each exported cost tab.
  // A previous offset pointed far below the total row, so Labour/Plant/Materials/Subcontract showed as 0 on Summary.
  const structuredRows = buildStructuredRows(lines, itemLabel).length;
  return `G${structuredRows + 6}`;
}

function findFirstCellRef(sheet: Sheet, label: string, valueColumn: string, style?: string) {
  const index = sheet.rows.findIndex((row) => String(row?.[0]?.value ?? "") === label && (!style || row?.[0]?.style === style));
  return `${valueColumn}${index >= 0 ? index + 1 : 1}`;
}

function escapeXml(value: unknown) {
  return sanitizeXmlText(value);
}

function xlsxStyleId(style?: string) {
  switch (style) {
    case "title": return 1;
    case "brandTitle": return 2;
    case "brandSub": return 3;
    case "brandDetail": return 4;
    case "subtitle": return 5;
    case "section": return 6;
    case "header": return 7;
    case "label": return 8;
    case "currency": return 9;
    case "totalLabel": return 10;
    case "total": return 11;
    case "group": return 12;
    case "subgroup": return 13;
    case "body": return 14;
    case "cellWrap": return 14;
    case "muted": return 15;
    case "link": return 16;
    case "item": return 17;
    case "coverKicker": return 18;
    case "coverRef": return 19;
    case "coverTitle": return 20;
    case "metaLabel": return 21;
    case "summaryCardLabel": return 22;
    case "summaryCardValue": return 23;
    case "summaryCardCurrency": return 24;
    case "summaryCardNote": return 5;
    case "requestBox": return 25;
    case "evidenceCategory": return 26;
    default: return 0;
  }
}

function xlsxWorksheetXml(sheet: Sheet, sheetIndex: number, hasLogo: boolean) {
  const computedColumns = computeSheetColumns(sheet);
  const cols = computedColumns.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(8, Math.round(w / 7))}" customWidth="1"/>`).join("");
  const merges: string[] = [];
  const hyperlinks: { ref: string; rId: string }[] = [];
  const rels: string[] = [];
  const isWideSheet = [SHEET_NAMES.labour, SHEET_NAMES.plant, SHEET_NAMES.materials, SHEET_NAMES.subcontract, SHEET_NAMES.evidence].includes(sheet.name as any);
  const rowsXml = sheet.rows.map((row, rIdx) => {
    const rowNumber = rIdx + 1;
    const height = hasLogo && sheetIndex === 1 && rowNumber === 1 ? 62 : estimateRowHeight(row, computedColumns);
    let colIndex = 1;
    const cells = row.map((cell) => {
      const startCol = colIndex;
      const endCol = startCol + (cell.mergeAcross || 0);
      const ref = `${columnName(startCol)}${rowNumber}`;
      if (endCol > startCol) merges.push(`${ref}:${columnName(endCol)}${rowNumber}`);
      colIndex = endCol + 1;

      const styleId = xlsxStyleId(cell.style);
      const rawValue = cell.value ?? "";
      if (cell.href) {
        const rId = `rId${hyperlinks.length + (hasLogo && sheetIndex === 1 ? 2 : 1)}`;
        hyperlinks.push({ ref, rId });
        rels.push(`<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(cell.href)}" TargetMode="External"/>`);
      }
      if (cell.formula) {
        const cached = cell.cachedValue ?? rawValue;
        const numericCached = Number(cached);
        const cachedXml = Number.isFinite(numericCached) ? `<v>${numericCached}</v>` : `<v>0</v>`;
        return `<c r="${ref}" s="${styleId}"><f>${escapeXml(cell.formula)}</f>${cachedXml}</c>`;
      }
      if (cell.type === "Number" || typeof rawValue === "number") {
        return `<c r="${ref}" s="${styleId}"><v>${Number(rawValue) || 0}</v></c>`;
      }
      return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(rawValue)}</t></is></c>`;
    }).join("");
    return `<row r="${rowNumber}" ht="${height}" customHeight="1">${cells}</row>`;
  }).join("\n");

  const drawingRel = hasLogo && sheetIndex === 1 ? `<drawing r:id="rId1"/>` : "";
  const hyperlinkXml = hyperlinks.length ? `<hyperlinks>${hyperlinks.map((h) => `<hyperlink ref="${h.ref}" r:id="${h.rId}"/>`).join("")}</hyperlinks>` : "";
  const mergeXml = merges.length ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>` : "";
  const relXml = [
    ...(hasLogo && sheetIndex === 1 ? [`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>`] : []),
    ...rels,
  ].join("");

  return {
    sheetXml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${rowsXml}</sheetData>${mergeXml}${hyperlinkXml}<printOptions gridLines="0" headings="0" horizontalCentered="0"/><pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="${isWideSheet ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/>${drawingRel}</worksheet>`,
    relXml: relXml ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relXml}</Relationships>` : "",
  };
}

const XLSX_STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="£#,##0.00"/></numFmts>
  <fonts count="12">
    <font><sz val="10"/><color rgb="FF111827"/><name val="Calibri"/></font>
    <font><b/><sz val="16"/><color rgb="FF111827"/><name val="Calibri"/></font>
    <font><b/><sz val="18"/><color rgb="FF111827"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF334155"/><name val="Calibri"/></font>
    <font><sz val="10"/><color rgb="FF475569"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF209A5C"/><name val="Calibri"/></font>
    <font><i/><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/></font>
    <font><b/><u/><sz val="10"/><color rgb="FF2563EB"/><name val="Calibri"/></font>
    <font><b/><sz val="20"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="9"/><color rgb="FF475569"/><name val="Calibri"/></font>
    <font><b/><sz val="12"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
  </fonts>
  <fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF2F7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF9FAFB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="3"><border/><border><bottom style="thin"><color rgb="FFE5E7EB"/></bottom></border><border><left style="thin"><color rgb="FFE5E7EB"/></left><right style="thin"><color rgb="FFE5E7EB"/></right><top style="thin"><color rgb="FFE5E7EB"/></top><bottom style="thin"><color rgb="FFE5E7EB"/></bottom></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="27">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="164" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="10" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="9" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="10" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="9" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="9" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="11" fillId="6" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="6" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function crc32(bytes: Uint8Array) {
  const table = crc32Table;
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function u16(n: number) { const a = new Uint8Array(2); new DataView(a.buffer).setUint16(0, n, true); return a; }
function u32(n: number) { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, n >>> 0, true); return a; }
function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}

function textBytes(text: string) { return new TextEncoder().encode(text); }

function makeZip(files: { name: string; data: Uint8Array }[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = textBytes(file.name);
    const data = file.data;
    const crc = crc32(data);
    const local = concatBytes([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
    localParts.push(local);
    const central = concatBytes([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]);
    centralParts.push(central);
    offset += local.length;
  }
  const centralOffset = offset;
  const central = concatBytes(centralParts);
  const end = concatBytes([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(centralOffset), u16(0)]);
  return concatBytes([...localParts, central, end]);
}

async function getImageDisplaySize(blob: Blob, maxWidth = 180, maxHeight = 70): Promise<{ width: number; height: number }> {
  if (typeof Image === "undefined" || typeof URL === "undefined") return { width: maxWidth, height: Math.round(maxWidth * 0.4) };

  const objectUrl = URL.createObjectURL(blob);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || maxWidth, height: img.naturalHeight || maxHeight });
      img.onerror = () => resolve({ width: maxWidth, height: Math.round(maxWidth * 0.4) });
      img.src = objectUrl;
    });

    const scale = Math.min(maxWidth / Math.max(1, dimensions.width), maxHeight / Math.max(1, dimensions.height), 1);
    return {
      width: Math.max(40, Math.round(dimensions.width * scale)),
      height: Math.max(24, Math.round(dimensions.height * scale)),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function fetchLogoBytes(logoUrl?: string | null): Promise<{ bytes: Uint8Array; ext: "png" | "jpeg"; width: number; height: number } | null> {
  const url = String(logoUrl || "").trim();
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const type = blob.type.toLowerCase();
    const ext: "png" | "jpeg" = type.includes("jpeg") || type.includes("jpg") || url.toLowerCase().match(/\.jpe?g($|\?)/) ? "jpeg" : "png";
    const size = await getImageDisplaySize(blob);
    return { bytes: new Uint8Array(await blob.arrayBuffer()), ext, ...size };
  } catch (err) {
    console.warn("[exportWorkbook] failed to embed company logo", err);
    return null;
  }
}

function contentTypesXml(sheetCount: number, logoExt?: "png" | "jpeg") {
  const sheets = Array.from({ length: sheetCount }, (_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const media = logoExt ? `<Default Extension="${logoExt}" ContentType="image/${logoExt}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${media}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets}${logoExt ? `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` : ""}</Types>`;
}

function workbookXlsxXml(sheets: Sheet[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${escapeXml(safeSheetName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`;
}

function workbookRelsXml(sheets: Sheet[]) {
  const rels = sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

function drawingXml(widthPx = 180, heightPx = 70) {
  const emuPerPx = 9525;
  const cx = Math.round(widthPx * emuPerPx);
  const cy = Math.round(heightPx * emuPerPx);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>95250</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>95250</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="Company logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;
}

function drawingRelsXml(ext: "png" | "jpeg") {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/company-logo.${ext}"/></Relationships>`;
}

async function buildCeWorkbookXlsxBlob(payload: WorkbookPayload, aiDraft?: AiDraftSections) {
  const sheets = buildCeWorkbookSheets(payload, aiDraft);
  const logo = await fetchLogoBytes(payload.companyProfile?.logo_url);
  const hasLogo = Boolean(logo);
  const files: { name: string; data: Uint8Array }[] = [
    { name: "[Content_Types].xml", data: textBytes(contentTypesXml(sheets.length, logo?.ext)) },
    { name: "_rels/.rels", data: textBytes(rootRelsXml()) },
    { name: "xl/workbook.xml", data: textBytes(workbookXlsxXml(sheets)) },
    { name: "xl/_rels/workbook.xml.rels", data: textBytes(workbookRelsXml(sheets)) },
    { name: "xl/styles.xml", data: textBytes(XLSX_STYLES_XML) },
  ];

  sheets.forEach((sheet, index) => {
    const ws = xlsxWorksheetXml(sheet, index + 1, hasLogo);
    files.push({ name: `xl/worksheets/sheet${index + 1}.xml`, data: textBytes(ws.sheetXml) });
    if (ws.relXml) files.push({ name: `xl/worksheets/_rels/sheet${index + 1}.xml.rels`, data: textBytes(ws.relXml) });
  });

  if (logo) {
    files.push({ name: "xl/drawings/drawing1.xml", data: textBytes(drawingXml(logo.width, logo.height)) });
    files.push({ name: "xl/drawings/_rels/drawing1.xml.rels", data: textBytes(drawingRelsXml(logo.ext)) });
    files.push({ name: `xl/media/company-logo.${logo.ext}`, data: logo.bytes });
  }

  return new Blob([makeZip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function downloadCeWorkbook(payload: WorkbookPayload, aiDraft?: AiDraftSections) {
  const blob = await buildCeWorkbookXlsxBlob(payload, aiDraft);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = (`${payload.meta.ceRef || ""} ${payload.meta.title || "ce-pack"}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "ce-pack";
  a.href = url;
  a.download = `${slug}-pack.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
