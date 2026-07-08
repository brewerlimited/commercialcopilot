"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { buildEventStepPath, normalizeRouteParam } from "@/lib/routeParams";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getOwnedEventOrThrow, getRequiredUser, isAuthErrorMessage, isOwnershipErrorMessage } from "@/lib/security";
import CEProgress from "@/components/CEProgress";
import { downloadCeWorkbook } from "@/lib/exportWorkbook";
import { COMPANY_PROFILE_SELECT, cleanCompanyProfile, type CompanyProfile } from "@/lib/companyProfile";
import { getContractFamily, getContractLabel, getCostLabel, getFeeBasisLabel } from "@/lib/contracts";
import { displayEventReference } from "@/lib/eventReference";
import { getDraftTemplateForContractType } from "@/lib/draftTemplates";
import { recalculateEventFinancialSummary } from "@/lib/financialSummary";
import { getCommercialStatusLabel, normaliseCommercialStatus } from "@/lib/commercialControl";
import { isSubscriptionActive, type BillingStatus } from "@/lib/billing";

type Unit = "day" | "week";

type Basis = {
  happened_summary: string;
  cause_type: string | null;
  cause_summary: string;
  difference_from_plan: string;
  mechanism_tags: string[];
  time_impact_toggle: string;
  mitigation_summary: string;
};

type ValuationSettings = {
  fee_percent: number;
  fee_basis: "defined_cost" | "defined_cost_plus_prelims";
  work_days_per_week: number;
};

type ReviewSettings = {
  include_basis: boolean;
  include_entitlement: boolean;
  include_time_impact: boolean;
  include_evidence_register: boolean;
  include_cost_summary: boolean;
  include_prelims_fee: boolean;
  include_risk_notes: boolean;
  include_commercial_pushback: boolean;
  include_excel: boolean;
  include_pdf: boolean;
  qualifications_notes: string;
};

type CheckStatus = "pass" | "warning" | "missing";
type CheckGroup = "Contract readiness" | "Basis readiness" | "Evidence readiness" | "Cost readiness";

type CheckItem = {
  group: CheckGroup;
  label: string;
  status: CheckStatus;
  detail?: string;
  blocker?: boolean;
};

type RebuttalDraft = {
  rebuttal_subject: string;
  rebuttal_body: string;
  key_points: string[];
  risk_note: string;
  updated_at?: string | null;
};

type GenerationMode = "standard" | "multistage";

const c = {
  bg: "var(--background)",
  card: "var(--surface)",
  input: "var(--surface-input)",
  border: "var(--border)",
  sub: "var(--text-muted)",
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
  soft: "var(--surface-soft)",
  redBg: "var(--red-bg)",
  redBorder: "var(--red-border)",
  redText: "var(--red-text)",
  greenBg: "var(--green-bg)",
  greenBorder: "var(--green-border)",
  greenText: "var(--green-text)",
  amberBg: "var(--amber-bg)",
  amberBorder: "var(--amber-border)",
  amberText: "var(--amber-text)",
  blueBg: "var(--blue-bg)",
  blueBorder: "var(--blue-border)",
  blueText: "var(--blue-text)",
  lightGrey: "var(--surface-soft)",
};

const defaultBasis: Basis = {
  happened_summary: "",
  cause_type: null,
  cause_summary: "",
  difference_from_plan: "",
  mechanism_tags: [],
  time_impact_toggle: "unsure",
  mitigation_summary: "",
};

const defaultReviewSettings: ReviewSettings = {
  include_basis: true,
  include_entitlement: true,
  include_time_impact: true,
  include_evidence_register: true,
  include_cost_summary: true,
  include_prelims_fee: true,
  include_risk_notes: true,
  include_commercial_pushback: true,
  include_excel: true,
  include_pdf: false,
  qualifications_notes: "",
};


function splitSentencesForPushback(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function extractGeneratedCommercialPushback(aiDraft: any): Array<{ heading: string; note: string }> {
  const direct = aiDraft?.internal_commercial_intelligence?.commercial_pushback || aiDraft?.commercial_pushback;
  if (Array.isArray(direct)) {
    return direct
      .map((item: any, index: number) => ({
        heading: String(item?.likely_challenge || item?.challenge || item?.heading || `Generated challenge ${index + 1}`).trim(),
        note: String(item?.defence_position || item?.defence_note || item?.note || item?.response || "").trim(),
      }))
      .filter((item) => item.heading || item.note)
      .slice(0, 4);
  }

  const source = aiDraft?.assumptions || aiDraft?.internal_commercial_intelligence?.strength_summary || "";
  const parts = splitSentencesForPushback(source);
  if (parts.length === 0) return [];
  return parts.map((note, index) => ({
    heading: index === 0 ? "Generated commercial pushback" : `Additional challenge ${index + 1}`,
    note,
  }));
}

function isMissingRebuttalTable(error: any) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("event_rebuttals") || msg.includes("schema cache") || msg.includes("does not exist");
}

function formatRebuttalDate(value?: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function clampNum(v: any, fallback: number) {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function getForceGenerateMode() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("cc_force_generate_mode") === "1";
  } catch {
    return false;
  }
}

function money(n: number) {
  if (!Number.isFinite(n)) return "£0.00";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
}


function companyProfileFromDraftPayload(draftPayload: any): CompanyProfile | null {
  const source = draftPayload?.company_profile || draftPayload?.companyProfile;
  if (!source || typeof source !== "object") return null;
  return cleanCompanyProfile({
    company_name: source.company_name || source.companyName || "",
    trading_name: source.trading_name || source.tradingName || "",
    role: source.role || "Subcontractor",
    logo_url: source.logo_url || source.logoUrl || "",
    logo_path: source.logo_path || source.logoPath || "",
    address: source.address || "",
    email: source.email || "",
    phone: source.phone || "",
    vat_number: source.vat_number || source.vatNumber || "",
    company_registration_number: source.company_registration_number || source.companyRegistrationNumber || "",
  });
}

function mergeCompanyProfileForWorkbook(payload: any, draftPayload: any) {
  const fromDraft = companyProfileFromDraftPayload(draftPayload);
  const current = cleanCompanyProfile(payload?.companyProfile || null);
  const hasCurrentIdentity = Boolean(current.company_name || current.trading_name || current.address || current.email || current.phone || current.logo_url);
  const hasDraftIdentity = Boolean(fromDraft && (fromDraft.company_name || fromDraft.trading_name || fromDraft.address || fromDraft.email || fromDraft.phone || fromDraft.logo_url));

  if (!hasCurrentIdentity && hasDraftIdentity) {
    return { ...payload, companyProfile: fromDraft };
  }

  // Preserve the latest profile fetch, but fill any missing fields from the saved AI payload.
  if (fromDraft) {
    return {
      ...payload,
      companyProfile: cleanCompanyProfile({
        ...fromDraft,
        ...current,
        company_name: current.company_name || fromDraft.company_name || "",
        trading_name: current.trading_name || fromDraft.trading_name || "",
        role: current.role || fromDraft.role || "Subcontractor",
        logo_url: current.logo_url || fromDraft.logo_url || "",
        logo_path: current.logo_path || fromDraft.logo_path || "",
        address: current.address || fromDraft.address || "",
        email: current.email || fromDraft.email || "",
        phone: current.phone || fromDraft.phone || "",
        vat_number: current.vat_number || fromDraft.vat_number || "",
        company_registration_number: current.company_registration_number || fromDraft.company_registration_number || "",
      }),
    };
  }

  return { ...payload, companyProfile: current };
}
function calcPrelimsDaily(
  lines: Array<{ qty: number; unit: "day" | "week"; rate: number }>,
  workDaysPerWeek: number
) {
  const wd = Math.max(1, Math.min(7, workDaysPerWeek || 5));
  return lines.reduce((sum, l) => {
    const qty = l.qty || 0;
    const rate = l.rate || 0;
    const daily = l.unit === "week" ? rate / wd : rate;
    return sum + qty * daily;
  }, 0);
}

function SmallBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${c.border}`,
        background: c.input,
        color: c.black,
        fontWeight: 700,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.6 : 1,
        ...(props.style ?? {}),
      }}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        padding: 12,
        borderRadius: 14,
        border: `1px solid ${c.border}`,
        outline: "none",
        background: c.input,
        color: c.black,
        fontSize: 14,
        lineHeight: 1.55,
        resize: "vertical",
        ...(props.style ?? {}),
      }}
    />
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: 18,
        padding: 20,
      }}
    >
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          margin: 0,
          color: c.black,
        }}
      >
        {title}
      </h2>

      {hint ? (
        <p
          style={{
            marginTop: 8,
            marginBottom: 0,
            fontSize: 13,
            lineHeight: 1.55,
            color: c.sub,
          }}
        >
          {hint}
        </p>
      ) : null}

      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  );
}

function SidebarCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: 18,
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: c.black,
          marginBottom: 12,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: c.sub,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div
        style={{
          color: strong ? c.black : c.sub,
          fontWeight: strong ? 700 : 500,
          fontSize: 13,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: c.black,
          fontWeight: strong ? 800 : 700,
          fontSize: 13,
          textAlign: "right",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function statusPill(status: CheckStatus) {
  if (status === "pass") {
    return {
      bg: c.greenBg,
      bd: c.greenBorder,
      tx: c.greenText,
      label: "Pass",
    };
  }
  if (status === "warning") {
    return {
      bg: c.amberBg,
      bd: c.amberBorder,
      tx: c.amberText,
      label: "Warning",
    };
  }
  return {
    bg: c.redBg,
    bd: c.redBorder,
    tx: c.redText,
    label: "Missing",
  };
}

function ReviewPageContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = normalizeRouteParam(params?.id);
  const initialMode = searchParams?.get("mode");

  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("Loading…");
  const [eventReference, setEventReference] = useState("Reference pending");
  const [contractType, setContractType] = useState<string | null>(null);
  const [contractSource, setContractSource] = useState<string | null>(null);
  const [delayDays, setDelayDays] = useState(0);
  const [commercialStatus, setCommercialStatus] = useState("draft");
  const [paymentStatus, setPaymentStatus] = useState("not_applied");
  const [statusSaving, setStatusSaving] = useState(false);

  const [basis, setBasis] = useState<Basis>(defaultBasis);

  const [instructionCount, setInstructionCount] = useState(0);
  const [photosCount, setPhotosCount] = useState(0);
  const [siteRecordsCount, setSiteRecordsCount] = useState(0);
  const [programmeCount, setProgrammeCount] = useState(0);
  const [costSupportCount, setCostSupportCount] = useState(0);

  const [resourceCount, setResourceCount] = useState(0);
  const [labourTotal, setLabourTotal] = useState(0);
  const [plantTotal, setPlantTotal] = useState(0);
  const [materialTotal, setMaterialTotal] = useState(0);
  const [definedCost, setDefinedCost] = useState(0);

  const [prelimLineCount, setPrelimLineCount] = useState(0);
  const [prelimLines, setPrelimLines] = useState<Array<{ qty: number; unit: Unit; rate: number }>>([]);

  const [valuation, setValuation] = useState<ValuationSettings>({
    fee_percent: 12.5,
    fee_basis: "defined_cost",
    work_days_per_week: 5,
  });

  const [contractUploadCount, setContractUploadCount] = useState(0);

  const [reviewSettings, setReviewSettings] = useState<ReviewSettings>(defaultReviewSettings);

  const [status, setStatus] = useState<"not_saved" | "saved" | "unsaved" | "saving" | "error">(
    "not_saved"
  );
  const [saveErr, setSaveErr] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setForceGenerateMode(getForceGenerateMode());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("cc:force-generate-changed", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("cc:force-generate-changed", sync as EventListener);
    };
  }, []);


  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState("Preparing generation…");
  const [generationEta, setGenerationEta] = useState("Estimating time…");
  const progressTimerRef = useRef<number | null>(null);
  const [hasGeneratedPack, setHasGeneratedPack] = useState(false);
  const [forceGenerateMode, setForceGenerateMode] = useState(false);
  const generationMode: GenerationMode = "multistage";
  const [billingGateLoaded, setBillingGateLoaded] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [isAdminUnlimited, setIsAdminUnlimited] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<BillingStatus>("inactive");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showReadinessDetails, setShowReadinessDetails] = useState(false);
  const [generatedCommercialPushback, setGeneratedCommercialPushback] = useState<Array<{ heading: string; note: string }>>([]);
  const [contractorResponse, setContractorResponse] = useState("");
  const [generatedRebuttal, setGeneratedRebuttal] = useState<RebuttalDraft | null>(null);
  const [isGeneratingRebuttal, setIsGeneratingRebuttal] = useState(false);
  const [rebuttalErr, setRebuttalErr] = useState<string | null>(null);
  const [rebuttalTableMissing, setRebuttalTableMissing] = useState(false);
  const [showRebuttalPanel, setShowRebuttalPanel] = useState(initialMode === "rebuttal");


  useEffect(() => {
    if (initialMode === "rebuttal" || commercialStatus === "rejected") {
      setShowRebuttalPanel(true);
    }
  }, [initialMode, commercialStatus]);

  const lastSavedSnapshotRef = useRef<string>("");
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");
  const savingRef = useRef(false);

  function clearGenerationProgressTimer() {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  function formatGenerationEta(seconds: number) {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    if (mins <= 0) return `${secs}s remaining`;
    return `${mins}m ${String(secs).padStart(2, "0")}s remaining`;
  }

  function startGenerationProgress() {
    clearGenerationProgressTimer();

    const startedAt = Date.now();
    const targetMs = 120000;

    setGenerationProgress(3);
    setGenerationStage("Step 1 of 5: Extracting commercial context…");
    setGenerationEta(formatGenerationEta(targetMs / 1000));

    progressTimerRef.current = window.setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const rawProgress = Math.min(91, 3 + (elapsedMs / targetMs) * 88);

      if (elapsedMs < 20000) {
        setGenerationStage("Step 1 of 5: Extracting commercial context…");
      } else if (elapsedMs < 45000) {
        setGenerationStage("Step 2 of 5: Running Standard-for-Multi baseline for Excel tabs…");
      } else if (elapsedMs < 95000) {
        setGenerationStage("Step 3 of 5: Generating all enhanced commercial sections together…");
      } else if (elapsedMs < 112000) {
        setGenerationStage("Step 4 of 5: Running commercial director QA review…");
      } else {
        setGenerationStage("Step 5 of 5: Finalising workbook download…");
      }

      setGenerationEta(formatGenerationEta((targetMs - elapsedMs) / 1000));
      setGenerationProgress(rawProgress);
    }, 1000);
  }

  async function finishGenerationProgress() {
    clearGenerationProgressTimer();
    setGenerationStage("Finalising download…");
    setGenerationEta("Almost done…");
    setGenerationProgress(100);
    await new Promise((resolve) => window.setTimeout(resolve, 450));
  }

  useEffect(() => {
    return () => clearGenerationProgressTimer();
  }, []);

  const prelimsDaily = useMemo(
    () => calcPrelimsDaily(prelimLines, valuation.work_days_per_week || 5),
    [prelimLines, valuation.work_days_per_week]
  );

  const prelimsTotal = useMemo(() => prelimsDaily * (delayDays || 0), [prelimsDaily, delayDays]);

  const feeBase = useMemo(() => {
    return valuation.fee_basis === "defined_cost_plus_prelims"
      ? definedCost + prelimsTotal
      : definedCost;
  }, [definedCost, prelimsTotal, valuation.fee_basis]);

  const feeAmount = useMemo(
    () => feeBase * ((valuation.fee_percent || 0) / 100),
    [feeBase, valuation.fee_percent]
  );

  const ceTotal = useMemo(
    () => definedCost + prelimsTotal + feeAmount,
    [definedCost, prelimsTotal, feeAmount]
  );

  const contractFamily = useMemo(() => getContractFamily(contractType), [contractType]);
  const contractLabel = useMemo(() => getContractLabel(contractType), [contractType]);
  const costLabel = useMemo(() => getCostLabel(contractType), [contractType]);
  const feeBasisLabel = useMemo(() => getFeeBasisLabel(contractType, valuation.fee_basis), [contractType, valuation.fee_basis]);
  const draftTemplate = useMemo(() => getDraftTemplateForContractType(contractType), [contractType]);
  const checks = useMemo<CheckItem[]>(() => {
    const list: CheckItem[] = [];

    list.push({
      group: "Contract readiness",
      label: "Contract type selected",
      status: contractType ? "pass" : "missing",
      blocker: !contractType,
    });

    list.push({
      group: "Contract readiness",
      label: "Contract source selected",
      status: contractSource ? "pass" : "missing",
      blocker: !contractSource,
    });

    if (contractSource === "upload_contract") {
      list.push({
        group: "Contract readiness",
        label: "Uploaded contract present",
        status: contractUploadCount > 0 ? "pass" : "missing",
        detail: contractUploadCount > 0 ? `${contractUploadCount} file(s)` : "No contract files found",
        blocker: contractUploadCount === 0,
      });
    } else {
      list.push({
        group: "Contract readiness",
        label: "Uploaded contract present",
        status: "warning",
        detail: "Using standard contract logic",
      });
    }

    list.push({
      group: "Basis readiness",
      label: "What happened completed",
      status: basis.happened_summary.trim() ? "pass" : "missing",
      blocker: !basis.happened_summary.trim(),
    });

    list.push({
      group: "Basis readiness",
      label: "Cause completed",
      status: basis.cause_type && basis.cause_summary.trim() ? "pass" : "missing",
      blocker: !(basis.cause_type && basis.cause_summary.trim()),
    });

    list.push({
      group: "Basis readiness",
      label: "Difference from plan completed",
      status: basis.difference_from_plan.trim() ? "pass" : "missing",
      blocker: !basis.difference_from_plan.trim(),
    });

    list.push({
      group: "Basis readiness",
      label: "Mechanism selected",
      status: basis.mechanism_tags.length > 0 ? "pass" : "missing",
      blocker: basis.mechanism_tags.length === 0,
    });

    list.push({
      group: "Basis readiness",
      label: "Time impact assessed",
      status: basis.time_impact_toggle && basis.time_impact_toggle !== "unsure" ? "pass" : "warning",
      detail:
        basis.time_impact_toggle === "yes"
          ? "Programme impact marked yes"
          : basis.time_impact_toggle === "no"
          ? "Programme impact marked no"
          : "Still marked unsure",
    });

    list.push({
      group: "Basis readiness",
      label: "Mitigation completed",
      status: basis.mitigation_summary.trim() ? "pass" : "warning",
      detail: basis.mitigation_summary.trim()
        ? "Mitigation recorded"
        : "No mitigation or limitation note entered",
    });

    list.push({
      group: "Evidence readiness",
      label: "Instruction / communication evidence",
      status: instructionCount > 0 ? "pass" : "warning",
      detail: `${instructionCount} file(s)`,
    });

    list.push({
      group: "Evidence readiness",
      label: "Photos",
      status: photosCount > 0 ? "pass" : "warning",
      detail: `${photosCount} file(s)`,
    });

    list.push({
      group: "Evidence readiness",
      label: "Site records",
      status: siteRecordsCount > 0 ? "pass" : "warning",
      detail: `${siteRecordsCount} file(s)`,
    });

    list.push({
      group: "Evidence readiness",
      label: "Programme support",
      status: programmeCount > 0 ? "pass" : "warning",
      detail:
        programmeCount > 0
          ? `${programmeCount} file(s)`
          : delayDays > 0
          ? "Delay days entered but no programme evidence uploaded"
          : "No programme files uploaded",
    });

    list.push({
      group: "Evidence readiness",
      label: "Cost support",
      status: costSupportCount > 0 ? "pass" : "warning",
      detail: `${costSupportCount} file(s)`,
    });

    list.push({
      group: "Cost readiness",
      label: "Resource lines added",
      status: resourceCount > 0 ? "pass" : "missing",
      detail: `${resourceCount} line(s)`,
      blocker: resourceCount === 0,
    });

    list.push({
      group: "Cost readiness",
      label: "Delay days set",
      status:
        basis.time_impact_toggle === "yes" && delayDays <= 0
          ? "missing"
          : delayDays > 0
          ? "pass"
          : "warning",
      detail: `${delayDays} day(s)`,
      blocker: basis.time_impact_toggle === "yes" && delayDays <= 0,
    });

    list.push({
      group: "Cost readiness",
      label: "Fee settings completed",
      status: valuation.fee_percent >= 0 ? "pass" : "missing",
      detail: `${valuation.fee_percent}%`,
    });

    list.push({
      group: "Cost readiness",
      label: "Prelim lines reviewed",
      status: prelimLineCount > 0 ? "pass" : "warning",
      detail: `${prelimLineCount} line(s)`,
    });

    return list;
  }, [
    basis,
    contractType,
    contractSource,
    contractUploadCount,
    instructionCount,
    photosCount,
    siteRecordsCount,
    programmeCount,
    costSupportCount,
    resourceCount,
    delayDays,
    valuation,
    prelimLineCount,
  ]);

  const blockers = useMemo(
    () => checks.filter((x) => x.status === "missing" && x.blocker).length,
    [checks]
  );

  const warnings = useMemo(
    () => checks.filter((x) => x.status === "warning").length,
    [checks]
  );

  const effectiveForceGenerateMode = isAdminUnlimited && forceGenerateMode;
  const packReady = hasGeneratedPack && !effectiveForceGenerateMode;
  const billingGatePending = !billingGateLoaded && !packReady;
  const subscriptionLocked = billingGateLoaded && !isAdminUnlimited && !isSubscriptionActive(subscriptionStatus) && !packReady;
  const generationCreditLocked = billingGateLoaded && !isAdminUnlimited && creditsRemaining <= 0 && !packReady;
  const generateDisabled = !packReady && (blockers > 0 || isGenerating || billingGatePending || subscriptionLocked || generationCreditLocked);
  const generateButtonLabel = effectiveForceGenerateMode ? "Produce recovery pack" : isGenerating
    ? "Generating…"
    : billingGatePending
    ? "Checking billing…"
    : subscriptionLocked
    ? "Subscription required"
    : generationCreditLocked
    ? "No credits remaining"
    : packReady
    ? "Download pack"
    : "Produce recovery pack";

  const readiness = useMemo(() => {
    const total = checks.length || 1;
    const score = checks.reduce((acc, item) => {
      if (item.status === "pass") return acc + 1;
      if (item.status === "warning") return acc + 0.5;
      return acc;
    }, 0);
    return Math.round((score / total) * 100);
  }, [checks]);

  const groupedChecks = useMemo(() => {
    return {
      contract: checks.filter((x) => x.group === "Contract readiness"),
      basis: checks.filter((x) => x.group === "Basis readiness"),
      evidence: checks.filter((x) => x.group === "Evidence readiness"),
      cost: checks.filter((x) => x.group === "Cost readiness"),
    };
  }, [checks]);

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        reviewSettings,
      }),
    [reviewSettings]
  );

  const isDirty = useMemo(() => {
    if (!loaded) return false;
    return currentSnapshot !== lastSavedSnapshot;
  }, [currentSnapshot, loaded]);

  useEffect(() => {
    if (!loaded || !eventId || !isUuid(eventId)) return;
    try {
      const stored = window.localStorage.getItem(`ccp-review-pushback-${eventId}`);
      if (stored === null) return;
      const parsed = stored === "true";
      setReviewSettings((prev) => ({ ...prev, include_commercial_pushback: parsed }));
    } catch {}
  }, [loaded, eventId]);

  useEffect(() => {
    if (!loaded || !eventId || !isUuid(eventId)) return;
    try {
      window.localStorage.setItem(
        `ccp-review-pushback-${eventId}`,
        String(reviewSettings.include_commercial_pushback)
      );
    } catch {}
  }, [loaded, eventId, reviewSettings.include_commercial_pushback]);

  const evidenceCount = useMemo(
    () => instructionCount + photosCount + siteRecordsCount + programmeCount + costSupportCount,
    [instructionCount, photosCount, siteRecordsCount, programmeCount, costSupportCount]
  );

  const pushbackItems = useMemo(() => {
    const items: Array<{ heading: string; note: string }> = [];

    if (programmeCount === 0 && delayDays > 0) {
      items.push({
        heading: "Time impact evidence",
        note: "Expect pushback if delay days are included without programme support showing the path from event to time effect.",
      });
    }

    if (photosCount === 0 && instructionCount === 0 && siteRecordsCount === 0) {
      items.push({
        heading: "Event substantiation",
        note: "The event narrative may be challenged if there is little visible instruction, site or photographic evidence behind the change.",
      });
    }

    if (basis.mechanism_tags.length === 0) {
      items.push({
        heading: "Commercial mechanism",
        note: "Without a clear mechanism of impact, the submission risks reading as a cost statement rather than a cause-and-effect entitlement case.",
      });
    }

    if (resourceCount === 0) {
      items.push({
        heading: "Cost build-up",
        note: "Any total without supporting resource lines is likely to attract immediate challenge on valuation basis.",
      });
    }

    if (prelimLineCount === 0 && delayDays > 0) {
      items.push({
        heading: "Prelim prolongation",
        note: "Where time impact is included, expect questions on why prolonged prelims are or are not part of the valuation.",
      });
    }

    if (!reviewSettings.qualifications_notes.trim()) {
      items.push({
        heading: "Reservations / assumptions",
        note: "If anything remains provisional, add a qualification note now to reduce avoidable back-and-forth after issue.",
      });
    }

    return items.slice(0, 4);
  }, [
    programmeCount,
    delayDays,
    photosCount,
    instructionCount,
    siteRecordsCount,
    basis.mechanism_tags,
    resourceCount,
    prelimLineCount,
    reviewSettings.qualifications_notes,
  ]);

  const badge = useMemo(() => {
    if (status === "error") {
      return { bg: c.redBg, bd: c.redBorder, tx: c.redText, label: "Save failed" };
    }
    if (status === "saving") {
      return { bg: c.amberBg, bd: c.amberBorder, tx: c.amberText, label: "Saving…" };
    }
    if (status === "unsaved") {
      return { bg: c.amberBg, bd: c.amberBorder, tx: c.amberText, label: "Unsaved" };
    }
    if (status === "saved") {
      return { bg: c.greenBg, bd: c.greenBorder, tx: c.greenText, label: "Saved" };
    }
    return { bg: c.input, bd: c.border, tx: c.sub, label: "Not saved" };
  }, [status]);

  useEffect(() => {
    if (!loaded) return;
    if (status === "saving" || status === "error") return;
    setStatus(isDirty ? "unsaved" : lastSavedAt ? "saved" : "not_saved");
  }, [isDirty, loaded, lastSavedAt]);

  useEffect(() => {
    (async () => {
      setSaveErr(null);
      if (!eventId || !isUuid(eventId)) return;

      const supabase = supabaseBrowser();

      try {
        const user = await getRequiredUser(supabase);
        let eventData: any;
        try {
          eventData = await getOwnedEventOrThrow(
            supabase,
            eventId,
            user.id,
            "id,title,status,payment_status,delay_days,contract_type,contract_source,event_number,event_reference,user_id"
          );
        } catch (eventLoadError: any) {
          const message = String(eventLoadError?.message || "");
          const optionalColumnMissing = /payment_status/i.test(message);
          if (!optionalColumnMissing) throw eventLoadError;
          eventData = await getOwnedEventOrThrow(
            supabase,
            eventId,
            user.id,
            "id,title,status,delay_days,contract_type,contract_source,event_number,event_reference,user_id"
          );
        }

        setTitle(eventData.title ?? "");
        setEventReference(displayEventReference(eventData));
        setDelayDays(clampNum(eventData.delay_days, 0));
        setCommercialStatus(normaliseCommercialStatus(eventData.status));
        setPaymentStatus(eventData.payment_status ?? "not_applied");
        setContractType(eventData.contract_type ?? null);
        setContractSource(eventData.contract_source ?? null);

        const basisRes = await (supabase as any).from("event_basis")
          .select(
            "happened_summary,cause_type,cause_summary,difference_from_plan,mechanism_tags,time_impact_toggle,mitigation_summary"
          )
          .eq("event_id", eventId)
          .maybeSingle();

        if (basisRes.data) {
          setBasis({
            happened_summary: (basisRes.data as any)?.happened_summary ?? "",
            cause_type: (basisRes.data as any)?.cause_type ?? null,
            cause_summary: (basisRes.data as any)?.cause_summary ?? "",
            difference_from_plan: (basisRes.data as any)?.difference_from_plan ?? "",
            mechanism_tags: Array.isArray((basisRes.data as any)?.mechanism_tags)
              ? (basisRes.data as any)?.mechanism_tags
              : [],
            time_impact_toggle: (basisRes.data as any)?.time_impact_toggle ?? "unsure",
            mitigation_summary: (basisRes.data as any)?.mitigation_summary ?? "",
          });
        }

        const filesRes = await (supabase as any).from("event_files")
          .select("category")
          .eq("event_id", eventId);

        const fileRows = (filesRes.data ?? []) as Array<{ category: string }>;
        setInstructionCount(fileRows.filter((x) => x.category === "instructions").length);
        setPhotosCount(fileRows.filter((x) => x.category === "photos").length);
        setSiteRecordsCount(fileRows.filter((x) => x.category === "site_records").length);
        setProgrammeCount(fileRows.filter((x) => x.category === "programme").length);
        setCostSupportCount(fileRows.filter((x) => x.category === "cost_support").length);

        const resourceRes = await (supabase as any).from("event_resource_lines")
          .select("category,total")
          .eq("event_id", eventId);

        const resourceRows = (resourceRes.data ?? []) as Array<{ category: string; total: number }>;
        setResourceCount(resourceRows.length);

        const labour = resourceRows
          .filter((x) => x.category === "labour")
          .reduce((sum, x) => sum + clampNum(x.total, 0), 0);
        const plant = resourceRows
          .filter((x) => x.category === "plant")
          .reduce((sum, x) => sum + clampNum(x.total, 0), 0);
        const material = resourceRows
          .filter((x) => x.category === "material")
          .reduce((sum, x) => sum + clampNum(x.total, 0), 0);

        setLabourTotal(labour);
        setPlantTotal(plant);
        setMaterialTotal(material);
        setDefinedCost(labour + plant + material);

        const valuationRes = await (supabase as any).from("event_valuation_settings")
          .select("fee_percent,fee_basis,work_days_per_week")
          .eq("event_id", eventId)
          .maybeSingle();

        setValuation({
          fee_percent: clampNum((valuationRes.data as any)?.fee_percent, 12.5),
          fee_basis:
            ((valuationRes.data as any)?.fee_basis as "defined_cost" | "defined_cost_plus_prelims") ||
            "defined_cost",
          work_days_per_week: clampNum((valuationRes.data as any)?.work_days_per_week, 5),
        });

        const prelimRes = await (supabase as any).from("event_prelim_lines")
          .select("qty,unit,rate,prelim_type")
          .eq("event_id", eventId);

        const prelimRows =
          ((prelimRes.data ?? []) as Array<{ qty: number; unit: Unit; rate: number }>) || [];
        setPrelimLineCount(prelimRows.length);
        setPrelimLines(prelimRows);

        if (eventData.contract_source === "upload_contract") {
          const contractFilesRes = await (supabase as any).from("event_contract_files")
            .select("id")
            .eq("event_id", eventId);
          setContractUploadCount((contractFilesRes.data ?? []).length);
        } else {
          setContractUploadCount(0);
        }

        const reviewRes = await (supabase as any).from("event_review_settings")
          .select(
            "include_basis,include_entitlement,include_time_impact,include_evidence_register,include_cost_summary,include_prelims_fee,include_risk_notes,include_commercial_pushback,include_excel,include_pdf,qualifications_notes"
          )
          .eq("event_id", eventId)
          .maybeSingle();

        const mergedReview: ReviewSettings = {
          ...defaultReviewSettings,
          ...(reviewRes.data ?? {}),
          qualifications_notes: (reviewRes.data as any)?.qualifications_notes ?? "",
        };

        setReviewSettings(mergedReview);

        const sessionRes = await supabase.auth.getSession();
        if (sessionRes.error) throw sessionRes.error;
        const accessToken = (sessionRes.data as any)?.session?.access_token;
        if (!accessToken) throw new Error("AUTH_REQUIRED");

        const creditGateRes = await fetch("/api/credits", {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const creditGateData = await creditGateRes.json().catch(() => ({}));
        if (!creditGateRes.ok) {
          throw new Error(creditGateData?.error || "Failed to load credits");
        }

        const loadedIsAdminUnlimited = Boolean(creditGateData?.isAdminUnlimited);
        setIsAdminUnlimited(loadedIsAdminUnlimited);
        setCreditsRemaining(clampNum(creditGateData?.creditsRemaining, 0));
        setSubscriptionStatus((creditGateData?.subscriptionStatus as BillingStatus) || "inactive");

        const existingPackId = await getExistingPackId(supabase, user.id);
        const existingPackAvailable = Boolean(existingPackId) && !(loadedIsAdminUnlimited && getForceGenerateMode());
        setHasGeneratedPack(existingPackAvailable);

        if (existingPackAvailable && existingPackId) {
          try {
            const latestDraftRes = await (supabase as any).from("event_ai_drafts")
              .select("draft_output")
              .eq("event_id", eventId)
              .eq("pack_id", existingPackId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!latestDraftRes.error && (latestDraftRes.data as any)?.draft_output) {
              setGeneratedCommercialPushback(extractGeneratedCommercialPushback((latestDraftRes.data as any).draft_output));
            }
          } catch (pushbackLoadError) {
            console.warn("Failed to load generated commercial pushback", pushbackLoadError);
          }
        }

        try {
          const rebuttalRes = await (supabase as any).from("event_rebuttals")
            .select("contractor_response,rebuttal_subject,rebuttal_body,key_points,risk_note,updated_at")
            .eq("event_id", eventId)
            .maybeSingle();

          if (rebuttalRes.error) throw rebuttalRes.error;
          if (rebuttalRes.data) {
            setContractorResponse(String((rebuttalRes.data as any).contractor_response || ""));
            setGeneratedRebuttal({
              rebuttal_subject: String((rebuttalRes.data as any).rebuttal_subject || ""),
              rebuttal_body: String((rebuttalRes.data as any).rebuttal_body || ""),
              key_points: Array.isArray((rebuttalRes.data as any).key_points) ? (rebuttalRes.data as any).key_points : [],
              risk_note: String((rebuttalRes.data as any).risk_note || ""),
              updated_at: (rebuttalRes.data as any).updated_at || null,
            });
          }
          setRebuttalTableMissing(false);
        } catch (rebuttalLoadError: any) {
          if (isMissingRebuttalTable(rebuttalLoadError)) {
            setRebuttalTableMissing(true);
          } else {
            console.warn("Failed to load rebuttal", rebuttalLoadError?.message || rebuttalLoadError);
          }
        }

                setBillingGateLoaded(true);

        const snapshot = JSON.stringify({
          reviewSettings: mergedReview,
        });
        lastSavedSnapshotRef.current = snapshot;
        setLastSavedSnapshot(snapshot);
        setLastSavedAt(Date.now());
        setStatus("saved");
        await recalculateEventFinancialSummary(supabase, eventId, user.id);
        setLoaded(true);
      } catch (e: any) {
        if (isAuthErrorMessage(e?.message)) {
          router.push("/login");
          return;
        }
        if (isOwnershipErrorMessage(e?.message)) {
          setTitle("Event not found");
          setLoaded(true);
          return;
        }
        console.error(e);
        setStatus("error");
        setSaveErr(e?.message ?? "Failed to load review");
        setLoaded(true);
      }
    })();
  }, [eventId, router]);

  useEffect(() => {
    if (!loaded) return;
    if (!isDirty) return;
    if (savingRef.current) return;

    const t = setTimeout(() => {
      void saveNow();
    }, 900);

    return () => clearTimeout(t);
  }, [isDirty, loaded, currentSnapshot]);

  async function saveNow() {
    if (!eventId || !isUuid(eventId)) return;
    if (savingRef.current) return;

    const snap = JSON.stringify({
      reviewSettings,
    });

    if (snap === lastSavedSnapshotRef.current) return;

    savingRef.current = true;
    setStatus("saving");
    setSaveErr(null);

    try {
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      await getOwnedEventOrThrow(supabase, eventId, user.id);

      const { include_commercial_pushback, ...reviewPayload } = reviewSettings;

      const { error } = await (supabase as any).from("event_review_settings").upsert(
        {
          event_id: eventId,
          ...reviewPayload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_id" }
      );

      if (error) throw error;

      lastSavedSnapshotRef.current = snap;
      setLastSavedSnapshot(snap);
      setLastSavedAt(Date.now());
      setStatus("saved");
    } catch (e: any) {
      console.error(e);
      setStatus("error");
      setSaveErr(e?.message ?? "Save failed");
    } finally {
      savingRef.current = false;
    }
  }

  async function getExistingPackId(supabase: ReturnType<typeof supabaseBrowser>, userId: string) {
    const res = await (supabase as any).from("event_packs")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (res.error) throw res.error;
    const packId = (res.data as any)?.id ?? null;
    if (!packId) return null;

    // A pack is only genuinely downloadable if the AI draft/payload row exists.
    // Historic demo seed/test rows can create event_packs without usable output;
    // those must not flip the Review CTA to Download Pack.
    const draftRes = await (supabase as any).from("event_ai_drafts")
      .select("id,draft_payload,draft_output")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .eq("pack_id", packId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (draftRes.error) {
      console.warn("Existing pack draft check failed:", draftRes.error.message);
      return null;
    }

    const draft = draftRes.data as any;
    if (!draft?.draft_payload || !draft?.draft_output) return null;
    return packId;
  }

  async function buildWorkbookPayload(supabase: ReturnType<typeof supabaseBrowser>, userId: string) {
    let eventData: any;
    try {
      eventData = await getOwnedEventOrThrow(
        supabase,
        eventId,
        userId,
        "id,title,status,payment_status,delay_days,contract_type,contract_source,event_number,event_reference,user_id"
      );
    } catch (eventLoadError: any) {
      const message = String(eventLoadError?.message || "");
      const optionalColumnMissing = /payment_status/i.test(message);
      if (!optionalColumnMissing) throw eventLoadError;
      eventData = await getOwnedEventOrThrow(
        supabase,
        eventId,
        userId,
        "id,title,status,delay_days,contract_type,contract_source,event_number,event_reference,user_id"
      );
    }

    const eventRes = { data: eventData } as any;

    const [basisRes, resourceRes, prelimRes, filesRes, valuationRes, companyProfileRes] = await Promise.all([
      (supabase as any).from("event_basis")
        .select("happened_summary,cause_type,cause_summary,difference_from_plan,mechanism_tags,time_impact_toggle,mitigation_summary")
        .eq("event_id", eventId)
        .maybeSingle(),
      (supabase as any).from("event_resource_lines")
        .select("category,item_name,unit,hours,qty,rate,total,notes,start_date,end_date,linked_event")
        .eq("event_id", eventId)
        .order("start_date", { ascending: true }),
      (supabase as any).from("event_prelim_lines")
        .select("name,qty,unit,rate,notes,prelim_type")
        .eq("event_id", eventId),
      (supabase as any).from("event_files")
        .select("id,category,file_name,description,relates_to,evidence_date,file_path")
        .eq("event_id", eventId),
      (supabase as any).from("event_valuation_settings")
        .select("fee_percent,fee_basis,work_days_per_week")
        .eq("event_id", eventId)
        .maybeSingle(),
      (supabase as any).from("company_profiles")
        .select(COMPANY_PROFILE_SELECT)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (basisRes.error) throw basisRes.error;
    if (resourceRes.error) throw resourceRes.error;
    if (prelimRes.error) throw prelimRes.error;
    if (filesRes.error) throw filesRes.error;
    if (valuationRes.error) throw valuationRes.error;
    if (companyProfileRes.error) console.warn("Company profile unavailable for workbook export:", companyProfileRes.error);

    const fileRows = (filesRes.data ?? []) as Array<{
      id: string;
      category: string;
      file_name: string | null;
      description: string | null;
      relates_to: string | null;
      evidence_date: string | null;
      file_path: string | null;
    }>;
    const counts = {
      instructions: fileRows.filter((x) => x.category === "instructions").length,
      photos: fileRows.filter((x) => x.category === "photos").length,
      site_records: fileRows.filter((x) => x.category === "site_records").length,
      programme: fileRows.filter((x) => x.category === "programme").length,
      cost_support: fileRows.filter((x) => x.category === "cost_support").length,
    };

    const origin = (process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : ""))?.replace(/\/$/, "") || "";
    const evidence = await Promise.all(
      fileRows.map(async (file) => {
        let downloadUrl: string | null = null;

        if (file.id && origin) {
          const existing = await (supabase as any).from("event_file_share_links")
            .select("token")
            .eq("event_file_id", file.id)
            .eq("is_active", true)
            .maybeSingle();

          let token = (existing.data as any)?.token ?? null;
          if (!token) {
            token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
            const inserted = await (supabase as any).from("event_file_share_links").insert({
              event_id: eventId,
              event_file_id: file.id,
              token,
              issued_file_name: file.file_name ?? "evidence-file",
              is_active: true,
            });

            if (inserted.error && !String(inserted.error.message || "").toLowerCase().includes("duplicate")) {
              throw inserted.error;
            }

            if (inserted.error) {
              const retry = await (supabase as any).from("event_file_share_links")
                .select("token")
                .eq("event_file_id", file.id)
                .eq("is_active", true)
                .maybeSingle();
              token = (retry.data as any)?.token ?? null;
            }
          }

          if (token) {
            downloadUrl = `${origin}/api/evidence-download/${token}`;
          }
        }

        return {
          file_name: file.file_name ?? "Untitled file",
          category: file.category,
          description: file.description,
          relates_to: file.relates_to,
          evidence_date: file.evidence_date,
          signed_url: downloadUrl,
        };
      })
    );

    return {
      payload: {
        companyProfile: cleanCompanyProfile(companyProfileRes.data || null),
        meta: {
          title: (eventRes.data as any)?.title ?? title,
          contractType: (eventRes.data as any)?.contract_type ?? contractType,
          contractSource: (eventRes.data as any)?.contract_source ?? contractSource,
          delayDays: clampNum((eventRes.data as any)?.delay_days, delayDays),
          generatedAt: new Date().toISOString(),
          ceRef: displayEventReference(eventRes.data),
        },
        basis: basisRes.data ?? basis,
        resources: (resourceRes.data ?? []) as any,
        prelims: (prelimRes.data ?? []) as any,
        valuation: {
          fee_percent: clampNum((valuationRes.data as any)?.fee_percent, valuation.fee_percent),
          fee_basis: ((valuationRes.data as any)?.fee_basis as any) || valuation.fee_basis,
          work_days_per_week: clampNum((valuationRes.data as any)?.work_days_per_week, valuation.work_days_per_week),
        },
        review: reviewSettings,
        fileCounts: counts,
        evidence,
        readiness,
        warnings,
        blockers,
      },
    };
  }

  function updateReview<K extends keyof ReviewSettings>(key: K, value: ReviewSettings[K]) {
    setReviewSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleGenerateRebuttal() {
    if (!eventId || !isUuid(eventId)) return;
    if (!hasGeneratedPack) {
      setRebuttalErr("Want the proper rebuttal? Make sure the pack has been generated first.");
      return;
    }
    const cleanResponse = contractorResponse.trim();
    if (cleanResponse.length < 20) {
      setRebuttalErr("Paste the contractor rejection or assessment response before generating a rebuttal.");
      return;
    }

    setIsGeneratingRebuttal(true);
    setRebuttalErr(null);

    try {
      const supabase = supabaseBrowser();
      const sessionRes = await supabase.auth.getSession();
      if (sessionRes.error) throw sessionRes.error;
      const accessToken = (sessionRes.data as any)?.session?.access_token;
      if (!accessToken) throw new Error("AUTH_REQUIRED");

      const res = await fetch("/api/generate-rebuttal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          eventId,
          event_id: eventId,
          contractorResponse: cleanResponse,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate rebuttal");
      }

      setGeneratedRebuttal(data.rebuttal || null);
      setRebuttalTableMissing(false);
    } catch (e: any) {
      console.error(e);
      const message = e?.message || "Failed to generate rebuttal";
      setRebuttalErr(message.includes("event_rebuttals") ? "Run the rebuttal SQL patch before generating rebuttals." : message);
    } finally {
      setIsGeneratingRebuttal(false);
    }
  }

  async function handleDownloadPack() {
    if (!eventId || !isUuid(eventId)) return;

    setSaveErr(null);

    try {
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      const { payload } = await buildWorkbookPayload(supabase, user.id);
      const existingPackId = await getExistingPackId(supabase, user.id);

      let latestAiDraft: any = null;

      let latestDraftPayload: any = null;

      if (existingPackId) {
        const latestDraftRes = await (supabase as any).from("event_ai_drafts")
          .select("draft_payload,draft_output")
          .eq("event_id", eventId)
          .eq("pack_id", existingPackId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!latestDraftRes.error) {
          latestAiDraft = (latestDraftRes.data as any)?.draft_output || null;
          latestDraftPayload = (latestDraftRes.data as any)?.draft_payload || null;
        }
      }

      // If RLS/client-side access does not expose the saved draft payload, use the
      // server route as the source of truth. In normal mode this is a pure existing
      // pack retrieval path: no OpenAI call and no credit burn.
      if (!latestDraftPayload || !latestAiDraft) {
        const sessionRes = await supabase.auth.getSession();
        if (sessionRes.error) throw sessionRes.error;
        const accessToken = (sessionRes.data as any)?.session?.access_token;
        if (!accessToken) throw new Error("AUTH_REQUIRED");

        const existingRes = await fetch("/api/generate-pack", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ eventId, forceGenerateMode: false }),
        });
        const existingData = await existingRes.json().catch(() => ({}));
        if (existingRes.ok && existingData?.existing) {
          latestDraftPayload = existingData?.draftPayload || latestDraftPayload;
          latestAiDraft = existingData?.aiDraft || latestAiDraft;
        }
      }

      const workbookPayload = mergeCompanyProfileForWorkbook(payload, latestDraftPayload);
      console.info("[review] workbook company profile", workbookPayload.companyProfile);
      await downloadCeWorkbook(workbookPayload, latestAiDraft);

    } catch (e: any) {
      console.error(e);
      setSaveErr(e?.message ?? "Failed to download pack");
    }
  }

  async function handleGeneratePack() {
    if (!eventId || !isUuid(eventId)) return;

    // Read Force Generate at click-time instead of trusting potentially stale
    // React state. This is critical because packReady/download branching happens
    // before the API request is sent.
    const liveForceGenerateMode = isAdminUnlimited && getForceGenerateMode();
    setForceGenerateMode(liveForceGenerateMode);

    if (hasGeneratedPack && !liveForceGenerateMode) {
      await handleDownloadPack();
      return;
    }

    if (billingGatePending) {
      setSaveErr("Checking billing access. Try again in a moment.");
      return;
    }

    if (subscriptionLocked) {
      setSaveErr("Your subscription is not active. Open Billing to upgrade before generating a recovery pack.");
      return;
    }

    if (generationCreditLocked) {
      setSaveErr("No credits remaining. Open Billing to upgrade or buy additional credits before generating another pack.");
      return;
    }

    setIsGenerating(true);
    startGenerationProgress();
    setSaveErr(null);

    try {
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);

      const { payload } = await buildWorkbookPayload(supabase, user.id);
      await recalculateEventFinancialSummary(supabase, eventId, user.id);

      const sessionRes = await supabase.auth.getSession();
      if (sessionRes.error) throw sessionRes.error;
      const accessToken = (sessionRes.data as any)?.session?.access_token;
      if (!accessToken) throw new Error("AUTH_REQUIRED");

      const generateRes = await fetch("/api/generate-pack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          eventId,
          generationMode,
          forceGenerateMode: liveForceGenerateMode,
          // Normal users should never bypass the existing-pack guard; this prevents
          // accidental duplicate generation and repeat credit deduction on retries.
          forceAiGeneration: liveForceGenerateMode,
          pack: {
            delay_days: delayDays || 0,
            defined_cost: definedCost || 0,
            prelim_cost: prelimsTotal || 0,
            fee_amount: feeAmount || 0,
            total_value: ceTotal || 0,
            readiness_score: readiness || 0,
            pack_version: 1,
          },
        }),
      });

      const generateData = await generateRes.json().catch(() => ({}));
      console.info("[review] generate-pack response", {
        requestedForceGenerate: liveForceGenerateMode,
        generationMode,
        responseGenerationMode: generateData?.generationMode,
        forceGenerated: generateData?.forceGenerated,
        forceGenerateMode: generateData?.forceGenerateMode,
        forceGenerateAllowed: generateData?.forceGenerateAllowed,
        usedExistingPack: generateData?.usedExistingPack,
        usedExistingDraft: generateData?.usedExistingDraft,
        aiPromptSent: generateData?.aiPromptSent,
        openAiRequestStartedAt: generateData?.openAiRequestStartedAt,
        openAiRequestCompletedAt: generateData?.openAiRequestCompletedAt,
        creditCharged: generateData?.creditCharged,
      });

      if (!generateRes.ok) {
        throw new Error(generateData?.error || "Failed to generate pack");
      }

      if (liveForceGenerateMode && !generateData?.aiPromptSent) {
        throw new Error("Force Generate did not call OpenAI. Generation stopped to avoid returning stale AI output.");
      }

      if (!generateData?.packId) {
        throw new Error("Pack generation completed but no saved pack was returned. No download has been marked as ready.");
      }

      if (generateData?.existing) {
        await finishGenerationProgress();

        // Existing generated packs must still download the exact AI payload and
        // AI draft returned by the API. Do not re-fetch the workbook without the
        // returned draft, otherwise old/broken rows with no draft_output can
        // produce a workbook that falls back to raw form inputs.
        const workbookPayload = mergeCompanyProfileForWorkbook(payload, generateData?.draftPayload);
        console.info("[review] workbook company profile", workbookPayload.companyProfile);
        await downloadCeWorkbook(workbookPayload, generateData?.aiDraft);

        const existingPushback = reviewSettings.include_commercial_pushback
          ? extractGeneratedCommercialPushback(generateData?.aiDraft)
          : [];
        setGeneratedCommercialPushback(existingPushback);

        setHasGeneratedPack(true);
        if (!isAdminUnlimited) setForceGenerateMode(false);
        if (typeof generateData?.creditsRemaining === "number") {
          setCreditsRemaining(generateData.creditsRemaining);
        }
        return;
      }

      await finishGenerationProgress();

      const workbookPayload = mergeCompanyProfileForWorkbook(payload, generateData?.draftPayload);
      console.info("[review] workbook company profile", workbookPayload.companyProfile);
      await downloadCeWorkbook(workbookPayload, generateData?.aiDraft);

      const generatedPushback = reviewSettings.include_commercial_pushback
        ? extractGeneratedCommercialPushback(generateData?.aiDraft)
        : [];
      const displayedGeneratedPushback =
        reviewSettings.include_commercial_pushback && generatedPushback.length === 0
          ? [
              {
                heading: "Pushback & defence generated",
                note: "No specific challenge theme was identified from the generated recovery pack output.",
              },
            ]
          : generatedPushback;
      setGeneratedCommercialPushback(displayedGeneratedPushback);

      if (typeof generateData?.creditsRemaining === "number") {
        setCreditsRemaining(generateData.creditsRemaining);
      }

      // Only switch to Download Pack after the API confirms a saved pack exists
      // and the browser download calls have completed without throwing.
      setHasGeneratedPack(true);
      if (!isAdminUnlimited) setForceGenerateMode(false);
    } catch (e: any) {
      clearGenerationProgressTimer();
      setGenerationProgress(0);
      setGenerationStage("Preparing generation…");
      console.error(e);
      setSaveErr(e?.message ?? "Failed to generate Excel pack");
    } finally {
      setIsGenerating(false);
    }
  }
  if (!eventId || !isUuid(eventId)) {
    return <div style={{ padding: 28 }}>Invalid event id.</div>;
  }

  if (!loaded) {
    return (
      <div style={{ background: c.bg, minHeight: "100vh" }}>
        <div style={{ padding: "22px 18px", maxWidth: 1280, margin: "0 auto" }}>
          <div
            style={{
              background: c.card,
              border: `1px solid ${c.border}`,
              borderRadius: 22,
              padding: 20,
              color: c.sub,
            }}
          >
            Loading…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: c.bg, minHeight: "100vh", position: "relative" }}>
      {isGenerating ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(246,247,251,0.84)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: 24,
          }}
        >
          <div
            style={{
              width: "min(460px, 100%)",
              background: c.card,
              border: `1px solid ${c.border}`,
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: c.black }}>
              Generating enhanced pack
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: c.sub, marginTop: 8 }}>
              Extracting commercial context, strengthening causation, and preparing the workbook for download.
            </div>
            <div style={{ marginTop: 18, height: 10, borderRadius: 999, overflow: "hidden", background: c.lightGrey }}>
              <div
                style={{
                  width: `${generationProgress}%`,
                  height: "100%",
                  background: c.black,
                  transition: "width 650ms ease",
                }}
              />
            </div>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                fontSize: 12,
                color: c.sub,
                fontWeight: 650,
              }}
            >
              <span>{generationStage}</span>
              <span style={{ color: c.black, textAlign: "right" }}>{Math.round(generationProgress)}% complete · {generationEta}</span>
            </div>
          </div>
        </div>
      ) : null}
      <div style={{ padding: "22px 18px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 18 }}>
            <div
              style={{
                background: c.card,
                border: `1px solid ${c.border}`,
                borderRadius: 18,
                padding: 20,
              }}
            >
              <div style={{ fontSize: 12, color: c.sub, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {eventReference !== "Reference pending" ? `${eventReference} — ${title || "Untitled CE"}` : title ? `“${title}”` : "Working event"}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: c.black,
                  letterSpacing: -0.2,
                }}
              >
                Review
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: c.sub,
                  marginTop: 6,
                  lineHeight: 1.55,
                  maxWidth: 760,
                }}
              >
                Sense-check the submission, confirm readiness and choose what goes into the final pack.
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginTop: 12,
                }}
              >
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: `1px solid ${badge.bd}`,
                    background: badge.bg,
                    color: badge.tx,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {badge.label}
                </span>

                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: `1px solid ${c.border}`,
                    background: c.input,
                    color: c.sub,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Payment readiness: {readiness}%
                </span>
              </div>
            </div>

            {saveErr ? (
              <div
                style={{
                  background: c.redBg,
                  border: `1px solid ${c.redBorder}`,
                  color: c.redText,
                  padding: 12,
                  borderRadius: 14,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {saveErr}
              </div>
            ) : null}

            <Card
              title="Will this get paid?"
              hint="Recovery readiness based on entitlement, evidence, valuation support and current commercial gaps."
            >
              <div
                style={{
                  border: `1px solid ${c.border}`,
                  borderRadius: 16,
                  padding: 16,
                  background: c.card,
                }}
              >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.2, textTransform: "uppercase", color: c.sub }}>Recovery readiness</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: c.black, letterSpacing: -0.4, marginTop: 4 }}>{readiness}%</div>
                    </div>
                    <div
                      style={{
                        minWidth: 118,
                        padding: "8px 10px",
                        borderRadius: 999,
                        border: `1px solid ${blockers > 0 ? c.redBorder : warnings > 0 ? c.amberBorder : c.greenBorder}`,
                        background: blockers > 0 ? c.redBg : warnings > 0 ? c.amberBg : c.greenBg,
                        color: blockers > 0 ? c.redText : warnings > 0 ? c.amberText : c.greenText,
                        textAlign: "center",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {blockers > 0 ? "Needs attention" : warnings > 0 ? "Review advised" : "Ready to issue"}
                    </div>
                  </div>

                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: c.lightGrey,
                      overflow: "hidden",
                      marginTop: 14,
                    }}
                  >
                    <div
                      style={{
                        width: `${readiness}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: blockers > 0 ? c.redBorder : warnings > 0 ? c.amberBorder : c.greenBorder,
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 14 }}>
                    {[
                      ["Issues", String(blockers + warnings), blockers > 0 ? c.redText : warnings > 0 ? c.amberText : c.greenText, blockers > 0 ? c.redBg : warnings > 0 ? c.amberBg : c.greenBg, blockers > 0 ? c.redBorder : warnings > 0 ? c.amberBorder : c.greenBorder],
                      ["Estimated total", money(ceTotal), c.black, c.input, c.border],
                      ["Status", getCommercialStatusLabel(commercialStatus), c.black, c.input, c.border],
                    ].map(([label, value, color, bg, border]) => (
                      <div
                        key={String(label)}
                        style={{
                          border: `1px solid ${String(border)}`,
                          borderRadius: 14,
                          padding: 12,
                          background: String(bg),
                        }}
                      >
                        <div style={{ fontSize: 12, color: c.sub }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: String(color), marginTop: 6 }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-start" }}>
                    <button
                      type="button"
                      onClick={() => setShowReadinessDetails((p) => !p)}
                      style={{
                        height: 38,
                        padding: "0 13px",
                        borderRadius: 12,
                        border: `1px solid ${c.border}`,
                        background: c.input,
                        color: c.black,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
                      }}
                    >
                      {showReadinessDetails ? "Hide payment check" : "What could stop payment?"}
                    </button>
                  </div>

                  {showReadinessDetails ? (
                    <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                      {checks
                        .filter((item) => item.status !== "pass")
                        .slice(0, 3)
                        .map((item) => (
                          <div
                            key={`${item.group}-${item.label}`}
                            style={{
                              border: `1px solid ${item.status === "missing" ? c.redBorder : c.amberBorder}`,
                              background: item.status === "missing" ? c.redBg : c.amberBg,
                              borderRadius: 14,
                              padding: 12,
                              fontSize: 13,
                              lineHeight: 1.5,
                              color: c.black,
                            }}
                          >
                            <strong>{item.label}</strong>
                            {item.detail ? <span style={{ color: c.sub }}> — {item.detail}</span> : null}
                          </div>
                        ))}
                      {checks.filter((item) => item.status !== "pass").length === 0 ? (
                        <div style={{ border: `1px solid ${c.greenBorder}`, background: c.greenBg, color: c.greenText, borderRadius: 14, padding: 12, fontSize: 13, fontWeight: 700 }}>
                          No obvious recovery blockers. Generate the pack to produce the submission documents.
                        </div>
                      ) : null}
                      <div style={{ fontSize: 12, color: c.sub, lineHeight: 1.5 }}>
                        This check is intentionally brief: it shows what may weaken payment. Full wording, commercial argument and exportable narrative remain inside Generate Pack.
                      </div>
                    </div>
                  ) : null}
                </div>

            </Card>

            <Card
              title="Likely pushback & defence"
              hint="Internal challenge points are generated with the pack so you can see what may be discounted, rejected or challenged before issue."
            >
              <div style={{ display: "grid", gap: 10 }}>
                {generatedCommercialPushback.length > 0 ? (
                  generatedCommercialPushback.map((item) => (
                    <div key={`${item.heading}-${item.note}`} style={{ border: `1px solid ${c.border}`, borderRadius: 14, padding: 12, background: c.input }}>
                      <div style={{ fontSize: 13, fontWeight: 650, color: c.black }}>{item.heading}</div>
                      {item.note ? <div style={{ marginTop: 5, fontSize: 12.5, lineHeight: 1.55, color: c.sub }}>{item.note}</div> : null}
                    </div>
                  ))
                ) : hasGeneratedPack ? (
                  <div
                    style={{
                      border: `1px solid ${c.border}`,
                      borderRadius: 14,
                      padding: 14,
                      background: c.soft,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 650, color: c.black }}>
                      Pushback has not been generated for this view
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.55, color: c.sub }}>
                      Select “Pushback & Defence” in Pack contents, then produce the recovery pack to show the generated defence points here.
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      border: `1px solid ${c.border}`,
                      borderRadius: 14,
                      padding: 14,
                      background: c.soft,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 650, color: c.black }}>
                      Likely pushback will appear here after generation
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.55, color: c.sub }}>
                      The defence check is created when the recovery pack is produced and stays internal unless the Pushback & Defence option is selected in Pack contents.
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {!showRebuttalPanel ? (
              <Card
                title="Rebuttal generator"
                hint="Use this if the CE is rejected, reduced or assessed short. The full rebuttal is generated from the completed pack and the contractor response."
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub }}>
                    Normally opens automatically once the CE status is Rejected, but you can open it now if you are preparing for a likely challenge or short assessment.
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRebuttalPanel(true)}
                    style={{
                      height: 40,
                      padding: "0 14px",
                      borderRadius: 12,
                      border: `1px solid ${c.black}`,
                      background: c.black,
                      color: c.blackContrast,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Open rebuttal generator
                  </button>
                </div>
              </Card>
            ) : (
              <Card
                title="Rebuttal generator"
                hint="Use this after a CE is rejected or reduced. Paste the contractor response and generate a measured commercial reply. This stays internal until you copy or issue it."
              >
                <div style={{ display: "grid", gap: 14 }}>
                  {commercialStatus !== "rejected" ? (
                    <div style={{ border: `1px solid ${c.amberBorder}`, background: c.amberBg, color: c.amberText, borderRadius: 14, padding: 12, fontSize: 12.5, lineHeight: 1.5 }}>
                      This panel is available now, but it is normally used once the CE status is marked as Rejected in the CE register.
                    </div>
                  ) : null}

                  {rebuttalTableMissing ? (
                    <div style={{ border: `1px solid ${c.redBorder}`, background: c.redBg, color: c.redText, borderRadius: 14, padding: 12, fontSize: 12.5, lineHeight: 1.5, fontWeight: 650 }}>
                      Rebuttal storage is not installed yet. Run REBUTTAL_ENGINE_PATCH.sql in Supabase, then refresh this page.
                    </div>
                  ) : null}

                  {!hasGeneratedPack ? (
                    <div style={{ border: `1px solid ${c.amberBorder}`, background: c.amberBg, color: c.amberText, borderRadius: 16, padding: 14, display: "grid", gap: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c.black }}>Want the proper rebuttal?</div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                        Make sure the pack has been generated first. Rebuttals are unlocked from the completed CE pack so users cannot bypass the submission workflow.
                      </div>
                      <button
                        type="button"
                        onClick={handleGeneratePack}
                        disabled={generateDisabled}
                        style={{
                          justifySelf: "start",
                          height: 38,
                          padding: "0 13px",
                          borderRadius: 12,
                          border: `1px solid ${generateDisabled ? c.border : c.black}`,
                          background: generateDisabled ? c.lightGrey : c.black,
                          color: generateDisabled ? c.sub : c.blackContrast,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: generateDisabled ? "not-allowed" : "pointer",
                        }}
                      >
                        Produce recovery pack
                      </button>
                    </div>
                  ) : (
                    <>
                  <label style={{ display: "grid", gap: 7 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.sub }}>Contractor rejection / assessment response</span>
                    <textarea
                      value={contractorResponse}
                      onChange={(e) => setContractorResponse(e.target.value)}
                      rows={6}
                      placeholder="Paste the contractor's rejection, assessment, or pay less reasoning here."
                      style={{
                        width: "100%",
                        border: `1px solid ${c.border}`,
                        borderRadius: 16,
                        padding: 12,
                        fontSize: 13.5,
                        lineHeight: 1.55,
                        resize: "vertical",
                        outline: "none",
                        color: c.black,
                        background: c.input,
                      }}
                    />
                  </label>

                  {rebuttalErr ? (
                    <div style={{ border: `1px solid ${c.redBorder}`, background: c.redBg, color: c.redText, borderRadius: 14, padding: 12, fontSize: 12.5, fontWeight: 650 }}>
                      {rebuttalErr}
                    </div>
                  ) : null}

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: c.sub, lineHeight: 1.5 }}>
                      Uses the saved CE facts, evidence, valuation and the pasted contractor response. No new facts are invented.
                    </div>
                    <button
                      type="button"
                      disabled={isGeneratingRebuttal || rebuttalTableMissing}
                      onClick={handleGenerateRebuttal}
                      style={{
                        height: 40,
                        padding: "0 14px",
                        borderRadius: 12,
                        border: `1px solid ${isGeneratingRebuttal || rebuttalTableMissing ? c.border : c.black}`,
                        background: isGeneratingRebuttal || rebuttalTableMissing ? c.lightGrey : c.black,
                        color: isGeneratingRebuttal || rebuttalTableMissing ? c.sub : c.blackContrast,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: isGeneratingRebuttal || rebuttalTableMissing ? "not-allowed" : "pointer",
                      }}
                    >
                      {isGeneratingRebuttal ? "Generating…" : generatedRebuttal ? "Regenerate rebuttal" : "Generate rebuttal"}
                    </button>
                  </div>

                  {generatedRebuttal ? (
                    <div style={{ border: `1px solid ${c.border}`, borderRadius: 16, background: c.soft, padding: 14, display: "grid", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: c.sub, textTransform: "uppercase", letterSpacing: 0.45 }}>Generated rebuttal</div>
                          {generatedRebuttal.updated_at ? (
                            <div style={{ marginTop: 4, fontSize: 12, color: c.sub }}>Saved {formatRebuttalDate(generatedRebuttal.updated_at)}</div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(`${generatedRebuttal.rebuttal_subject}\n\n${generatedRebuttal.rebuttal_body}`)}
                          style={{ height: 34, border: `1px solid ${c.border}`, background: c.input, borderRadius: 11, padding: "0 10px", fontSize: 12, fontWeight: 700, color: c.black, cursor: "pointer" }}
                        >
                          Copy
                        </button>
                      </div>

                      <div style={{ border: `1px solid ${c.border}`, borderRadius: 14, background: c.input, padding: 12 }}>
                        <div style={{ fontSize: 12, color: c.sub, fontWeight: 700 }}>Subject</div>
                        <div style={{ marginTop: 5, fontSize: 13.5, color: c.black, fontWeight: 650 }}>{generatedRebuttal.rebuttal_subject}</div>
                      </div>

                      <div style={{ border: `1px solid ${c.border}`, borderRadius: 14, background: c.input, padding: 12 }}>
                        <div style={{ fontSize: 12, color: c.sub, fontWeight: 700 }}>Response body</div>
                        <div style={{ marginTop: 7, whiteSpace: "pre-wrap", fontSize: 13.2, lineHeight: 1.65, color: c.black }}>{generatedRebuttal.rebuttal_body}</div>
                      </div>

                      {generatedRebuttal.key_points?.length ? (
                        <div style={{ display: "grid", gap: 7 }}>
                          {generatedRebuttal.key_points.slice(0, 5).map((point, index) => (
                            <div key={`${point}-${index}`} style={{ border: `1px solid ${c.border}`, borderRadius: 12, background: c.input, padding: "9px 10px", fontSize: 12.5, color: c.sub, lineHeight: 1.45 }}>
                              {point}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {generatedRebuttal.risk_note ? (
                        <div style={{ border: `1px solid ${c.amberBorder}`, borderRadius: 14, background: c.amberBg, padding: 12, fontSize: 12.5, color: c.amberText, lineHeight: 1.5 }}>
                          {generatedRebuttal.risk_note}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                    </>
                  )}
                </div>
              </Card>
            )}

            <Card
              title="Recovery summary"
              hint="The final value, time and contract position before you generate the pack."
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    border: `1px solid ${c.border}`,
                    borderRadius: 14,
                    padding: 14,
                    background: c.input,
                  }}
                >
                  <div style={{ display: "grid", gap: 10 }}>
                    <Row
                      label="Contract type"
                      value={contractLabel}
                    />
                    <Row
                      label="Contract source"
                      value={
                        contractSource === "standard_logic"
                          ? "Standard contract logic"
                          : contractSource === "upload_contract"
                          ? "Uploaded contract"
                          : "—"
                      }
                    />
                    <Row label="Contract family" value={contractFamily} />
                    <Row label="Draft template" value={draftTemplate.title} />
                    <Row label={costLabel} value={money(definedCost)} />
                    <Row label="Prelims (daily)" value={money(prelimsDaily)} />
                    <Row label="Delay days" value={`${delayDays}`} />
                  </div>
                </div>

                <div
                  style={{
                    border: `1px solid ${c.border}`,
                    borderRadius: 14,
                    padding: 14,
                    background: c.input,
                  }}
                >
                  <div style={{ display: "grid", gap: 10 }}>
                    <Row label="Prelims total" value={money(prelimsTotal)} />
                    <Row label={`Fee %`} value={`${valuation.fee_percent}%`} />
                    <Row
                      label="Fee basis"
                      value={feeBasisLabel}
                    />
                    <Row label="Fee amount" value={money(feeAmount)} />
                    <div style={{ height: 1, background: c.border, margin: "2px 0" }} />
                    <Row label="CE total" value={money(ceTotal)} strong />
                  </div>
                </div>
              </div>
            </Card>

            <Card
              title="Pack contents"
              hint="Choose the sections needed to support entitlement, valuation and payment. The generated recovery narrative populates the Basis of Change and Time Impact tabs when the pack is produced."
            >
              {[
                {
                  heading: "Recovery Narrative",
                  items: [
                    ["include_basis", "Basis of Change"],
                    ["include_entitlement", "Contractual Position"],
                    ["include_time_impact", "Time Impact Summary"],
                  ],
                },
                {
                  heading: "Valuation",
                  items: [
                    ["include_cost_summary", "Valuation Schedules"],
                    ["include_prelims_fee", "Prelims + Fee"],
                  ],
                },
                {
                  heading: "Supporting Information",
                  items: [
                    ["include_evidence_register", "Evidence Register"],
                  ],
                },
                {
                  heading: "Internal Defence",
                  items: [
                    ["include_commercial_pushback", "Pushback & Defence"],
                  ],
                },
              ].map((group) => (
                <div key={group.heading} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: c.black, marginBottom: 8 }}>{group.heading}</div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 12,
                    }}
                  >
                    {group.items.map(([key, label]) => {
                      const checked = reviewSettings[key as keyof ReviewSettings] as boolean;
                      return (
                        <label
                          key={key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            border: `1px solid ${c.border}`,
                            borderRadius: 14,
                            padding: "12px 14px",
                            background: c.input,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              updateReview(key as keyof ReviewSettings, e.target.checked as any)
                            }
                          />
                          <span style={{ fontSize: 13, fontWeight: 600, color: c.black }}>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Card>


            <Card
              title="Recovery checks"
              hint="These checks tell you what supports payment, what is weak, and what may undermine the CE if challenged."
            >
              <div style={{ display: "grid", gap: 14 }}>
                {(
                  [
                    ["Contract route", groupedChecks.contract],
                    ["Causation and basis", groupedChecks.basis],
                    ["Evidence support", groupedChecks.evidence],
                    ["Valuation support", groupedChecks.cost],
                  ] as Array<[string, CheckItem[]]>
                ).map(([heading, items]) => (
                  <div key={heading}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: c.black,
                        marginBottom: 10,
                      }}
                    >
                      {heading}
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      {(items as CheckItem[]).map((item) => {
                        const pill = statusPill(item.status);
                        return (
                          <div
                            key={`${heading}-${item.label}`}
                            style={{
                              border: `1px solid ${c.border}`,
                              borderRadius: 14,
                              padding: 12,
                              background: c.input,
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 14,
                              alignItems: "flex-start",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: c.black,
                                }}
                              >
                                {item.label}
                              </div>
                              {item.detail ? (
                                <div
                                  style={{
                                    marginTop: 4,
                                    fontSize: 12,
                                    color: c.sub,
                                    lineHeight: 1.45,
                                  }}
                                >
                                  {item.detail}
                                </div>
                              ) : null}
                            </div>

                            <span
                              style={{
                                flexShrink: 0,
                                padding: "6px 10px",
                                borderRadius: 999,
                                border: `1px solid ${pill.bd}`,
                                background: pill.bg,
                                color: pill.tx,
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {pill.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card
              title="Recovery notes / qualifications"
              hint="Use this for reservations, assumptions, pending substantiation, limitations, or commercial wording you want reflected in the generated pack."
            >
              <Textarea
                rows={8}
                value={reviewSettings.qualifications_notes}
                onChange={(e) => updateReview("qualifications_notes", e.target.value)}
                placeholder="e.g. Programme impact remains subject to final accepted programme review. Valuation excludes unresolved downstream effects and any further instructed change not yet priced."
              />
            </Card>

            <Card
              title="What may weaken this CE?"
              hint="These prompts highlight the gaps most likely to delay, discount or weaken recovery."
            >
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  programmeCount === 0 && delayDays > 0
                    ? "Add at least one programme-support document because delay days are entered."
                    : null,
                  photosCount === 0
                    ? "Add photographic evidence if the change involved a physical restriction, condition or encountered issue."
                    : null,
                  basis.mitigation_summary.trim() === ""
                    ? "Add a mitigation note or explain why mitigation was not reasonably possible."
                    : null,
                  prelimLineCount === 0
                    ? "Review whether time-related prelims should be included."
                    : null,
                  contractSource === "upload_contract" && contractUploadCount === 0
                    ? "Upload the contract documents before generation."
                    : null,
                  reviewSettings.qualifications_notes.trim() === ""
                    ? "Consider adding qualifications / assumptions if anything remains subject to review."
                    : null,
                ]
                  .filter(Boolean)
                  .map((text) => (
                    <div
                      key={text}
                      style={{
                        border: `1px solid ${c.border}`,
                        borderRadius: 14,
                        padding: 12,
                        background: c.input,
                        fontSize: 13,
                        color: c.sub,
                        lineHeight: 1.55,
                      }}
                    >
                      {text}
                    </div>
                  ))}

                {[
                  programmeCount === 0 && delayDays > 0
                    ? "Add at least one programme-support document because delay days are entered."
                    : null,
                  photosCount === 0
                    ? "Add photographic evidence if the change involved a physical restriction, condition or encountered issue."
                    : null,
                  basis.mitigation_summary.trim() === ""
                    ? "Add a mitigation note or explain why mitigation was not reasonably possible."
                    : null,
                  prelimLineCount === 0
                    ? "Review whether time-related prelims should be included."
                    : null,
                  contractSource === "upload_contract" && contractUploadCount === 0
                    ? "Upload the contract documents before generation."
                    : null,
                  reviewSettings.qualifications_notes.trim() === ""
                    ? "Consider adding qualifications / assumptions if anything remains subject to review."
                    : null,
                ].filter(Boolean).length === 0 ? (
                  <div
                    style={{
                      border: `1px solid ${c.greenBorder}`,
                      background: c.greenBg,
                      color: c.greenText,
                      borderRadius: 14,
                      padding: 12,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    No obvious recovery gaps at this stage. The pack looks commercially well-prepared.
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          <div
            style={{
              position: "sticky",
              top: 20,
              alignSelf: "start",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                background: c.card,
                border: `1px solid ${c.border}`,
                borderRadius: 18,
                padding: 12,
              }}
            >
              <CEProgress eventId={eventId} currentStep="review" />
            </div>

            <SidebarCard title="Recovery guidance">
              <div style={{ display: "grid", gap: 10 }}>
                <div>Review is the final recovery check before generation.</div>
                <div>Missing inputs make the CE easier to discount or reject.</div>
                <div>Generation uses deterministic totals only.</div>
                <div>Pushback & Defence surfaces likely challenge points before issue.</div>
                <div>Contract choice affects entitlement wording and clause references.</div>
                {lastSavedAt ? (
                  <div>Last saved at {new Date(lastSavedAt).toLocaleTimeString()}</div>
                ) : (
                  <div>Changes save automatically shortly after you stop typing.</div>
                )}
              </div>
            </SidebarCard>

            <SidebarCard title="Produce recovery pack">
              <div style={{ display: "grid", gap: 10 }}>
                <div
                  style={{
                    border: `1px solid ${c.border}`,
                    borderRadius: 14,
                    padding: 12,
                    background: c.input,
                  }}
                >
                  <div style={{ display: "grid", gap: 8 }}>
                    <Row label="Recovery readiness" value={`${readiness}%`} />
                    <Row label="Blockers" value={String(blockers)} />
                    <Row label="Warnings" value={String(warnings)} />
                  </div>
                </div>

                <div
                  style={{
                    border: `1px solid ${c.border}`,
                    borderRadius: 14,
                    padding: 12,
                    background: c.input,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.black, marginBottom: 8 }}>Selected recovery sections</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {[
                      reviewSettings.include_basis ? "Basis of Change" : null,
                      reviewSettings.include_entitlement ? "Contractual Position" : null,
                      reviewSettings.include_time_impact ? "Time Impact Summary" : null,
                      reviewSettings.include_evidence_register ? "Evidence Register" : null,
                      reviewSettings.include_cost_summary ? "Cost Summary" : null,
                      reviewSettings.include_prelims_fee ? "Prelims + Fee Summary" : null,
                      reviewSettings.include_commercial_pushback ? "Pushback & Defence" : null,
                    ].filter(Boolean).map((item) => (
                      <div key={String(item)} style={{ fontSize: 12, color: c.sub }}>• {item}</div>
                    ))}
                  </div>
                </div>


                <button
                  onClick={handleGeneratePack}
                  disabled={generateDisabled}
                  style={{
                    width: "100%",
                    background: c.black,
                    color: c.blackContrast,
                    padding: "12px",
                    borderRadius: 12,
                    fontWeight: 700,
                    border: "none",
                    cursor: generateDisabled ? "not-allowed" : "pointer",
                    opacity: generateDisabled ? 0.6 : 1,
                  }}
                >
                  {generateButtonLabel}
                </button>

                {subscriptionLocked ? (
                  <div style={{ fontSize: 12, color: c.redText, background: c.redBg, border: `1px solid ${c.redBorder}`, borderRadius: 12, padding: 10 }}>
                    Your subscription is not active. Open Billing to upgrade before generating a recovery pack.
                  </div>
                ) : generationCreditLocked ? (
                  <div style={{ fontSize: 12, color: c.redText, background: c.redBg, border: `1px solid ${c.redBorder}`, borderRadius: 12, padding: 10 }}>
                    You have no credits remaining. Open Billing to upgrade or buy additional credits before generating another pack.
                  </div>
                ) : null}

                {isAdminUnlimited && forceGenerateMode ? (
                  <div style={{ fontSize: 12, color: c.blueText, background: c.blueBg, border: `1px solid ${c.blueBorder}`, borderRadius: 12, padding: 10 }}>
                    Force Generate is on. This event will keep showing Produce recovery pack during testing.
                  </div>
                ) : null}

                <SmallBtn onClick={() => router.push(buildEventStepPath(eventId, "prelims"))}>
                  Back to prelims
                </SmallBtn>

                <SmallBtn
                  onClick={() => router.push(`/app`)}
                  style={{ background: c.lightGrey }}
                >
                  Back to dashboard
                </SmallBtn>

                {blockers > 0 ? (
                  <div
                    style={{
                      border: `1px solid ${c.redBorder}`,
                      background: c.redBg,
                      color: c.redText,
                      borderRadius: 14,
                      padding: 12,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Resolve the blocker items in Recovery checks before generating the pack.
                  </div>
                ) : null}
              </div>
            </SidebarCard>
          </div>
        </div>
      </div>
    </div>
  );
}


/*
QA_HARMONISATION_PASS

After specialist section generation:
- review change_to_contract_basis
- review commercial_impact
- review contractual_position

Check:
1. contradictions
2. repeated wording
3. clause consistency
4. operational causation depth
5. entitlement not preceding narrative
6. missing factual limitations
7. NEC/JCT terminology correctness

Return improved sections before final JSON assembly.
*/

export default function ReviewPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading review…</div>}>
      <ReviewPageContent />
    </Suspense>
  );
}
