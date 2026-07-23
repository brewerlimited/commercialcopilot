export type TradeProfileKey =
  | "general"
  | "groundworks"
  | "drylining"
  | "passive_fire"
  | "fit_out"
  | "frc";

export type TradeProfile = {
  key: TradeProfileKey;
  label: string;
  shortLabel: string;
  description: string;
  evidenceFocus: string[];
  resourceFocus: string[];
  programmeFocus: string[];
  commercialRisks: string[];
  promptContext: string;
};

export const TRADE_PROFILES: TradeProfile[] = [
  {
    key: "general",
    label: "General subcontract works",
    shortLabel: "General",
    description: "Default subcontractor recovery profile for mixed or unclassified works.",
    evidenceFocus: [
      "instructions, drawings, RFIs and written directions",
      "site diary records, photos and supervisor notes",
      "labour, plant, material and subcontract cost support",
      "programme extracts, lookaheads and sequencing records",
    ],
    resourceFocus: [
      "direct labour and supervision",
      "plant, materials and subcontract packages",
      "preliminaries, management time and disruption support",
    ],
    programmeFocus: [
      "changed sequence or access",
      "return visits, abortive work and reattendance",
      "delay, disruption or acceleration where evidenced",
    ],
    commercialRisks: [
      "weak link between instruction and cost",
      "missing contemporaneous records",
      "programme impact asserted without support",
      "valuation basis not clearly explained",
    ],
    promptContext:
      "Use a general UK subcontractor commercial management lens. Keep the narrative factual, operationally grounded and commercially defensible. Do not assume a specialist trade mechanism unless the event facts clearly support it.",
  },
  {
    key: "groundworks",
    label: "Groundworks",
    shortLabel: "Groundworks",
    description: "Excavation, drainage, ducting, civils, external works and ground remediation.",
    evidenceFocus: [
      "drawings, setting out information, permits and service records",
      "photos of obstructions, excavations, water, ground conditions and reinstatement",
      "plant records, delivery tickets, muck-away tickets and testing records",
      "daily allocations showing gangs, machines, banksmen and supervision",
    ],
    resourceFocus: [
      "excavators, dumpers, rollers, breakers, pumps and compaction plant",
      "groundworkers, plant operators, banksmen, supervisors and engineers",
      "aggregate, concrete, pipework, ducting, protection and reinstatement materials",
    ],
    programmeFocus: [
      "loss of planned excavation sequence",
      "standing time, remobilisation and return visits",
      "follow-on ducting, drainage, slab, surfacing or backfill impacts",
    ],
    commercialRisks: [
      "ground condition presented as a change without contract support",
      "plant standing time not linked to instruction or obstruction",
      "muck-away or disposal quantities not evidenced",
      "weather, water or services risk confused with recoverable change",
    ],
    promptContext:
      "Write through a groundworks/civils subcontractor lens. Explain excavation methodology, access, plant dependency, obstructions, service constraints, dewatering, disposal, backfill, compaction, testing and reinstatement only where supported by the facts. Tie plant and gang time tightly to the changed operation.",
  },
  {
    key: "drylining",
    label: "Drylining",
    shortLabel: "Drylining",
    description: "Partitions, plasterboard, ceilings, linings, fire-rated boards and associated finishing.",
    evidenceFocus: [
      "latest drawings, room data sheets, details and specification revisions",
      "photos of access restrictions, incomplete preceding trades and out-of-sequence areas",
      "QA sheets, inspection records and snag / defect communications",
      "daily allocations by floor, plot, room, elevation or area",
    ],
    resourceFocus: [
      "dryliners, fixers, ceiling fixers, tapers, supervisors and material handlers",
      "boards, metalwork, beads, insulation, fixings, compounds and access equipment",
      "rehandling, protection, waste and return-visit labour",
    ],
    programmeFocus: [
      "area-by-area access release",
      "trade stacking and fragmented working",
      "return visits caused by late MEP, design or builder's work issues",
    ],
    commercialRisks: [
      "inefficient working asserted without room / area evidence",
      "damage, protection or rework not separated from original scope",
      "materials uplift not tied to drawing or specification change",
      "sequence impact not linked to access release or preceding trade delay",
    ],
    promptContext:
      "Write through a drylining subcontractor lens. Focus on area release, out-of-sequence working, MEP interfaces, board types, fire/acoustic requirements, access constraints, rehandling and finishing sequence. Make clear whether the impact is changed scope, disruption, rework or delayed access.",
  },
  {
    key: "passive_fire",
    label: "Passive fire",
    shortLabel: "Passive fire",
    description: "Fire stopping, cavity barriers, fire protection, compartmentation and compliance records.",
    evidenceFocus: [
      "fire strategy, specifications, approved details and manufacturer requirements",
      "photos before close-up, installation records and marked-up locations",
      "inspection records, third-party comments and sign-off sheets",
      "penetration schedules, access constraints and remobilisation records",
    ],
    resourceFocus: [
      "fire stoppers, supervisors, inspectors and QA/admin support",
      "sealants, collars, wraps, batt, pillows, boards, intumescent products and fixings",
      "access equipment, protection, tagging and certification time",
    ],
    programmeFocus: [
      "missed close-up windows",
      "return visits caused by incomplete preceding works or late penetrations",
      "inspection hold points and sign-off delays",
    ],
    commercialRisks: [
      "compliance work treated as variation without identifying the changed requirement",
      "late penetrations not tied to responsible trade or instruction",
      "certification/admin effort not supported by records",
      "access and close-up impact not evidenced by dates and locations",
    ],
    promptContext:
      "Write through a passive fire subcontractor lens. Prioritise compartmentation, compliance, access before close-up, late penetrations, inspection hold points, tagging, certification and manufacturer/detail requirements. Avoid implying entitlement just because works are safety-critical; link entitlement to a changed instruction, late information, access failure or changed requirement.",
  },
  {
    key: "fit_out",
    label: "Fit-out",
    shortLabel: "Fit-out",
    description: "Internal fit-out, finishes, joinery, architectural packages and completion works.",
    evidenceFocus: [
      "drawings, schedules, specifications, samples and client selections",
      "photos of incomplete areas, access restrictions, damage or revised finishes",
      "snagging lists, inspection records and handover constraints",
      "labour allocations by area, floor, room, plot or workface",
    ],
    resourceFocus: [
      "fixers, joiners, decorators, floor layers, supervisors and material handlers",
      "finishes, joinery, ironmongery, protection, access and specialist subcontract support",
      "rehandling, storage, protection, cleaning and return visits",
    ],
    programmeFocus: [
      "trade stacking and restricted access",
      "late selection, late design or revised finishes",
      "handover, protection and repeated attendance impacts",
    ],
    commercialRisks: [
      "snagging or quality correction confused with recoverable change",
      "client selection delay not tied to instruction or programme impact",
      "damage/protection responsibility unclear",
      "fragmented working not evidenced by workface records",
    ],
    promptContext:
      "Write through a fit-out subcontractor lens. Focus on area access, finishes, joinery, protection, trade interfaces, repeated attendance, client selections, handover constraints and snag/completion sequence. Separate recoverable change from ordinary defects or snagging.",
  },
  {
    key: "frc",
    label: "FRC / concrete frame",
    shortLabel: "FRC",
    description: "Formwork, reinforcement, concrete, frame alterations and temporary works interfaces.",
    evidenceFocus: [
      "structural drawings, bar bending schedules, pour records and concrete tickets",
      "temporary works information, permits, hold points and inspection records",
      "photos of reinforcement, formwork, clashes, remedial works and access conditions",
      "gang, crane, pump, plant and supervisor allocation records",
    ],
    resourceFocus: [
      "steel fixers, formwork carpenters, concrete finishers, supervisors and engineers",
      "cranes, pumps, MEWPs, shutters, falsework, rebar, concrete and embedments",
      "rework, break-out, recast, curing, testing and temporary works support",
    ],
    programmeFocus: [
      "pour sequence changes and missed pour windows",
      "inspection hold points, redesign and remedial works",
      "craneage, pumping, access and follow-on trade impacts",
    ],
    commercialRisks: [
      "rework not separated from quality responsibility",
      "standing time not linked to hold point, instruction or design issue",
      "materials, wastage or concrete quantities not evidenced",
      "temporary works and inspection impacts not supported by records",
    ],
    promptContext:
      "Write through a reinforced concrete frame subcontractor lens. Explain formwork, reinforcement, embedments, pour sequence, concrete placement, temporary works, inspections, curing, remedial works and crane/pump dependency only where supported. Keep entitlement linked to instruction, information, access, obstruction, hold point or changed design.",
  },
];

