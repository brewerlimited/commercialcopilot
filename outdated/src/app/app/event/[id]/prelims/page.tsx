"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import CEProgress from "@/components/CEProgress";

type Unit = "day" | "week";

type ValuationSettings = {
  event_id: string;
  fee_percent: number;
  fee_basis: "defined_cost" | "defined_cost_plus_prelims";
  work_days_per_week: number;
};

type PrelimLine = {
  id: string;
  event_id: string;
  name: string;
  qty: number;
  unit: Unit;
  rate: number;
  notes: string | null;
  _localOnly?: boolean;
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
  lightGrey: "#f3f4f6",
};

const PRELIM_SUGGESTIONS = [
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
        background: "#fff",
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
        padding: 12,
        borderRadius: 14,
        border: `1px solid ${c.border}`,
        outline: "none",
        background: "#fff",
        color: c.black,
        fontSize: 14,
        fontWeight: 500,
        fontFamily: "inherit",
        minWidth: 0,
        ...(props.style ?? {}),
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
        padding: 12,
        borderRadius: 14,
        border: `1px solid ${c.border}`,
        outline: "none",
        background: "#fff",
        color: c.black,
        fontSize: 14,
        fontWeight: 500,
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
            color: c.sub,
            marginBottom: 0,
            lineHeight: 1.5,
            fontSize: 13,
          }}
        >
          {hint}
        </p>
      ) : null}

      <div style={{ marginTop: 12 }}>{children}</div>
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
          lineHeight: 1.5,
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
        background: "#fff",
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
            background: "#fff",
            cursor: "pointer",
            fontWeight: 650,
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
  const eventId = (params?.id ?? "").toString();

  const [title, setTitle] = useState<string>("Loading…");
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
  const savingRef = useRef<boolean>(false);

  const [nameFocusId, setNameFocusId] = useState<string | null>(null);
  const [nameQueryById, setNameQueryById] = useState<Record<string, string>>({});

  const prelimsDaily = useMemo(() => calcPrelimsDaily(lines, 5), [lines]);
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

  const isDirty = useMemo(() => {
    if (!loaded) return false;
    const snapshot = JSON.stringify({ delayDays, settings, lines });
    return snapshot !== lastSavedSnapshotRef.current;
  }, [delayDays, settings, lines, loaded]);

  useEffect(() => {
    if (!loaded) return;
    if (status === "saving" || status === "error") return;
    setStatus(isDirty ? "unsaved" : lastSavedAt ? "saved" : "not_saved");
  }, [isDirty, loaded, lastSavedAt, status]);

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
    (async () => {
      setSaveErr(null);
      if (!eventId || !isUuid(eventId)) return;

      const supabase = supabaseBrowser();
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session?.user) {
        router.push("/login");
        return;
      }

      const { data: ev, error: evErr } = await supabase
        .from("events")
        .select("id,title,delay_days")
        .eq("id", eventId)
        .single();

      if (evErr || !ev) {
        setTitle("Event not found");
        setLoaded(true);
        return;
      }

      setTitle(ev.title);
      setDelayDays(clampNum(ev.delay_days, 0));

      const { data: resLines } = await supabase
        .from("event_resource_lines")
        .select("total")
        .eq("event_id", eventId);

      const sum =
        (resLines as any[] | null)?.reduce((s, r) => s + clampNum(r.total, 0), 0) ?? 0;
      setDefinedCost(sum);

      const { data: s } = await supabase
        .from("event_valuation_settings")
        .select("event_id,fee_percent,fee_basis")
        .eq("event_id", eventId)
        .maybeSingle();

      const mergedSettings: ValuationSettings = {
        event_id: eventId,
        fee_percent: clampNum((s as any)?.fee_percent, 12.5),
        fee_basis: ((s as any)?.fee_basis ?? "defined_cost") as
          | "defined_cost"
          | "defined_cost_plus_prelims",
        work_days_per_week: 5,
      };
      setSettings(mergedSettings);

      const { data: p } = await supabase
        .from("event_prelim_lines")
        .select("id,event_id,name,qty,unit,rate,notes")
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
        })) ?? [];

      setLines(mergedLines);

      const snapshot = JSON.stringify({
        delayDays: clampNum(ev.delay_days, 0),
        settings: mergedSettings,
        lines: mergedLines,
      });
      lastSavedSnapshotRef.current = snapshot;
      setStatus("saved");
      setLastSavedAt(Date.now());
      setLoaded(true);
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
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { error: evErr } = await supabase
        .from("events")
        .update({ delay_days: Math.max(0, Math.round(delayDays || 0)) })
        .eq("id", eventId);
      if (evErr) throw evErr;

      const toUpsertSettings = {
        event_id: eventId,
        fee_percent: clampNum(settings.fee_percent, 0),
        fee_basis: settings.fee_basis,
        updated_at: new Date().toISOString(),
      };

      const { error: sErr } = await supabase
        .from("event_valuation_settings")
        .upsert(toUpsertSettings, { onConflict: "event_id" });
      if (sErr) throw sErr;

      const toUpsert = lines
        .filter((l) => l.name.trim())
        .map((l) => ({
          id: isUuid(l.id) ? l.id : undefined,
          event_id: eventId,
          name: l.name.trim(),
          qty: Math.max(0, Math.round(l.qty || 0)),
          unit: l.unit,
          rate: clampNum(l.rate, 0),
          notes: (l.notes ?? "").trim() ? l.notes : null,
        }));

      if (toUpsert.length > 0) {
        const { error: uErr } = await supabase
          .from("event_prelim_lines")
          .upsert(toUpsert as any, { onConflict: "id" });
        if (uErr) throw uErr;
      }

      const persistedIds = lines.filter((l) => isUuid(l.id)).map((l) => l.id);
      const { data: existing } = await supabase
        .from("event_prelim_lines")
        .select("id")
        .eq("event_id", eventId);

      const existingIds = (existing as any[] | null)?.map((x) => x.id) ?? [];
      const toDelete = existingIds.filter((id) => !persistedIds.includes(id));

      if (toDelete.length > 0) {
        const { error: dErr } = await supabase
          .from("event_prelim_lines")
          .delete()
          .in("id", toDelete);
        if (dErr) throw dErr;
      }

      const snapshot = JSON.stringify({ delayDays, settings, lines });
      lastSavedSnapshotRef.current = snapshot;
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

  function addLineFromName(name: string) {
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
      await supabase.from("event_prelim_lines").delete().eq("id", id);
    }
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
                Prelims + Fee
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
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 16,
                alignItems: "start",
              }}
            >
              <div style={{ alignSelf: "start" }}>
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
                      <span style={{ fontWeight: 650, fontSize: 12, color: c.sub }}>Fee %</span>
                      <Input
                        type="number"
                        step={0.1}
                        min={0}
                        value={settings.fee_percent}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            fee_percent: clampNum(e.target.value, 0),
                          }))
                        }
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
                      <span style={{ fontWeight: 650, fontSize: 12, color: c.sub }}>Fee basis</span>
                      <Select
                        value={settings.fee_basis}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            fee_basis: e.target.value as "defined_cost" | "defined_cost_plus_prelims",
                          }))
                        }
                      >
                        <option value="defined_cost">Defined Cost only</option>
                        <option value="defined_cost_plus_prelims">Defined Cost + Prelims</option>
                      </Select>
                    </label>
                  </div>
                </Card>
              </div>

              <div style={{ alignSelf: "start" }}>
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
                      <span style={{ fontWeight: 650, fontSize: 12, color: c.sub }}>Days</span>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={delayDays}
                        onChange={(e) =>
                          setDelayDays(Math.max(0, Math.round(clampNum(e.target.value, 0))))
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
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <SmallBtn
                  onClick={() => {
                    const starter = ["Project Manager", "Quantity Surveyor", "Site Supervisor"];
                    starter.forEach((n) => {
                      if (!lines.some((l) => normalize(l.name) === normalize(n))) {
                        addLineFromName(n);
                      }
                    });
                  }}
                >
                  + Add common prelims
                </SmallBtn>

                <SmallBtn onClick={() => addLineFromName("")}>+ Add line</SmallBtn>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {lines.length === 0 ? (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      border: `1px dashed ${c.border}`,
                      color: c.sub,
                    }}
                  >
                    Add prelim lines (e.g. PM/QS/Supervisor) and set a day/week rate.
                  </div>
                ) : null}

                {lines.map((l) => {
                  const q = nameQueryById[l.id] ?? l.name;
                  const filtered = PRELIM_SUGGESTIONS.filter((x) =>
                    normalize(x).includes(normalize(q))
                  );
                  const showSuggest =
                    nameFocusId === l.id && normalize(q).length >= 1 && filtered.length > 0;

                  const dailyRate = l.unit === "week" ? (l.rate || 0) / 5 : l.rate || 0;
                  const lineDailyTotal = (l.qty || 0) * dailyRate;
                  const lineTotal = lineDailyTotal * (delayDays || 0);

                  return (
                    <div
                      key={l.id}
                      style={{
                        background: "#fff",
                        border: `1px solid ${c.border}`,
                        borderRadius: 16,
                        padding: 12,
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 2.2fr) 84px 132px 120px 132px 44px",
                        gap: 10,
                        alignItems: "end",
                      }}
                    >
                      <div style={{ position: "relative", minWidth: 0 }}>
                        <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
                          <span style={{ fontWeight: 650, fontSize: 12, color: c.sub }}>
                            Prelim item
                          </span>
                          <Input
                            value={q}
                            onChange={(e) => {
                              const v = e.target.value;
                              setNameQueryById((p) => ({ ...p, [l.id]: v }));
                              updateLine(l.id, { name: v });
                            }}
                            onFocus={() => setNameFocusId(l.id)}
                            onBlur={() =>
                              setTimeout(
                                () => setNameFocusId((cur) => (cur === l.id ? null : cur)),
                                150
                              )
                            }
                            placeholder="e.g. Project Manager"
                          />
                        </label>

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

                      <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
                        <span style={{ fontWeight: 650, fontSize: 12, color: c.sub }}>Qty</span>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={l.qty}
                          onChange={(e) =>
                            updateLine(l.id, {
                              qty: Math.max(0, Math.round(clampNum(e.target.value, 0))),
                            })
                          }
                        />
                      </label>

                      <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
                        <span style={{ fontWeight: 650, fontSize: 12, color: c.sub }}>Unit</span>
                        <Select
                          value={l.unit}
                          onChange={(e) => updateLine(l.id, { unit: e.target.value as Unit })}
                        >
                          <option value="day">Per day</option>
                          <option value="week">Per week</option>
                        </Select>
                      </label>

                      <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
                        <span style={{ fontWeight: 650, fontSize: 12, color: c.sub }}>Rate</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={l.rate}
                          onChange={(e) => updateLine(l.id, { rate: clampNum(e.target.value, 0) })}
                        />
                      </label>

                      <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                        <span style={{ fontWeight: 650, fontSize: 12, color: c.sub }}>Line total</span>
                        <div
                          style={{
                            padding: "10px 12px",
                            borderRadius: 14,
                            border: `1px solid ${c.border}`,
                            background: c.soft,
                            fontWeight: 750,
                            color: c.black,
                            whiteSpace: "nowrap",
                          }}
                          title={`Daily: ${money(lineDailyTotal)} × ${delayDays || 0} day(s)`}
                        >
                          {money(lineTotal)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeLine(l.id)}
                        style={{
                          height: 44,
                          width: 44,
                          borderRadius: 14,
                          border: `1px solid ${c.border}`,
                          background: "#fff",
                          cursor: "pointer",
                          fontWeight: 800,
                        }}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
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
              <CEProgress eventId={eventId} currentStep="prelims" />
            </div>

            <SidebarCard title="Guidance">
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>Defined Cost</span>
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

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>Fee ({settings.fee_percent || 0}%)</span>
                  <strong style={{ color: c.black }}>{money(feeAmount)}</strong>
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
                onClick={() => router.push(`/app/event/${eventId}/resources`)}
                style={{
                  width: "100%",
                  border: `1px solid ${c.border}`,
                  background: "white",
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
                onClick={() => router.push(`/app/event/${eventId}/review`)}
                style={{
                  width: "100%",
                  background: "#111827",
                  color: "white",
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