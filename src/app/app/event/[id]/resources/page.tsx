"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { buildEventStepPath, normalizeRouteParam } from "@/lib/routeParams";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getOwnedEventOrThrow, getRequiredUser, isAuthErrorMessage, isOwnershipErrorMessage } from "@/lib/security";
import CEProgress from "@/components/CEProgress";
import { getResourceLibrary } from "@/lib/resourceLibrary";
import { getCostLabel } from "@/lib/contracts";
import { recalculateEventFinancialSummary } from "@/lib/financialSummary";

type Category = "labour" | "plant" | "material";
type Tab = Category | "prelims";
type Unit = "hour" | "day" | "week" | "each" | "m" | "m2" | "m3" | "t" | "kg" | "l" | "sheet" | "bag";

type RateCard = {
  id: string;
  category: Category;
  name: string;
  unit: Unit;
  rate: number;
  active: boolean;
  source_type?: "custom" | "ceca" | null;
  ceca_rate?: number | null;
  adjustment_percent?: number | null;
  final_rate?: number | null;
  project_name?: string | null;
  main_contractor?: string | null;
};

type SuggestionItem = {
  id: string;
  name: string;
  unit: string;
  rate?: number;
  source: "rate_card" | "library";
  sourceLabel?: string;
  sourceDetail?: string;
};

type Line = {
  id: string;
  event_id: string;
  category: Category;
  item_name: string;
  unit: Unit;
  hours: number | null;
  qty: number;
  rate: number;
  total: number;
  notes: string | null;
  tags: string[];
  start_date: string | null;
  end_date: string | null;
  linked_event: string | null;
  _localOnly?: boolean;
};

type ActivityRecord = {
  id: string;
  title: string;
  date: string | null;
  notes: string | null;
};

type ActivityBucket = ActivityRecord & {
  key: string;
  lines: Line[];
  hidden?: boolean;
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
  blueBg: "var(--blue-bg)",
  blueBorder: "var(--blue-border)",
  blueText: "var(--blue-text)",
  amberBg: "var(--amber-bg)",
  amberBorder: "var(--amber-border)",
  amberText: "var(--amber-text)",
  lightGrey: "var(--surface-soft)",
};

const TAG_OPTIONS = [
  { key: "standing_time", label: "Standing time" },
  { key: "resequencing", label: "Resequencing" },
  { key: "additional_handling", label: "Additional handling" },
  { key: "different_plant", label: "Different plant" },
  { key: "longer_distances", label: "Longer distances" },
  { key: "rework_abortive", label: "Rework / abortive" },
  { key: "temporary_works", label: "Temporary works" },
  { key: "restricted_access", label: "Restricted access" },
  { key: "extended_duration_prelims", label: "Extended duration prelims" },
];

