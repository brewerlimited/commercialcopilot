"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getContractLabel } from "@/lib/contracts";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";
import { COMMON_IMPORT_LIBRARY, getResourceLibrary } from "@/lib/resourceLibrary";
import { AppPageHeader, MetricCard } from "@/components/appUi";

type Category = "labour" | "plant" | "materials";
type SourceType = "custom" | "ceca";

type RateCard = {
  id: string;
  user_id: string;
  category: Category;
  name: string;
  unit: string;
  rate: number;
  notes: string | null;
  active: boolean;
  project_name?: string | null;
  main_contractor?: string | null;
  source_type?: SourceType | null;
  ceca_item_id?: string | null;
  ceca_rate?: number | null;
  adjustment_percent?: number | null;
  final_rate?: number | null;
  created_at?: string;
  updated_at?: string;
};

type ProjectOption = {
  key: string;
  project_name: string;
  main_contractor: string;
  contract_type?: string | null;
};

type ProjectRateSettings = {
  id?: string;
  project_name: string;
  main_contractor: string;
  ceca_adjustment_percent: number;
  use_ceca_for_plant: boolean;
};

type CecaPlantRate = {
  id: string;
  section_name: string;
  item_name: string;
  capacity_text: string | null;
  hire_unit: string;
  ceca_rate: number;
  year: number;
  search_aliases?: string | null;
};

const c = {
  bg: "var(--background)",
  card: "var(--surface)",
  input: "var(--surface-input)",
  border: "var(--border)",
  text: "var(--foreground)",
  sub: "var(--text-muted)",
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
  purple: "var(--purple, #6d4aff)",
  purpleSoft: "var(--purple-soft, #f3efff)",
  purpleBorder: "var(--purple-border, #ddd4ff)",
  soft: "var(--surface-soft)",
  activeBg: "var(--active-bg)",
  redBg: "var(--red-bg)",
  redBd: "var(--red-border)",
  redTx: "var(--red-text)",
  greenBg: "var(--green-bg)",
  greenBd: "var(--green-border)",
  greenTx: "var(--green-text)",
};

const CATEGORY_TABS: { key: Category; label: string; hint: string }[] = [
  { key: "labour", label: "Labour", hint: "Operatives and supervision rates used in deterministic pricing." },
  { key: "plant", label: "Plant", hint: "Machines, attachments, wagons and tools." },
  { key: "materials", label: "Materials", hint: "Supply items used in resource build-ups." },
];

const UNITS = ["hour", "day", "week", "each", "m", "m2", "m3", "t", "kg", "l"] as const;

