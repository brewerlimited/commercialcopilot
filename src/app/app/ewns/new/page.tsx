"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CONTRACT_TYPE_OPTIONS, getContractLabel } from "@/lib/contracts";

const c = {
  card: "var(--surface)",
  input: "var(--surface-input)",
  border: "var(--border)",
  sub: "var(--text-muted)",
  text: "var(--foreground)",
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
  soft: "var(--surface-soft)",
  amberBg: "var(--amber-bg)",
  amberBorder: "var(--amber-border)",
  amberText: "var(--amber-text)",
  greenBg: "var(--green-bg)",
  greenBorder: "var(--green-border)",
  greenText: "var(--green-text)",
  redBg: "var(--red-bg)",
  redBorder: "var(--red-border)",
  redText: "var(--red-text)",
};

type GeneratedEwn = {
  narrative: string;
  consequences: string[];
  mitigation: string[];
};

type LocalEwnRow = {
  id: string;
  project_id: string | null;
  title: string;
  project_name: string;
  main_contractor: string;
  contract_type: string;
  what_happened: string;
  event_date: string | null;
  location: string;
  impact: string;
  required_action: string;
  evidence_summary: string;
  generated_output: GeneratedEwn;
  status: "open";
  created_at: string;
};

type ProjectOption = {
  id: string;
  project_name: string;
  main_contractor: string | null;
  contract_type: string | null;
};

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontWeight: 700, fontSize: 12, color: c.sub }}>{children}</span>;
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
        lineHeight: 1.5,
        fontFamily: "inherit",
        ...(props.style ?? {}),
      }}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        minHeight: 112,
        padding: "12px 12px",
        borderRadius: 14,
        border: `1px solid ${c.border}`,
        outline: "none",
        resize: "vertical",
        background: c.input,
        color: c.black,
        fontSize: 14,
        lineHeight: 1.55,
        fontFamily: "inherit",
        ...(props.style ?? {}),
      }}
    />
  );
}

function makeGeneratedEwn(input: {
  title: string;
  whatHappened: string;
  when: string;
  where: string;
  impact: string;
  requiredAction: string;
  evidence: string;
}): GeneratedEwn {
  const issue = input.whatHappened.trim() || input.title.trim() || "the matter identified on site";
  const locationText = input.where.trim() ? ` at ${input.where.trim()}` : "";
  const dateText = input.when.trim() ? ` on ${input.when.trim()}` : "";
  const impactText = input.impact.trim() || "the matter may affect progress, productivity and the commercial position of the Subcontract Works";
  const actionText = input.requiredAction.trim() || "confirmation of the required way forward";
  const evidenceText = input.evidence.trim() || "site records, photographs, allocation sheets, correspondence and associated records";

  return {
    narrative: [
      `During the progression of the Subcontract Works, the Subcontractor has identified ${issue}${locationText}${dateText}.`,
      `The matter requires review as it may affect the planned method, sequence, productivity and/or safe delivery of the works. Based on the current information, the known impact is ${impactText}.`,
      `The Subcontractor requires ${actionText} so that the matter can be reviewed, mitigated and progressed without avoidable delay.`,
      "As it stands, there is a risk that the works cannot proceed as planned and that further time and/or cost impact may arise if the matter is not resolved within a reasonable timeframe.",
      `Supporting records currently include ${evidenceText}.`,
    ].join("\n\n"),
    consequences: [
      impactText,
      "Possible disruption to planned sequence, productivity and programme if the matter is not resolved promptly.",
      "Potential requirement for further commercial notification should the matter result in a recoverable change or impact.",
    ],
    mitigation: [
      `The Subcontractor requires ${actionText} from the Contractor/design team as soon as reasonably practicable.`,
      "The Subcontractor will continue to maintain records of labour, plant, materials, site constraints, correspondence and instructions relating to the matter.",
      "Where practical, the Subcontractor will seek to mitigate delay and disruption without waiving entitlement to recover any resulting time or cost impact.",
    ],
  };
}

