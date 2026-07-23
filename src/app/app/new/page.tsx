"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CONTRACT_TYPE_OPTIONS, getContractFamilyHint, requiresUploadedContract, type KnownContractType } from "@/lib/contracts";
import { buildEventReference } from "@/lib/eventReference";
import { getDefaultNoticePeriodDays } from "@/lib/commercialControl";
import { AppSideCard, RingProgress } from "@/components/appUi";
import CEProgress from "@/components/CEProgress";
import { trackAnalyticsWithUser } from "@/lib/analyticsClient";

type ContractType = KnownContractType;

type ContractSource = "standard_logic" | "upload_contract";

type ProjectOption = {
  id: string;
  project_name: string;
  main_contractor: string;
  contract_type?: string | null;
  trade_profile?: string | null;
};

const FIELD_GRID_STYLE = {
  display: "grid",
  gap: 14,
  alignItems: "start",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const CONTRACT_SOURCE_OPTIONS: { value: ContractSource; label: string }[] = [
  { value: "standard_logic", label: "Use standard contract logic" },
  { value: "upload_contract", label: "Upload contract documents" },
];

const c = {
  card: "var(--surface)",
  input: "var(--surface-input)",
  border: "var(--border)",
  sub: "var(--text-muted)",
  text: "var(--foreground)",
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
  soft: "var(--surface-soft)",
  redBg: "var(--red-bg)",
  redBorder: "var(--red-border)",
  redText: "var(--red-text)",
  amberBg: "var(--amber-bg)",
  amberBorder: "var(--amber-border)",
  amberText: "var(--amber-text)",
};

type EwnConversionFacts = {
  title: string;
  whatHappened: string;
  impact: string;
  requiredAction: string;
  evidence: string;
  location: string;
  eventDate: string | null;
  generatedNarrative: string;
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontWeight: 700,
        fontSize: 12,
        color: c.sub,
      }}
    >
      {children}
    </span>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 14,
        border: `1px solid ${c.border}`,
        outline: "none",
        background: c.input,
        color: c.black,
        fontSize: 14,
        lineHeight: 1.5,
        ...(props.style ?? {}),
      }}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 14,
        border: `1px solid ${c.border}`,
        outline: "none",
        background: c.input,
        color: c.black,
        fontSize: 14,
        ...(props.style ?? {}),
      }}
    />
  );
}

function normalizeContractType(value?: string | null): ContractType | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (CONTRACT_TYPE_OPTIONS.some((option) => option.value === raw)) return raw as ContractType;

  const lower = raw.toLowerCase();
  if (lower.includes("jct")) return "jct_d_and_b_2016";
  if (lower.includes("bespoke") || lower.includes("other")) return "bespoke_other";
  if (lower.includes("unconfirmed") || lower.includes("unknown")) return "unconfirmed";
  if (lower.includes("nec4") && lower.includes("option a")) return "nec4_ecs_option_a";
  if (lower.includes("nec4") && lower.includes("option b")) return "nec4_ecs_option_b";
  if (lower.includes("nec")) return "nec4_ecs_option_b";
  return null;
}

