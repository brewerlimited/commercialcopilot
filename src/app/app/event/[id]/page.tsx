"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { buildEventStepPath, normalizeRouteParam } from "@/lib/routeParams";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getOwnedEventOrThrow, getRequiredUser, isAuthErrorMessage, isOwnershipErrorMessage } from "@/lib/security";
import CEProgress from "@/components/CEProgress";
import { calculateTimeRisk, formatDateShort, getDefaultNoticePeriodDays, toDateInputValue } from "@/lib/commercialControl";

type Basis = {
  happened_summary: string;
  cause_type: string | null;
  cause_summary: string;
  difference_from_plan: string;
  mechanism_tags: string[];
  time_impact_toggle: string;
  mitigation_summary: string;
};

type StepKey = "happened" | "cause" | "mechanism" | "time" | "mitigation";

type EventTiming = {
  event_date: string;
  notice_period_days: number | null;
  notification_deadline: string | null;
  contract_type: string | null;
};

const FORM_STEPS: { key: StepKey; label: string }[] = [
  { key: "happened", label: "What happened" },
  { key: "cause", label: "Cause" },
  { key: "mechanism", label: "Mechanism" },
  { key: "time", label: "Time impact" },
  { key: "mitigation", label: "Mitigation" },
];

const MECH_OPTIONS = [
  "standing_time",
  "resequencing",
  "additional_handling",
  "different_plant",
  "longer_distances",
  "rework_abortive",
  "temporary_works",
  "restricted_access",
  "extended_duration_prelims",
];

const CAUSE_OPTIONS = [
  { v: "instruction", label: "Instruction / direction" },
  { v: "access", label: "Access restriction / prevention" },
  { v: "design", label: "Design information / change" },
  { v: "weather", label: "Weather / flooding" },
  { v: "qty_variance", label: "Quantity variance (e.g. 60.4)" },
  { v: "third_party", label: "Third party / utilities" },
  { v: "other", label: "Other" },
];

const c = {
  bg: "var(--background)",
  card: "var(--surface)",
  input: "var(--surface-input)",
  border: "var(--border)",
  sub: "var(--text-muted)",
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
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

const defaultBasis: Basis = {
  happened_summary: "",
  cause_type: null,
  cause_summary: "",
  difference_from_plan: "",
  mechanism_tags: [],
  time_impact_toggle: "unsure",
  mitigation_summary: "",
};


function coerceText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x)).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
    } catch {}
    return value.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function normaliseBasisFromRecord(record: any): Basis {
  const source = record?.basis_of_change || record?.project_event?.basis_of_change || record?.draft_payload?.project_event?.basis_of_change || record?.draftPayload?.project_event?.basis_of_change || record || {};

  return {
    happened_summary:
      coerceText(source.happened_summary) ||
      coerceText(source.what_happened) ||
      coerceText(source.background) ||
      coerceText(record?.happened_summary),
    cause_type: coerceText(source.cause_type || record?.cause_type) || null,
    cause_summary:
      coerceText(source.cause_summary) ||
      coerceText(source.cause) ||
      coerceText(record?.cause_summary),
    difference_from_plan:
      coerceText(source.difference_from_plan) ||
      coerceText(source.difference_from_planned_basis) ||
      coerceText(source.sequence_disruption) ||
      coerceText(record?.difference_from_plan),
    mechanism_tags: normaliseTags(source.mechanism_tags || record?.mechanism_tags),
    time_impact_toggle: coerceText(source.time_impact_toggle || record?.time_impact_toggle) || "unsure",
    mitigation_summary:
      coerceText(source.mitigation_summary) ||
      coerceText(source.mitigation) ||
      coerceText(record?.mitigation_summary),
  };
}

