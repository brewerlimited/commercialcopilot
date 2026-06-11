"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { buildEventStepPath, normalizeRouteParam } from "@/lib/routeParams";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getOwnedEventOrThrow, getRequiredUser, isAuthErrorMessage, isOwnershipErrorMessage } from "@/lib/security";
import CEProgress from "@/components/CEProgress";
import { getCostLabel, getFeeBasisLabel } from "@/lib/contracts";
import { recalculateEventFinancialSummary } from "@/lib/financialSummary";

type Unit = "day" | "week";

type ValuationSettings = {
  event_id: string;
  fee_percent: number;
  fee_basis: "defined_cost" | "defined_cost_plus_prelims";
  work_days_per_week: number;
};

type PrelimType = "staff" | "prelim";

type PrelimLine = {
  id: string;
  event_id: string;
  name: string;
  qty: number;
  unit: Unit;
  rate: number;
  notes: string | null;
  prelim_type: PrelimType;
  _localOnly?: boolean;
};

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
  lightGrey: "var(--surface-soft)",
};

const STAFF_SUGGESTIONS = [
  "Project Manager",
  "Quantity Surveyor",
  "Commercial Manager",
  "Site Manager",
  "Site Supervisor",
  "Foreman",
  "Engineer",
  "Planner",
  "H&S Advisor",
  "Site Administrator",
  "Site Administrator",
];

const OTHER_PRELIM_SUGGESTIONS = [
  "General Management / Overheads",
  "Welfare",
  "Fuel",
  "Small Tools",
  "Site Vehicle / Van",
  "Accommodation",
  "Travel",
  "Temporary Facilities",
  "IT / Comms",
];

const PRELIM_SUGGESTIONS = [...STAFF_SUGGESTIONS, ...OTHER_PRELIM_SUGGESTIONS];

const PRELIM_ROW_GRID = "minmax(180px, 1fr) 88px 88px 100px 100px 40px 40px";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function money(n: number) {
  if (!Number.isFinite(n)) return "£0.00";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
}

function clampNum(v: any, fallback: number) {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function normalize(s: string) {
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
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
        fontSize: 13,
        fontFamily: "inherit",
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.6 : 1,
        ...(props.style ?? {}),
      }}
    />
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "7px 9px",
        borderRadius: 12,
        border: `1px solid ${c.border}`,
        outline: "none",
        background: c.input,
        color: c.black,
        fontSize: 13,
        fontWeight: 400,
        fontFamily: "inherit",
        minWidth: 0,
        ...(props.style ?? {}),
      }}
    />
  );
}