const TRADE_PROFILE_LOOKUP = new Map<TradeProfileKey, TradeProfile>(
  TRADE_PROFILES.map((profile) => [profile.key, profile]),
);

export function normaliseTradeProfile(value?: string | null): TradeProfileKey {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "general";

  const cleaned = raw.replace(/[\s-]+/g, "_");
  if (cleaned === "passive_fire" || cleaned === "fire_stopping" || cleaned === "firestopping") return "passive_fire";
  if (cleaned === "fit_out" || cleaned === "fitout" || cleaned === "interiors") return "fit_out";
  if (cleaned === "frc" || cleaned === "rc_frame" || cleaned === "concrete_frame" || cleaned === "reinforced_concrete") return "frc";
  if (cleaned === "groundworks" || cleaned === "groundwork" || cleaned === "civils" || cleaned === "civil_engineering") return "groundworks";
  if (cleaned === "drylining" || cleaned === "dry_lining" || cleaned === "dryliner") return "drylining";

  return TRADE_PROFILE_LOOKUP.has(cleaned as TradeProfileKey) ? (cleaned as TradeProfileKey) : "general";
}

export function getTradeProfile(value?: string | null): TradeProfile {
  return TRADE_PROFILE_LOOKUP.get(normaliseTradeProfile(value)) || TRADE_PROFILE_LOOKUP.get("general")!;
}