function hasMeaningfulBasis(b: Basis) {
  return Boolean(
    b.happened_summary.trim() ||
      b.cause_summary.trim() ||
      b.difference_from_plan.trim() ||
      b.mitigation_summary.trim() ||
      b.mechanism_tags.length > 0 ||
      b.cause_type
  );
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function clampNum(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function calcProgress(b: Basis, delayDays: number) {
  let done = 0;
  const total = 5;

  if (b.happened_summary.trim()) done++;
  if (b.cause_type && b.cause_summary.trim() && b.difference_from_plan.trim()) done++;
  if (b.mechanism_tags.length > 0) done++;
  if (
    b.time_impact_toggle === "no" ||
    b.time_impact_toggle === "unsure" ||
    (b.time_impact_toggle === "yes" && delayDays > 0)
  ) {
    done++;
  }
  if (b.mitigation_summary.trim()) done++;

  return clamp(Math.round((done / total) * 100), 0, 100);
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
        border: `1px solid ${c.border}`,
        borderRadius: 18,
        padding: "18px 20px",
        background: c.card,
        boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: c.sub,
      }}
    >
      {children}
    </span>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        minHeight: 46,
        padding: 12,
        borderRadius: 16,
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

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        minHeight: 46,
        padding: 12,
        borderRadius: 16,
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

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        minHeight: 46,
        padding: 12,
        borderRadius: 16,
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


function CleanNumberInput({
  value,
  onCommit,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step,
  integer = false,
  placeholder,
}: {
  value: number | null;
  onCommit: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value === null || value === undefined ? "" : String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value === null || value === undefined ? "" : String(value));
  }, [value, focused]);

  function commit(raw: string) {
    if (raw.trim() === "") {
      onCommit(null);
      return;
    }
    let parsed = Number(raw);
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
      placeholder={placeholder}
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

function StepTabs({
  activeStep,
  onStepChange,
}: {
  activeStep: StepKey;
  onStepChange: (step: StepKey) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      {FORM_STEPS.map((step, i) => {
        const active = activeStep === step.key;

        return (
          <button
            key={step.key}
            type="button"
            onClick={() => onStepChange(step.key)}
            style={{
              padding: "8px 10px",
              borderRadius: 999,
              border: `1px solid ${c.border}`,
              background: active ? c.black : c.input,
              color: active ? c.blackContrast : c.black,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {i + 1}. {step.label}
          </button>
        );
      })}
    </div>
  );
}

function GuidanceCard({
  progress,
  statusLabel,
  lastSavedAt,
  delayDays,
}: {
  progress: number;
  statusLabel: string;
  lastSavedAt: number | null;
  delayDays: number;
}) {
  return (
    <SidebarCard title="Guidance">
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span>Basis progress</span>
          <strong style={{ color: c.black }}>{progress}%</strong>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span>Status</span>
          <strong style={{ color: c.black }}>{statusLabel}</strong>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span>Delay days</span>
          <strong style={{ color: c.black }}>{delayDays}</strong>
        </div>

        <div style={{ height: 1, background: c.border, margin: "2px 0" }} />

        {lastSavedAt ? (
          <div>Last saved at {new Date(lastSavedAt).toLocaleTimeString()}</div>
        ) : (
          <div>Changes save automatically shortly after you stop typing.</div>
        )}

        <div>
          Keep this page factual and specific. Dates, locations, restrictions and changed assumptions
          make the later CE narrative much stronger.
        </div>
      </div>
    </SidebarCard>
  );
}

function NextStepCard({
  onSave,
  onContinue,
  canContinue,
}: {
  onSave: () => Promise<void>;
  onContinue: () => Promise<void>;
  canContinue: boolean;
}) {
  return (
    <SidebarCard title="Next step">
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          Once the basis is clear, move to evidence and upload instructions, diaries, photos, programme
          extracts and cost support.
        </div>

        <button
          type="button"
          onClick={() => {
            void onSave();
          }}
          style={{
            width: "100%",
            padding: "11px 12px",
            borderRadius: 12,
            border: `1px solid ${c.border}`,
            background: c.input,
            color: c.black,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Save now
        </button>

        <button
          type="button"
          onClick={() => {
            void onContinue();
          }}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${c.black}`,
            background: c.black,
            color: c.blackContrast,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Continue to Evidence
        </button>

        <button
          type="button"
          onClick={() => {
            window.location.href = "/app";
          }}
          style={{
            width: "100%",
            padding: "11px 12px",
            borderRadius: 12,
            border: `1px solid ${c.border}`,
            background: c.lightGrey,
            color: c.black,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Back to dashboard
        </button>

        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            fontWeight: 600,
            color: canContinue ? c.greenText : c.amberText,
          }}
        >
          {canContinue
            ? "Basis details look complete enough to move on."
            : "You can continue now, but filling the remaining gaps will strengthen the CE narrative."}
        </div>
      </div>
    </SidebarCard>
  );
}

export default function EventBasisPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = normalizeRouteParam(params?.id);

  const [title, setTitle] = useState<string>("Loading…");
  const [basis, setBasis] = useState<Basis>(defaultBasis);
  const [delayDays, setDelayDays] = useState<number>(0);
  const [eventTiming, setEventTiming] = useState<EventTiming>({
    event_date: "",
    notice_period_days: null,
    notification_deadline: null,
    contract_type: null,
  });
  const [loaded, setLoaded] = useState(false);
  const [activeStep, setActiveStep] = useState<StepKey>("happened");

  const [status, setStatus] = useState<"not_saved" | "saved" | "unsaved" | "saving" | "error">("not_saved");
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const lastSavedSnapshotRef = useRef<string>("");
  const [savedVersion, setSavedVersion] = useState(0);
  const savingRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progress = useMemo(() => calcProgress(basis, delayDays), [basis, delayDays]);

  const timeRisk = useMemo(
    () =>
      calculateTimeRisk({
        eventDate: eventTiming.event_date || null,
        noticePeriodDays: eventTiming.notice_period_days ?? getDefaultNoticePeriodDays(eventTiming.contract_type),
        notificationDeadline: eventTiming.notification_deadline,
      }),
    [eventTiming]
  );

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        basis,
        delayDays,
        eventTiming,
      }),
    [basis, delayDays, eventTiming]
  );

  const isDirty = useMemo(() => {
    if (!loaded) return false;
    return currentSnapshot !== lastSavedSnapshotRef.current;
  }, [currentSnapshot, loaded, savedVersion]);

  const qualityHints = useMemo(() => {
    const hints: string[] = [];

    if (!basis.happened_summary.trim()) {
      hints.push("Add a clear what happened summary with dates and location.");
    }
    if (!basis.cause_type) {
      hints.push("Select a cause type.");
    }
    if (!basis.cause_summary.trim()) {
      hints.push("Explain what caused the event.");
    }
    if (!basis.difference_from_plan.trim()) {
      hints.push("State what differed from the accepted plan or assumption.");
    }
    if (basis.mechanism_tags.length === 0) {
      hints.push("Select at least one execution mechanism.");
    }
    if (basis.time_impact_toggle === "yes" && delayDays <= 0) {
      hints.push("Enter the programme impact in days.");
    }
    if (!basis.mitigation_summary.trim()) {
      hints.push("Add mitigation or explain why mitigation was limited.");
    }

    return hints;
  }, [basis, delayDays]);

  const badgeStyle = useMemo(() => {
    if (status === "error") {
      return { bg: c.redBg, bd: c.redBorder, tx: c.redText, label: "Save failed" };
    }
    if (status === "saving") {
      return { bg: c.amberBg, bd: c.amberBorder, tx: c.amberText, label: "Saving…" };
    }
    if (status === "unsaved") {
      return { bg: c.amberBg, bd: c.amberBorder, tx: c.amberText, label: "Unsaved changes" };
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

        let ev: any;
        try {
          ev = await getOwnedEventOrThrow(
            supabase,
            eventId,
            user.id,
            "id,title,delay_days,user_id,event_date,notice_period_days,notification_deadline,contract_type"
          );
        } catch (eventLoadError: any) {
          const message = String(eventLoadError?.message || "");
          const optionalColumnMissing = /event_date|notice_period_days|notification_deadline/i.test(message);
          if (!optionalColumnMissing) throw eventLoadError;

          ev = await getOwnedEventOrThrow(
            supabase,
            eventId,
            user.id,
            "id,title,delay_days,user_id,contract_type"
          );
        }

        setTitle((ev as any).title);
        setDelayDays(clampNum((ev as any).delay_days, 0));
        const loadedTiming: EventTiming = {
          event_date: toDateInputValue((ev as any).event_date),
          notice_period_days: (ev as any).notice_period_days ?? getDefaultNoticePeriodDays((ev as any).contract_type),
          notification_deadline: toDateInputValue((ev as any).notification_deadline),
          contract_type: (ev as any).contract_type ?? null,
        };
        setEventTiming(loadedTiming);


      const basisRes = await (supabase as any).from("event_basis")
        .select("*")
        .eq("event_id", eventId)
        .maybeSingle();

      if (basisRes.error) {
        console.warn("Could not load event_basis row", basisRes.error);
      }

      let merged: Basis = {
        ...defaultBasis,
        ...(basisRes.data ? normaliseBasisFromRecord(basisRes.data) : {}),
      };

      // Safety net: if a previous UI pass failed to display the basis row, do not leave
      // existing CEs looking blank. Try to recover from the most recent generated payload.
      if (!hasMeaningfulBasis(merged)) {
        const draftRes = await (supabase as any).from("event_ai_drafts")
          .select("draft_payload,draft_output,created_at")
          .eq("event_id", eventId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!draftRes.error && Array.isArray(draftRes.data)) {
          for (const draft of draftRes.data) {
            const recovered = normaliseBasisFromRecord(draft?.draft_payload || draft?.draft_output || draft);
            if (hasMeaningfulBasis(recovered)) {
              merged = { ...defaultBasis, ...recovered };
              break;
            }
          }
        }
      }

      const initialSnapshot = JSON.stringify({
        basis: merged,
        delayDays: clampNum((ev as any).delay_days, 0),
        eventTiming: loadedTiming,
      });

      setBasis(merged);
      lastSavedSnapshotRef.current = initialSnapshot;
      setSavedVersion((v) => v + 1);
      setStatus(hasMeaningfulBasis(merged) ? "saved" : "not_saved");
      setLastSavedAt(hasMeaningfulBasis(merged) ? Date.now() : null);
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
        setSaveErr(e?.message ?? "Failed to load basis");
        setLoaded(true);
      }
    })();
  }, [eventId, router]);

  useEffect(() => {
    if (!loaded) return;
    if (status === "saving" || status === "error") return;

    const nextDirty = currentSnapshot !== lastSavedSnapshotRef.current;
    setStatus(nextDirty ? "unsaved" : lastSavedAt ? "saved" : "not_saved");
  }, [currentSnapshot, loaded, lastSavedAt, status, savedVersion]);

  useEffect(() => {
    if (!loaded) return;
    if (!isDirty) return;
    if (savingRef.current) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      void saveNow();
    }, 1200);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [currentSnapshot, isDirty, loaded]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (!isSave) return;

      e.preventDefault();
      void saveNow();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentSnapshot, loaded]);

  function updateBasis<K extends keyof Basis>(key: K, value: Basis[K]) {
    setBasis((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function toggleMechanism(tag: string) {
    setBasis((prev) => {
      const set = new Set(prev.mechanism_tags);
      if (set.has(tag)) {
        set.delete(tag);
      } else {
        set.add(tag);
      }

      return {
        ...prev,
        mechanism_tags: Array.from(set),
      };
    });
  }

  async function saveNow() {
    if (!loaded) return;
    if (!eventId || !isUuid(eventId)) return;
    if (savingRef.current) return;

    const snap = JSON.stringify({
      basis,
      delayDays,
      eventTiming,
    });

    if (snap === lastSavedSnapshotRef.current) return;

    savingRef.current = true;
    setStatus("saving");
    setSaveErr(null);

    try {
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      await getOwnedEventOrThrow(supabase, eventId, user.id);

      const basisPayload = {
        event_id: eventId,
        happened_summary: basis.happened_summary,
        cause_type: basis.cause_type,
        cause_summary: basis.cause_summary,
        difference_from_plan: basis.difference_from_plan,
        mechanism_tags: basis.mechanism_tags,
        time_impact_toggle: basis.time_impact_toggle,
        mitigation_summary: basis.mitigation_summary,
        updated_at: new Date().toISOString(),
      };

      // Never let a blank UI state overwrite a meaningful existing basis row.
      if (!hasMeaningfulBasis(basis)) {
        const existing = await (supabase as any).from("event_basis")
          .select("*")
          .eq("event_id", eventId)
          .maybeSingle();
        const existingBasis = existing.data ? normaliseBasisFromRecord(existing.data) : defaultBasis;
        if (hasMeaningfulBasis(existingBasis)) {
          setBasis(existingBasis);
          throw new Error("Existing CE basis was protected from being overwritten by a blank form. Reloaded the saved data instead.");
        }
      }

      const { error: basisError } = await (supabase as any).from("event_basis")
        .upsert(basisPayload, { onConflict: "event_id" });

      if (basisError) throw basisError;

      const eventUpdatePayload = {
        delay_days: basis.time_impact_toggle === "yes" ? Math.max(0, Math.round(delayDays)) : 0,
        event_date: eventTiming.event_date || null,
        notice_period_days: eventTiming.notice_period_days,
        notification_deadline: timeRisk.deadline ? timeRisk.deadline.toISOString().slice(0, 10) : null,
      };

      const eventUpdate = await (supabase as any).from("events")
        .update(eventUpdatePayload)
        .eq("id", eventId)
        .eq("user_id", user.id);

      if (eventUpdate.error) {
        const message = String(eventUpdate.error.message || "");
        const optionalColumnMissing = /event_date|notice_period_days|notification_deadline/i.test(message);
        if (!optionalColumnMissing) throw eventUpdate.error;

        throw new Error(
          "Event date could not be saved because the notice-risk database columns are missing. Run EVENT_DATE_NOTICE_RISK_PATCH.sql in Supabase, then refresh this CE."
        );
      }

      const savedTiming: EventTiming = {
        ...eventTiming,
        notification_deadline: timeRisk.deadline ? timeRisk.deadline.toISOString().slice(0, 10) : null,
      };

      // Do not blindly write savedTiming back into state here. If the user changes
      // the date while autosave is in flight, replacing state with this stale
      // closure value makes the date field feel locked until they delete it.
      setEventTiming((current) => {
        if (
          current.event_date === eventTiming.event_date &&
          current.notice_period_days === eventTiming.notice_period_days
        ) {
          return { ...current, notification_deadline: savedTiming.notification_deadline };
        }
        return current;
      });

      lastSavedSnapshotRef.current = JSON.stringify({
        basis,
        delayDays,
        eventTiming: savedTiming,
      });
      setSavedVersion((v) => v + 1);
      setStatus("saved");
      setLastSavedAt(Date.now());
    } catch (e: any) {
      setStatus("error");
      setSaveErr(e?.message ?? "Save failed");
    } finally {
      savingRef.current = false;
    }
  }

  async function continueToEvidence() {
    await saveNow();
    router.push(buildEventStepPath(eventId, "evidence"));
  }

  if (!eventId || !isUuid(eventId)) {
    return (
      <div
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          borderRadius: 22,
          padding: 20,
        }}
      >
        <div style={{ fontWeight: 700, color: c.black }}>Loading event…</div>
        <div style={{ marginTop: 8, color: c.sub, fontSize: 13 }}>
          If this stays here, refresh the page.
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
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
    );
  }

  const basisReady = qualityHints.length === 0;

  return (
    <div style={{ background: c.bg, minHeight: "100vh" }}>
      <div style={{ padding: "22px 18px", maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 380px",
            gap: 20,
            alignItems: "start",
          }}
        >
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
                Basis of Change
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
                Set out what changed, why it matters, and how the event has affected the works.
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
                    border: `1px solid ${badgeStyle.bd}`,
                    background: badgeStyle.bg,
                    color: badgeStyle.tx,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {badgeStyle.label}
                </span>

                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: `1px solid ${c.border}`,
                    background: c.input,
                    color: c.sub,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Basis {progress}%
                </span>

                {lastSavedAt ? (
                  <span style={{ fontSize: 12, color: c.sub }}>
                    Last saved at {new Date(lastSavedAt).toLocaleTimeString()}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: c.sub }}>Autosave on</span>
                )}
              </div>
            </div>

            <Card
              title="Event date & notice risk"
              hint="Used by the commercial dashboard to calculate time-bar risk from the contract notice period. Bespoke contract review can later extract this rule from uploaded contracts, but the calculated rule is stored here for transparency."
            >
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(180px, 0.5fr)", gap: 14, alignItems: "end" }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <Label>Event date / date became known</Label>
                  <Input
                    type="date"
                    value={eventTiming.event_date}
                    onChange={(e) =>
                      setEventTiming((prev) => ({
                        ...prev,
                        event_date: e.target.value,
                        notification_deadline: null,
                      }))
                    }
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <Label>Notice period (days)</Label>
                  <CleanNumberInput
                    min={0}
                    step={1}
                    integer
                    value={eventTiming.notice_period_days}
                    onCommit={(value) =>
                      setEventTiming((prev) => ({
                        ...prev,
                        notice_period_days: value === null ? null : Math.max(0, Math.round(value)),
                        notification_deadline: null,
                      }))
                    }
                    placeholder="e.g. 56"
                  />
                </label>
              </div>

              <div
                style={{
                  marginTop: 14,
                  border: `1px solid ${
                    timeRisk.state === "overdue" ? c.redBorder : timeRisk.state === "due_soon" ? c.amberBorder : c.border
                  }`,
                  background: timeRisk.state === "overdue" ? c.redBg : timeRisk.state === "due_soon" ? c.amberBg : c.input,
                  borderRadius: 16,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: c.black }}>{timeRisk.label}</div>
                  <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: c.sub }}>{timeRisk.detail}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: c.sub, textTransform: "uppercase", letterSpacing: 0.45 }}>Deadline</div>
                  <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800, color: c.black }}>
                    {timeRisk.deadline ? formatDateShort(timeRisk.deadline) : "—"}
                  </div>
                </div>
              </div>
            </Card>

            <Card
              title="Build the event basis"
              hint="Work through each section and keep it factual. You are setting up the narrative and entitlement logic here."
            >
              <StepTabs activeStep={activeStep} onStepChange={setActiveStep} />
            </Card>

            {saveErr ? (
              <div
                style={{
                  background: c.redBg,
                  border: `1px solid ${c.redBorder}`,
                  color: c.redText,
                  padding: 12,
                  borderRadius: 16,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {saveErr}
              </div>
            ) : null}

            {activeStep === "happened" && (
              <Card
                title="1) What happened?"
                hint="Plain English. Include date(s), location and what you were trying to do."
              >
                <Textarea
                  value={basis.happened_summary}
                  onChange={(e) => updateBasis("happened_summary", e.target.value)}
                  rows={6}
                  placeholder="e.g. Access to ST43 was blocked by flooding on 16/01/26. Works could not proceed until pumping completed and the area was made safe."
                />
              </Card>
            )}

            {activeStep === "cause" && (
              <Card
                title="2) Why did it happen?"
                hint="Select the trigger and explain what differed from the accepted plan or assumed conditions."
              >
                <div style={{ display: "grid", gap: 18 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <Label>Cause type</Label>
                    <Select
                      value={basis.cause_type ?? ""}
                      onChange={(e) =>
                        updateBasis("cause_type", e.target.value ? e.target.value : null)
                      }
                    >
                      <option value="">Select…</option>
                      {CAUSE_OPTIONS.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <Label>Cause summary</Label>
                    <Textarea
                      value={basis.cause_summary}
                      onChange={(e) => updateBasis("cause_summary", e.target.value)}
                      rows={4}
                      placeholder="Explain the direct cause of the event."
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <Label>What differed from the accepted plan / assumption?</Label>
                    <Textarea
                      value={basis.difference_from_plan}
                      onChange={(e) => updateBasis("difference_from_plan", e.target.value)}
                      rows={4}
                      placeholder="State what was expected and what was actually encountered."
                    />
                  </label>
                </div>
              </Card>
            )}

            {activeStep === "mechanism" && (
              <Card
                title="3) How did it change execution?"
                hint="Select the mechanisms that actually occurred on site."
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {MECH_OPTIONS.map((tag) => {
                    const selected = basis.mechanism_tags.includes(tag);

                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleMechanism(tag)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 999,
                          border: `1px solid ${c.border}`,
                          background: selected ? c.black : c.input,
                          color: selected ? c.blackContrast : c.black,
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        {tag.replaceAll("_", " ")}
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}

            {activeStep === "time" && (
              <Card
                title="4) Time impact"
                hint="If the programme was affected, enter the delay in days so it can feed through into prelims later."
              >
                <div style={{ display: "grid", gap: 18 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <Label>Did it affect the programme?</Label>
                    <Select
                      value={basis.time_impact_toggle}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateBasis("time_impact_toggle", value);

                        if (value !== "yes") {
                          setDelayDays(0);
                        }
                      }}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                      <option value="unsure">Unsure</option>
                    </Select>
                  </label>

                  {basis.time_impact_toggle === "yes" ? (
                    <label style={{ display: "grid", gap: 6 }}>
                      <Label>How long was the programme impacted by? (days)</Label>
                      <CleanNumberInput
                        min={0}
                        step={1}
                        integer
                        value={delayDays}
                        onCommit={(value) => setDelayDays(Math.max(0, Math.round(value ?? 0)))}
                        placeholder="Enter number of days"
                      />
                    </label>
                  ) : null}
                </div>
              </Card>
            )}

            {activeStep === "mitigation" && (
              <Card
                title="5) Mitigation"
                hint="What was done to reduce the impact, or why was mitigation not reasonably possible?"
              >
                <Textarea
                  value={basis.mitigation_summary}
                  onChange={(e) => updateBasis("mitigation_summary", e.target.value)}
                  rows={6}
                  placeholder="Explain any mitigation, resequencing, additional attendances or why options were limited."
                />
              </Card>
            )}
          </div>

          <div
            style={{
              position: "sticky",
              top: 20,
              alignSelf: "start",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div
              style={{
                border: `1px solid ${c.border}`,
                borderRadius: 18,
                padding: "16px 18px",
                background: c.card,
                boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
              }}
            >
              <CEProgress eventId={eventId} currentStep="details" />
            </div>

            <GuidanceCard
              progress={progress}
              statusLabel={badgeStyle.label}
              lastSavedAt={lastSavedAt}
              delayDays={delayDays}
            />

            <SidebarCard title="Quality checks">
              {qualityHints.length === 0 ? (
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: c.greenText,
                  }}
                >
                  Basis details look solid enough to move on.
                </div>
              ) : (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 0,
                    listStyle: "none",
                    color: c.sub,
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {qualityHints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              )}
            </SidebarCard>

            <NextStepCard onSave={saveNow} onContinue={continueToEvidence} canContinue={basisReady} />
          </div>
        </div>
      </div>
    </div>
  );
}