function readLocalEwns(): Array<Record<string, unknown>> {
  try {
    const raw = localStorage.getItem("cc.ewns");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function factsFromEwnRow(row: Record<string, unknown>): EwnConversionFacts {
  const generated = row.generated_output && typeof row.generated_output === "object" ? row.generated_output as Record<string, unknown> : null;
  return {
    title: textValue(row.title),
    whatHappened: textValue(row.what_happened),
    impact: textValue(row.impact),
    requiredAction: textValue(row.required_action),
    evidence: textValue(row.evidence_summary),
    location: textValue(row.location),
    eventDate: textValue(row.event_date) || null,
    generatedNarrative: generated ? textValue(generated.narrative) : "",
  };
}

function buildEwnBasisText(facts: EwnConversionFacts) {
  return [
    facts.whatHappened,
    facts.location ? `Location: ${facts.location}.` : "",
    facts.eventDate ? `EWN date / date became known: ${facts.eventDate}.` : "",
  ].filter(Boolean).join("\n\n");
}

function buildEwnDifferenceText(facts: EwnConversionFacts) {
  const parts = [
    "Created from EWN. Confirm the change from planned or tendered basis before submission.",
    facts.evidence ? `Evidence / records noted in EWN: ${facts.evidence}` : "",
    facts.generatedNarrative ? `Original EWN narrative retained for review: ${facts.generatedNarrative}` : "",
  ].filter(Boolean);
  return parts.join("\n\n");
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function projectOptionLabel(option: ProjectOption) {
  return option.main_contractor ? `${option.project_name} — ${option.main_contractor}` : option.project_name;
}

export default function NewEvent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [mainContractor, setMainContractor] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [contractType, setContractType] = useState<ContractType>("nec4_ecs_option_b");
  const [contractSource, setContractSource] = useState<ContractSource>("standard_logic");
  const [fromEwnId, setFromEwnId] = useState<string | null>(null);
  const [fromEwnConvertedEventId, setFromEwnConvertedEventId] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [ewnFacts, setEwnFacts] = useState({
    title: "",
    whatHappened: "",
    impact: "",
    requiredAction: "",
    evidence: "",
    location: "",
    generatedNarrative: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canCreate = useMemo(() => {
    if (!title.trim()) return false;
    if (!projectName.trim()) return false;
    if (!mainContractor.trim()) return false;
    if (fromEwnConvertedEventId) return false;
    if ((contractSource === "upload_contract" || requiresUploadedContract(contractType)) && files.length === 0) return false;
    return !loading;
  }, [title, projectName, mainContractor, fromEwnConvertedEventId, contractSource, contractType, files, loading]);

  useEffect(() => {
    if (requiresUploadedContract(contractType)) {
      setContractSource("upload_contract");
    }
  }, [contractType]);

  function applyProjectOption(value: string) {
    const clean = value.trim();
    const match = projectOptions.find((option) => option.project_name.trim().toLowerCase() === clean.toLowerCase());
    if (!match) {
      setProjectId(null);
      return;
    }
    setProjectId(match.id);
    if (match.main_contractor) setMainContractor((prev) => prev || match.main_contractor);
    const nextContractType = normalizeContractType(match.contract_type);
    if (nextContractType) setContractType(nextContractType);
  }

  useEffect(() => {
    let active = true;
    async function loadProjects() {
      try {
        const supabase = supabaseBrowser();
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (!user) return;

        let res = await (supabase as any).from("projects")
          .select("id,project_name,main_contractor,contract_type,trade_profile,updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (res.error && /trade_profile|schema cache|column|does not exist/i.test(String(res.error.message || ""))) {
          res = await (supabase as any).from("projects")
            .select("id,project_name,main_contractor,contract_type,updated_at")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false });
        }

        if (res.error) throw res.error;
        if (!active) return;

        const seen = new Set<string>();
        const next: ProjectOption[] = [];
        for (const row of (res.data ?? []) as Array<{ id: string; project_name?: string | null; main_contractor?: string | null; contract_type?: string | null; trade_profile?: string | null }>) {
          const project_name = String(row.project_name ?? "").trim();
          if (!project_name) continue;
          const main_contractor = String(row.main_contractor ?? "").trim();
          const key = `${project_name.toLowerCase()}__${main_contractor.toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          next.push({ id: row.id, project_name, main_contractor, contract_type: row.contract_type ?? null, trade_profile: row.trade_profile ?? null });
        }
        setProjectOptions(next);
      } catch (error) {
        console.warn("Failed to load project options", error);
      }
    }

    void loadProjects();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const ewnId = params.get("from_ewn");
    const paramProjectId = params.get("project_id");
    const ewnTitle = params.get("title");
    const project = params.get("project");
    const contractor = params.get("main_contractor");
    const importedContractType = normalizeContractType(params.get("contract_type"));
    const importedEventDate = params.get("event_date");
    const whatHappened = params.get("what_happened") || "";
    const impact = params.get("impact") || "";
    const requiredAction = params.get("required_action") || "";
    const evidence = params.get("evidence") || "";
    const location = params.get("location") || "";

    if (ewnId) setFromEwnId(ewnId);
    if (paramProjectId) setProjectId(paramProjectId);
    if (ewnTitle) setTitle((prev) => prev || ewnTitle);
    if (project) setProjectName((prev) => prev || project);
    if (contractor) setMainContractor((prev) => prev || contractor);
    if (importedContractType) setContractType(importedContractType);
    if (importedEventDate) setEventDate(importedEventDate);
    if (whatHappened || impact || requiredAction || evidence || location) {
      setEwnFacts((prev) => ({ ...prev, title: ewnTitle || prev.title, whatHappened, impact, requiredAction, evidence, location }));
    }

    async function loadLinkedEwn() {
      if (!ewnId) return;
      try {
        const supabase = supabaseBrowser();
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        let row: Record<string, unknown> | null = null;

        if (user) {
          const res = await (supabase as any).from("ewns")
            .select("id,title,project_id,project_name,main_contractor,contract_type,status,converted_event_id,event_date,location,what_happened,impact,required_action,evidence_summary,generated_output")
            .eq("id", ewnId)
            .eq("user_id", user.id)
            .maybeSingle();
          if (res.error) throw res.error;
          row = (res.data ?? null) as Record<string, unknown> | null;
        }

        if (!row) {
          row = readLocalEwns().find((item) => item.id === ewnId) ?? null;
        }
        if (!active || !row) return;

        const facts = factsFromEwnRow(row);
        setFromEwnConvertedEventId(textValue(row.converted_event_id) || null);
        if (textValue(row.project_id)) setProjectId(textValue(row.project_id));
        if (facts.title) {
          setTitle((prev) => prev || facts.title);
          setEwnFacts((prev) => ({ ...prev, title: facts.title }));
        }
        if (textValue(row.project_name)) setProjectName((prev) => prev || textValue(row.project_name));
        if (textValue(row.main_contractor)) setMainContractor((prev) => prev || textValue(row.main_contractor));
        const rowContractType = normalizeContractType(textValue(row.contract_type));
        if (rowContractType) setContractType(rowContractType);
        if (facts.eventDate) setEventDate((prev) => prev || facts.eventDate);
        setEwnFacts((prev) => ({
          title: facts.title || prev.title,
          whatHappened: facts.whatHappened || prev.whatHappened,
          impact: facts.impact || prev.impact,
          requiredAction: facts.requiredAction || prev.requiredAction,
          evidence: facts.evidence || prev.evidence,
          location: facts.location || prev.location,
          generatedNarrative: facts.generatedNarrative || prev.generatedNarrative,
        }));
      } catch (error) {
        if (active) setErr(errorMessage(error, "Failed to load linked EWN"));
      }
    }

    void loadLinkedEwn();
    return () => {
      active = false;
    };
  }, []);

  function handlePickedFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const next = Array.from(fileList);
    setFiles((prev) => {
      const existing = new Map(prev.map((f) => [`${f.name}_${f.size}`, f]));
      for (const f of next) {
        existing.set(`${f.name}_${f.size}`, f);
      }
      return Array.from(existing.values());
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function create() {
    setErr(null);
    setLoading(true);

    try {
      if (fromEwnConvertedEventId) {
        setErr("This EWN has already been converted. Open the existing CE instead of creating another one.");
        return;
      }
      if (requiresUploadedContract(contractType) && files.length === 0) {
        setContractSource("upload_contract");
        setErr("Upload the bespoke or unconfirmed contract before creating this CE so it does not use standard NEC/JCT wording.");
        return;
      }

      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();

      const user = data.session?.user;
      if (!user) {
        router.push("/login");
        return;
      }

      if (fromEwnId) {
        const latestEwn = await (supabase as any).from("ewns")
          .select("converted_event_id")
          .eq("id", fromEwnId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (latestEwn.error) throw latestEwn.error;
        const existingConvertedEventId = String(latestEwn.data?.converted_event_id || "");
        if (existingConvertedEventId) {
          router.push(`/app/event/${existingConvertedEventId}`);
          return;
        }
      }

      const cleanProjectName = projectName.trim();
      const cleanMainContractor = mainContractor.trim();
      let linkedProjectId = projectId;

      let projectRes = await (supabase as any).from("projects")
        .upsert(
          {
            id: linkedProjectId ?? undefined,
            user_id: user.id,
            project_name: cleanProjectName,
            main_contractor: cleanMainContractor,
            contract_type: contractType,
            trade_profile: "general",
            status: "live",
            updated_at: new Date().toISOString(),
          },
          { onConflict: linkedProjectId ? "id" : "user_id,project_name,main_contractor" }
        )
        .select("id")
        .single();
      if (projectRes.error && /trade_profile|schema cache|column|does not exist/i.test(String(projectRes.error.message || ""))) {
        projectRes = await (supabase as any).from("projects")
          .upsert(
            {
              id: linkedProjectId ?? undefined,
              user_id: user.id,
              project_name: cleanProjectName,
              main_contractor: cleanMainContractor,
              contract_type: contractType,
              status: "live",
              updated_at: new Date().toISOString(),
            },
            { onConflict: linkedProjectId ? "id" : "user_id,project_name,main_contractor" }
          )
          .select("id")
          .single();
      }
      if (projectRes.error) throw projectRes.error;
      linkedProjectId = (projectRes.data as any)?.id as string;
      setProjectId(linkedProjectId);

      let existingRefs = linkedProjectId
        ? await (supabase as any).from("events")
            .select("event_number,event_reference")
            .eq("user_id", user.id)
            .eq("project_id", linkedProjectId)
            .order("event_number", { ascending: false })
            .limit(1)
        : null;

      if (!existingRefs || existingRefs.error) {
        const canFallback = !existingRefs || /project_id|schema cache|column|does not exist/i.test(String(existingRefs.error?.message || ""));
        if (!canFallback && existingRefs.error) throw existingRefs.error;

        existingRefs = await (supabase as any).from("events")
          .select("event_number,event_reference")
          .eq("user_id", user.id)
          .eq("project_name", cleanProjectName)
          .eq("main_contractor", cleanMainContractor)
          .order("event_number", { ascending: false })
          .limit(1);
      }

      if (existingRefs.error) throw existingRefs.error;

      const existingNumbers = (existingRefs.data ?? [])
        .map((row: { event_number?: number | string | null }) => Number(row.event_number))
        .filter((value: number) => Number.isFinite(value));
      const nextEventNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      const eventReference = buildEventReference(contractType, nextEventNumber);

      const basePayload = {
        user_id: user.id,
        title: title.trim(),
        project_name: cleanProjectName,
        main_contractor: cleanMainContractor,
        status: "draft",
        contract_type: contractType,
        contract_source: requiresUploadedContract(contractType) ? "upload_contract" : contractSource,
        trade_profile: "general",
        event_number: nextEventNumber,
        event_reference: eventReference,
        project_id: linkedProjectId,
        ...(eventDate ? { event_date: eventDate } : {}),
      };

      let insertRes = await (supabase as any).from("events")
        .insert([
          {
            ...basePayload,
            notice_period_days: getDefaultNoticePeriodDays(contractType),
          },
        ])
        .select("id")
        .single();

      if (insertRes.error) {
        const message = String(insertRes.error.message || "");
        const optionalColumnMissing = /notice_period_days/i.test(message);
        const tradeProfileMissing = /trade_profile|schema cache|column|does not exist/i.test(message);
        if (!optionalColumnMissing && !tradeProfileMissing) throw insertRes.error;

        const { trade_profile: _tradeProfile, ...fallbackBasePayload } = basePayload;

        insertRes = await (supabase as any).from("events")
          .insert([fallbackBasePayload])
          .select("id")
          .single();
      }

      if (insertRes.error) throw insertRes.error;

      const eventId = (insertRes.data as any)?.id as string;

      if (fromEwnId) {
        const convertedAt = new Date().toISOString();
        const conversionUpdate = await (supabase as any).from("ewns")
          .update({ status: "converted", converted_event_id: eventId, converted_at: convertedAt })
          .eq("id", fromEwnId)
          .eq("user_id", user.id);
        if (conversionUpdate.error) throw conversionUpdate.error;
      }

      if ((contractSource === "upload_contract" || requiresUploadedContract(contractType)) && files.length > 0) {
        for (const file of files) {
          const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
          const filePath = `${user.id}/${eventId}/${Date.now()}-${safeName}`;

          const upload = await supabase.storage
            .from("contract-files")
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (upload.error) throw upload.error;

          const fileInsert = await (supabase as any).from("event_contract_files").insert({
            event_id: eventId,
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type || null,
          });

          if (fileInsert.error) throw fileInsert.error;
        }
      }

      if (fromEwnId) {
        const conversionFacts: EwnConversionFacts = {
          title: ewnFacts.title || title.trim(),
          whatHappened: ewnFacts.whatHappened,
          impact: ewnFacts.impact,
          requiredAction: ewnFacts.requiredAction,
          evidence: ewnFacts.evidence,
          location: ewnFacts.location,
          eventDate,
          generatedNarrative: ewnFacts.generatedNarrative,
        };
        const happenedSummary = buildEwnBasisText(conversionFacts);

        const causeSummary = ewnFacts.impact
          ? `Potential impact identified in the linked EWN: ${ewnFacts.impact}`
          : "Impact carried forward from the linked EWN. Review and expand before submission.";
        const mitigationSummary = ewnFacts.requiredAction
          ? `Required action / mitigation identified in the linked EWN: ${ewnFacts.requiredAction}`
          : "Required action carried forward from the linked EWN. Review and expand before submission.";
        const differenceFromPlan = buildEwnDifferenceText(conversionFacts);

        if (happenedSummary || ewnFacts.impact || ewnFacts.requiredAction || ewnFacts.evidence) {
          const basisCarryOver = await (supabase as any).from("event_basis").upsert(
            {
              event_id: eventId,
              happened_summary: happenedSummary,
              cause_type: "other",
              cause_summary: causeSummary,
              difference_from_plan: differenceFromPlan,
              mechanism_tags: [],
              time_impact_toggle: ewnFacts.impact ? "unsure" : "unsure",
              mitigation_summary: mitigationSummary,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "event_id" }
          );
          if (basisCarryOver.error) throw basisCarryOver.error;
        }

        const actionInsert = await (supabase as any).from("event_actions")
          .insert({
            event_id: eventId,
            user_id: user.id,
            action_type: "ewn_converted",
            action_date: new Date().toISOString().slice(0, 10),
            notes: `Created from EWN${conversionFacts.title ? `: ${conversionFacts.title}` : ""}`,
            metadata: {
              ewn_id: fromEwnId,
              ewn_title: conversionFacts.title || null,
              ewn_event_date: conversionFacts.eventDate,
            },
          });
        if (actionInsert.error) {
          console.warn("EWN conversion action log skipped", actionInsert.error.message);
        }

        try {
          const raw = localStorage.getItem("cc.ewns");
          const parsed = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed)) {
            const convertedAt = new Date().toISOString();
            localStorage.setItem(
              "cc.ewns",
              JSON.stringify(
                parsed.map((item: Record<string, unknown>) =>
                  item.id === fromEwnId
                    ? { ...item, status: "converted", converted_event_id: eventId, converted_at: convertedAt }
                    : item
                )
              )
            );
          }
        } catch {}
      }

      void trackAnalyticsWithUser(supabase, fromEwnId ? "ewn_converted_to_ce" : "ce_created", {
        event_id: eventId,
        project_id: linkedProjectId,
        contract_type: contractType,
        contract_source: requiresUploadedContract(contractType) ? "upload_contract" : contractSource,
        trade_profile: "general",
        from_ewn: Boolean(fromEwnId),
        uploaded_contract_files: (contractSource === "upload_contract" || requiresUploadedContract(contractType)) ? files.length : 0,
      });

      router.push(`/app/event/${eventId}`);
    } catch (e: unknown) {
      setErr(errorMessage(e, "Failed to create CE draft"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="app-form-with-rail" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 16, alignItems: "start" }}>
    <div
      style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: 18,
        padding: 22,
        boxShadow: "0 10px 30px rgba(15,23,42,.045)",
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 22 }}>
        <div
          aria-hidden
          style={{
            width: 54,
            height: 54,
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            background: "rgba(109, 74, 255, 0.1)",
            color: "#6d4aff",
            fontSize: 24,
            fontWeight: 900,
            flexShrink: 0,
          }}
        >
          +
        </div>
        <div>
          <h1 style={{ margin: 0, color: c.black, fontSize: 28, lineHeight: 1.08, fontWeight: 850 }}>
            New CE
          </h1>
          <p style={{ margin: "8px 0 0", color: c.sub, fontSize: 14, lineHeight: 1.5 }}>
            Create a new compensation event or variation and connect it to the right project, contractor and contract basis.
          </p>
        </div>
      </div>

      <CEProgress eventId="new" currentStep="setup" />

      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          margin: 0,
          color: c.black,
        }}
      >
        1. New CE
      </h1>

      <p
        style={{
          marginTop: 8,
          marginBottom: 0,
          color: c.sub,
          fontSize: 13,
          lineHeight: 1.55,
          maxWidth: 760,
        }}
      >
        Set the CE up correctly before moving into Basis of Change, evidence and valuation build-up.
      </p>

      {fromEwnId ? (
        <div
          style={{
            marginTop: 18,
            border: `1px solid ${fromEwnConvertedEventId ? c.redBorder : c.amberBorder}`,
            background: fromEwnConvertedEventId ? c.redBg : c.amberBg,
            color: fromEwnConvertedEventId ? c.redText : c.amberText,
            borderRadius: 14,
            padding: 12,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {fromEwnConvertedEventId ? (
            <>
              This EWN is already linked to a CE. Use the existing record to avoid duplicate recovery items.{" "}
              <a href={`/app/event/${fromEwnConvertedEventId}`} style={{ color: "inherit", fontWeight: 900 }}>
                Open linked CE →
              </a>
            </>
          ) : (
            "This CE has been started from an EWN. Review the title, project and contract basis before creating the draft."
          )}
        </div>
      ) : null}

      {fromEwnId && (ewnFacts.whatHappened || ewnFacts.impact || ewnFacts.requiredAction || ewnFacts.evidence || ewnFacts.generatedNarrative) ? (
        <div
          style={{
            marginTop: 14,
            border: `1px solid ${c.border}`,
            background: c.soft,
            borderRadius: 14,
            padding: 14,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: c.sub, textTransform: "uppercase", letterSpacing: 0.5 }}>EWN conversion pack</div>
              <div style={{ marginTop: 4, color: c.black, fontSize: 15, lineHeight: 1.35, fontWeight: 800 }}>
                {ewnFacts.title || title || "Linked EWN"}
              </div>
            </div>
            {eventDate ? (
              <div style={{ border: `1px solid ${c.border}`, background: c.input, borderRadius: 999, padding: "7px 10px", color: c.sub, fontSize: 12, fontWeight: 800 }}>
                EWN date {eventDate}
              </div>
            ) : null}
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <section style={{ border: `1px solid ${c.border}`, background: c.input, borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: c.sub, marginBottom: 6 }}>Basis carried forward</div>
              <p style={{ margin: 0, color: c.black, fontSize: 13, lineHeight: 1.55 }}>{ewnFacts.whatHappened || "No EWN basis text recorded."}</p>
              {ewnFacts.location ? <p style={{ margin: "6px 0 0", color: c.sub, fontSize: 12, lineHeight: 1.45 }}>Location: {ewnFacts.location}</p> : null}
            </section>
            <section style={{ border: `1px solid ${c.border}`, background: c.input, borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: c.sub, marginBottom: 6 }}>Commercial follow-up</div>
              {ewnFacts.impact ? <p style={{ margin: 0, color: c.black, fontSize: 13, lineHeight: 1.55 }}>Impact: {ewnFacts.impact}</p> : null}
              {ewnFacts.requiredAction ? <p style={{ margin: "6px 0 0", color: c.black, fontSize: 13, lineHeight: 1.55 }}>Required action: {ewnFacts.requiredAction}</p> : null}
              {!ewnFacts.impact && !ewnFacts.requiredAction ? <p style={{ margin: 0, color: c.black, fontSize: 13, lineHeight: 1.55 }}>Impact and required action need confirming during CE basis review.</p> : null}
            </section>
          </div>
          {ewnFacts.evidence || ewnFacts.generatedNarrative ? (
            <div style={{ border: `1px solid ${c.border}`, background: c.input, borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: c.sub, marginBottom: 6 }}>Records retained for CE review</div>
              {ewnFacts.evidence ? <p style={{ margin: 0, color: c.black, fontSize: 13, lineHeight: 1.55 }}>{ewnFacts.evidence}</p> : null}
              {ewnFacts.generatedNarrative ? <p style={{ margin: ewnFacts.evidence ? "8px 0 0" : 0, color: c.sub, fontSize: 12, lineHeight: 1.55 }}>Original EWN narrative will be retained inside the CE basis notes for review.</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <Label>CE title</Label>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Flooding at ST43"
          />
        </label>

        <div style={FIELD_GRID_STYLE}>
          <label style={{ display: "grid", gap: 6 }}>
            <Label>Project / job</Label>
            <datalist id="existing-projects">
              {projectOptions.map((option) => (
                <option key={option.id} value={option.project_name} label={projectOptionLabel(option)} />
              ))}
            </datalist>
            <TextInput
              list="existing-projects"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                if (projectId) setProjectId(null);
                applyProjectOption(e.target.value);
              }}
              onBlur={(e) => applyProjectOption(e.target.value)}
              placeholder="e.g. A428 Black Cat to Caxton Gibbet"
            />
            <span style={{ color: c.sub, fontSize: 12, lineHeight: 1.45 }}>
              Choose an existing project or type a new one.
            </span>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <Label>Main contractor</Label>
            <TextInput
              value={mainContractor}
              onChange={(e) => setMainContractor(e.target.value)}
              placeholder="e.g. Main contractor"
            />
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              contractSource === "upload_contract"
                ? "minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1.6fr)"
                : "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 14,
            alignItems: "start",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <Label>Contract type</Label>
            <SelectInput
              value={contractType}
              onChange={(e) => {
                const value = e.target.value as ContractType;
                setContractType(value);
                if (requiresUploadedContract(value)) setContractSource("upload_contract");
              }}
            >
              {CONTRACT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <Label>Contract source</Label>
            <SelectInput
              value={contractSource}
              disabled={requiresUploadedContract(contractType)}
              onChange={(e) => {
                const value = e.target.value as ContractSource;
                setContractSource(value);
                if (value === "standard_logic") {
                  setFiles([]);
                }
              }}
            >
              {CONTRACT_SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </label>

          {contractSource === "upload_contract" ? (
            <div style={{ display: "grid", gap: 6 }}>
              <Label>Contract documents</Label>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => handlePickedFiles(e.target.files)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              />

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handlePickedFiles(e.dataTransfer.files);
                }}
                style={{
                  border: `1px dashed ${c.border}`,
                  background: c.soft,
                  borderRadius: 14,
                  padding: 12,
                  minHeight: 50,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontSize: 12, color: c.sub, lineHeight: 1.4 }}>
                    Upload subcontract agreement, Z clauses, amendments, scope extracts or other
                    contract documents.
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: `1px solid ${c.black}`,
                      background: c.black,
                      color: c.blackContrast,
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Upload files
                  </button>
                </div>

                {files.length > 0 ? (
                  <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    {files.map((file, index) => (
                      <div
                        key={`${file.name}_${file.size}_${index}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: `1px solid ${c.border}`,
                          background: c.input,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: c.black,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {file.name}
                          </div>
                          <div style={{ fontSize: 12, color: c.sub }}>
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          style={{
                            border: `1px solid ${c.border}`,
                            background: c.input,
                            borderRadius: 10,
                            padding: "8px 10px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            marginTop: 12,
            border: `1px solid ${c.border}`,
            background: c.soft,
            borderRadius: 14,
            padding: 12,
            fontSize: 12,
            color: c.sub,
            lineHeight: 1.5,
          }}
        >
          {getContractFamilyHint(contractType)}
        </div>

        <div
          style={{
            border: `1px solid ${c.border}`,
            background: c.soft,
            borderRadius: 14,
            padding: 14,
            fontSize: 12,
            color: c.sub,
            lineHeight: 1.5,
          }}
        >
          {contractSource === "standard_logic" ? (
            <>
              The CE will start from the standard clause structure for the selected contract type.
              This is best where the contract generally follows the standard NEC wording and there are
              no major bespoke amendments.
            </>
          ) : (
            <>
              Uploaded contract documents will be attached to the CE so later AI drafting can review
              amended clauses, notice requirements, risk allocation, Defined Cost changes, fee changes
              and programme obligations.
            </>
          )}
        </div>

        {err ? (
          <div
            style={{
              border: `1px solid ${c.redBorder}`,
              background: c.redBg,
              color: c.redText,
              padding: 12,
              borderRadius: 14,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {err}
          </div>
        ) : null}

        <button
          onClick={create}
          disabled={!canCreate}
          style={{
            padding: "12px 14px",
            borderRadius: 14,
            border: `1px solid ${c.black}`,
            background: c.black,
            color: c.blackContrast,
            fontWeight: 700,
            cursor: !canCreate ? "not-allowed" : "pointer",
            opacity: !canCreate ? 0.6 : 1,
          }}
        >
          {loading ? "Creating…" : fromEwnId ? "Create CE from EWN" : "Create draft"}
        </button>
      </div>
    </div>
    <aside style={{ display: "grid", gap: 14, position: "sticky", top: 92 }}>
      <AppSideCard title="Commercial Readiness" tone="purple" icon="◎">
        <div style={{ display: "grid", placeItems: "center", marginBottom: 12 }}><RingProgress value={0} tone="purple" label="Just started" size={112} /></div>
        <div style={{ display: "grid", gap: 9 }}>
          <span style={{ display: "flex", justifyContent: "space-between" }}>Narrative <strong>0%</strong></span>
          <span style={{ display: "flex", justifyContent: "space-between" }}>Dates <strong>0%</strong></span>
          <span style={{ display: "flex", justifyContent: "space-between" }}>Notice risk <strong>0%</strong></span>
          <span style={{ display: "flex", justifyContent: "space-between" }}>Evidence <strong>0%</strong></span>
          <span style={{ display: "flex", justifyContent: "space-between" }}>Resources <strong>0%</strong></span>
        </div>
      </AppSideCard>
      <AppSideCard title="Commercial Coach" tone="purple" icon="i">
        Start with a clear event title and the correct project and contract. These choices control the later notice, entitlement and valuation checks.
      </AppSideCard>
      <AppSideCard title="What's next?" tone="blue" icon="→">
        Create the draft, then complete the event basis before uploading evidence and building the cost support.
      </AppSideCard>
    </aside>
    </div>
    </div>
  );
}