function CleanNumberInput({
  value,
  onCommit,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step,
  integer = false,
}: {
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
}) {
  const [draft, setDraft] = useState(value === undefined || value === null ? "" : String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value === undefined || value === null ? "" : String(value));
  }, [value, focused]);

  function commit(raw: string) {
    let parsed = raw.trim() === "" ? min : Number(raw);
    if (!Number.isFinite(parsed)) parsed = min;
    parsed = Math.max(min, Math.min(max, parsed));
    if (integer) parsed = Math.round(parsed);
    setDraft(String(parsed));
    onCommit(parsed);
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      step={step}
      value={draft}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (/^\d*\.?\d*$/.test(raw)) setDraft(raw);
      }}
      onBlur={() => {
        setFocused(false);
        commit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        padding: "7px 9px",
        borderRadius: 12,
        border: `1px solid ${c.border}`,
        outline: "none",
        background: c.input,
        color: c.black,
        fontSize: 13,
        fontWeight: 400,
        fontFamily: "inherit",
        minWidth: 0,
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
            color: c.sub,
            marginBottom: 0,
            lineHeight: 1.55,
            fontSize: 13,
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

function SuggestBox({
  open,
  items,
  onPick,
}: {
  open: boolean;
  items: string[];
  onPick: (label: string) => void;
}) {
  if (!open || items.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        right: 0,
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 12px 30px rgba(0,0,0,0.10)",
        zIndex: 50,
      }}
    >
      {items.slice(0, 10).map((label, idx) => (
        <button
          key={label}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(label);
          }}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "10px 12px",
            border: "none",
            borderBottom: idx === items.length - 1 ? "none" : `1px solid ${c.border}`,
            background: c.input,
            cursor: "pointer",
            fontWeight: 600,
            color: c.black,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function calcPrelimsDaily(lines: PrelimLine[], workDaysPerWeek: number) {
  const wd = Math.max(1, Math.min(7, workDaysPerWeek || 5));
  return lines.reduce((sum, l) => {
    const qty = l.qty || 0;
    const rate = l.rate || 0;
    const daily = l.unit === "week" ? rate / wd : rate;
    return sum + qty * daily;
  }, 0);
}

export default function PrelimsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = normalizeRouteParam(params?.id);

  const [title, setTitle] = useState<string>("Loading…");
  const [contractType, setContractType] = useState<string | null>(null);
  const [delayDays, setDelayDays] = useState<number>(0);

  const [settings, setSettings] = useState<ValuationSettings>({
    event_id: eventId,
    fee_percent: 12.5,
    fee_basis: "defined_cost",
    work_days_per_week: 5,
  });

  const [lines, setLines] = useState<PrelimLine[]>([]);
  const [definedCost, setDefinedCost] = useState<number>(0);

  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"not_saved" | "saved" | "unsaved" | "saving" | "error">(
    "not_saved"
  );
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const lastSavedSnapshotRef = useRef<string>("");
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");
  const savingRef = useRef<boolean>(false);

  const [nameFocusId, setNameFocusId] = useState<string | null>(null);
  const [nameQueryById, setNameQueryById] = useState<Record<string, string>>({});
  const [notesOpenById, setNotesOpenById] = useState<Record<string, boolean>>({});

  const staffLines = useMemo(() => lines.filter((l) => l.prelim_type === "staff"), [lines]);
  const otherPrelimLines = useMemo(() => lines.filter((l) => l.prelim_type !== "staff"), [lines]);

  const prelimsDaily = useMemo(() => calcPrelimsDaily(lines, settings.work_days_per_week || 5), [lines, settings.work_days_per_week]);
  const prelimsTotal = useMemo(() => prelimsDaily * (delayDays || 0), [prelimsDaily, delayDays]);

  const feeBase = useMemo(() => {
    return settings.fee_basis === "defined_cost_plus_prelims"
      ? definedCost + prelimsTotal
      : definedCost;
  }, [definedCost, prelimsTotal, settings.fee_basis]);

  const feeAmount = useMemo(
    () => feeBase * ((settings.fee_percent || 0) / 100),
    [feeBase, settings.fee_percent]
  );

  const ceTotal = useMemo(
    () => definedCost + prelimsTotal + feeAmount,
    [definedCost, prelimsTotal, feeAmount]
  );

  const costLabel = useMemo(() => getCostLabel(contractType), [contractType]);
  const feeBasisLabel = useMemo(() => getFeeBasisLabel(contractType, settings.fee_basis), [contractType, settings.fee_basis]);

  const isDirty = useMemo(() => {
    if (!loaded) return false;
    const snapshot = JSON.stringify({ delayDays, settings, lines: lines.filter((l) => l.name.trim() || isUuid(l.id)) });
    return snapshot !== lastSavedSnapshot;
  }, [delayDays, settings, lines, loaded]);

  useEffect(() => {
    if (!loaded) return;
    if (status === "saving" || status === "error") return;
    setStatus(isDirty ? "unsaved" : lastSavedAt ? "saved" : "not_saved");
  }, [isDirty, loaded, lastSavedAt]);

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
    (async () => {
      setSaveErr(null);

      if (!eventId || !isUuid(eventId)) return;

      const supabase = supabaseBrowser();

      try {
        const user = await getRequiredUser(supabase);
        const ev = await getOwnedEventOrThrow(supabase, eventId, user.id, "id,title,delay_days,contract_type,user_id");

        setTitle((ev as any).title);
        setContractType((ev as any).contract_type ?? null);
        setDelayDays(clampNum((ev as any).delay_days, 0));

        const { data: resLines } = await (supabase as any).from("event_resource_lines")
          .select("total")
          .eq("event_id", eventId);

        const sum =
          (resLines as any[] | null)?.reduce((s, r) => s + clampNum(r.total, 0), 0) ?? 0;
        setDefinedCost(sum);

        const { data: s } = await (supabase as any).from("event_valuation_settings")
          .select("event_id,fee_percent,fee_basis,work_days_per_week")
          .eq("event_id", eventId)
          .maybeSingle();

        const mergedSettings: ValuationSettings = {
          event_id: eventId,
          fee_percent: clampNum((s as any)?.fee_percent, 12.5),
          fee_basis: ((s as any)?.fee_basis ?? "defined_cost") as
            | "defined_cost"
            | "defined_cost_plus_prelims",
          work_days_per_week: clampNum((s as any)?.work_days_per_week, 5),
        };
        setSettings(mergedSettings);

        const { data: p } = await (supabase as any).from("event_prelim_lines")
          .select("id,event_id,name,qty,unit,rate,notes,prelim_type")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });

        const mergedLines: PrelimLine[] =
          (p as any[] | null)?.map((x) => ({
            id: x.id,
            event_id: x.event_id,
            name: x.name ?? "",
            qty: clampNum(x.qty, 1),
            unit: (x.unit ?? "day") as Unit,
            rate: clampNum(x.rate, 0),
            notes: x.notes ?? null,
            prelim_type: (x.prelim_type ?? "prelim") as PrelimType,
          })) ?? [];

        setLines(mergedLines);

        const snapshot = JSON.stringify({
          delayDays: clampNum((ev as any).delay_days, 0),
          settings: mergedSettings,
          lines: mergedLines.filter((l) => l.name.trim() || isUuid(l.id)),
        });
        lastSavedSnapshotRef.current = snapshot;
        setLastSavedSnapshot(snapshot);
        setStatus("saved");
        setLastSavedAt(Date.now());
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
        setSaveErr(e?.message ?? "Failed to load prelims");
        setLoaded(true);
      }
    })();
  }, [eventId, router]);

  useEffect(() => {
    if (!loaded) return;
    if (!isDirty) return;
    if (savingRef.current) return;

    const t = setTimeout(() => saveNow(), 900);
    return () => clearTimeout(t);
  }, [isDirty, loaded, delayDays, settings, lines]);

  async function saveNow() {
    if (!eventId || !isUuid(eventId)) return;
    if (savingRef.current) return;

    savingRef.current = true;
    setStatus("saving");
    setSaveErr(null);

    try {
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      await getOwnedEventOrThrow(supabase, eventId, user.id);

      const { error: evErr } = await (supabase as any).from("events")
        .update({ delay_days: Math.max(0, Math.round(delayDays || 0)) })
        .eq("id", eventId)
        .eq("user_id", user.id);
      if (evErr) throw evErr;

      const toUpsertSettings = {
        event_id: eventId,
        fee_percent: clampNum(settings.fee_percent, 0),
        fee_basis: settings.fee_basis,
        work_days_per_week: Math.max(1, Math.min(7, Math.round(settings.work_days_per_week || 5))),
        updated_at: new Date().toISOString(),
      };

      const { error: sErr } = await (supabase as any).from("event_valuation_settings")
        .upsert(toUpsertSettings, { onConflict: "event_id" });
      if (sErr) throw sErr;

      const validLines = lines.filter((l) => l.name.trim());
      const persistedIds = validLines.filter((l) => isUuid(l.id)).map((l) => l.id);

      const { data: existingBefore } = await (supabase as any).from("event_prelim_lines")
        .select("id")
        .eq("event_id", eventId);

      const existingBeforeIds = (existingBefore as any[] | null)?.map((x) => x.id) ?? [];
      const toDelete = existingBeforeIds.filter((id) => !persistedIds.includes(id));

      if (toDelete.length > 0) {
        const { error: dErr } = await (supabase as any).from("event_prelim_lines")
          .delete()
          .in("id", toDelete)
          .eq("event_id", eventId);
        if (dErr) throw dErr;
      }

      const toInsert = validLines
        .filter((l) => !isUuid(l.id))
        .map((l) => ({
          event_id: eventId,
          name: l.name.trim(),
          qty: Math.max(0, Math.round(l.qty || 0)),
          unit: l.unit,
          rate: clampNum(l.rate, 0),
          notes: (l.notes ?? "").trim() ? l.notes : null,
          prelim_type: l.prelim_type ?? "prelim",
        }));

      const toUpdate = validLines
        .filter((l) => isUuid(l.id))
        .map((l) => ({
          id: l.id,
          event_id: eventId,
          name: l.name.trim(),
          qty: Math.max(0, Math.round(l.qty || 0)),
          unit: l.unit,
          rate: clampNum(l.rate, 0),
          notes: (l.notes ?? "").trim() ? l.notes : null,
          prelim_type: l.prelim_type ?? "prelim",
        }));

      if (toInsert.length > 0) {
        const { error: iErr } = await (supabase as any).from("event_prelim_lines")
          .insert(toInsert as any);
        if (iErr) throw iErr;
      }

      if (toUpdate.length > 0) {
        const { error: uErr } = await (supabase as any).from("event_prelim_lines")
          .upsert(toUpdate as any, { onConflict: "id" });
        if (uErr) throw uErr;
      }

      const { data: refreshedPrelims, error: refreshErr } = await (supabase as any).from("event_prelim_lines")
        .select("id,event_id,name,qty,unit,rate,notes,prelim_type")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (refreshErr) throw refreshErr;

      await recalculateEventFinancialSummary(supabase, eventId, user.id);

      const nextLines: PrelimLine[] =
        (refreshedPrelims as any[] | null)?.map((x) => ({
          id: x.id,
          event_id: x.event_id,
          name: x.name ?? "",
          qty: clampNum(x.qty, 1),
          unit: (x.unit ?? "day") as Unit,
          rate: clampNum(x.rate, 0),
          notes: x.notes ?? null,
          prelim_type: (x.prelim_type ?? "prelim") as PrelimType,
        })) ?? [];

      const blankDraftLines = lines.filter((l) => !isUuid(l.id) && !l.name.trim());
      setLines([...nextLines, ...blankDraftLines]);

      const nextSettings: ValuationSettings = {
        ...settings,
        work_days_per_week: Math.max(1, Math.min(7, Math.round(settings.work_days_per_week || 5))),
      };
      setSettings(nextSettings);

      const snapshot = JSON.stringify({ delayDays, settings: nextSettings, lines: nextLines.filter((l) => l.name.trim() || isUuid(l.id)) });
      lastSavedSnapshotRef.current = snapshot;
      setLastSavedSnapshot(snapshot);
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

  function addLineFromName(name: string, prelimType: PrelimType = "prelim") {
    const id = `temp_${Math.random().toString(16).slice(2)}`;
    setLines((prev) => [
      ...prev,
      {
        id,
        event_id: eventId,
        name,
        qty: 1,
        unit: "day",
        rate: 0,
        notes: null,
        prelim_type: prelimType,
        _localOnly: true,
      },
    ]);
  }

  function updateLine(id: string, patch: Partial<PrelimLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
    if (isUuid(id)) {
      const supabase = supabaseBrowser();
      try {
        const user = await getRequiredUser(supabase);
        await getOwnedEventOrThrow(supabase, eventId, user.id);
        await (supabase as any).from("event_prelim_lines").delete().eq("id", id).eq("event_id", eventId);
        await recalculateEventFinancialSummary(supabase, eventId, user.id);
      } catch (e) {
        console.error(e);
      }
    }
  }

  function renderPrelimSection(title: string, hint: string, sectionLines: PrelimLine[], sectionType: PrelimType) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.black }}>{title}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: c.sub }}>{hint}</div>
        </div>

        {sectionLines.length === 0 ? (
          <div
            style={{
              padding: 14,
              borderRadius: 14,
              border: `1px dashed ${c.border}`,
              color: c.sub,
              background: c.soft,
            }}
          >
            No {sectionType === "staff" ? "staff prelims" : "other prelims"} added yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto", width: "100%" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: PRELIM_ROW_GRID,
              gap: 10,
              fontSize: 12,
              color: c.sub,
              fontWeight: 600,
              padding: "0 10px",
              minWidth: 0,
            }}
          >
            <div>{sectionType === "staff" ? "Staff item" : "Prelim item"}</div>
            <div>Unit</div>
            <div>Qty</div>
            <div>Rate</div>
            <div>Total</div>
            <div style={{ textAlign: "center" }}>More</div>
            <div />
          </div>
          </div>
        )}

        {sectionLines.map((l) => {
          const q = nameQueryById[l.id] ?? l.name;
          const sourceSuggestions = sectionType === "staff" ? STAFF_SUGGESTIONS : OTHER_PRELIM_SUGGESTIONS;
          const filtered = sourceSuggestions.filter((x) => normalize(x).includes(normalize(q)));
          const showSuggest = nameFocusId === l.id && normalize(q).length >= 1 && filtered.length > 0;
          const workingDays = Math.max(1, Math.min(7, settings.work_days_per_week || 5));
          const dailyRate = l.unit === "week" ? (l.rate || 0) / workingDays : l.rate || 0;
          const lineDailyTotal = (l.qty || 0) * dailyRate;
          const lineTotal = lineDailyTotal * (delayDays || 0);
          const notesOpen = !!notesOpenById[l.id];

          return (
            <div
              key={l.id}
              style={{
                background: c.card,
                border: `1px solid ${c.border}`,
                borderRadius: 18,
                overflow: "hidden",
              }}
            >
              <div style={{ overflowX: "auto", width: "100%" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: PRELIM_ROW_GRID,
                  gap: 10,
                  alignItems: "center",
                  padding: "12px",
                  minWidth: 0,
                }}
              >
                <div style={{ position: "relative", minWidth: 0 }}>
                  <Input
                    value={q}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNameQueryById((p) => ({ ...p, [l.id]: v }));
                      updateLine(l.id, { name: v });
                    }}
                    onFocus={() => setNameFocusId(l.id)}
                    onBlur={() => setTimeout(() => setNameFocusId((cur) => (cur === l.id ? null : cur)), 150)}
                    placeholder={sectionType === "staff" ? "e.g. Project Manager" : "e.g. Welfare"}
                  />
                  <SuggestBox
                    open={showSuggest}
                    items={filtered}
                    onPick={(label) => {
                      setNameQueryById((p) => ({ ...p, [l.id]: label }));
                      updateLine(l.id, { name: label });
                      setNameFocusId(null);
                    }}
                  />
                </div>

                <Select value={l.unit} onChange={(e) => updateLine(l.id, { unit: e.target.value as Unit })}>
                  <option value="day">Per day</option>
                  <option value="week">Per week</option>
                </Select>

                <CleanNumberInput
                  min={0}
                  step={1}
                  integer
                  value={l.qty}
                  onCommit={(value) => updateLine(l.id, { qty: Math.max(0, Math.round(value)) })}
                />

                <CleanNumberInput
                  min={0}
                  step={0.01}
                  value={l.rate}
                  onCommit={(value) => updateLine(l.id, { rate: clampNum(value, 0) })}
                />

                <div
                  style={{
                    fontWeight: 700,
                    color: c.black,
                    fontSize: 13,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0,
                  }}
                  title={`Daily: ${money(lineDailyTotal)} × ${delayDays || 0} day(s)`}
                >
                  {money(lineTotal)}
                </div>

                <button
                  type="button"
                  onClick={() => setNotesOpenById((prev) => ({ ...prev, [l.id]: !prev[l.id] }))}
                  style={{
                    height: 36,
                    width: 36,
                    borderRadius: 12,
                    border: `1px solid ${c.border}`,
                    background: c.input,
                    cursor: "pointer",
                    fontWeight: 700,
                    justifySelf: "center",
                  }}
                  title={notesOpen ? "Hide notes" : "Show notes"}
                >
                  {notesOpen ? "−" : "+"}
                </button>

                <button
                  type="button"
                  onClick={() => removeLine(l.id)}
                  style={{
                    height: 36,
                    width: 36,
                    borderRadius: 12,
                    border: `1px solid ${c.border}`,
                    background: c.input,
                    cursor: "pointer",
                    fontWeight: 700,
                    justifySelf: "center",
                  }}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
              </div>

              {notesOpen ? (
                <div style={{ padding: "0 12px 12px 12px", borderTop: `1px solid ${c.border}`, background: c.soft }}>
                  <div style={{ display: "grid", gap: 6, paddingTop: 12 }}>
                    <span style={{ fontWeight: 600, fontSize: 12, color: c.sub }}>Notes</span>
                    <textarea
                      value={l.notes ?? ""}
                      onChange={(e) => updateLine(l.id, { notes: e.target.value })}
                      placeholder="Optional notes for this prelim line"
                      style={{
                        width: "100%",
                        minHeight: 78,
                        resize: "vertical",
                        padding: 12,
                        borderRadius: 14,
                        border: `1px solid ${c.border}`,
                        outline: "none",
                        background: c.input,
                        color: c.black,
                        fontSize: 14,
                        fontWeight: 400,
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
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
    <div style={{ background: c.bg, minHeight: "100vh" }}>
      <div style={{ padding: "22px 18px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
            <div
              style={{
                background: c.card,
                border: `1px solid ${c.border}`,
                borderRadius: 18,
                padding: 20,
              }}
            >
              <div style={{ fontSize: 12, color: c.sub, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {title ? `“${title}”` : "Working event"}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: c.black,
                  letterSpacing: -0.2,
                }}
              >
                Prelims + Fee
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
                Add time-related prelims and fee so the CE total reflects the full commercial position.
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
                  CE Total: {money(ceTotal)}
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

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 18,
                alignItems: "start",
              }}
            >
              <div style={{ alignSelf: "start", minWidth: 0 }}>
                <Card title="Fee settings">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 160px) minmax(0, 1fr)",
                      gap: 10,
                      alignItems: "end",
                    }}
                  >
                    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 12, color: c.sub }}>Fee %</span>
                      <CleanNumberInput
                        min={0}
                        step={0.1}
                        value={settings.fee_percent}
                        onCommit={(value) =>
                          setSettings((p) => ({
                            ...p,
                            fee_percent: clampNum(value, 0),
                          }))
                        }
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 12, color: c.sub }}>Fee basis</span>
                      <Select
                        value={settings.fee_basis}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            fee_basis: e.target.value as "defined_cost" | "defined_cost_plus_prelims",
                          }))
                        }
                      >
                        <option value="defined_cost">{getCostLabel(contractType)} only</option>
                        <option value="defined_cost_plus_prelims">{getCostLabel(contractType)} + Prelims</option>
                      </Select>
                    </label>
                  </div>
                </Card>
              </div>

              <div style={{ alignSelf: "start", minWidth: 0 }}>
                <Card title="Delay days">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 160px) minmax(0, 1fr)",
                      gap: 10,
                      alignItems: "end",
                    }}
                  >
                    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 12, color: c.sub }}>Days</span>
                      <CleanNumberInput
                        min={0}
                        step={1}
                        integer
                        value={delayDays}
                        onCommit={(value) =>
                          setDelayDays(Math.max(0, Math.round(clampNum(value, 0))))
                        }
                      />
                    </label>

                    <div style={{ color: c.sub, fontSize: 12 }}>
                      Multiplies prelim daily equivalent.
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            <Card title="Time-related prelims">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                <SmallBtn
                  onClick={() => {
                    const starter = ["Project Manager", "Quantity Surveyor", "Site Supervisor"];
                    starter.forEach((n) => {
                      if (!lines.some((l) => normalize(l.name) === normalize(n) && l.prelim_type === "staff")) {
                        addLineFromName(n, "staff");
                      }
                    });
                  }}
                >
                  + Add common prelims
                </SmallBtn>

                <SmallBtn onClick={() => addLineFromName("", "staff")}>+ Add staff</SmallBtn>
                <SmallBtn onClick={() => addLineFromName("", "prelim")}>+ Add other prelim</SmallBtn>
              </div>

              <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
                {lines.length === 0 ? (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      border: `1px dashed ${c.border}`,
                      color: c.sub,
                    }}
                  >
                    Add staff or other prelim lines and set a day/week rate.
                  </div>
                ) : null}

                {renderPrelimSection("Staff prelims", "These export into Labour & Plant as staff-related prelim support.", staffLines, "staff")}
                {renderPrelimSection("Other prelims", "These stay in the Prelims + Fee sheet.", otherPrelimLines, "prelim")}
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
              <CEProgress eventId={eventId} currentStep="prelims" />
            </div>

            <SidebarCard title="Guidance">
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>{costLabel}</span>
                  <strong style={{ color: c.black }}>{money(definedCost)}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>Prelims (daily)</span>
                  <strong style={{ color: c.black }}>{money(prelimsDaily)}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>Prelims × {delayDays || 0} day(s)</span>
                  <strong style={{ color: c.black }}>{money(prelimsTotal)}</strong>
                </div>

                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>Fee ({settings.fee_percent || 0}%)</span>
                    <strong style={{ color: c.black }}>{money(feeAmount)}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: c.sub }}>{feeBasisLabel}</div>
                </div>

                <div style={{ height: 1, background: c.border, margin: "2px 0" }} />

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: c.black, fontWeight: 600 }}>CE Total</span>
                  <strong style={{ color: c.black }}>{money(ceTotal)}</strong>
                </div>

                <div style={{ height: 1, background: c.border, margin: "2px 0" }} />

                <div>Use day or week rates only for time-related prelims.</div>
                <div>Delay days multiply the daily equivalent of each prelim line.</div>
                <div>Fee is calculated deterministically from the selected basis.</div>

                {lastSavedAt ? (
                  <div>Last saved at {new Date(lastSavedAt).toLocaleTimeString()}</div>
                ) : (
                  <div>Changes save automatically shortly after you stop typing.</div>
                )}
              </div>
            </SidebarCard>

            <SidebarCard title="Next step">
              <div style={{ marginBottom: 14 }}>
                Once prelims and fee are set, move to review to check the full CE build-up and final
                output structure.
              </div>

              <button
                onClick={() => router.push(buildEventStepPath(eventId, "resources"))}
                style={{
                  width: "100%",
                  border: `1px solid ${c.border}`,
                  background: c.input,
                  color: c.black,
                  padding: "12px",
                  borderRadius: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginBottom: 10,
                }}
              >
                Back to resources
              </button>

              <button
                onClick={() => router.push(buildEventStepPath(eventId, "review"))}
                style={{
                  width: "100%",
                  background: c.black,
                  color: c.blackContrast,
                  padding: "12px",
                  borderRadius: 12,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  marginBottom: 10,
                }}
              >
                Continue to review
              </button>

              <button
                onClick={() => router.push(`/app`)}
                style={{
                  width: "100%",
                  border: `1px solid ${c.border}`,
                  background: c.lightGrey,
                  padding: "12px",
                  borderRadius: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Back to dashboard
              </button>
            </SidebarCard>
          </div>
        </div>
      </div>
    </div>
  );
}