function money(n: number) {
  if (!isFinite(n)) return "£0.00";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function cleanNumber(v: string) {
  const x = Number(String(v).replace(/[^\d.-]/g, ""));
  return isFinite(x) ? x : 0;
}

function cleanSignedNumber(v: string) {
  const x = Number(String(v).replace(/[^\d.-]/g, ""));
  return isFinite(x) ? x : 0;
}

function contractLabel(v?: string | null) {
  return getContractLabel(v);
}

function projectDisplay(project?: string | null, contractor?: string | null) {
  const p = project?.trim();
  const mc = contractor?.trim();
  if (p && mc) return `${p} — ${mc}`;
  if (p) return p;
  if (mc) return mc;
  return "Select a project";
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? c.purpleBorder : c.border}`,
        background: active ? c.purpleSoft : c.input,
        color: active ? c.purple : c.black,
        fontSize: 14,
        lineHeight: 1.2,
        fontWeight: 650,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={{ fontSize: 13, fontWeight: 650, color: c.text, letterSpacing: -0.1 }}>{label}</span>
      {children}
      {hint ? <span style={{ fontSize: 12, fontWeight: 550, color: c.sub, lineHeight: 1.5 }}>{hint}</span> : null}
    </label>
  );
}

function calcAdjustedRate(base: number, adjustment: number) {
  return Math.max(0, base * (1 + adjustment / 100));
}

function formatAdjustment(v: number) {
  return `${v > 0 ? "+" : ""}${v}%`;
}

function cecaLabel(item?: CecaPlantRate | null) {
  if (!item) return "";
  const capacity = item.capacity_text?.trim();
  return capacity ? `${item.item_name} — ${capacity}` : item.item_name;
}

function shortenCecaText(value?: string | null, maxLength = 74) {
  let text = String(value ?? "")
    .replace(/^-\s*/g, "")
    .replace(/^continued\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  text = text
    .split(/\.\s*Capacity\b/i)[0]
    .split(/\s+Capacity\s*\(/i)[0]
    .split(/\s+Capacity\s+is\b/i)[0]
    .split(/\s+complete with\b/i)[0]
    .trim();

  if (text.includes(" - (") && text.length > 50) {
    text = text.split(" - (")[0].trim();
  }

  text = text.replace(/\s+-\s*$/g, "").replace(/[.:\s]+$/g, "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function cecaDisplayName(item?: CecaPlantRate | null) {
  if (!item) return "";
  const itemName = shortenCecaText(item.item_name);
  const capacity = shortenCecaText(item.capacity_text, 44);
  return capacity ? `${itemName} - ${capacity}` : itemName;
}

function cecaFullSourceNote(item: CecaPlantRate, baseRate: number, unit: string) {
  return `CECA 2025 source: ${cecaLabel(item)}. Base rate ${money(baseRate)}/${unit}.`;
}

function normaliseCecaSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/tonnes?|tons?/g, "t")
    .replace(/\b(\d+(?:\.\d+)?)\s*t\b/g, (_, n) => `${Number(n).toString()}t`)
    .replace(/\b360\b/g, "excavator")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function capacityTonnes(capacity?: string | null) {
  const match = capacity?.match(/up to\s+(\d+(?:\.\d+)?)\s*tonnes?/i);
  return match ? Number(match[1]) : null;
}

function queryTonnes(query: string) {
  const match = query.match(/\b(\d+(?:\.\d+)?)\s*t\b/);
  return match ? Number(match[1]) : null;
}

function capacityRank(item: CecaPlantRate, queryTonnage: number | null) {
  const tonnes = capacityTonnes(item.capacity_text);
  if (!tonnes || !queryTonnage) return 0;
  if (tonnes >= queryTonnage) return 100 - Math.abs(tonnes - queryTonnage);
  return 25 - Math.abs(tonnes - queryTonnage);
}

function formatTonnageAlias(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.0$/, "");
}

function tonnageAliases(tonnes: number) {
  const values = new Set<string>([formatTonnageAlias(tonnes)]);
  const floored = Math.floor(tonnes);
  if (floored > 0) values.add(String(floored));
  if (Number.isInteger(tonnes) && tonnes > 1) values.add(String(tonnes - 1));
  return [...values];
}

function pushPlantTonnageAliases(bits: string[], tonnes: number, plantNames: string[]) {
  for (const value of tonnageAliases(tonnes)) {
    bits.push(`${value}t`, `${value} t`, `${value} tonne`, `${value} ton`);
    for (const plantName of plantNames) {
      bits.push(`${value}t ${plantName}`, `${value} tonne ${plantName}`, `${value} ton ${plantName}`);
    }
  }
}

function cecaSearchText(item: CecaPlantRate) {
  const tonnes = capacityTonnes(item.capacity_text);
  const bits = [item.section_name, item.item_name, item.capacity_text ?? "", item.search_aliases ?? ""];
  const identity = `${item.section_name} ${item.item_name}`;

  if (tonnes) {
    pushPlantTonnageAliases(bits, tonnes, []);
  }

  if (tonnes && /excavator|backhoe/i.test(identity)) {
    bits.push("excavator", "digger", "360", "tracked excavator", "crawler excavator", "backhoe", "jcb");
    pushPlantTonnageAliases(bits, tonnes, ["excavator", "digger", "360", "tracked excavator", "crawler excavator"]);
  }

  if (tonnes && /dumper|dump truck/i.test(identity)) {
    bits.push("dumper", "site dumper", "tracked dumper", "dump truck");
    pushPlantTonnageAliases(bits, tonnes, ["dumper", "site dumper", "tracked dumper", "dump truck"]);
  }

  return normaliseCecaSearch(bits.join(" "));
}

export default function RateCardsPage() {
  const router = useRouter();

  const [tab, setTab] = useState<Category>("labour");
  const [rows, setRows] = useState<RateCard[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectSettings, setProjectSettings] = useState<ProjectRateSettings[]>([]);
  const [cecaItems, setCecaItems] = useState<CecaPlantRate[]>([]);
  const [selectedProjectKey, setSelectedProjectKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RateCard | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingProjectSettings, setSavingProjectSettings] = useState(false);
  const [nameSuggestOpen, setNameSuggestOpen] = useState(false);
  const [nameSuggestIndex, setNameSuggestIndex] = useState(0);

  const [projectAdjustmentInput, setProjectAdjustmentInput] = useState("0");
  const [projectPlantBasis, setProjectPlantBasis] = useState<"custom" | "ceca">("custom");

  const [form, setForm] = useState<{
    category: Category;
    source_type: SourceType;
    name: string;
    unit: string;
    rate: string;
    notes: string;
    active: boolean;
    ceca_query: string;
    ceca_item_id: string | null;
    ceca_rate: number | null;
    adjustment_percent: string;
    final_rate: string;
  }>({
    category: "labour",
    source_type: "custom",
    name: "",
    unit: "hour",
    rate: "0",
    notes: "",
    active: true,
    ceca_query: "",
    ceca_item_id: null,
    ceca_rate: null,
    adjustment_percent: "0",
    final_rate: "0",
  });

  const selectedProject = useMemo(
    () => projects.find((project) => project.key === selectedProjectKey) ?? null,
    [projects, selectedProjectKey]
  );

  const selectedProjectSettings = useMemo(() => {
    if (!selectedProject) return null;
    return (
      projectSettings.find(
        (setting) =>
          setting.project_name === selectedProject.project_name &&
          (setting.main_contractor ?? "") === (selectedProject.main_contractor ?? "")
      ) ?? null
    );
  }, [projectSettings, selectedProject]);

  useEffect(() => {
    if (!selectedProjectSettings) {
      setProjectAdjustmentInput("0");
      setProjectPlantBasis("custom");
      return;
    }
    setProjectAdjustmentInput(String(Number(selectedProjectSettings.ceca_adjustment_percent ?? 0)));
    setProjectPlantBasis(selectedProjectSettings.use_ceca_for_plant ? "ceca" : "custom");
  }, [selectedProjectSettings]);

  function resetForm(category: Category) {
    const adjustment = selectedProjectSettings?.ceca_adjustment_percent ?? 0;
    const defaultSource: SourceType = category === "plant" && selectedProjectSettings?.use_ceca_for_plant ? "ceca" : "custom";
    setEditing(null);
    setForm({
      category,
      source_type: defaultSource,
      name: "",
      unit: category === "materials" ? "each" : "hour",
      rate: "0",
      notes: "",
      active: true,
      ceca_query: "",
      ceca_item_id: null,
      ceca_rate: null,
      adjustment_percent: String(adjustment),
      final_rate: "0",
    });
  }

  function openNew() {
    resetForm(tab);
    setOpen(true);
  }

  function openEdit(r: RateCard) {
    const currentAdjustment = r.adjustment_percent ?? selectedProjectSettings?.ceca_adjustment_percent ?? 0;
    setEditing(r);
    setForm({
      category: r.category,
      source_type: (r.source_type as SourceType) || "custom",
      name: r.name,
      unit: r.unit || "hour",
      rate: String(r.rate ?? 0),
      notes: r.notes ?? "",
      active: r.active ?? true,
      ceca_query: r.name,
      ceca_item_id: r.ceca_item_id ?? null,
      ceca_rate: r.ceca_rate ?? null,
      adjustment_percent: String(currentAdjustment),
      final_rate: String(r.final_rate ?? r.rate ?? 0),
    });
    setOpen(true);
  }

  async function load() {
    setErr(null);
    setLoading(true);
    const supabase = supabaseBrowser();

    try {
      const user = await getRequiredUser(supabase);
      const cecaPromise = (async () => {
        const withAliases = await (supabase as any).from("ceca_plant_rates_simple")
          .select("id,section_name,item_name,capacity_text,hire_unit,ceca_rate,year,search_aliases")
          .order("section_name", { ascending: true })
          .order("item_name", { ascending: true });

        if (!withAliases.error) return withAliases;

        const message = String(withAliases.error.message ?? "").toLowerCase();
        const missingAliasColumn = withAliases.error.code === "42703" || withAliases.error.code === "PGRST204" || message.includes("search_aliases");
        if (!missingAliasColumn) return withAliases;

        return (supabase as any).from("ceca_plant_rates_simple")
          .select("id,section_name,item_name,capacity_text,hire_unit,ceca_rate,year")
          .order("section_name", { ascending: true })
          .order("item_name", { ascending: true });
      })();

      const [rateRes, eventRes, settingsRes, cecaRes] = await Promise.all([
        (supabase as any).from("rate_cards")
          .select("id,user_id,category,name,unit,rate,notes,active,project_name,main_contractor,source_type,ceca_item_id,ceca_rate,adjustment_percent,final_rate,created_at,updated_at")
          .eq("user_id", user.id)
          .order("category", { ascending: true })
          .order("name", { ascending: true }),
        (supabase as any).from("events")
          .select("project_name,main_contractor,contract_type,updated_at")
          .eq("user_id", user.id)
          .not("project_name", "is", null)
          .order("updated_at", { ascending: false }),
        (supabase as any).from("project_rate_settings")
          .select("id,project_name,main_contractor,ceca_adjustment_percent,use_ceca_for_plant")
          .eq("user_id", user.id),
        cecaPromise,
      ]);

      if (rateRes.error) throw rateRes.error;
      if (eventRes.error) throw eventRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (cecaRes.error) throw cecaRes.error;

      const nextRows = (rateRes.data ?? []) as RateCard[];
      const seen = new Set<string>();
      const nextProjects: ProjectOption[] = [];

      for (const event of (eventRes.data ?? []) as Array<{ project_name?: string | null; main_contractor?: string | null; contract_type?: string | null }>) {
        const project_name = String(event.project_name ?? "").trim();
        const main_contractor = String(event.main_contractor ?? "").trim();
        if (!project_name) continue;
        const key = `${project_name}__${main_contractor}`;
        if (seen.has(key)) continue;
        seen.add(key);
        nextProjects.push({ key, project_name, main_contractor, contract_type: event.contract_type ?? null });
      }

      setRows(nextRows);
      setProjects(nextProjects);
      setProjectSettings((settingsRes.data ?? []) as ProjectRateSettings[]);
      setCecaItems((cecaRes.data ?? []) as CecaPlantRate[]);
      setSelectedProjectKey((current) => {
        if (current && nextProjects.some((project) => project.key === current)) return current;
        return nextProjects[0]?.key ?? "";
      });
    } catch (e: any) {
      if (isAuthErrorMessage(e?.message)) {
        router.push("/login");
        return;
      }
      setErr(e?.message ?? "Failed to load rate cards");
      setRows([]);
      setProjects([]);
      setProjectSettings([]);
      setCecaItems([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    return rows
      .filter((row) => row.category === tab)
      .filter((row) => {
        if (!selectedProject) return false;
        return (row.project_name ?? "") === selectedProject.project_name && (row.main_contractor ?? "") === selectedProject.main_contractor;
      })
      .filter((row) => (showInactive ? true : row.active))
      .filter((row) => {
        if (!search) return true;
        const hay = [row.name, row.notes ?? "", row.source_type ?? ""].join(" ").toLowerCase();
        return hay.includes(search);
      });
  }, [rows, selectedProject, showInactive, q, tab]);

  const activeCount = useMemo(() => filtered.filter((row) => row.active).length, [filtered]);

  const modalSuggestions = useMemo(() => {
    if (form.category === "plant" && form.source_type === "ceca") {
      const query = normaliseCecaSearch(form.ceca_query);
      const queryParts = query.split(" ").filter(Boolean);
      const tonnage = queryTonnes(query);
      if (!query) return [];
      return cecaItems
        .filter((item) => {
          const hay = cecaSearchText(item);
          return queryParts.every((part) => hay.includes(part));
        })
        .sort((a, b) => {
          const aHay = cecaSearchText(a);
          const bHay = cecaSearchText(b);
          const aStarts = query ? aHay.startsWith(query) : false;
          const bStarts = query ? bHay.startsWith(query) : false;
          if (aStarts !== bStarts) return aStarts ? -1 : 1;
          const rankDiff = capacityRank(b, tonnage) - capacityRank(a, tonnage);
          if (rankDiff !== 0) return rankDiff;
          return cecaLabel(a).localeCompare(cecaLabel(b));
        })
        .slice(0, query ? 12 : 8)
        .map((item) => ({
          id: item.id,
          name: cecaDisplayName(item),
          fullName: cecaLabel(item),
          unit: item.hire_unit,
          source: "ceca" as const,
          cecaRate: Number(item.ceca_rate ?? 0),
          item,
        }));
    }

    const query = form.name.trim().toLowerCase();
    const fromLibrary = getResourceLibrary(form.category).map((item) => ({
      name: item.name,
      unit: item.unit,
      source: "library" as const,
    }));
    const fromRows = rows
      .filter((row) => row.category === form.category)
      .map((row) => ({ name: row.name, unit: row.unit, source: "rate_card" as const }));
    const merged = [...fromRows, ...fromLibrary];
    const seen = new Set<string>();

    return merged
      .filter((item) => {
        const key = item.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .filter((item) => (!query ? true : item.name.toLowerCase().includes(query)))
      .sort((a, b) => {
        const aStarts = query ? a.name.toLowerCase().startsWith(query) : false;
        const bStarts = query ? b.name.toLowerCase().startsWith(query) : false;
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        if (a.source !== b.source) return a.source === "rate_card" ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, query ? 10 : 8);
  }, [cecaItems, form.category, form.ceca_query, form.name, form.source_type, rows]);

  async function saveProjectSettings() {
    if (!selectedProject) {
      setErr("Select a project first.");
      return;
    }
    setSavingProjectSettings(true);
    setErr(null);
    setNotice(null);
    try {
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      const payload = {
        user_id: user.id,
        project_name: selectedProject.project_name,
        main_contractor: selectedProject.main_contractor,
        ceca_adjustment_percent: cleanSignedNumber(projectAdjustmentInput),
        use_ceca_for_plant: projectPlantBasis === "ceca",
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any).from("project_rate_settings")
        .upsert(payload, { onConflict: "user_id,project_name,main_contractor" });
      if (error) throw error;
      setNotice("Project CECA settings saved.");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save project settings");
    } finally {
      setSavingProjectSettings(false);
    }
  }

  async function importCommonForTab() {
    setErr(null);
    setSaving(true);
    try {
      if (!selectedProject) {
        setErr("Select a project before editing rate cards.");
        return;
      }
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      const existing = rows
        .filter((row) => row.category === tab)
        .filter((row) => (row.project_name ?? "") === selectedProject.project_name && (row.main_contractor ?? "") === selectedProject.main_contractor)
        .map((row) => row.name.trim().toLowerCase());
      const items = (COMMON_IMPORT_LIBRARY as Record<string, Array<{ name: string; unit: string; defaultRate?: number; notes?: string }>>)[tab] || [];
      const payload = items
        .filter((item) => !existing.includes(item.name.trim().toLowerCase()))
        .map((item) => {
          const defaultRate = Number(item.defaultRate ?? 0);
          return {
            user_id: user.id,
            project_name: selectedProject.project_name,
            main_contractor: selectedProject.main_contractor,
            category: tab,
            name: item.name,
            unit: item.unit,
            rate: defaultRate,
            notes:
              item.notes ??
              (tab === "labour"
                ? "Imported common labour market-rate starter. Edit for project, region, contract or actual cost basis."
                : "Imported common starter item"),
            active: true,
            source_type: "custom",
            ceca_item_id: null,
            ceca_rate: null,
            adjustment_percent: null,
            final_rate: defaultRate,
          };
        });

      if (payload.length > 0) {
        const { error } = await (supabase as any).from("rate_cards").insert(payload);
        if (error) throw error;
      }

      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to import starter items");
    } finally {
      setSaving(false);
    }
  }

  async function saveModal() {
    setErr(null);
    setNotice(null);

    const name = form.name.trim();
    if (form.category === "plant" && form.source_type === "ceca" && !form.ceca_item_id) {
      setErr("Select a CECA item first.");
      return;
    }
    if (!name) {
      setErr(form.source_type === "ceca" ? "Select a CECA item first." : "Name is required.");
      return;
    }

    const adjustment = cleanSignedNumber(form.adjustment_percent);
    const rateNum = form.source_type === "ceca" ? cleanNumber(form.final_rate) : cleanNumber(form.rate);
    if (rateNum < 0) {
      setErr("Rate cannot be negative.");
      return;
    }

    setSaving(true);
    try {
      if (!selectedProject) {
        setErr("Select a project before saving rate cards.");
        return;
      }

      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      const payload: any = {
        project_name: selectedProject.project_name,
        main_contractor: selectedProject.main_contractor,
        category: form.category,
        name,
        unit: form.unit,
        rate: rateNum,
        notes: form.notes.trim() ? form.notes.trim() : null,
        active: form.active,
        source_type: form.source_type,
        ceca_item_id: form.source_type === "ceca" ? form.ceca_item_id : null,
        ceca_rate: form.source_type === "ceca" ? Number(form.ceca_rate ?? 0) : null,
        adjustment_percent: form.source_type === "ceca" ? adjustment : null,
        final_rate: form.source_type === "ceca" ? rateNum : rateNum,
        updated_at: new Date().toISOString(),
      };

      if (!editing) {
        payload.user_id = user.id;
        const { error } = await (supabase as any).from("rate_cards").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("rate_cards")
          .update(payload)
          .eq("id", editing.id)
          .eq("user_id", user.id);
        if (error) throw error;
      }

      setOpen(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(row: RateCard, next: boolean) {
    setErr(null);
    const supabase = supabaseBrowser();
    const { error } = await (supabase as any).from("rate_cards")
      .update({ active: next, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("user_id", row.user_id);

    if (error) {
      setErr(error.message);
      return;
    }
    setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, active: next } : item)));
  }

  async function duplicate(row: RateCard) {
    setErr(null);
    try {
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      const payload: any = {
        user_id: user.id,
        project_name: row.project_name ?? selectedProject?.project_name ?? null,
        main_contractor: row.main_contractor ?? selectedProject?.main_contractor ?? null,
        category: row.category,
        name: `${row.name} (copy)`,
        unit: row.unit,
        rate: row.rate,
        notes: row.notes,
        active: true,
        source_type: row.source_type ?? "custom",
        ceca_item_id: row.ceca_item_id ?? null,
        ceca_rate: row.ceca_rate ?? null,
        adjustment_percent: row.adjustment_percent ?? null,
        final_rate: row.final_rate ?? row.rate,
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any).from("rate_cards").insert(payload);
      if (error) throw error;
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Duplicate failed");
    }
  }

  const Card = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <section
      style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: 24,
        padding: 24,
        boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 750, letterSpacing: -0.5, color: c.black }}>{title}</h2>
          {hint ? <div style={{ marginTop: 7, color: c.sub, fontWeight: 500, fontSize: 14, lineHeight: 1.55, maxWidth: 860 }}>{hint}</div> : null}
        </div>
      </div>
      <div style={{ marginTop: 18 }}>{children}</div>
    </section>
  );

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <AppPageHeader
        title="Project Rate Cards"
        description="Manage project-specific labour, plant and material rates, then reuse them across CE / VO valuations with controlled deterministic pricing."
      />
      <div className="app-rate-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        <MetricCard label="Labour rates" value={rows.filter((row) => row.category === "labour" && row.active).length} hint="Active" tone="purple" />
        <MetricCard label="Plant rates" value={rows.filter((row) => row.category === "plant" && row.active).length} hint="Custom and CECA" tone="green" />
        <MetricCard label="Material rates" value={rows.filter((row) => row.category === "materials" && row.active).length} hint="Active" tone="orange" />
        <MetricCard label="Projects" value={projects.length} hint="With reusable rate cards" tone="blue" />
      </div>
      <Card title="Rate card library" hint="Choose a project and maintain the rate basis used in its compensation events and variations.">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(360px, 1.25fr) minmax(300px, 0.95fr)",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              border: `1px solid ${c.border}`,
              borderRadius: 20,
              background: c.card,
              padding: 18,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 750, letterSpacing: 0.2, color: c.sub, textTransform: "uppercase" }}>Project rate basis</div>
              <select
                value={selectedProjectKey}
                onChange={(e) => {
                  setSelectedProjectKey(e.target.value);
                  setQ("");
                  setNotice(null);
                }}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 16,
                  border: `1px solid ${c.border}`,
                  background: c.input,
                  fontWeight: 700,
                  fontSize: 15,
                  color: c.text,
                  outline: "none",
                }}
              >
                {projects.length === 0 ? <option value="">No projects found</option> : null}
                {projects.map((project) => (
                  <option key={project.key} value={project.key}>
                    {projectDisplay(project.project_name, project.main_contractor)}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                gap: 18,
                flexWrap: "wrap",
                alignItems: "center",
                paddingTop: 2,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.sub, textTransform: "uppercase", letterSpacing: 0.3 }}>
                  Contract
                </div>
                <div style={{ fontSize: 13, fontWeight: 650, color: c.black }}>
                  {contractLabel(selectedProject?.contract_type)}
                </div>
              </div>

              {selectedProject ? (
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.sub, textTransform: "uppercase", letterSpacing: 0.3 }}>
                    Saved rates
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 650, color: c.black }}>
                    {activeCount} active {CATEGORY_TABS.find((item) => item.key === tab)?.label.toLowerCase()} item{activeCount === 1 ? "" : "s"}
                  </div>
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.sub, textTransform: "uppercase", letterSpacing: 0.3 }}>
                  Category
                </div>
                <div style={{ fontSize: 13, fontWeight: 650, color: c.black }}>
                  {CATEGORY_TABS.find((item) => item.key === tab)?.label}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              border: `1px solid ${c.border}`,
              borderRadius: 20,
              background: c.card,
              padding: 18,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.25, color: c.black }}>Plant pricing basis</div>
                <div style={{ marginTop: 5, fontSize: 13, color: c.sub, fontWeight: 500, lineHeight: 1.55 }}>
                  Set the CECA adjustment once for the project, then save the final adjusted rate into the card.
                </div>
              </div>
              {projectPlantBasis === "ceca" ? (
                <div style={{ padding: "7px 10px", borderRadius: 999, border: `1px solid ${c.border}`, background: c.soft, fontSize: 12, fontWeight: 750, color: c.sub, whiteSpace: "nowrap" }}>
                  CECA 2025
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) 120px auto", gap: 10, alignItems: "end" }}>
              <Field label="Plant basis">
                <select
                  value={projectPlantBasis}
                  onChange={(e) => setProjectPlantBasis(e.target.value as "custom" | "ceca")}
                  style={{ width: "100%", padding: 11, borderRadius: 12, border: `1px solid ${c.border}`, background: c.input, fontWeight: 750, color: c.text }}
                  disabled={!selectedProject}
                >
                  <option value="custom">Custom</option>
                  <option value="ceca">CECA adjusted</option>
                </select>
              </Field>

              <Field label="Adj. %">
                <input
                  value={projectAdjustmentInput}
                  onChange={(e) => setProjectAdjustmentInput(e.target.value)}
                  inputMode="decimal"
                  placeholder="-25"
                  style={{ width: "100%", padding: 11, borderRadius: 12, border: `1px solid ${c.border}`, background: c.input, fontWeight: 750, color: c.text }}
                  disabled={!selectedProject || projectPlantBasis !== "ceca"}
                />
              </Field>

              <button
                onClick={saveProjectSettings}
                disabled={!selectedProject || savingProjectSettings}
                style={{
                  padding: "11px 12px",
                  borderRadius: 12,
                  border: `1px solid ${c.black}`,
                  background: c.black,
                  color: c.blackContrast,
                  fontWeight: 750,
                  fontSize: 14,
                  cursor: !selectedProject || savingProjectSettings ? "not-allowed" : "pointer",
                  opacity: !selectedProject || savingProjectSettings ? 0.7 : 1,
                  whiteSpace: "nowrap",
                  alignSelf: "end",
                }}
              >
                {savingProjectSettings ? "Saving…" : "Save"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ padding: "7px 10px", borderRadius: 999, border: `1px solid ${c.border}`, background: c.soft, fontSize: 12, fontWeight: 700, color: c.sub }}>
                Basis {projectPlantBasis === "ceca" ? "CECA adjusted" : "Custom"}
              </div>
              {projectPlantBasis === "ceca" ? (
                <>
                  <div style={{ padding: "7px 10px", borderRadius: 999, border: `1px solid ${c.border}`, background: c.soft, fontSize: 12, fontWeight: 700, color: c.sub }}>
                    {formatAdjustment(cleanSignedNumber(projectAdjustmentInput))}
                  </div>
                  <div style={{ padding: "7px 10px", borderRadius: 999, border: `1px solid ${c.border}`, background: c.soft, fontSize: 12, fontWeight: 700, color: c.sub }}>
                    {cecaItems.length} items
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {CATEGORY_TABS.map((item) => (
            <Pill
              key={item.key}
              label={item.label}
              active={tab === item.key}
              onClick={() => {
                setTab(item.key);
                setQ("");
              }}
            />
          ))}

          <div style={{ flex: 1 }} />

          <button
            onClick={importCommonForTab}
            disabled={saving || !selectedProject}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${c.border}`,
              background: c.input,
              color: c.black,
              fontWeight: 700,
              cursor: saving || !selectedProject ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              opacity: saving || !selectedProject ? 0.6 : 1,
            }}
          >
            Load common {CATEGORY_TABS.find((item) => item.key === tab)?.label?.toLowerCase()}
          </button>

          <button
            onClick={openNew}
            disabled={!selectedProject}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${c.black}`,
              background: c.black,
              color: c.blackContrast,
              fontWeight: 700,
              cursor: !selectedProject ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              opacity: !selectedProject ? 0.6 : 1,
            }}
          >
            + Add {CATEGORY_TABS.find((item) => item.key === tab)?.label}
          </button>
        </div>

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${tab}…`}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 14,
              border: `1px solid ${c.border}`,
              outline: "none",
              background: c.input,
              color: c.text,
              fontWeight: 700,
            }}
          />

          <button
            onClick={() => setShowInactive((prev) => !prev)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${c.border}`,
              background: c.input,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            title="Show or hide inactive items"
          >
            {showInactive ? "Hide inactive" : "Show inactive"}
          </button>
        </div>

        {err ? (
          <div
            style={{
              marginTop: 12,
              background: c.redBg,
              border: `1px solid ${c.redBd}`,
              color: c.redTx,
              padding: 12,
              borderRadius: 14,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {err}
          </div>
        ) : null}

        {notice ? (
          <div
            style={{
              marginTop: 12,
              background: c.greenBg,
              border: `1px solid ${c.greenBd}`,
              color: c.greenTx,
              padding: 12,
              borderRadius: 14,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {notice}
          </div>
        ) : null}

        {!selectedProject ? (
          <div
            style={{
              marginTop: 12,
              border: `1px solid ${c.border}`,
              borderRadius: 16,
              padding: 16,
              background: c.soft,
              color: c.sub,
              fontWeight: 700,
            }}
          >
            Create a CE with a project and main contractor first, then manage project-specific rates here.
          </div>
        ) : null}

        <div style={{ marginTop: 14, border: `1px solid ${c.border}`, borderRadius: 16, overflow: "hidden", background: c.card }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(260px,1fr) 88px 120px 280px",
              background: c.soft,
              padding: "11px 16px",
              fontSize: 12,
              lineHeight: 1.2,
              fontWeight: 700,
              color: c.sub,
              alignItems: "center",
            }}
          >
            <div>Name</div>
            <div>Unit</div>
            <div style={{ textAlign: "right" }}>Rate</div>
            <div style={{ textAlign: "right" }}>Actions</div>
          </div>

          {loading ? (
            <div style={{ padding: 14, color: c.sub, fontWeight: 700 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 14, color: c.sub, fontWeight: 700 }}>
              {selectedProject ? `Nothing to act on yet for this project. Click “Add” to create your first ${tab} rate.` : "Select a project to view rate cards."}
            </div>
          ) : (
            filtered.map((row) => (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(260px,1fr) 88px 120px 280px",
                  padding: "12px 16px",
                  borderTop: `1px solid ${c.border}`,
                  alignItems: "center",
                  columnGap: 0,
                  fontSize: 14,
                  background: row.active ? c.card : c.soft,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, lineHeight: 1.35, fontWeight: 650, color: c.black, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={row.name}>
                    {row.name}
                  </div>
                  {row.source_type === "ceca" ? (
                    <div style={{ marginTop: 5, fontSize: 12, color: c.sub, fontWeight: 700, lineHeight: 1.45 }}>
                      CECA 2025 · Base {money(Number(row.ceca_rate ?? 0))}/{row.unit} · {formatAdjustment(Number(row.adjustment_percent ?? 0))}
                    </div>
                  ) : row.notes ? (
                    <div style={{ marginTop: 4, fontSize: 12, color: c.sub, fontWeight: 700 }}>{row.notes}</div>
                  ) : null}
                  {!row.active ? <div style={{ marginTop: 6, fontSize: 12, color: c.sub, fontWeight: 700 }}>Inactive</div> : null}
                </div>

                <div style={{ color: c.sub, fontSize: 14, fontWeight: 650 }}>{row.unit}</div>
                <div style={{ textAlign: "right", fontSize: 14, fontWeight: 650, color: c.black }}>{money(Number(row.rate ?? 0))}</div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "nowrap", alignItems: "center" }}>
                  <button
                    onClick={() => openEdit(row)}
                    style={{ padding: "7px 10px", borderRadius: 10, border: `1px solid ${c.border}`, background: c.input, color: c.black, fontSize: 13, lineHeight: 1.2, fontWeight: 650, cursor: "pointer" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => duplicate(row)}
                    style={{ padding: "7px 10px", borderRadius: 10, border: `1px solid ${c.border}`, background: c.input, color: c.black, fontSize: 13, lineHeight: 1.2, fontWeight: 650, cursor: "pointer" }}
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => setActive(row, !row.active)}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 10,
                      border: `1px solid ${c.border}`,
                      background: row.active ? c.input : c.black,
                      color: row.active ? c.sub : c.blackContrast,
                      fontSize: 13,
                      lineHeight: 1.2,
                      fontWeight: 650,
                      cursor: "pointer",
                    }}
                  >
                    {row.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {open && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.35)",
            backdropFilter: "blur(4px)",
            zIndex: 60,
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "min(820px, 100%)",
              background: c.card,
              border: `1px solid ${c.border}`,
              borderRadius: 22,
              padding: 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: c.black }}>{editing ? "Edit rate card item" : "Add rate card item"}</div>
                <div style={{ marginTop: 6, color: c.sub, fontWeight: 700, fontSize: 13 }}>
                  {selectedProject ? `Project: ${projectDisplay(selectedProject.project_name, selectedProject.main_contractor)}` : "Select a project first."}
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${c.border}`, background: c.input, color: c.black, fontWeight: 700, cursor: "pointer" }}
              >
                Close
              </button>
            </div>

            {err ? (
              <div
                style={{
                  marginTop: 12,
                  background: c.redBg,
                  border: `1px solid ${c.redBd}`,
                  color: c.redTx,
                  padding: 12,
                  borderRadius: 14,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {err}
              </div>
            ) : null}

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 12, alignItems: "start" }}>
              <Field label="Category">
                <select
                  value={form.category}
                  onChange={(e) => {
                    const nextCategory = e.target.value as Category;
                    setForm((prev) => ({
                      ...prev,
                      category: nextCategory,
                      source_type: nextCategory === "plant" && projectPlantBasis === "ceca" ? "ceca" : "custom",
                      unit: nextCategory === "materials" ? "each" : prev.unit,
                    }));
                  }}
                  style={{ width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${c.border}`, background: c.input, fontWeight: 650, color: c.text }}
                  disabled={!!editing}
                >
                  <option value="labour">Labour</option>
                  <option value="plant">Plant</option>
                  <option value="materials">Materials</option>
                </select>
              </Field>

              <Field label="Rate source">
                <select
                  value={form.source_type}
                  onChange={(e) => {
                    const nextSource = e.target.value as SourceType;
                    setForm((prev) => ({
                      ...prev,
                      source_type: nextSource,
                      ceca_query: nextSource === "ceca" ? prev.ceca_query : "",
                      ceca_item_id: nextSource === "ceca" ? prev.ceca_item_id : null,
                      ceca_rate: nextSource === "ceca" ? prev.ceca_rate : null,
                      adjustment_percent: nextSource === "ceca" ? String(selectedProjectSettings?.ceca_adjustment_percent ?? cleanSignedNumber(prev.adjustment_percent)) : "0",
                      final_rate: nextSource === "ceca" ? prev.final_rate : prev.rate,
                    }));
                    setNameSuggestIndex(0);
                    setNameSuggestOpen(false);
                  }}
                  style={{ width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${c.border}`, background: c.input, fontWeight: 650, color: c.text }}
                  disabled={form.category !== "plant"}
                >
                  <option value="custom">Custom</option>
                  <option value="ceca">CECA adjusted</option>
                </select>
              </Field>

              <Field label={form.category === "plant" && form.source_type === "ceca" ? "CECA item" : "Name"}>
                <div style={{ position: "relative" }}>
                  <input
                    value={form.category === "plant" && form.source_type === "ceca" ? form.ceca_query : form.name}
                    onFocus={() => setNameSuggestOpen(true)}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (form.category === "plant" && form.source_type === "ceca") {
                        setForm((prev) => ({ ...prev, ceca_query: value, ceca_item_id: null, ceca_rate: null, final_rate: "0", rate: "0" }));
                      } else {
                        setForm((prev) => ({ ...prev, name: value }));
                      }
                      setNameSuggestOpen(true);
                      setNameSuggestIndex(0);
                    }}
                    onKeyDown={(e) => {
                      if (!nameSuggestOpen || modalSuggestions.length === 0) return;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setNameSuggestIndex((prev) => (prev + 1) % modalSuggestions.length);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setNameSuggestIndex((prev) => (prev - 1 + modalSuggestions.length) % modalSuggestions.length);
                      } else if (e.key === "Tab" || e.key === "Enter") {
                        e.preventDefault();
                        const picked: any = modalSuggestions[nameSuggestIndex] || modalSuggestions[0];
                        if (!picked) return;
                        if (form.category === "plant" && form.source_type === "ceca" && picked.item) {
                          const adjustment = selectedProjectSettings?.ceca_adjustment_percent ?? cleanSignedNumber(form.adjustment_percent);
                          const base = Number(picked.cecaRate ?? 0);
                          const finalRate = calcAdjustedRate(base, adjustment);
                          setForm((prev) => ({
                            ...prev,
                            name: picked.name,
                            ceca_query: picked.name,
                            ceca_item_id: picked.id,
                            ceca_rate: base,
                            unit: picked.unit || prev.unit || "hour",
                            adjustment_percent: String(adjustment),
                            final_rate: String(finalRate),
                            rate: String(finalRate),
                            notes: prev.notes.trim() ? prev.notes : cecaFullSourceNote(picked.item, base, picked.unit || prev.unit || "hour"),
                          }));
                        } else {
                          setForm((prev) => ({ ...prev, name: picked.name, unit: picked.unit || prev.unit || "each" }));
                        }
                        setNameSuggestOpen(false);
                      }
                    }}
                    onBlur={() => setTimeout(() => setNameSuggestOpen(false), 120)}
                    placeholder={form.category === "plant" && form.source_type === "ceca" ? "Search CECA plant, e.g. 13t excavator" : form.category === "labour" ? "e.g. Groundworker" : form.category === "plant" ? "e.g. 13T Excavator" : "e.g. C32/40 Concrete"}
                    style={{ width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${c.border}`, background: c.input, fontWeight: 650, color: c.text, fontSize: 15 }}
                  />
                  {nameSuggestOpen && modalSuggestions.length > 0 ? (
                    <div
                      style={{
                        position: "absolute",
                        top: 56,
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        background: c.card,
                        border: `1px solid ${c.border}`,
                        borderRadius: 16,
                        boxShadow: "0 18px 40px rgba(15,23,42,0.12)",
                        overflow: "auto",
                        maxHeight: 360,
                      }}
                    >
                      {modalSuggestions.map((item: any, idx) => (
                        <button
                          key={`${item.source}_${item.name}_${item.id ?? idx}`}
                          type="button"
                          title={item.source === "ceca" && item.fullName ? item.fullName : item.name}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (form.category === "plant" && form.source_type === "ceca" && item.item) {
                              const adjustment = selectedProjectSettings?.ceca_adjustment_percent ?? cleanSignedNumber(form.adjustment_percent);
                              const base = Number(item.cecaRate ?? 0);
                              const finalRate = calcAdjustedRate(base, adjustment);
                              setForm((prev) => ({
                                ...prev,
                                name: item.name,
                                ceca_query: item.name,
                                ceca_item_id: item.id,
                                ceca_rate: base,
                                unit: item.unit || prev.unit || "hour",
                                adjustment_percent: String(adjustment),
                                final_rate: String(finalRate),
                                rate: String(finalRate),
                                notes: prev.notes.trim() ? prev.notes : cecaFullSourceNote(item.item, base, item.unit || prev.unit || "hour"),
                              }));
                            } else {
                              setForm((prev) => ({ ...prev, name: item.name, unit: item.unit || prev.unit || "each" }));
                            }
                            setNameSuggestOpen(false);
                          }}
                          onMouseEnter={() => setNameSuggestIndex(idx)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: 14,
                            border: "none",
                            borderBottom: idx === modalSuggestions.length - 1 ? "none" : `1px solid ${c.border}`,
                            background: idx === nameSuggestIndex ? c.activeBg : c.card,
                            cursor: "pointer",
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) auto",
                            gap: 12,
                            alignItems: "start",
                            fontWeight: 700,
                            color: c.black,
                          }}
                        >
                          <span style={{ minWidth: 0, display: "grid", gap: 4 }}>
                            <span style={{ display: "block", lineHeight: 1.25, fontSize: 15 }}>{item.name}</span>
                            {item.source === "ceca" && item.item ? (
                              <>
                                <span style={{ display: "block", fontSize: 12, color: c.sub, fontWeight: 600 }}>
                                  {item.item.section_name} · {money(Number(item.cecaRate ?? 0))}/{item.unit}
                                </span>
                                {item.fullName && item.fullName !== item.name ? (
                                  <span style={{ display: "block", fontSize: 11, color: c.sub, fontWeight: 550, lineHeight: 1.35 }}>
                                    Full CECA wording saved in notes
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span style={{ display: "block", fontSize: 12, color: c.sub, fontWeight: 600 }}>
                                {item.unit} · {item.source === "rate_card" ? "Saved" : "Library"}
                              </span>
                            )}
                          </span>
                          <span style={{ fontSize: 12, color: c.sub, fontWeight: 750, whiteSpace: "nowrap" }}>{item.source === "rate_card" ? `Saved` : item.source === "ceca" ? `CECA · ${item.unit}` : `Library`}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Field>

              <Field label="Unit">
                <select
                  value={form.unit}
                  onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                  style={{ width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${c.border}`, background: c.input, fontWeight: 650, color: c.text }}
                  disabled={form.category === "plant" && form.source_type === "ceca"}
                >
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </Field>

              {form.category === "plant" && form.source_type === "ceca" ? (
                <>
                  <Field label="CECA base rate">
                    <div style={{ width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${c.border}`, background: c.soft, fontWeight: 650, color: c.black }}>
                      {money(Number(form.ceca_rate ?? 0))} / {form.unit}
                    </div>
                  </Field>
                  <Field label="Adjustment %" hint="Negative for discount, positive for uplift.">
                    <input
                      value={form.adjustment_percent}
                      onChange={(e) => {
                        const nextAdjustment = cleanSignedNumber(e.target.value);
                        const base = Number(form.ceca_rate ?? 0);
                        const finalRate = calcAdjustedRate(base, nextAdjustment);
                        setForm((prev) => ({
                          ...prev,
                          adjustment_percent: e.target.value,
                          final_rate: String(finalRate),
                          rate: String(finalRate),
                        }));
                      }}
                      inputMode="decimal"
                      placeholder="-25"
                      style={{ width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${c.border}`, background: c.input, fontWeight: 650, color: c.text }}
                    />
                  </Field>
                  <Field label="Final project rate">
                    <div style={{ width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${c.greenBd}`, background: c.greenBg, display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 750, color: c.greenTx }}>{money(cleanNumber(form.final_rate))} / {form.unit}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: c.sub }}>Saved as the live project plant rate</div>
                    </div>
                  </Field>
                </>
              ) : (
                <Field label="Rate (GBP)">
                  <input
                    value={form.rate}
                    onChange={(e) => setForm((prev) => ({ ...prev, rate: e.target.value }))}
                    inputMode="decimal"
                    placeholder="e.g. 25.00"
                    style={{ width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${c.border}`, background: c.input, fontWeight: 650, color: c.text }}
                  />
                  <div style={{ marginTop: 6, fontSize: 12, color: c.sub, fontWeight: 700 }}>Preview: {money(cleanNumber(form.rate))} / {form.unit}</div>
                </Field>
              )}

              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Notes (optional)">
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder={form.category === "plant" && form.source_type === "ceca" ? "e.g. CECA 2025 less 25% agreed for this project" : "e.g. includes operator / standby minimum / internal reference"}
                    style={{ width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${c.border}`, background: c.input, fontWeight: 650, color: c.text, resize: "vertical" }}
                  />
                </Field>
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10 }}>
                <input id="active" type="checkbox" checked={form.active} onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))} />
                <label htmlFor="active" style={{ fontWeight: 650, color: c.black }}>
                  Active (shows in assisted typing)
                </label>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setOpen(false)}
                style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${c.border}`, background: c.input, color: c.black, fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>

              <button
                onClick={saveModal}
                disabled={saving}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${c.black}`,
                  background: c.black,
                  color: c.blackContrast,
                  fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
