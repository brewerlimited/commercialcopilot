export type ContractFamily = "NEC" | "JCT" | "BESPOKE" | "UNCONFIRMED" | "UNKNOWN";

export const CONTRACT_TYPE_OPTIONS = [
  { value: "nec4_ecs_option_a", label: "NEC4 ECS Option A", family: "NEC" as const },
  { value: "nec4_ecs_option_b", label: "NEC4 ECS Option B", family: "NEC" as const },
  { value: "nec4_ecc_option_a", label: "NEC4 ECC Option A", family: "NEC" as const },
  { value: "nec4_ecc_option_b", label: "NEC4 ECC Option B", family: "NEC" as const },
  { value: "jct_d_and_b_2016", label: "JCT Design & Build 2016", family: "JCT" as const },
  { value: "jct_intermediate_2016", label: "JCT Intermediate 2016", family: "JCT" as const },
  { value: "jct_standard_building_2016", label: "JCT Standard Building Contract 2016", family: "JCT" as const },
  { value: "bespoke_other", label: "Bespoke / Other contract", family: "BESPOKE" as const },
  { value: "unconfirmed", label: "Unconfirmed contract", family: "UNCONFIRMED" as const },
] as const;

export type KnownContractType = (typeof CONTRACT_TYPE_OPTIONS)[number]["value"];

const CONTRACT_LABEL_LOOKUP = new Map<string, string>(
  CONTRACT_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

const CONTRACT_FAMILY_LOOKUP = new Map<string, ContractFamily>(
  CONTRACT_TYPE_OPTIONS.map((option) => [option.value, option.family]),
);

export function getContractFamily(contractType?: string | null): ContractFamily {
  const raw = String(contractType ?? "").trim();
  if (!raw) return "UNCONFIRMED";

  const mapped = CONTRACT_FAMILY_LOOKUP.get(raw);
  if (mapped) return mapped;

  const lower = raw.toLowerCase();
  if (lower.includes("bespoke") || lower.includes("other") || lower.includes("amended") || lower.includes("subcontract order")) return "BESPOKE";
  if (lower.includes("unconfirmed") || lower.includes("unknown") || lower.includes("not sure")) return "UNCONFIRMED";
  if (lower.includes("nec")) return "NEC";
  if (lower.includes("jct")) return "JCT";
  return "UNCONFIRMED";
}

export function getContractLabel(contractType?: string | null): string {
  const raw = String(contractType ?? "").trim();
  if (!raw) return "Contract not set";

  const mapped = CONTRACT_LABEL_LOOKUP.get(raw);
  if (mapped) return mapped;

  const tokens = raw
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const tokenMap: Record<string, string> = {
    nec: "NEC",
    nec3: "NEC3",
    nec4: "NEC4",
    ecs: "ECS",
    ecc: "ECC",
    psc: "PSC",
    jct: "JCT",
    sbc: "SBC",
    db: "D&B",
    dnb: "D&B",
    bespoke: "Bespoke",
    unconfirmed: "Unconfirmed",
  };

  return tokens
    .map((token) => {
      const lower = token.toLowerCase();
      if (tokenMap[lower]) return tokenMap[lower];
      if (/^\d+$/.test(token)) return token;
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ");
}

export function getContractFamilyHint(contractType?: string | null): string {
  const family = getContractFamily(contractType);
  if (family === "NEC") {
    return "NEC-ready structure. Draft outputs will later use Defined Cost and programme framing.";
  }
  if (family === "JCT") {
    return "JCT-ready structure. Draft outputs will later use progress and loss & expense framing.";
  }
  if (family === "BESPOKE") {
    return "Bespoke contract selected. Upload the contract before creating a CE so drafting uses the project-specific wording rather than NEC/JCT assumptions.";
  }
  return "Contract unconfirmed. Confirm the contract form before relying on standard NEC or JCT wording.";
}

export function getCostLabel(contractType?: string | null): string {
  const family = getContractFamily(contractType);
  if (family === "NEC") return "Defined Cost";
  if (family === "JCT") return "Direct cost";
  return "Recoverable cost";
}

export function getFeeBasisLabel(contractType: string | null | undefined, feeBasis: string | null | undefined): string {
  const costLabel = getCostLabel(contractType);
  return feeBasis === "defined_cost_plus_prelims"
    ? `Based on ${costLabel} + Prelims`
    : `Based on ${costLabel} only`;
}

export function requiresUploadedContract(contractType?: string | null): boolean {
  const family = getContractFamily(contractType);
  return family === "BESPOKE" || family === "UNCONFIRMED";
}

export function getContractLanguageInstruction(contractType?: string | null): string {
  const family = getContractFamily(contractType);
  if (family === "NEC") {
    return "Use NEC-appropriate language including Defined Cost and programme effect where supported.";
  }
  if (family === "JCT") {
    return "Use JCT-appropriate language. Do not use NEC-specific phrases such as Defined Cost unless explaining why they are not applicable.";
  }
  if (family === "BESPOKE") {
    return "Use neutral subcontract recovery language unless uploaded contract text supports a specific clause, entitlement route or terminology. Do not default to NEC or JCT wording.";
  }
  return "The contract is unconfirmed. Use neutral subcontract recovery language, avoid NEC/JCT-specific terms unless clearly supported, and flag clause certainty as requiring confirmation.";
}
