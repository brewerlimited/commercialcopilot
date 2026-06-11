export type ContractFamily = "NEC" | "JCT" | "UNKNOWN";

export const CONTRACT_TYPE_OPTIONS = [
  { value: "nec4_ecs_option_a", label: "NEC4 ECS Option A", family: "NEC" as const },
  { value: "nec4_ecs_option_b", label: "NEC4 ECS Option B", family: "NEC" as const },
  { value: "nec4_ecc_option_a", label: "NEC4 ECC Option A", family: "NEC" as const },
  { value: "nec4_ecc_option_b", label: "NEC4 ECC Option B", family: "NEC" as const },
  { value: "jct_d_and_b_2016", label: "JCT Design & Build 2016", family: "JCT" as const },
  { value: "jct_intermediate_2016", label: "JCT Intermediate 2016", family: "JCT" as const },
  { value: "jct_standard_building_2016", label: "JCT Standard Building Contract 2016", family: "JCT" as const },
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
  if (!raw) return "UNKNOWN";

  const mapped = CONTRACT_FAMILY_LOOKUP.get(raw);
  if (mapped) return mapped;

  const lower = raw.toLowerCase();
  if (lower.includes("nec")) return "NEC";
  if (lower.includes("jct")) return "JCT";
  return "UNKNOWN";
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
  return "Contract family not yet identified.";
}

export function getCostLabel(contractType?: string | null): string {
  return getContractFamily(contractType) === "JCT" ? "Direct cost" : "Defined Cost";
}

export function getFeeBasisLabel(contractType: string | null | undefined, feeBasis: string | null | undefined): string {
  const costLabel = getContractFamily(contractType) === "JCT" ? "Direct cost" : "Defined Cost";
  return feeBasis === "defined_cost_plus_prelims"
    ? `Based on ${costLabel} + Prelims`
    : `Based on ${costLabel} only`;
}