function clampNum(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function money(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
}

function calcLineTotal(line: Line) {
  const rate = Number(line.rate) || 0;
  const qty = Number(line.qty) || 0;

  if (line.unit === "hour") {
    const hours = Number(line.hours) || 0;
    return hours * qty * rate;
  }

  return qty * rate;
}

function labelTab(t: Tab) {
  if (t === "labour") return "Labour";
  if (t === "plant") return "Plant";
  if (t === "material") return "Material";
  return "Prelims + Fee";
}


function normaliseActivityValue(value?: string | null, fallback = "") {
  return (value || fallback).trim();
}

function getActivityKey(activity: { title?: string | null; date?: string | null; notes?: string | null }) {
  const title = normaliseActivityValue(activity.title, "General activity") || "General activity";
  const date = normaliseActivityValue(activity.date);
  const notes = normaliseActivityValue(activity.notes, "General notes") || "General notes";
  return [title, date, notes].join("||").toLowerCase();
}

function getHiddenActivityStorageKey(tab: Category, bucketKey: string) {
  return `${tab}:${bucketKey}`;
}

function titleCaseLabel(category: Category) {
  if (category === "labour") return "Labour";
  if (category === "plant") return "Plant";
  return "Material";
}

function sourceLabelForRateCard(rateCard?: RateCard | null) {
  if (!rateCard) return null;
  if (rateCard.source_type === "ceca") {
    const adj = Number(rateCard.adjustment_percent ?? 0);
    const sign = adj > 0 ? "+" : "";
    return `CECA 2025 · ${sign}${adj}% applied`;
  }
  return "Custom project rate";
}

function sourceDetailForRateCard(rateCard?: RateCard | null) {
  if (!rateCard) return null;
  if (rateCard.source_type === "ceca") {
    return `Base ${money(Number(rateCard.ceca_rate ?? rateCard.rate ?? 0))}/${rateCard.unit}`;
  }
  return `${money(Number(rateCard.rate ?? 0))}/${rateCard.unit}`;
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

export default function ResourcesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = normalizeRouteParam(params?.id);

  const supabase = useMemo(() => supabaseBrowser(), []);

  const [activeTab, setActiveTab] = useState<Tab>("labour");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [eventTitle, setEventTitle] = useState<string>("");
  const [contractType, setContractType] = useState<string | null>(null);

  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [hiddenActivityKeys, setHiddenActivityKeys] = useState<Record<string, boolean>>({});
  const [viewportWidth, setViewportWidth] = useState<number>(1440);
  const [editingQty, setEditingQty] = useState<Record<string, string>>({});
  const [editingRate, setEditingRate] = useState<Record<string, string>>({});

  const [draftActivityTitle, setDraftActivityTitle] = useState("");
  const [draftTaskDate, setDraftTaskDate] = useState("");
  const [draftTaskDescription, setDraftTaskDescription] = useState("");

  const [activeSuggestFor, setActiveSuggestFor] = useState<string | null>(null);
  const [suggestQuery, setSuggestQuery] = useState<string>("");
  const [highlightedSuggestIndex, setHighlightedSuggestIndex] = useState(0);
  const suggestRef = useRef<HTMLDivElement | null>(null);

  const [tagsOpenFor, setTagsOpenFor] = useState<string | null>(null);
  const [detailsOpenFor, setDetailsOpenFor] = useState<string | null>(null);
  const tagsRef = useRef<HTMLDivElement | null>(null);
  const lastSavedSnapshotRef = useRef<string>("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!eventId || typeof window === "undefined") return;
    try {
      const rawActivities = window.localStorage.getItem(`ccp_resource_activities_${eventId}`);
      const rawHidden = window.localStorage.getItem(`ccp_hidden_resource_activities_${eventId}`);
      setActivities(rawActivities ? JSON.parse(rawActivities) : []);
      setHiddenActivityKeys(rawHidden ? JSON.parse(rawHidden) : {});
    } catch {
      setActivities([]);
      setHiddenActivityKeys({});
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId || typeof window === "undefined") return;
    window.localStorage.setItem(`ccp_resource_activities_${eventId}`, JSON.stringify(activities));
  }, [activities, eventId]);

  useEffect(() => {
    if (!eventId || typeof window === "undefined") return;
    window.localStorage.setItem(`ccp_hidden_resource_activities_${eventId}`, JSON.stringify(hiddenActivityKeys));
  }, [hiddenActivityKeys, eventId]);

  function serialiseLines(nextLines: Line[]) {
    return JSON.stringify(
      nextLines.map((l) => ({
        id: l._localOnly ? "local" : l.id,
        category: l.category,
        item_name: l.item_name,
        unit: l.unit,
        hours: l.hours ?? null,
        qty: Number(l.qty ?? 0),
        rate: Number(l.rate ?? 0),
        total: Number(l.total ?? 0),
        notes: l.notes ?? null,
        tags: Array.isArray(l.tags) ? [...l.tags].sort() : [],
        start_date: l.start_date ?? null,
        end_date: l.end_date ?? null,
        linked_event: l.linked_event ?? null,
      }))
    );
  }

  const costLabel = useMemo(() => getCostLabel(contractType), [contractType]);

  const totals = useMemo(() => {
    const labour = lines
      .filter((l) => l.category === "labour")
      .reduce((a, l) => a + (Number(l.total) || 0), 0);

    const plant = lines
      .filter((l) => l.category === "plant")
      .reduce((a, l) => a + (Number(l.total) || 0), 0);

    const material = lines
      .filter((l) => l.category === "material")
      .reduce((a, l) => a + (Number(l.total) || 0), 0);

    const definedCost = labour + plant + material;
    return { labour, plant, material, definedCost };
  }, [lines]);


  const activityBuckets = useMemo(() => {
    const activeCategoryLines = activeTab === "prelims" ? [] : lines.filter((line) => line.category === activeTab);

    const derivedFromLines = activeCategoryLines.reduce<ActivityRecord[]>((acc, line) => {
      const title = normaliseActivityValue(line.linked_event, "General activity") || "General activity";
      const date = line.start_date ?? null;
      const notes = normaliseActivityValue(line.notes, "General notes") || "General notes";
      const key = getActivityKey({ title, date, notes });
      if (!acc.find((entry) => getActivityKey(entry) === key)) {
        acc.push({ id: `derived_${key}`, title, date, notes });
      }
      return acc;
    }, []);

    const mergedBase = [...activities, ...derivedFromLines].reduce<ActivityRecord[]>((acc, activity) => {
      const title = normaliseActivityValue(activity.title, "General activity") || "General activity";
      const date = activity.date ?? null;
      const notes = normaliseActivityValue(activity.notes, "General notes") || "General notes";
      const key = getActivityKey({ title, date, notes });
      if (!acc.find((entry) => getActivityKey(entry) === key)) {
        acc.push({ id: activity.id || key, title, date, notes });
      }
      return acc;
    }, []);

    return mergedBase
      .map<ActivityBucket>((activity) => {
        const key = getActivityKey(activity);
        const bucketLines = activeCategoryLines
          .filter((line) => getActivityKey({
            title: normaliseActivityValue(line.linked_event, "General activity") || "General activity",
            date: line.start_date ?? null,
            notes: normaliseActivityValue(line.notes, "General notes") || "General notes",
          }) === key)
          .sort((a, b) => a.item_name.localeCompare(b.item_name));

        return {
          ...activity,
          key,
          lines: bucketLines,
          hidden: !!hiddenActivityKeys[getHiddenActivityStorageKey(activeTab as Category, key)] && bucketLines.length === 0,
        };
      })
      .sort((a, b) => {
        const byTitle = a.title.localeCompare(b.title);
        if (byTitle !== 0) return byTitle;
        const byDate = (a.date || "").localeCompare(b.date || "");
        if (byDate !== 0) return byDate;
        return (a.notes || "").localeCompare(b.notes || "");
      });
  }, [activities, hiddenActivityKeys, lines, activeTab]);

  const visibleActivityBuckets = useMemo(() => {
    if (activeTab === "prelims") return [] as ActivityBucket[];
    return activityBuckets.filter((bucket) => !bucket.hidden);
  }, [activityBuckets, activeTab]);

  const hiddenBucketCount = useMemo(() => {
    if (activeTab === "prelims") return 0;
    return activityBuckets.filter((bucket) => bucket.hidden).length;
  }, [activityBuckets, activeTab]);

  const filteredSuggestions = useMemo(() => {
    const q = (suggestQuery || "").trim().toLowerCase();
    const tabCat: Category | null = activeTab === "prelims" ? null : activeTab;
    if (!tabCat) return [] as SuggestionItem[];

    const activeRateCards = rateCards
      .filter((r) => r.active)
      .filter((r) => r.category === tabCat)
      .map((r) => ({
        id: `rate_${r.id}`,
        name: r.name,
        unit: r.unit,
        rate: Number(r.rate ?? 0),
        source: "rate_card" as const,
        sourceLabel: sourceLabelForRateCard(r) ?? undefined,
        sourceDetail: sourceDetailForRateCard(r) ?? undefined,
      }));

    const libraryItems = getResourceLibrary(tabCat).map((item) => ({
      id: `lib_${tabCat}_${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: item.name,
      unit: item.unit,
      source: "library" as const,
      sourceLabel: "Library item",
      sourceDetail: `${item.unit} · enter your project rate`,
    }));

    const merged = [...activeRateCards, ...libraryItems];
    const seen = new Set<string>();
    const deduped = merged.filter((item) => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const ranked = deduped
      .filter((item) => (!q ? true : item.name.toLowerCase().includes(q)))
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aStarts = q ? aName.startsWith(q) : false;
        const bStarts = q ? bName.startsWith(q) : false;
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        if (a.source !== b.source) return a.source === "rate_card" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return ranked.slice(0, q ? 12 : 10);
  }, [rateCards, suggestQuery, activeTab]);

  const matchedRateCardByName = useMemo(() => {
    const map = new Map<string, RateCard>();
    for (const rateCard of rateCards) {
      const key = `${rateCard.category}::${rateCard.name.trim().toLowerCase()}`;
      if (!map.has(key)) map.set(key, rateCard);
    }
    return map;
  }, [rateCards]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (activeSuggestFor) {
        const el = suggestRef.current;
        if (!(el && e.target instanceof Node && el.contains(e.target))) {
          setActiveSuggestFor(null);
          setSuggestQuery("");
        }
      }

      if (tagsOpenFor) {
        const el2 = tagsRef.current;
        if (!(el2 && e.target instanceof Node && el2.contains(e.target))) {
          setTagsOpenFor(null);
        }
      }
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [activeSuggestFor, tagsOpenFor]);

  async function load() {
    if (!eventId) return;
    setLoading(true);
    setError(null);

    try {
      const user = await getRequiredUser(supabase);
      const ev = await getOwnedEventOrThrow(supabase, eventId, user.id, "id,title,user_id,project_name,main_contractor,contract_type");
      setEventTitle((ev as any).title ?? "");
      setContractType((ev as any).contract_type ?? null);

      const eventProjectName = (ev as any).project_name ?? null;
      const eventMainContractor = (ev as any).main_contractor ?? null;

      let rcQuery = (supabase as any).from("rate_cards")
        .select("id,category,name,unit,rate,active,source_type,ceca_rate,adjustment_percent,final_rate,project_name,main_contractor")
        .eq("user_id", (ev as any).user_id);

      if (eventProjectName) {
        rcQuery = rcQuery.eq("project_name", eventProjectName);
      }

      const rc = await rcQuery
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (rc.error) throw rc.error;
      const eventContractor = String(eventMainContractor ?? "").trim();
      const scopedRateCards = ((rc.data || []) as RateCard[]).filter((row) => {
        const rowContractor = String(row.main_contractor ?? "").trim();
        return rowContractor === eventContractor;
      });
      setRateCards(scopedRateCards);

      const ln = await (supabase as any).from("event_resource_lines")
        .select("id,event_id,category,item_name,unit,hours,qty,rate,total,notes,tags,start_date,end_date,linked_event,created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (ln.error) throw ln.error;

      const loadedLines = (ln.data || []).map((x: any) => ({
        id: x.id,
        event_id: x.event_id,
        category: x.category,
        item_name: x.item_name,
        unit: x.unit,
        hours: x.hours,
        qty: Number(x.qty ?? 1),
        rate: Number(x.rate ?? 0),
        total: Number(x.total ?? 0),
        notes: x.notes ?? null,
        tags: Array.isArray(x.tags) ? x.tags : [],
        start_date: x.start_date ?? null,
        end_date: x.end_date ?? null,
        linked_event: x.linked_event ?? null,
      }));

      setLines(loadedLines);
      lastSavedSnapshotRef.current = serialiseLines(loadedLines);
      setSaveState("saved");
      setLastSavedAt(Date.now());
    } catch (e: any) {
      setError(e?.message ?? "Failed to load resources");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (loading) return;
    if (error) {
      setSaveState("error");
      return;
    }
    if (saving) {
      setSaveState("saving");
      return;
    }

    const currentSnapshot = serialiseLines(lines);
    setSaveState(currentSnapshot === lastSavedSnapshotRef.current ? "saved" : "unsaved");
  }, [lines, loading, error, saving]);

  function openSuggest(lineId: string, currentValue: string) {
    setActiveSuggestFor(lineId);
    setSuggestQuery(currentValue ?? "");
    setHighlightedSuggestIndex(0);
  }

  function closeSuggest() {
    setActiveSuggestFor(null);
    setSuggestQuery("");
    setHighlightedSuggestIndex(0);
  }

  function pickSuggestion(lineId: string, suggestion: SuggestionItem) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const next: Line = {
          ...l,
          item_name: suggestion.name,
          unit: suggestion.unit as Unit,
          rate: suggestion.source === "rate_card" ? Number(suggestion.rate ?? 0) : l.rate,
        };
        next.total = calcLineTotal(next);
        return next;
      })
    );
    closeSuggest();
  }

  function addLine(category: Category, defaults?: Partial<Line>) {
    if (!eventId) return;
    const tempId = `temp_${Math.random().toString(36).slice(2)}`;

    const unit: Unit = category === "material" ? "each" : "hour";

    const base: Line = {
      id: tempId,
      event_id: eventId,
      category,
      item_name: "",
      unit,
      hours: unit === "hour" ? 0 : null,
      qty: 1,
      rate: 0,
      total: 0,
      notes: defaults?.notes ?? null,
      tags: [],
      start_date: defaults?.start_date ?? null,
      end_date: null,
      linked_event: defaults?.linked_event ?? null,
      _localOnly: true,
    };

    setLines((prev) => [...prev, base]);
  }

  function updateLine(lineId: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const next = { ...l, ...patch } as Line;
        next.total = calcLineTotal(next);
        return next;
      })
    );
  }

  async function persistLine(line: Line) {
    if (!eventId) return;
    setSaving("Saving...");
    setSaveState("saving");
    setError(null);

    try {
      const user = await getRequiredUser(supabase);
      await getOwnedEventOrThrow(supabase, eventId, user.id);

      const payload = {
        event_id: eventId,
        category: line.category,
        item_name: line.item_name,
        unit: line.unit,
        hours: line.unit === "hour" ? Number(line.hours ?? 0) : null,
        qty: Number(line.qty ?? 1),
        rate: Number(line.rate ?? 0),
        total: Number(line.total ?? 0),
        notes: line.notes,
        tags: line.tags ?? [],
        start_date: line.start_date,
        end_date: line.end_date,
        linked_event: line.linked_event,
      };

      if (line._localOnly) {
        const ins = await (supabase as any).from("event_resource_lines")
          .insert(payload)
          .select("id")
          .single();
        if (ins.error) throw ins.error;

        await recalculateEventFinancialSummary(supabase, eventId, user.id);

        setLines((prev) => {
          const next = prev.map((x) => (x.id === line.id ? { ...line, id: (ins.data as any)?.id, _localOnly: false } : x));
          lastSavedSnapshotRef.current = serialiseLines(next);
          setLastSavedAt(Date.now());
          setSaveState("saved");
          return next;
        });
      } else {
        const up = await (supabase as any).from("event_resource_lines").update(payload).eq("id", line.id).eq("event_id", eventId);
        if (up.error) throw up.error;

        await recalculateEventFinancialSummary(supabase, eventId, user.id);

        setLines((prev) => {
          const next = prev.map((x) => (x.id === line.id ? { ...x, ...line, _localOnly: false } : x));
          lastSavedSnapshotRef.current = serialiseLines(next);
          setLastSavedAt(Date.now());
          setSaveState("saved");
          return next;
        });
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to save line");
      setSaveState("error");
    } finally {
      setSaving(null);
    }
  }

  async function deleteLine(line: Line) {
    if (!eventId) return;
    setSaving("Deleting...");
    setSaveState("saving");
    setError(null);

    try {
      const user = await getRequiredUser(supabase);
      await getOwnedEventOrThrow(supabase, eventId, user.id);

      if (!line._localOnly) {
        const del = await (supabase as any).from("event_resource_lines").delete().eq("id", line.id).eq("event_id", eventId);
        if (del.error) throw del.error;
      }

      await recalculateEventFinancialSummary(supabase, eventId, user.id);

      setLines((prev) => {
        const next = prev.filter((x) => x.id !== line.id);
        lastSavedSnapshotRef.current = serialiseLines(next);
        setLastSavedAt(Date.now());
        setSaveState("saved");
        return next;
      });
      closeSuggest();
      setTagsOpenFor(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete line");
      setSaveState("error");
    } finally {
      setSaving(null);
    }
  }

  function toggleTag(lineId: string, tag: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const has = l.tags.includes(tag);
        const tags = has ? l.tags.filter((t) => t !== tag) : [...l.tags, tag];
        return { ...l, tags };
      })
    );
  }

  function tagCount(line: Line) {
    return Array.isArray(line.tags) ? line.tags.length : 0;
  }

  function addActivity() {
    const title = normaliseActivityValue(draftActivityTitle);
    if (!title) return;
    const nextActivity: ActivityRecord = {
      id: `activity_${Math.random().toString(36).slice(2)}`,
      title,
      date: draftTaskDate || null,
      notes: normaliseActivityValue(draftTaskDescription) || null,
    };
    const key = getActivityKey(nextActivity);
    setActivities((prev) => (prev.some((entry) => getActivityKey(entry) === key) ? prev : [...prev, nextActivity]));
    setHiddenActivityKeys((prev) => {
      const next = { ...prev };
      ["labour", "plant", "material"].forEach((tab) => {
        delete next[`${tab}:${key}`];
      });
      return next;
    });
    setDraftActivityTitle("");
    setDraftTaskDate("");
    setDraftTaskDescription("");
  }

  function addLineForActivity(category: Category, activity: ActivityRecord) {
    addLine(category, {
      linked_event: activity.title || null,
      start_date: activity.date || null,
      notes: activity.notes || null,
    });
  }

  function hideActivityForCurrentTab(bucket: ActivityBucket) {
    if (activeTab === "prelims") return;
    const storageKey = getHiddenActivityStorageKey(activeTab as Category, bucket.key);
    setHiddenActivityKeys((prev) => ({ ...prev, [storageKey]: true }));
  }

  function showHiddenActivities() {
    if (activeTab === "prelims") return;
    setHiddenActivityKeys((prev) => {
      const next = { ...prev };
      const prefix = `${activeTab}:`;
      Object.keys(next).forEach((key) => {
        if (key.startsWith(prefix)) delete next[key];
      });
      return next;
    });
  }

  function TabButton({ tab }: { tab: Tab }) {
    const active = activeTab === tab;
    return (
      <button
        onClick={() => {
          closeSuggest();
          setTagsOpenFor(null);
          setActiveTab(tab);
        }}
        style={{
          border: `1px solid ${c.border}`,
          background: active ? c.black : c.input,
          color: active ? c.blackContrast : c.black,
          padding: "9px 12px",
          borderRadius: 12,
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        {labelTab(tab)}
      </button>
    );
  }


  const resourceBadge = useMemo(() => {
    if (saveState === "error") return { bg: c.redBg, bd: c.redBorder, tx: c.redText, label: "Save failed" };
    if (saveState === "saving") return { bg: c.amberBg, bd: c.amberBorder, tx: c.amberText, label: "Saving…" };
    if (saveState === "unsaved") return { bg: c.amberBg, bd: c.amberBorder, tx: c.amberText, label: "Unsaved" };
    return { bg: c.greenBg, bd: c.greenBorder, tx: c.greenText, label: "Saved" };
  }, [saveState]);

  if (!eventId) return null;

  return (
    <div style={{ background: c.bg, minHeight: "100vh" }}>
      <div style={{ padding: "22px 18px", maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: viewportWidth < 1180 ? "minmax(0, 1fr)" : "minmax(0, 1fr) 380px",
            gap: 20,
            alignItems: "start",
          }}
        >
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
                {eventTitle ? `“${eventTitle}”` : "Working event"}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: c.black,
                  letterSpacing: -0.2,
                }}
              >
                Resources
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
                Build the valuation around activities first, then attach the labour, plant and material lines that support each activity.
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
                    border: `1px solid ${resourceBadge.bd}`,
                    background: resourceBadge.bg,
                    color: resourceBadge.tx,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {resourceBadge.label}
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
                  {lines.length} resource line{lines.length === 1 ? "" : "s"}
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

            {loading ? (
              <div
                style={{
                  background: c.card,
                  border: `1px solid ${c.border}`,
                  borderRadius: 18,
                  padding: 20,
                  color: c.sub,
                }}
              >
                Loading…
              </div>
            ) : (
              <>
                {error ? (
                  <div
                    style={{
                      background: c.redBg,
                      border: `1px solid ${c.redBorder}`,
                      color: c.redText,
                      borderRadius: 14,
                      padding: 14,
                      fontWeight: 600,
                    }}
                  >
                    {error}
                  </div>
                ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div
                  style={{
                    background: c.card,
                    border: `1px solid ${c.border}`,
                    borderRadius: 22,
                    padding: 14,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <TabButton tab="labour" />
                    <TabButton tab="plant" />
                    <TabButton tab="material" />
                    
                  </div>

                </div>

                {activeTab === "prelims" ? (
                  <div
                    style={{
                      background: c.card,
                      border: `1px solid ${c.border}`,
                      borderRadius: 22,
                      padding: 20,
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 600, color: c.black, marginBottom: 6 }}>
                      Prelims + Fee
                    </div>
                    <div style={{ fontSize: 13, color: c.sub, lineHeight: 1.35 }}>
                      Keep prelims and fee in one place. This will feed the Excel summary and multiply
                      time-related prelims by delay days.
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      background: c.card,
                      border: `1px solid ${c.border}`,
                      borderRadius: 22,
                      padding: 18,
                      position: "relative",
                      minWidth: 0,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub, marginBottom: 12 }}>
                      Build the direct resource cost from the change while the evidence is still fresh.
                      Start typing in “Item” to pick from your {labelTab(activeTab).toLowerCase()} rate
                      card.
                    </div>

                    <div
                      style={{
                        border: `1px solid ${c.border}`,
                        borderRadius: 16,
                        padding: 14,
                        background: c.soft,
                        marginBottom: 16,
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: c.black, marginBottom: 4 }}>
                          Activity-led build-up
                        </div>
                        <div style={{ fontSize: 12, color: c.sub, lineHeight: 1.5 }}>
                          Define the activity, date and optional notes first. New {labelTab(activeTab).toLowerCase()} lines added here will sit beneath that activity in the build-up.
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: viewportWidth < 900
                            ? "minmax(0, 1fr)"
                            : "minmax(180px, 1.05fr) 140px minmax(220px, 1.4fr) minmax(160px, 0.8fr)",
                          gap: 10,
                          alignItems: "end",
                        }}
                      >
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: c.sub }}>Activity</div>
                          <input
                            value={draftActivityTitle}
                            onChange={(e) => setDraftActivityTitle(e.target.value)}
                            placeholder="e.g. Trial hole excavation"
                            style={{ width: "100%", border: `1px solid ${c.border}`, borderRadius: 12, padding: "10px 12px", fontSize: 14, background: c.input, color: c.black }}
                          />
                        </div>

                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: c.sub }}>Date</div>
                          <input
                            type="date"
                            value={draftTaskDate}
                            onChange={(e) => setDraftTaskDate(e.target.value)}
                            style={{ width: "100%", border: `1px solid ${c.border}`, borderRadius: 12, padding: "10px 12px", fontSize: 14, background: c.input, color: c.black }}
                          />
                        </div>

                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: c.sub }}>Notes</div>
                          <input
                            value={draftTaskDescription}
                            onChange={(e) => setDraftTaskDescription(e.target.value)}
                            placeholder="e.g. Break out and excavate around live services"
                            style={{ width: "100%", border: `1px solid ${c.border}`, borderRadius: 12, padding: "10px 12px", fontSize: 14, background: c.input, color: c.black }}
                          />
                        </div>

                        <button
                          onClick={addActivity}
                          style={{
                            border: "none",
                            background: c.black,
                            color: c.blackContrast,
                            padding: "10px 16px",
                            borderRadius: 12,
                            fontWeight: 600,
                            fontSize: 14,
                            cursor: "pointer",
                            minHeight: 42,
                            minWidth: viewportWidth < 900 ? undefined : 160,
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            lineHeight: 1.2,
                          }}
                        >
                          + Add activity
                        </button>
                      </div>
                    </div>

                    {hiddenBucketCount > 0 ? (
                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                        <button
                          type="button"
                          onClick={showHiddenActivities}
                          style={{
                            border: `1px solid ${c.border}`,
                            background: c.input,
                            color: c.black,
                            padding: "8px 12px",
                            borderRadius: 10,
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          Show hidden activities ({hiddenBucketCount})
                        </button>
                      </div>
                    ) : null}

                    {visibleActivityBuckets.length === 0 ? (
                      <div
                        style={{
                          border: `1px dashed ${c.border}`,
                          borderRadius: 14,
                          padding: 14,
                          color: c.sub,
                          fontWeight: 600,
                          marginTop: 12,
                        }}
                      >
                        No activities yet. Add an activity first, then add {labelTab(activeTab).toLowerCase()} lines inside it.
                      </div>
                    ) : null}

                    {visibleActivityBuckets.map((bucket) => {
                      const emptyBucket = bucket.lines.length === 0;
                      return (
                        <div
                          key={bucket.key}
                          style={{
                            marginTop: 12,
                            border: `1px solid ${c.border}`,
                            borderRadius: 16,
                            background: emptyBucket ? c.lightGrey : c.card,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              padding: 14,
                              background: c.soft,
                              borderBottom: `1px solid ${c.border}`,
                              display: "grid",
                              gridTemplateColumns: viewportWidth < 900 ? "minmax(0, 1fr)" : "minmax(0, 1fr) auto",
                              gap: 12,
                              alignItems: "start",
                            }}
                          >
                            <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: c.sub }}>Activity</div>
                              <div style={{ fontSize: 15, fontWeight: 600, color: c.black }}>{bucket.title}</div>
                              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: c.sub }}>
                                <span><strong style={{ color: c.black }}>Date:</strong> {bucket.date ? new Date(bucket.date).toLocaleDateString("en-GB") : "Not set"}</span>
                                <span><strong style={{ color: c.black }}>Notes:</strong> {bucket.notes || "General notes"}</span>
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: viewportWidth < 900 ? "flex-start" : "flex-end", alignItems: "center" }}>
                              <button
                                type="button"
                                onClick={() => addLineForActivity(activeTab as Category, bucket)}
                                style={{
                                  border: `1px solid ${c.border}`,
                                  background: c.input,
                                  color: c.black,
                                  padding: "8px 12px",
                                  borderRadius: 10,
                                  fontWeight: 600,
                                  fontSize: 13,
                                  cursor: "pointer",
                                }}
                              >
                                + Add {titleCaseLabel(activeTab as Category)}
                              </button>

                              {emptyBucket ? (
                                <button
                                  type="button"
                                  onClick={() => hideActivityForCurrentTab(bucket)}
                                  style={{
                                    border: `1px solid ${c.border}`,
                                    background: c.lightGrey,
                                    color: c.sub,
                                    padding: "8px 12px",
                                    borderRadius: 10,
                                    fontWeight: 600,
                                    fontSize: 13,
                                    cursor: "pointer",
                                  }}
                                >
                                  Hide activity
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {emptyBucket ? (
                            <div style={{ padding: 14, color: c.sub, fontWeight: 600 }}>
                              No {labelTab(activeTab).toLowerCase()} lines added for this activity yet.
                            </div>
                          ) : (
                            <>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "minmax(0, 1fr) 76px 72px 88px 84px 36px 32px",
                                  gap: 10,
                                  fontSize: 12,
                                  color: c.sub,
                                  fontWeight: 600,
                                  padding: "10px 12px",
                                  borderBottom: `1px solid ${c.border}`,
                                }}
                              >
                                <div>Item</div>
                                <div>Unit</div>
                                <div>Qty</div>
                                <div>Rate</div>
                                <div>Total</div>
                                <div style={{ textAlign: "center" }}>More</div>
                                <div />
                              </div>

                              {bucket.lines.map((l) => {
                                const isSuggesting = activeSuggestFor === l.id;
                                const isTagsOpen = tagsOpenFor === l.id;
                                const isDetailsOpen = detailsOpenFor === l.id;
                                const qtyValue = l.unit === "hour" ? Number(l.hours ?? 0) : Number(l.qty ?? 0);

                                return (
                                  <div
                                    key={l.id}
                                    style={{
                                      padding: "12px",
                                      borderBottom: `1px solid ${c.border}`,
                                      position: "relative",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "minmax(0, 1fr) 76px 72px 88px 84px 36px 32px",
                                        gap: 10,
                                        alignItems: "center",
                                      }}
                                    >
                            <div ref={isSuggesting ? suggestRef : null} style={{ position: "relative" }}>
                              <input
                                value={l.item_name}
                                placeholder="Start typing…"
                                onFocus={() => openSuggest(l.id, l.item_name)}
                                onChange={(e) => {
                                  updateLine(l.id, { item_name: e.target.value });
                                  setSuggestQuery(e.target.value);
                                  setActiveSuggestFor(l.id);
                                  setHighlightedSuggestIndex(0);
                                }}
                                onKeyDown={(e) => {
                                  if (!isSuggesting || filteredSuggestions.length === 0) return;
                                  if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    setHighlightedSuggestIndex((prev) => (prev + 1) % filteredSuggestions.length);
                                    return;
                                  }
                                  if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    setHighlightedSuggestIndex((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
                                    return;
                                  }
                                  if (e.key === "Tab") {
                                    e.preventDefault();
                                    const pickedSuggestion = filteredSuggestions[highlightedSuggestIndex] || filteredSuggestions[0];
                                    if (!pickedSuggestion) return;
                                    const picked: Line = {
                                      ...l,
                                      item_name: pickedSuggestion.name,
                                      unit: pickedSuggestion.unit as Unit,
                                      rate: pickedSuggestion.source === "rate_card" ? Number(pickedSuggestion.rate ?? 0) : l.rate,
                                      total: 0,
                                    };
                                    picked.total = calcLineTotal(picked);
                                    pickSuggestion(l.id, pickedSuggestion);
                                    setTimeout(() => persistLine(picked), 0);
                                    return;
                                  }
                                }}
                                onBlur={() => {
                                  setTimeout(() => {}, 0);
                                  if (l.item_name.trim().length > 0) {
                                    const latest = {
                                      ...l,
                                      item_name: l.item_name,
                                    };
                                    persistLine(latest);
                                  }
                                }}
                                style={{
                                  width: "100%",
                                  border: `1px solid ${c.border}`,
                                  borderRadius: 12,
                                  padding: "7px 9px",
                                  fontWeight: 400,
                                  fontSize: 13,
                                  outline: "none",
                                }}
                              />

                              {(() => {
                                const matchedRateCard = matchedRateCardByName.get(`${l.category}::${l.item_name.trim().toLowerCase()}`);
                                const matchedSourceLabel = sourceLabelForRateCard(matchedRateCard);
                                const matchedSourceDetail = sourceDetailForRateCard(matchedRateCard);
                                if (!matchedRateCard || !matchedSourceLabel) return null;
                                return (
                                  <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: c.sub, letterSpacing: 0.2, textTransform: "uppercase" }}>
                                      {matchedSourceLabel}
                                    </span>
                                    {matchedSourceDetail ? (
                                      <span style={{ fontSize: 11, fontWeight: 700, color: c.sub }}>
                                        {matchedSourceDetail}
                                      </span>
                                    ) : null}
                                  </div>
                                );
                              })()}

                              {isSuggesting ? (
                                <div
                                  style={{
                                    position: "absolute",
                                    zIndex: 50,
                                    top: 46,
                                    left: 0,
                                    right: 0,
                                    background: c.input,
                                    border: `1px solid ${c.border}`,
                                    borderRadius: 12,
                                    overflow: "hidden",
                                    maxHeight: 320,
                                    overflowY: "auto",
                                    boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
                                  }}
                                >
                                  {filteredSuggestions.length === 0 ? (
                                    <div style={{ padding: 12, color: c.sub, fontWeight: 600 }}>
                                      No matches. Keep typing — you can still save custom items.
                                    </div>
                                  ) : (
                                    filteredSuggestions.map((r, idx) => (
                                      <button
                                        key={r.id}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          const picked: Line = {
                                            ...l,
                                            item_name: r.name,
                                            unit: r.unit as Unit,
                                            rate: r.source === "rate_card" ? Number(r.rate ?? 0) : l.rate,
                                            total: 0,
                                          };
                                          picked.total = calcLineTotal(picked);

                                          pickSuggestion(l.id, r);
                                          setTimeout(() => persistLine(picked), 0);
                                        }}
                                        onMouseEnter={() => setHighlightedSuggestIndex(idx)}
                                        style={{
                                          width: "100%",
                                          textAlign: "left",
                                          padding: 12,
                                          border: "none",
                                          background: idx === highlightedSuggestIndex ? c.soft : c.input,
                                          cursor: "pointer",
                                          fontWeight: 600,
                                          display: "flex",
                                          justifyContent: "space-between",
                                          gap: 10,
                                        }}
                                      >
                                        <span>{r.name}</span>
                                        <span style={{ color: c.sub, fontWeight: 500 }}>
                                          {r.source === "rate_card" ? (r.sourceDetail ?? money(Number(r.rate ?? 0))) : (r.sourceDetail ?? `${r.unit} · library`)}
                                        </span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              ) : null}
                            </div>

                            <div>
                              <select
                                value={l.unit}
                                onChange={(e) => {
                                  const v = e.target.value as Unit;
                                  const next = {
                                    ...l,
                                    unit: v,
                                    hours: v === "hour" ? (l.hours ?? 0) : null,
                                  } as Line;
                                  next.total = calcLineTotal(next);
                                  updateLine(l.id, {
                                    unit: next.unit,
                                    hours: next.hours,
                                    total: next.total,
                                  });
                                  persistLine(next);
                                }}
                                style={{
                                  width: "100%",
                                  minWidth: 76,
                                  border: `1px solid ${c.border}`,
                                  borderRadius: 12,
                                  padding: "7px 9px",
                                  fontWeight: 400,
                                  fontSize: 13,
                                  background: c.input,
                                  color: c.black,
                                }}
                              >
                                <option value="hour">hour</option>
                                <option value="day">day</option>
                                <option value="week">week</option>
                                <option value="each">each</option>
                                <option value="m">m</option>
                                <option value="m2">m2</option>
                                <option value="m3">m3</option>
                                <option value="t">t</option>
                                <option value="kg">kg</option>
                                <option value="l">l</option>
                                <option value="sheet">sheet</option>
                                <option value="bag">bag</option>
                              </select>
                            </div>

                            <div>
                              <input
                                value={editingQty[l.id] ?? String(qtyValue)}
                                type="text"
                                inputMode="decimal"
                                onFocus={(e) => {
                                  setEditingQty((prev) => ({ ...prev, [l.id]: String(qtyValue) }));
                                  e.currentTarget.select();
                                }}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (/^\d*\.?\d*$/.test(raw)) {
                                    setEditingQty((prev) => ({ ...prev, [l.id]: raw }));
                                  }
                                }}
                                onBlur={() => {
                                  const raw = editingQty[l.id] ?? String(qtyValue);
                                  const parsed = clampNum(Number(raw || 0), 0, 10000);
                                  if (l.unit === "hour") {
                                    updateLine(l.id, { hours: parsed, qty: 1 });
                                  } else {
                                    updateLine(l.id, { qty: parsed });
                                  }
                                  const next = {
                                    ...l,
                                    hours: l.unit === "hour" ? parsed : l.hours,
                                    qty: l.unit === "hour" ? 1 : parsed,
                                    total: 0,
                                  };
                                  next.total = calcLineTotal(next);
                                  setEditingQty((prev) => {
                                    const copy = { ...prev };
                                    delete copy[l.id];
                                    return copy;
                                  });
                                  persistLine(next);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.currentTarget.blur();
                                }}
                                style={{
                                  width: "100%",
                                  border: `1px solid ${c.border}`,
                                  borderRadius: 12,
                                  padding: "7px 9px",
                                  fontWeight: 400,
                                  fontSize: 13,
                                }}
                              />
                            </div>

                            <div>
                              <input
                                value={editingRate[l.id] ?? String(Number(l.rate ?? 0))}
                                type="text"
                                inputMode="decimal"
                                onFocus={(e) => {
                                  setEditingRate((prev) => ({ ...prev, [l.id]: String(Number(l.rate ?? 0)) }));
                                  e.currentTarget.select();
                                }}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (/^\d*\.?\d*$/.test(raw)) {
                                    setEditingRate((prev) => ({ ...prev, [l.id]: raw }));
                                  }
                                }}
                                onBlur={() => {
                                  const raw = editingRate[l.id] ?? String(Number(l.rate ?? 0));
                                  const parsed = clampNum(Number(raw || 0), 0, 1000000);
                                  updateLine(l.id, { rate: parsed });
                                  const next = {
                                    ...l,
                                    rate: parsed,
                                    total: 0,
                                  };
                                  next.total = calcLineTotal(next);
                                  setEditingRate((prev) => {
                                    const copy = { ...prev };
                                    delete copy[l.id];
                                    return copy;
                                  });
                                  persistLine(next);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.currentTarget.blur();
                                }}
                                style={{
                                  width: "100%",
                                  border: `1px solid ${c.border}`,
                                  borderRadius: 12,
                                  padding: "7px 9px",
                                  fontWeight: 400,
                                  fontSize: 13,
                                }}
                              />
                            </div>

                            <div
                              style={{
                                fontWeight: 700,
                                color: c.black,
                                fontSize: 13,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {money(Number(l.total ?? 0))}
                            </div>

                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", paddingRight: 6 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  closeSuggest();
                                  setDetailsOpenFor((cur) => (cur === l.id ? null : l.id));
                                  setTagsOpenFor(null);
                                }}
                                title={isDetailsOpen ? "Hide details" : "Show details"}
                                aria-label={isDetailsOpen ? "Hide details" : "Show details"}
                                style={{
                                  width: 30,
                                  height: 30,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: `1px solid ${c.border}`,
                                  background: isDetailsOpen ? c.black : c.input,
                                  color: isDetailsOpen ? c.blackContrast : c.black,
                                  borderRadius: 10,
                                  fontWeight: 700,
                                  fontSize: 16,
                                  cursor: "pointer",
                                }}
                              >
                                {isDetailsOpen ? "−" : "+"}
                              </button>
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <button
                                onClick={() => deleteLine(l)}
                                title="Delete"
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 10,
                                  border: `1px solid ${c.border}`,
                                  background: c.input,
                                  cursor: "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                ×
                              </button>
                            </div>
                          </div>

                          {isDetailsOpen ? (
                            <div
                              style={{
                                marginTop: 12,
                                padding: 14,
                                borderRadius: 14,
                                border: `1px solid ${c.border}`,
                                background: c.soft,
                                display: "grid",
                                gap: 18,
                              }}
                            >
                              <div style={{ display: "grid", gap: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: c.sub }}>
                                  Tags
                                </div>
                                <div style={{ position: "relative", maxWidth: 240 }}>
                                  <button
                                    onClick={() => {
                                      closeSuggest();
                                      setTagsOpenFor((cur) => (cur === l.id ? null : l.id));
                                    }}
                                    style={{
                                      width: "100%",
                                      border: `1px solid ${c.border}`,
                                      background: c.input,
                                      padding: "10px 12px",
                                      borderRadius: 12,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      gap: 10,
                                    }}
                                    title="Select tags"
                                  >
                                    <span style={{ color: c.black }}>
                                      {tagCount(l) === 0 ? "Add tags" : `${tagCount(l)} selected`}
                                    </span>
                                    <span style={{ color: c.sub }}>▾</span>
                                  </button>

                                  {isTagsOpen ? (
                                    <div
                                      ref={tagsRef}
                                      style={{
                                        position: "absolute",
                                        zIndex: 60,
                                        top: 46,
                                        left: 0,
                                        right: 0,
                                        background: c.input,
                                        border: `1px solid ${c.border}`,
                                        borderRadius: 12,
                                        overflow: "hidden",
                                        boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
                                      }}
                                    >
                                      <div style={{ padding: 10, fontSize: 12, color: c.sub }}>
                                        Tag the resource lines that support the causation narrative later.
                                      </div>

                                      <div style={{ maxHeight: 240, overflow: "auto" }}>
                                        {TAG_OPTIONS.map((t) => {
                                          const checked = l.tags.includes(t.key);
                                          return (
                                            <label
                                              key={t.key}
                                              style={{
                                                display: "flex",
                                                gap: 10,
                                                alignItems: "center",
                                                padding: "10px 12px",
                                                cursor: "pointer",
                                                borderTop: `1px solid ${c.border}`,
                                                userSelect: "none",
                                              }}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                  toggleTag(l.id, t.key);
                                                }}
                                              />
                                              <span style={{ fontWeight: 550, color: c.black }}>
                                                {t.label}
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>

                                      <div
                                        style={{
                                          padding: 10,
                                          borderTop: `1px solid ${c.border}`,
                                          background: c.soft,
                                          display: "flex",
                                          justifyContent: "space-between",
                                          gap: 10,
                                        }}
                                      >
                                        <button
                                          onClick={() => {
                                            updateLine(l.id, { tags: [] });
                                            setTimeout(() => persistLine({ ...l, tags: [] }), 0);
                                          }}
                                          style={{
                                            border: `1px solid ${c.border}`,
                                            background: c.input,
                                            padding: "8px 10px",
                                            borderRadius: 10,
                                            fontWeight: 600,
                                            cursor: "pointer",
                                            fontSize: 12,
                                          }}
                                        >
                                          Clear
                                        </button>

                                        <button
                                          onClick={() => {
                                            const updated = lines.find((x) => x.id === l.id) ?? l;
                                            setTimeout(() => persistLine(updated), 0);
                                            setTagsOpenFor(null);
                                          }}
                                          style={{
                                            border: "none",
                                            background: c.black,
                                            color: c.blackContrast,
                                            padding: "8px 10px",
                                            borderRadius: 10,
                                            fontWeight: 600,
                                            cursor: "pointer",
                                            fontSize: 12,
                                          }}
                                        >
                                          Done
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                                  gap: 12,
                                }}
                              >
                                <div style={{ display: "grid", gap: 8 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: c.sub }}>
                                    Activity date
                                  </div>
                                  <input
                                    type="date"
                                    value={l.start_date ?? ""}
                                    onChange={(e) => updateLine(l.id, { start_date: e.target.value || null })}
                                    onBlur={() => {
                                      const updated = lines.find((x) => x.id === l.id) ?? l;
                                      persistLine(updated);
                                    }}
                                    style={{
                                      width: "100%",
                                      border: `1px solid ${c.border}`,
                                      borderRadius: 12,
                                      padding: "10px 12px",
                                      fontSize: 14,
                                      fontWeight: 400,
                                      fontFamily: "inherit",
                                      outline: "none",
                                      background: c.input,
                                      color: c.black,
                                    }}
                                  />
                                </div>

                                <div style={{ display: "grid", gap: 8 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: c.sub }}>
                                    End date
                                  </div>
                                  <input
                                    type="date"
                                    value={l.end_date ?? ""}
                                    onChange={(e) => updateLine(l.id, { end_date: e.target.value || null })}
                                    onBlur={() => {
                                      const updated = lines.find((x) => x.id === l.id) ?? l;
                                      persistLine(updated);
                                    }}
                                    style={{
                                      width: "100%",
                                      border: `1px solid ${c.border}`,
                                      borderRadius: 12,
                                      padding: "10px 12px",
                                      fontSize: 14,
                                      fontWeight: 400,
                                      fontFamily: "inherit",
                                      outline: "none",
                                      background: c.input,
                                      color: c.black,
                                    }}
                                  />
                                </div>

                                <div style={{ display: "grid", gap: 8 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: c.sub }}>
                                    Activity / structure
                                  </div>
                                  <input
                                    value={l.linked_event ?? ""}
                                    placeholder="e.g. Trial hole excavation / ST94"
                                    onChange={(e) => updateLine(l.id, { linked_event: e.target.value })}
                                    onBlur={() => {
                                      const updated = lines.find((x) => x.id === l.id) ?? l;
                                      persistLine(updated);
                                    }}
                                    style={{
                                      width: "100%",
                                      border: `1px solid ${c.border}`,
                                      borderRadius: 12,
                                      padding: "10px 12px",
                                      fontSize: 14,
                                      fontWeight: 400,
                                      fontFamily: "inherit",
                                      outline: "none",
                                      background: c.input,
                                      color: c.black,
                                    }}
                                  />
                                </div>
                              </div>

                              <div style={{ display: "grid", gap: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: c.sub }}>
                                  Notes
                                </div>
                                <textarea
                                  value={l.notes ?? ""}
                                  placeholder="Add optional notes for this line…"
                                  onChange={(e) => updateLine(l.id, { notes: e.target.value })}
                                  onBlur={() => {
                                    const updated = lines.find((x) => x.id === l.id) ?? l;
                                    persistLine(updated);
                                  }}
                                  rows={3}
                                  style={{
                                    width: "100%",
                                    border: `1px solid ${c.border}`,
                                    borderRadius: 12,
                                    padding: "10px 12px",
                                    fontSize: 14,
                                    lineHeight: 1.55,
                                    fontFamily: "inherit",
                                    resize: "vertical",
                                    outline: "none",
                                    background: c.input,
                                    color: c.black,
                                  }}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              </>
            )}
          </div>

              <div
                style={{
                  position: viewportWidth < 1180 ? "static" : "sticky",
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
                  <CEProgress eventId={eventId} currentStep="resources" />
                </div>

                <SidebarCard title="Summary">
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Labour</span>
                      <span style={{ color: c.black, fontWeight: 600 }}>{money(totals.labour)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Plant</span>
                      <span style={{ color: c.black, fontWeight: 600 }}>{money(totals.plant)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Material</span>
                      <span style={{ color: c.black, fontWeight: 600 }}>{money(totals.material)}</span>
                    </div>

                    <div style={{ height: 1, background: c.border, margin: "8px 0" }} />

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: c.black, fontWeight: 600 }}>{costLabel}</span>
                      <span style={{ color: c.black, fontWeight: 650 }}>
                        {money(totals.definedCost)}
                      </span>
                    </div>
                  </div>
                </SidebarCard>

                <SidebarCard title="Guidance">
                  Tip: pick from the rate card for speed, then amend the rate only where the event
                  genuinely requires it.
                </SidebarCard>

                <SidebarCard title="Next step">
                  <div style={{ marginBottom: 14 }}>
                    Once resources are in, move on to prelims and fee so the full cost build-up can be
                    reviewed together.
                  </div>

                  <button
                    onClick={() => router.push(buildEventStepPath(eventId, "evidence"))}
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
                    Back to evidence
                  </button>

                  <button
                    onClick={() => router.push(buildEventStepPath(eventId, "prelims"))}
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
                    Continue to prelims
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
