"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import CEProgress from "@/components/CEProgress";

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

const c = {
  bg: "#f6f7fb",
  card: "#ffffff",
  border: "#e5e7eb",
  sub: "#475569",
  black: "#111827",
  soft: "#f8fafc",
  redBg: "#fef2f2",
  redBorder: "#fecaca",
  redText: "#991b1b",
  greenBg: "#ecfdf5",
  greenBorder: "#a7f3d0",
  greenText: "#065f46",
  amberBg: "#fffbeb",
  amberBorder: "#fde68a",
  amberText: "#92400e",
  blueBg: "#eff6ff",
  blueBorder: "#bfdbfe",
  blueText: "#1d4ed8",
  lightGrey: "#f3f4f6",
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
  include_excel: true,
  include_pdf: true,
  qualifications_notes: "",
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function clampNum(v: any, fallback: number) {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function money(n: number) {
  if (!Number.isFinite(n)) return "£0.00";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
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
        background: "#fff",
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
        background: "#fff",
        color: c.black,
        fontSize: 14,
        lineHeight: 1.5,
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
        padding: 18,
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
            lineHeight: 1.5,
            color: c.sub,
          }}
        >
          {hint}
        </p>
      ) : null}

      <div style={{ marginTop: 14 }}>{children}</div>
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
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: c.black,
          marginBottom: 12,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 13,
          lineHeight: 1.5,
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

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = (params?.id ?? "").toString();

  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("Loading…");
  const [contractType, setContractType] = useState<string | null>(null);
  const [contractSource, setContractSource] = useState<string | null>(null);
  const [delayDays, setDelayDays] = useState(0);

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
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const lastSavedSnapshotRef = useRef<string>("");
  const savingRef = useRef(false);

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
    return currentSnapshot !== lastSavedSnapshotRef.current;
  }, [currentSnapshot, loaded]);

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
    return { bg: "#fff", bd: c.border, tx: c.sub, label: "Not saved" };
  }, [status]);

  useEffect(() => {
    if (!loaded) return;
    if (status === "saving" || status === "error") return;
    setStatus(isDirty ? "unsaved" : lastSavedAt ? "saved" : "not_saved");
  }, [isDirty, loaded, lastSavedAt, status]);

  useEffect(() => {
    (async () => {
      setSaveErr(null);
      if (!eventId || !isUuid(eventId)) return;

      const supabase = supabaseBrowser();
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session?.user) {
        router.push("/login");
        return;
      }

      const evRes = await supabase
        .from("events")
        .select("id,title,delay_days,contract_type,contract_source")
        .eq("id", eventId)
        .single();

      if (evRes.error || !evRes.data) {
        setTitle("Event not found");
        setLoaded(true);
        return;
      }

      setTitle(evRes.data.title ?? "");
      setDelayDays(clampNum(evRes.data.delay_days, 0));
      setContractType(evRes.data.contract_type ?? null);
      setContractSource(evRes.data.contract_source ?? null);

      const basisRes = await supabase
        .from("event_basis")
        .select(
          "happened_summary,cause_type,cause_summary,difference_from_plan,mechanism_tags,time_impact_toggle,mitigation_summary"
        )
        .eq("event_id", eventId)
        .maybeSingle();

      if (basisRes.data) {
        setBasis({
          happened_summary: basisRes.data.happened_summary ?? "",
          cause_type: basisRes.data.cause_type ?? null,
          cause_summary: basisRes.data.cause_summary ?? "",
          difference_from_plan: basisRes.data.difference_from_plan ?? "",
          mechanism_tags: Array.isArray(basisRes.data.mechanism_tags)
            ? basisRes.data.mechanism_tags
            : [],
          time_impact_toggle: basisRes.data.time_impact_toggle ?? "unsure",
          mitigation_summary: basisRes.data.mitigation_summary ?? "",
        });
      }

      const filesRes = await supabase
        .from("event_files")
        .select("category")
        .eq("event_id", eventId);

      const fileRows = (filesRes.data ?? []) as Array<{ category: string }>;
      setInstructionCount(fileRows.filter((x) => x.category === "instructions").length);
      setPhotosCount(fileRows.filter((x) => x.category === "photos").length);
      setSiteRecordsCount(fileRows.filter((x) => x.category === "site_records").length);
      setProgrammeCount(fileRows.filter((x) => x.category === "programme").length);
      setCostSupportCount(fileRows.filter((x) => x.category === "cost_support").length);

      const resourceRes = await supabase
        .from("event_resource_lines")
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

      const valuationRes = await supabase
        .from("event_valuation_settings")
        .select("fee_percent,fee_basis")
        .eq("event_id", eventId)
        .maybeSingle();

      setValuation({
        fee_percent: clampNum(valuationRes.data?.fee_percent, 12.5),
        fee_basis:
          (valuationRes.data?.fee_basis as "defined_cost" | "defined_cost_plus_prelims") ||
          "defined_cost",
        work_days_per_week: 5,
      });

      const prelimRes = await supabase
        .from("event_prelim_lines")
        .select("qty,unit,rate")
        .eq("event_id", eventId);

      const prelimRows =
        ((prelimRes.data ?? []) as Array<{ qty: number; unit: Unit; rate: number }>) || [];
      setPrelimLineCount(prelimRows.length);
      setPrelimLines(prelimRows);

      if (evRes.data.contract_source === "upload_contract") {
        const contractFilesRes = await supabase
          .from("event_contract_files")
          .select("id")
          .eq("event_id", eventId);
        setContractUploadCount((contractFilesRes.data ?? []).length);
      } else {
        setContractUploadCount(0);
      }

      const reviewRes = await supabase
        .from("event_review_settings")
        .select(
          "include_basis,include_entitlement,include_time_impact,include_evidence_register,include_cost_summary,include_prelims_fee,include_risk_notes,include_excel,include_pdf,qualifications_notes"
        )
        .eq("event_id", eventId)
        .maybeSingle();

      const mergedReview: ReviewSettings = {
        ...defaultReviewSettings,
        ...(reviewRes.data ?? {}),
        qualifications_notes: reviewRes.data?.qualifications_notes ?? "",
      };

      setReviewSettings(mergedReview);

      const snapshot = JSON.stringify({
        reviewSettings: mergedReview,
      });
      lastSavedSnapshotRef.current = snapshot;
      setLastSavedAt(Date.now());
      setStatus("saved");
      setLoaded(true);
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
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { error } = await supabase.from("event_review_settings").upsert(
        {
          event_id: eventId,
          ...reviewSettings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_id" }
      );

      if (error) throw error;

      lastSavedSnapshotRef.current = snap;
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

  function updateReview<K extends keyof ReviewSettings>(key: K, value: ReviewSettings[K]) {
    setReviewSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleGeneratePack() {
    alert(
      "Generate Pack is the next stage. This page is now preparing the selections, notes, and readiness checks for the future generation flow."
    );
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
              borderRadius: 18,
              padding: 18,
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
    <div style={{ background: c.bg, minHeight: "100vh" }}>
      <div style={{ padding: "22px 18px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                background: c.card,
                border: `1px solid ${c.border}`,
                borderRadius: 16,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 12, color: c.sub, marginBottom: 6 }}>Event</div>
              <div
                style={{
                  fontSize: 20,
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
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {title ? `“${title}”` : ""}
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
                    fontWeight: 750,
                  }}
                >
                  {badge.label}
                </span>

                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: `1px solid ${c.border}`,
                    background: "#fff",
                    color: c.sub,
                    fontSize: 12,
                    fontWeight: 750,
                  }}
                >
                  Readiness: {readiness}%
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
              title="Commercial summary"
              hint="This is the final commercial sense-check before you generate the pack."
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
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "grid", gap: 10 }}>
                    <Row
                      label="Contract type"
                      value={contractType ? contractType.replaceAll("_", " ").toUpperCase() : "—"}
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
                    <Row label="Defined Cost" value={money(definedCost)} />
                    <Row label="Prelims (daily)" value={money(prelimsDaily)} />
                    <Row label="Delay days" value={`${delayDays}`} />
                  </div>
                </div>

                <div
                  style={{
                    border: `1px solid ${c.border}`,
                    borderRadius: 14,
                    padding: 14,
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "grid", gap: 10 }}>
                    <Row label="Prelims total" value={money(prelimsTotal)} />
                    <Row label={`Fee %`} value={`${valuation.fee_percent}%`} />
                    <Row
                      label="Fee basis"
                      value={
                        valuation.fee_basis === "defined_cost_plus_prelims"
                          ? "Defined Cost + Prelims"
                          : "Defined Cost only"
                      }
                    />
                    <Row label="Fee amount" value={money(feeAmount)} />
                    <div style={{ height: 1, background: c.border, margin: "2px 0" }} />
                    <Row label="CE total" value={money(ceTotal)} strong />
                  </div>
                </div>
              </div>
            </Card>

            <Card
              title="Pack contents to generate"
              hint="Choose what should be included in the CE pack. These options can map into the same output under the hood later, but the user intent should be explicit now."
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                {[
                  ["include_basis", "Basis of Change narrative"],
                  ["include_entitlement", "Clause / entitlement reasoning"],
                  ["include_time_impact", "Time impact summary"],
                  ["include_evidence_register", "Evidence register"],
                  ["include_cost_summary", "Cost summary"],
                  ["include_prelims_fee", "Prelims + Fee summary"],
                  ["include_risk_notes", "Risk / qualification notes"],
                  ["include_excel", "Excel workbook"],
                  ["include_pdf", "PDF pack"],
                ].map(([key, label]) => {
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
                        background: "#fff",
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
            </Card>

            <Card
              title="Quality checks"
              hint="These checks tell you what is strong, what is weak, and what may undermine the final output."
            >
              <div style={{ display: "grid", gap: 14 }}>
                {[
                  ["Contract readiness", groupedChecks.contract],
                  ["Basis readiness", groupedChecks.basis],
                  ["Evidence readiness", groupedChecks.evidence],
                  ["Cost readiness", groupedChecks.cost],
                ].map(([heading, items]) => (
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
                              background: "#fff",
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
                                fontWeight: 750,
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
              title="Generation notes / qualifications"
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
              title="Missing items / prompts"
              hint="These prompts highlight the gaps most likely to weaken your submission."
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
                        background: "#fff",
                        fontSize: 13,
                        color: c.sub,
                        lineHeight: 1.5,
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
                    No obvious prompts at this stage. The pack looks commercially well-prepared.
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
                borderRadius: 16,
                padding: 12,
              }}
            >
              <CEProgress eventId={eventId} currentStep="review" />
            </div>

            <SidebarCard title="Guidance">
              <div style={{ display: "grid", gap: 10 }}>
                <div>Review is your final commercial check before generation.</div>
                <div>Missing inputs reduce narrative quality and clause confidence.</div>
                <div>Generation uses deterministic totals only.</div>
                <div>Contract choice affects entitlement wording and clause references.</div>
                {lastSavedAt ? (
                  <div>Last saved at {new Date(lastSavedAt).toLocaleTimeString()}</div>
                ) : (
                  <div>Changes save automatically shortly after you stop typing.</div>
                )}
              </div>
            </SidebarCard>

            <SidebarCard title="Generate pack">
              <div style={{ display: "grid", gap: 10 }}>
                <div
                  style={{
                    border: `1px solid ${c.border}`,
                    borderRadius: 14,
                    padding: 12,
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "grid", gap: 8 }}>
                    <Row label="Readiness" value={`${readiness}%`} />
                    <Row label="Blockers" value={String(blockers)} />
                    <Row label="Warnings" value={String(warnings)} />
                  </div>
                </div>

                <button
                  onClick={handleGeneratePack}
                  disabled={blockers > 0}
                  style={{
                    width: "100%",
                    background: c.black,
                    color: "#fff",
                    padding: "12px",
                    borderRadius: 12,
                    fontWeight: 700,
                    border: "none",
                    cursor: blockers > 0 ? "not-allowed" : "pointer",
                    opacity: blockers > 0 ? 0.6 : 1,
                  }}
                >
                  Generate pack
                </button>

                <SmallBtn onClick={() => router.push(`/app/event/${eventId}/prelims`)}>
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
                    Resolve the blocker items in Quality checks before generating the pack.
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