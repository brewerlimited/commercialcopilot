"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CONTRACT_TYPE_OPTIONS, type KnownContractType } from "@/lib/contracts";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";

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
  redBd: "var(--red-border)",
  redTx: "var(--red-text)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={{ color: c.sub, fontSize: 12, fontWeight: 700 }}>{label}</span>
      {children}
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return { width: "100%", border: `1px solid ${c.border}`, background: c.input, color: c.text, borderRadius: 14, padding: "12px 13px", fontWeight: 700, fontFamily: "inherit" };
}

export default function NewProjectPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [mainContractor, setMainContractor] = useState("");
  const [contractType, setContractType] = useState<KnownContractType>("nec4_ecs_option_b");
  const [status, setStatus] = useState("live");
  const [jobNumber, setJobNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [projectManager, setProjectManager] = useState("");
  const [quantitySurveyor, setQuantitySurveyor] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const cleanProjectName = projectName.trim();
      if (!cleanProjectName) {
        setErr("Project name is required.");
        return;
      }
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      const payload = {
        user_id: user.id,
        project_name: cleanProjectName,
        main_contractor: mainContractor.trim(),
        contract_type: contractType,
        status,
        job_number: jobNumber.trim() || null,
        start_date: startDate || null,
        completion_date: completionDate || null,
        project_manager: projectManager.trim() || null,
        quantity_surveyor: quantitySurveyor.trim() || null,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const res = await (supabase as any).from("projects")
        .upsert(payload, { onConflict: "user_id,project_name,main_contractor" })
        .select("id")
        .single();
      if (res.error) throw res.error;
      router.push(`/app/projects/${(res.data as any)?.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save project";
      if (isAuthErrorMessage(message)) {
        router.push("/login");
        return;
      }
      setErr(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 26 }}>
        <Link href="/app/projects" style={{ color: c.sub, fontSize: 13, fontWeight: 800, textDecoration: "none" }}>← Projects</Link>
        <h1 style={{ margin: "8px 0 0", color: c.black, fontSize: 26 }}>New Project</h1>
        <p style={{ margin: "8px 0 0", color: c.sub, fontSize: 13, lineHeight: 1.55, maxWidth: 760 }}>Create the project once, then raise CEs, EWNs and project rate cards against a stable project record.</p>
      </section>

      <section style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 22, padding: 22, display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Project / job name">
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} style={inputStyle()} placeholder="e.g. Westgate Residential Block C" />
          </Field>
          <Field label="Main contractor">
            <input value={mainContractor} onChange={(e) => setMainContractor(e.target.value)} style={inputStyle()} placeholder="e.g. Harwood Developments" />
          </Field>
          <Field label="Contract type">
            <select value={contractType} onChange={(e) => setContractType(e.target.value as KnownContractType)} style={inputStyle()}>
              {CONTRACT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle()}>
              <option value="live">Live</option>
              <option value="dormant">Dormant</option>
              <option value="defects">Defects</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
          <Field label="Job number">
            <input value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} style={inputStyle()} />
          </Field>
          <Field label="Project manager">
            <input value={projectManager} onChange={(e) => setProjectManager(e.target.value)} style={inputStyle()} />
          </Field>
          <Field label="Quantity surveyor">
            <input value={quantitySurveyor} onChange={(e) => setQuantitySurveyor(e.target.value)} style={inputStyle()} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Start date">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle()} />
            </Field>
            <Field label="Completion date">
              <input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} style={inputStyle()} />
            </Field>
          </div>
        </div>

        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} style={{ ...inputStyle(), resize: "vertical" }} />
        </Field>

        {err ? <div style={{ border: `1px solid ${c.redBd}`, background: c.redBg, color: c.redTx, borderRadius: 14, padding: 12, fontWeight: 800 }}>{err}</div> : null}

        <button onClick={save} disabled={saving} style={{ border: `1px solid ${c.black}`, background: c.black, color: c.blackContrast, borderRadius: 14, padding: "12px 14px", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.65 : 1 }}>
          {saving ? "Saving..." : "Create project"}
        </button>
      </section>
    </div>
  );
}
