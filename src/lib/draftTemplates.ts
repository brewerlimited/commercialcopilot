import { getContractFamily, type ContractFamily } from "@/lib/contracts";

export type DraftTemplateKey = "NEC_STANDARD" | "JCT_STANDARD";

export type DraftSectionTemplate = {
  key: string;
  label: string;
};

export type DraftTemplate = {
  key: DraftTemplateKey;
  contractFamily: Exclude<ContractFamily, "UNKNOWN">;
  title: string;
  sections: DraftSectionTemplate[];
};

export const NEC_STANDARD_TEMPLATE: DraftTemplate = {
  key: "NEC_STANDARD",
  contractFamily: "NEC",
  title: "NEC standard draft",
  sections: [
    { key: "background", label: "Background" },
    { key: "change_to_contract_basis", label: "Change to Contract Basis" },
    { key: "effect_on_defined_cost", label: "Effect on Defined Cost" },
    { key: "effect_on_programme", label: "Effect on Programme" },
    { key: "commercial_impact", label: "Commercial Impact" },
    { key: "contractual_position", label: "Contractual Position" },
    { key: "assumptions", label: "Assumptions" },
    { key: "conclusion", label: "Conclusion" },
  ],
};

export const JCT_STANDARD_TEMPLATE: DraftTemplate = {
  key: "JCT_STANDARD",
  contractFamily: "JCT",
  title: "JCT standard draft",
  sections: [
    { key: "background", label: "Background" },
    { key: "change_to_contract_basis", label: "Change to Contract Basis" },
    { key: "effect_on_progress", label: "Effect on Progress" },
    { key: "effect_on_loss_and_expense", label: "Effect on Loss and Expense" },
    { key: "commercial_impact", label: "Commercial Impact" },
    { key: "contractual_position", label: "Contractual Position" },
    { key: "assumptions", label: "Assumptions" },
    { key: "conclusion", label: "Conclusion" },
  ],
};

export function getDraftTemplateForContractType(contractType?: string | null): DraftTemplate {
  const family = getContractFamily(contractType);
  return family === "JCT" ? JCT_STANDARD_TEMPLATE : NEC_STANDARD_TEMPLATE;
}
