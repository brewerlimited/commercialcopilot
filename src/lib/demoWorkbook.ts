import { downloadCeWorkbook, type AiDraftSections, type WorkbookPayload } from "@/lib/exportWorkbook";

export const DEMO_WORKBOOK_PAYLOAD: WorkbookPayload = {
  meta: {
    ceRef: "CE 002",
    title: "Standing time due to delayed permit for service corridor excavation",
    contractType: "nec4_ecs_option_b",
    contractSource: "standard_logic",
    projectName: "Ainsworth Energy Recovery Facility",
    mainContractor: "Morrison Infrastructure",
    delayDays: 4,
    generatedAt: new Date("2026-06-18T09:00:00.000Z").toISOString(),
    instructionRef: "PMI-041 / Site instruction 13 Jun 2026",
    programmeRef: "Accepted programme Rev C",
  },
  companyProfile: {
    company_legal_name: "Example Subcontractor Ltd",
    trading_name: "Example Subcontractor",
    company_email: "commercial@example-subcontractor.co.uk",
    company_phone: "+44 20 0000 0000",
    vat_number: "GB 000 0000 00",
    company_registration_number: "00000000",
    company_address: "Unit 4, Trade Park, Bristol, BS1 1AA",
    logo_url: null,
  } as any,
  basis: {
    happened_summary:
      "Excavation works to the service corridor were stopped after the required permit and access confirmation were not available at the planned start time. The gang, excavator and dumper remained on standby while the permit position was resolved.",
    cause_type: "client_instruction_or_access",
    cause_summary:
      "The delay arose from permit and access control requirements outside the subcontractor's planned working method.",
    difference_from_plan:
      "The accepted programme allowed continuous excavation and cart-away during the planned shift. The workface was unavailable, preventing productive excavation during the recorded period.",
    mechanism_tags: ["Access restriction", "Permit delay", "Standing time", "Defined Cost"],
    time_impact_toggle: "yes",
    mitigation_summary:
      "The supervisor retained the gang at the workface, protected the excavation area and recommenced once access was confirmed. No reasonable alternative workface was available for the affected resources.",
  },
  resources: [
    {
      category: "labour",
      item_name: "Groundworker",
      unit: "hour",
      qty: 3,
      hours: 8,
      rate: 28.5,
      total: 684,
      start_date: "2026-06-13",
      end_date: "2026-06-13",
      linked_event: "Permit delay",
      notes: "Gang held at workface while permit and access position was resolved.",
    },
    {
      category: "labour",
      item_name: "Site supervisor",
      unit: "hour",
      qty: 1,
      hours: 8,
      rate: 38,
      total: 304,
      start_date: "2026-06-13",
      end_date: "2026-06-13",
      linked_event: "Permit delay",
      notes: "Supervisor coordinated access queries, protected the workface and recorded delay.",
    },
    {
      category: "plant",
      item_name: "13T excavator",
      unit: "hour",
      qty: 1,
      hours: 8,
      rate: 45,
      total: 360,
      start_date: "2026-06-13",
      end_date: "2026-06-13",
      linked_event: "Permit delay",
      notes: "Excavator retained on standby at the service corridor workface.",
    },
    {
      category: "plant",
      item_name: "6T dumper",
      unit: "hour",
      qty: 1,
      hours: 8,
      rate: 32,
      total: 256,
      start_date: "2026-06-13",
      end_date: "2026-06-13",
      linked_event: "Permit delay",
      notes: "Dumper retained for excavation cart-away once permit was released.",
    },
    {
      category: "material",
      item_name: "Temporary protection materials",
      unit: "item",
      qty: 1,
      rate: 185,
      total: 185,
      start_date: "2026-06-13",
      end_date: "2026-06-13",
      linked_event: "Workface protection",
      notes: "Protection and consumables used to keep the excavation safe during the delay.",
    },
  ],
  prelims: [
    { name: "Site management", qty: 1, unit: "day", rate: 320, prelim_type: "staff", notes: "Management time supporting access resolution and records." },
    { name: "Commercial review", qty: 1, unit: "day", rate: 420, prelim_type: "staff", notes: "Preparation of entitlement, resource and submission support." },
  ],
  valuation: {
    fee_percent: 12.5,
    fee_basis: "defined_cost_plus_prelims",
    work_days_per_week: 5,
  },
  review: {
    include_basis: true,
    include_entitlement: true,
    include_time_impact: true,
    include_evidence_register: true,
    include_cost_summary: true,
    include_prelims_fee: true,
    include_risk_notes: false,
    include_commercial_pushback: false,
    include_excel: true,
    include_pdf: false,
    qualifications_notes: "Demo workbook only. Replace with project-specific commercial qualifications before issue.",
  },
  fileCounts: {
    instructions: 1,
    photos: 2,
    site_records: 1,
    programme: 1,
    cost_support: 2,
  },
  evidence: [
    {
      file_name: "site-instruction-permit-delay.pdf",
      category: "instructions",
      description: "Instruction and permit trail confirming access was not released at the planned start time.",
      relates_to: "Permit delay",
      evidence_date: "2026-06-13",
    },
    {
      file_name: "supervisor-diary-13-june.pdf",
      category: "site_records",
      description: "Diary record of labour and plant held during the affected shift.",
      relates_to: "Standing time",
      evidence_date: "2026-06-13",
    },
    {
      file_name: "programme-extract-rev-c.pdf",
      category: "programme",
      description: "Accepted programme extract showing planned excavation sequence.",
      relates_to: "Time impact",
      evidence_date: "2026-06-12",
    },
  ],
  readiness: 94,
  warnings: 1,
  blockers: 0,
};

export const DEMO_AI_DRAFT: AiDraftSections = {
  background:
    "The subcontractor was engaged to carry out excavation and service corridor works at the Ainsworth Energy Recovery Facility. The planned works required timely access to the excavation workface and the release of the relevant permit so that labour and plant could proceed in sequence.",
  change_to_contract_basis:
    "The planned basis changed when the permit and access confirmation required to commence the service corridor excavation were not available at the planned start time. This prevented productive excavation and caused labour and plant to stand while the access position was resolved.",
  effect_on_defined_cost:
    "Defined Cost has been built from the recorded labour, plant, temporary protection materials and associated preliminary support required during the period of standing time. The resources were retained for the affected shift because they were required to recommence once the workface became available.",
  effect_on_programme:
    "The event affected the planned excavation sequence for the service corridor. The recorded impact was one working shift, with four working days of downstream delay carried in the programme assessment due to the knock-on effect on follow-on service installation activities.",
  commercial_impact:
    "The event caused recoverable standing time, preliminaries and fee. The submission is supported by site records, permit correspondence, programme extracts and cost build-up so the assessment can be followed from event record to priced value.",
  contractual_position:
    "The event is presented as a compensation event / variation arising from access and permit control outside the subcontractor's planned productive working sequence. The submission relies on the factual record, causation, Defined Cost build-up and programme impact rather than general delay narrative.",
  assumptions:
    "The assessment assumes the recorded labour and plant were reasonably retained because the permit release was expected during the affected working period and there was no equivalent alternative workface available.",
  risks_and_qualifications: "",
  conclusion:
    "The subcontractor is entitled to recover the additional cost and time consequences arising from the permit and access delay. The enclosed workbook provides the commercial narrative, evidence register and auditable cost support for assessment.",
};

export async function downloadDemoCeWorkbook() {
  await downloadCeWorkbook(DEMO_WORKBOOK_PAYLOAD, DEMO_AI_DRAFT);
}
