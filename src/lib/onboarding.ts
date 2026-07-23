export type OnboardingState =
  | "WELCOME"
  | "PROJECT_SETUP"
  | "PROJECT_SETUP_IN_PROGRESS"
  | "FIRST_ISSUE"
  | "FIRST_ISSUE_IN_PROGRESS"
  | "COMPLETE";

export type OnboardingProjectDraft = {
  projectName: string;
  tradePackage: string;
  otherTrade: string;
  contractBasis: string;
  mainContractor: string;
  projectReference: string;
};

export type OnboardingIssueDraft = {
  projectId: string | null;
  projectName: string;
  tradePackage: string;
  title: string;
  description: string;
  lastEditedAt?: string | null;
};

export type OnboardingPrefs = {
  onboardingCompletedAt?: string | null;
  welcomeDismissedAt?: string | null;
  guideHiddenAt?: string | null;
  projectDraft?: OnboardingProjectDraft | null;
  issueDraft?: OnboardingIssueDraft | null;
  lastUiState?: OnboardingState | null;
};

export type OnboardingProjectLike = {
  id?: string | null;
  project_name?: string | null;
  status?: string | null;
  is_demo?: boolean | null;
  demo?: boolean | null;
  seeded?: boolean | null;
};

export type OnboardingIssueLike = {
  id?: string | null;
  title?: string | null;
  status?: string | null;
  is_demo?: boolean | null;
  demo?: boolean | null;
  seeded?: boolean | null;
  first_issue_captured_at?: string | null;
  onboarding_captured_at?: string | null;
  created_at?: string | null;
};

export const ONBOARDING_FLOW_VERSION = "v1";

export const EMPTY_PROJECT_DRAFT: OnboardingProjectDraft = {
  projectName: "",
  tradePackage: "",
  otherTrade: "",
  contractBasis: "",
  mainContractor: "",
  projectReference: "",
};

export const EMPTY_ISSUE_DRAFT: OnboardingIssueDraft = {
  projectId: null,
  projectName: "",
  tradePackage: "",
  title: "",
  description: "",
  lastEditedAt: null,
};

export const TRADE_OPTIONS = [
  "Drylining",
  "Brickwork",
  "Passive fire",
  "Roofing",
  "Flooring",
  "Scaffolding",
  "Fit-out",
  "Mechanical",
  "Electrical",
  "M&E",
  "Other",
];

export const CONTRACT_BASIS_OPTIONS = [
  { label: "NEC-based", value: "nec" },
  { label: "JCT-based", value: "jct" },
  { label: "Other or bespoke", value: "bespoke_other" },
  { label: "Not sure", value: "not_sure" },
];

export const TRADE_EXAMPLES: Record<string, string> = {
  Drylining: "The partition setting-out was revised after installation had started, requiring removal and reinstatement.",
  "Passive fire": "Incomplete M&E penetrations required additional visits and prevented the fire-stopping works from being completed as planned.",
  Brickwork: "Lintel information was issued late, disrupting the planned sequence and reducing gang productivity.",
  Roofing: "Access was delayed and temporary waterproofing was required to protect incomplete areas.",
  Flooring: "The substrate was incomplete, requiring phased return visits and out-of-sequence working.",
  Scaffolding: "Additional adaptations were instructed and the scaffold remained in place beyond the planned hire period.",
  "Fit-out": "Selections were issued late, resulting in out-of-sequence working and repeat visits.",
  Mechanical: "Revised coordination information required installed work to be altered and commissioning to be repeated.",
  Electrical: "Revised coordination information required installed work to be altered and testing to be repeated.",
  "M&E": "Revised coordination information required installed work to be altered and commissioning activities to be repeated.",
  Other: "Issued information changed after work had started, causing additional work and disruption to the planned sequence.",
};

export function onboardingStorageKey(userId: string, suffix: string) {
  return `ccp.onboarding.${ONBOARDING_FLOW_VERSION}.${userId}.${suffix}`;
}

export function contractBasisToContractType(contractBasis: string) {
  if (contractBasis === "jct") return "jct_d_and_b_2016";
  if (contractBasis === "bespoke_other") return "bespoke_other";
  if (contractBasis === "not_sure") return "unconfirmed";
  return "nec4_ecs_option_b";
}

export function tradePackageToProfile(tradePackage: string) {
  const trade = tradePackage.trim().toLowerCase();
  if (trade === "drylining") return "drylining";
  if (trade === "passive fire") return "passive_fire";
  if (trade === "fit-out" || trade === "fit out") return "fit_out";
  return "general";
}

export function hasMeaningfulIssueText(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length >= 18 && /\s/.test(clean);
}

function isQualifyingProject(project: OnboardingProjectLike) {
  if (!project.id) return false;
  if (project.is_demo || project.demo || project.seeded) return false;
  const status = String(project.status ?? "live").toLowerCase();
  if (status === "deleted" || status === "archived") return false;
  return Boolean(String(project.project_name ?? "").trim());
}

function isQualifyingIssue(issue: OnboardingIssueLike) {
  if (!issue.id) return false;
  if (issue.is_demo || issue.demo || issue.seeded) return false;
  const status = String(issue.status ?? "draft").toLowerCase();
  if (status === "deleted" || status === "archived" || status === "void") return false;
  const title = String(issue.title ?? "").trim();
  return Boolean(title && (issue.first_issue_captured_at || issue.onboarding_captured_at || issue.created_at));
}

export function resolveOnboardingState({
  isInvitedUser = false,
  prefs,
  projects,
  issues,
  projectDraft,
  issueDraft,
}: {
  isInvitedUser?: boolean;
  prefs?: OnboardingPrefs | null;
  projects: OnboardingProjectLike[];
  issues: OnboardingIssueLike[];
  projectDraft?: OnboardingProjectDraft | null;
  issueDraft?: OnboardingIssueDraft | null;
}): OnboardingState {
  if (isInvitedUser) return "COMPLETE";
  if (prefs?.onboardingCompletedAt) return "COMPLETE";

  const hasLiveProject = projects.some(isQualifyingProject);
  const hasLiveIssue = issues.some(isQualifyingIssue);
  if (hasLiveProject && hasLiveIssue) return "COMPLETE";

  if (!hasLiveProject) {
    if (
      projectDraft &&
      [projectDraft.projectName, projectDraft.tradePackage, projectDraft.contractBasis, projectDraft.mainContractor, projectDraft.projectReference]
        .some((value) => value.trim())
    ) {
      return "PROJECT_SETUP_IN_PROGRESS";
    }
    return prefs?.welcomeDismissedAt ? "PROJECT_SETUP" : "WELCOME";
  }

  if (issueDraft && (issueDraft.title.trim() || hasMeaningfulIssueText(issueDraft.description))) return "FIRST_ISSUE_IN_PROGRESS";
  return "FIRST_ISSUE";
}