function readLocalEwns(): LocalEwnRow[] {
  try {
    const raw = localStorage.getItem("cc.ewns");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalEwn(row: LocalEwnRow) {
  const existing = readLocalEwns().filter((item) => item.id !== row.id);
  localStorage.setItem("cc.ewns", JSON.stringify([row, ...existing]));
}

export default function NewEwnPage() {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [mainContractor, setMainContractor] = useState("");
  const [contractType, setContractType] = useState("NEC4");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [whatHappened, setWhatHappened] = useState("");
  const [when, setWhen] = useState("");
  const [where, setWhere] = useState("");
  const [impact, setImpact] = useState("");
  const [requiredAction, setRequiredAction] = useState("");
  const [evidence, setEvidence] = useState("");
  const [generated, setGenerated] = useState<GeneratedEwn | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canGenerate = useMemo(() => title.trim() && whatHappened.trim() && !saving, [title, whatHappened, saving]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextProjectId = params.get("project_id");
    const project = params.get("project");
    const contractor = params.get("main_contractor");
    const contract = params.get("contract_type");
    if (nextProjectId) setProjectId(nextProjectId);
    if (project) setProjectName((prev) => prev || project);
    if (contractor) setMainContractor((prev) => prev || contractor);
    if (contract) setContractType((prev) => prev || contract);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadProjects() {
      try {
        const supabase = supabaseBrowser();
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id;
        if (!userId) {
          if (!cancelled) setProjects([]);
          return;
        }

        const res = await (supabase as any).from("projects")
          .select("id,project_name,main_contractor,contract_type")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });

        if (res.error) throw res.error;
        if (!cancelled) setProjects((res.data ?? []) as ProjectOption[]);
      } catch {
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    }

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  function selectProject(nextProjectId: string) {
    if (!nextProjectId) {
      setProjectId(null);
      return;
    }

    const project = projects.find((item) => item.id === nextProjectId);
    if (!project) return;

    setProjectId(project.id);
    setProjectName(project.project_name);
    setMainContractor(project.main_contractor ?? "");
    if (project.contract_type) setContractType(project.contract_type);
  }

  function updateProjectName(value: string) {
    setProjectName(value);
    setProjectId(null);
  }

  function updateMainContractor(value: string) {
    setMainContractor(value);
    setProjectId(null);
  }

  async function generateAndSave() {
    setErr(null);
    setSaving(true);
    try {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (token) {
        const res = await fetch("/api/generate-ewn", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: savedId,
            projectId,
            title,
            projectName,
            mainContractor,
            contractType,
            whatHappened,
            when,
            where,
            impact,
            requiredAction,
            evidence,
          }),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || "Failed to generate EWN");

        setGenerated(payload.generated_output as GeneratedEwn);
        setSavedId(payload.id as string);
        if (payload.project_id) setProjectId(payload.project_id as string);
        return;
      }

      const output = makeGeneratedEwn({ title, whatHappened, when, where, impact, requiredAction, evidence });
      setGenerated(output);

      const row = {
        id: savedId || crypto.randomUUID(),
        project_id: projectId,
        title: title.trim(),
        project_name: projectName.trim(),
        main_contractor: mainContractor.trim(),
        contract_type: contractType,
        what_happened: whatHappened.trim(),
        event_date: when || null,
        location: where.trim(),
        impact: impact.trim(),
        required_action: requiredAction.trim(),
        evidence_summary: evidence.trim(),
        generated_output: output,
        status: "open" as const,
        created_at: new Date().toISOString(),
      };

      saveLocalEwn(row);
      setSavedId(row.id);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to generate EWN");
    } finally {
      setSaving(false);
    }
  }

  function convertHref() {
    const params = new URLSearchParams();
    if (savedId) params.set("from_ewn", savedId);
    if (projectId) params.set("project_id", projectId);
    params.set("title", title.trim());
    if (projectName.trim()) params.set("project", projectName.trim());
    if (mainContractor.trim()) params.set("main_contractor", mainContractor.trim());
    if (contractType.trim()) params.set("contract_type", contractType.trim());
    if (whatHappened.trim()) params.set("what_happened", whatHappened.trim());
    if (impact.trim()) params.set("impact", impact.trim());
    if (requiredAction.trim()) params.set("required_action", requiredAction.trim());
    if (evidence.trim()) params.set("evidence", evidence.trim());
    if (where.trim()) params.set("location", where.trim());
    if (when) params.set("event_date", when);
    return `/app/new?${params.toString()}`;
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: c.sub, textTransform: "uppercase", letterSpacing: 0.6 }}>Early Warning Notice</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: "6px 0 0", color: c.black }}>New EWN</h1>
            <p style={{ margin: "8px 0 0", color: c.sub, fontSize: 13, lineHeight: 1.55, maxWidth: 780 }}>
              Log the issue quickly, generate a clean early warning narrative, then convert it into a CE if the commercial impact develops.
            </p>
          </div>
          <Link href="/app/ewns" style={{ border: `1px solid ${c.border}`, background: c.soft, color: c.black, borderRadius: 14, padding: "11px 13px", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
            View EWN register
          </Link>
        </div>

        <div style={{ display: "grid", gap: 16, marginTop: 22 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <Label>EWN title</Label>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Existing services clash at Newlay" />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <Label>Use existing project</Label>
            <SelectInput value={projectId ?? ""} onChange={(e) => selectProject(e.target.value)} disabled={projectsLoading || projects.length === 0}>
              <option value="">{projectsLoading ? "Loading projects..." : projects.length === 0 ? "No saved projects yet - type a new one below" : "Type a new project or choose existing..."}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.project_name}{project.main_contractor ? ` - ${project.main_contractor}` : ""}
                </option>
              ))}
            </SelectInput>
            <span style={{ color: c.sub, fontSize: 12, fontWeight: 650 }}>
              Pick a saved project, or type a new project below. New projects are added to Projects when the EWN is generated.
            </span>
          </label>

          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <Label>Project / job</Label>
              <TextInput value={projectName} onChange={(e) => updateProjectName(e.target.value)} placeholder="e.g. Calder Road" />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <Label>Main contractor</Label>
              <TextInput value={mainContractor} onChange={(e) => updateMainContractor(e.target.value)} placeholder="e.g. BAM Nuttall" />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <Label>Contract type</Label>
            <SelectInput value={contractType} onChange={(e) => setContractType(e.target.value)}>
              {contractType && !CONTRACT_TYPE_OPTIONS.some((option) => option.value === contractType) && !["NEC4", "NEC3", "JCT", "Bespoke"].includes(contractType) ? (
                <option value={contractType}>{getContractLabel(contractType)}</option>
              ) : null}
              {CONTRACT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
              <option value="NEC4">NEC4</option>
              <option value="NEC3">NEC3</option>
              <option value="JCT">JCT</option>
              <option value="Bespoke">Bespoke</option>
            </SelectInput>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <Label>What happened</Label>
            <TextArea value={whatHappened} onChange={(e) => setWhatHappened(e.target.value)} placeholder="Describe the issue in plain site language." />
          </label>

          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <Label>When</Label>
              <TextInput type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <Label>Where</Label>
              <TextInput value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Location, chainage, phase or work area" />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <Label>Impact</Label>
            <TextArea value={impact} onChange={(e) => setImpact(e.target.value)} placeholder="Delay, disruption, resequencing, standing time, extra supervision, restricted working etc." />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <Label>Required action</Label>
            <TextArea value={requiredAction} onChange={(e) => setRequiredAction(e.target.value)} placeholder="What confirmation, instruction, design response or access is required?" />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <Label>Evidence</Label>
            <TextArea value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Photos, diaries, allocation sheets, correspondence, drawings, instructions etc." />
          </label>

          {err ? <div style={{ border: `1px solid ${c.redBorder}`, background: c.redBg, color: c.redText, padding: 12, borderRadius: 14, fontSize: 13, fontWeight: 700 }}>{err}</div> : null}

          <button onClick={generateAndSave} disabled={!canGenerate} style={{ padding: "12px 14px", borderRadius: 14, border: `1px solid ${c.black}`, background: c.black, color: c.blackContrast, fontWeight: 700, cursor: !canGenerate ? "not-allowed" : "pointer", opacity: !canGenerate ? 0.6 : 1 }}>
            {saving ? "Generating…" : savedId ? "Regenerate EWN" : "Generate EWN"}
          </button>
        </div>
      </div>

      {generated ? (
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 28, display: "grid", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: c.black }}>Generated EWN output</h2>
              <p style={{ margin: "6px 0 0", color: c.sub, fontSize: 13 }}>Keep the notice clean, factual and commercially useful.</p>
            </div>
            <Link href={convertHref()} style={{ border: `1px solid ${c.black}`, background: c.black, color: c.blackContrast, borderRadius: 14, padding: "12px 14px", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
              Convert to CE →
            </Link>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <section style={{ border: `1px solid ${c.border}`, background: c.soft, borderRadius: 18, padding: 16 }}>
              <div style={{ fontSize: 12, color: c.sub, fontWeight: 800, marginBottom: 8 }}>Narrative</div>
              <p style={{ margin: 0, color: c.black, fontSize: 14, lineHeight: 1.65 }}>{generated.narrative}</p>
            </section>
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <section style={{ border: `1px solid ${c.border}`, background: c.soft, borderRadius: 18, padding: 16 }}>
                <div style={{ fontSize: 12, color: c.sub, fontWeight: 800, marginBottom: 8 }}>Consequences</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: c.black, fontSize: 14, lineHeight: 1.65 }}>{generated.consequences.map((x) => <li key={x}>{x}</li>)}</ul>
              </section>
              <section style={{ border: `1px solid ${c.border}`, background: c.soft, borderRadius: 18, padding: 16 }}>
                <div style={{ fontSize: 12, color: c.sub, fontWeight: 800, marginBottom: 8 }}>Mitigation</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: c.black, fontSize: 14, lineHeight: 1.65 }}>{generated.mitigation.map((x) => <li key={x}>{x}</li>)}</ul>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
