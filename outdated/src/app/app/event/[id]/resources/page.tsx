"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import CEProgress from "@/components/CEProgress";

type Category = "labour" | "plant" | "material";
type Tab = Category | "prelims";
type Unit = "hour" | "day" | "week" | "each";

type RateCard = {
  id: string;
  category: Category;
  name: string;
  unit: Unit;
  rate: number;
  active: boolean;
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
  blueBg: "#eff6ff",
  blueBorder: "#bfdbfe",
  blueText: "#1d4ed8",
  amberBg: "#fffbeb",
  amberBorder: "#fde68a",
  amberText: "#92400e",
  lightGrey: "#f3f4f6",
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
          fontSize: 13,
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

export default function ResourcesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = params?.id;

  const supabase = useMemo(() => supabaseBrowser(), []);

  const [activeTab, setActiveTab] = useState<Tab>("labour");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [eventTitle, setEventTitle] = useState<string>("");

  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  const [activeSuggestFor, setActiveSuggestFor] = useState<string | null>(null);
  const [suggestQuery, setSuggestQuery] = useState<string>("");
  const suggestRef = useRef<HTMLDivElement | null>(null);

  const [tagsOpenFor, setTagsOpenFor] = useState<string | null>(null);
  const [detailsOpenFor, setDetailsOpenFor] = useState<string | null>(null);
  const tagsRef = useRef<HTMLDivElement | null>(null);
  const lastSavedSnapshotRef = useRef<string>("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");

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

  const visibleLines = useMemo(() => {
    if (activeTab === "prelims") return [];
    return lines.filter((l) => l.category === activeTab);
  }, [lines, activeTab]);

  const filteredSuggestions = useMemo(() => {
    const q = (suggestQuery || "").trim().toLowerCase();
    const tabCat: Category | null = activeTab === "prelims" ? null : activeTab;

    const candidates = rateCards
      .filter((r) => r.active)
      .filter((r) => (tabCat ? r.category === tabCat : true))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!q) return candidates.slice(0, 10);
    return candidates.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 12);
  }, [rateCards, suggestQuery, activeTab]);

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
      const ev = await supabase.from("events").select("id,title").eq("id", eventId).single();
      if (ev.error) throw ev.error;
      setEventTitle(ev.data?.title ?? "");

      const rc = await supabase
        .from("rate_cards")
        .select("id,category,name,unit,rate,active")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (rc.error) throw rc.error;
      setRateCards((rc.data || []) as RateCard[]);

      const ln = await supabase
        .from("event_resource_lines")
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
  }

  function closeSuggest() {
    setActiveSuggestFor(null);
    setSuggestQuery("");
  }

  function pickSuggestion(lineId: string, r: RateCard) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const next: Line = {
          ...l,
          item_name: r.name,
          unit: r.unit,
          rate: Number(r.rate ?? 0),
        };
        next.total = calcLineTotal(next);
        return next;
      })
    );
    closeSuggest();
  }

  function addLine(category: Category) {
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
      notes: null,
      tags: [],
      start_date: null,
      end_date: null,
      linked_event: null,
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
        const ins = await supabase
          .from("event_resource_lines")
          .insert(payload)
          .select("id")
          .single();
        if (ins.error) throw ins.error;

        setLines((prev) => {
          const next = prev.map((x) => (x.id === line.id ? { ...line, id: ins.data.id, _localOnly: false } : x));
          lastSavedSnapshotRef.current = serialiseLines(next);
          return next;
        });
      } else {
        const up = await supabase.from("event_resource_lines").update(payload).eq("id", line.id);
        if (up.error) throw up.error;
        setLines((prev) => {
          const next = prev.map((x) => (x.id === line.id ? { ...x, ...line, _localOnly: false } : x));
          lastSavedSnapshotRef.current = serialiseLines(next);
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
      if (!line._localOnly) {
        const del = await supabase.from("event_resource_lines").delete().eq("id", line.id);
        if (del.error) throw del.error;
      }
      setLines((prev) => {
        const next = prev.filter((x) => x.id !== line.id);
        lastSavedSnapshotRef.current = serialiseLines(next);
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
          background: active ? "#111827" : "white",
          color: active ? "white" : c.black,
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
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 20, alignItems: "start" }}>
          <div
            style={{
              background: c.card,
              border: `1px solid ${c.border}`,
              borderRadius: 16,
              padding: 18,
              marginBottom: 16,
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
              Resources
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
              {eventTitle ? `“${eventTitle}”` : ""}
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
                  background: "#fff",
                  color: c.sub,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {lines.length} resource line{lines.length === 1 ? "" : "s"}
              </span>

              <span style={{ fontSize: 12, color: c.sub }}>Autosave on</span>
            </div>
          </div>

          <div style={{ position: "sticky", top: 20, alignSelf: "start" }}>
            <div
              style={{
                background: c.card,
                border: `1px solid ${c.border}`,
                borderRadius: 16,
                padding: 12,
              }}
            >
              <CEProgress eventId={eventId} currentStep="resources" />
            </div>
          </div>
        </div>

        {loading ? (
          <div
            style={{
              background: c.card,
              border: `1px solid ${c.border}`,
              borderRadius: 16,
              padding: 18,
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
                  marginBottom: 14,
                  fontWeight: 600,
                }}
              >
                {error}
              </div>
            ) : null}

            {saving ? (
              <div
                style={{
                  background: c.blueBg,
                  border: `1px solid ${c.blueBorder}`,
                  color: c.blueText,
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 14,
                  fontWeight: 600,
                }}
              >
                {saving}
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 20, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div
                  style={{
                    background: c.card,
                    border: `1px solid ${c.border}`,
                    borderRadius: 18,
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

                  {activeTab !== "prelims" ? (
                    <button
                      onClick={() => addLine(activeTab)}
                      style={{
                        border: "none",
                        background: "#111827",
                        color: "white",
                        padding: "9px 12px",
                        borderRadius: 12,
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      + Add {labelTab(activeTab)}
                    </button>
                  ) : null}
                </div>

                {activeTab === "prelims" ? (
                  <div
                    style={{
                      background: c.card,
                      border: `1px solid ${c.border}`,
                      borderRadius: 18,
                      padding: 18,
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 650, color: c.black, marginBottom: 6 }}>
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
                      borderRadius: 18,
                      padding: 16,
                      position: "relative",
                    }}
                  >
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: c.sub, marginBottom: 12 }}>
                      Build the direct resource cost from the change while the evidence is still fresh.
                      Start typing in “Item” to pick from your {labelTab(activeTab).toLowerCase()} rate
                      card.
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(200px, 1fr) 76px 72px 88px 84px 36px 32px",
                        gap: 10,
                        fontSize: 12,
                        color: c.sub,
                        fontWeight: 600,
                        padding: "6px 4px 10px",
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

                    {visibleLines.length === 0 ? (
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
                        No {labelTab(activeTab)} lines yet. Click “+ Add {labelTab(activeTab)}”.
                      </div>
                    ) : null}

                    {visibleLines.map((l) => {
                      const isSuggesting = activeSuggestFor === l.id;
                      const isTagsOpen = tagsOpenFor === l.id;
                      const isDetailsOpen = detailsOpenFor === l.id;
                      const qtyValue = l.unit === "hour" ? Number(l.hours ?? 0) : Number(l.qty ?? 0);

                      return (
                        <div
                          key={l.id}
                          style={{
                            padding: "12px 4px",
                            borderBottom: `1px solid ${c.border}`,
                            position: "relative",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(200px, 1fr) 76px 72px 88px 84px 36px 32px",
                              gap: 10,
                              alignItems: "center",
                            }}
                          >
                            <div style={{ position: "relative" }}>
                              <input
                                value={l.item_name}
                                placeholder="Start typing…"
                                onFocus={() => openSuggest(l.id, l.item_name)}
                                onChange={(e) => {
                                  updateLine(l.id, { item_name: e.target.value });
                                  setSuggestQuery(e.target.value);
                                  setActiveSuggestFor(l.id);
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

                              {isSuggesting ? (
                                <div
                                  ref={suggestRef}
                                  style={{
                                    position: "absolute",
                                    zIndex: 50,
                                    top: 46,
                                    left: 0,
                                    right: 0,
                                    background: "white",
                                    border: `1px solid ${c.border}`,
                                    borderRadius: 12,
                                    overflow: "hidden",
                                    boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
                                  }}
                                >
                                  {filteredSuggestions.length === 0 ? (
                                    <div style={{ padding: 12, color: c.sub, fontWeight: 600 }}>
                                      No matches. Keep typing — you can still save custom items.
                                    </div>
                                  ) : (
                                    filteredSuggestions.map((r) => (
                                      <button
                                        key={r.id}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          const picked: Line = {
                                            ...l,
                                            item_name: r.name,
                                            unit: r.unit,
                                            rate: Number(r.rate ?? 0),
                                            total: 0,
                                          };
                                          picked.total = calcLineTotal(picked);

                                          pickSuggestion(l.id, r);
                                          setTimeout(() => persistLine(picked), 0);
                                        }}
                                        style={{
                                          width: "100%",
                                          textAlign: "left",
                                          padding: 12,
                                          border: "none",
                                          background: "white",
                                          cursor: "pointer",
                                          fontWeight: 600,
                                          display: "flex",
                                          justifyContent: "space-between",
                                          gap: 10,
                                        }}
                                      >
                                        <span>{r.name}</span>
                                        <span style={{ color: c.sub, fontWeight: 500 }}>
                                          {money(Number(r.rate ?? 0))}
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
                                  background: "white",
                                }}
                              >
                                <option value="hour">hour</option>
                                <option value="day">day</option>
                                <option value="week">week</option>
                                <option value="each">each</option>
                              </select>
                            </div>

                            <div>
                              <input
                                value={qtyValue}
                                type="number"
                                step={l.unit === "hour" ? 0.5 : 1}
                                onChange={(e) => {
                                  const input = clampNum(Number(e.target.value), 0, 10000);
                                  if (l.unit === "hour") {
                                    updateLine(l.id, { hours: input, qty: 1 });
                                  } else {
                                    updateLine(l.id, { qty: input });
                                  }
                                }}
                                onBlur={() => {
                                  const next = {
                                    ...l,
                                    total: calcLineTotal(l),
                                  };
                                  persistLine(next);
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
                                value={Number(l.rate ?? 0)}
                                type="number"
                                step={0.01}
                                onChange={(e) =>
                                  updateLine(l.id, {
                                    rate: clampNum(Number(e.target.value), 0, 1000000),
                                  })
                                }
                                onBlur={() => {
                                  const next = {
                                    ...l,
                                    total: calcLineTotal(l),
                                  };
                                  persistLine(next);
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
                                  background: isDetailsOpen ? c.black : "white",
                                  color: isDetailsOpen ? "white" : c.black,
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
                                  background: "white",
                                  cursor: "pointer",
                                  fontWeight: 650,
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
                                gap: 14,
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
                                      background: "white",
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
                                        background: "white",
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
                                          background: "#fafafa",
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
                                            background: "white",
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
                                            background: "#111827",
                                            color: "white",
                                            padding: "8px 10px",
                                            borderRadius: 10,
                                            fontWeight: 650,
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
                                    Start date
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
                                      fontWeight: 500,
                                      fontFamily: "inherit",
                                      outline: "none",
                                      background: "white",
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
                                      fontWeight: 500,
                                      fontFamily: "inherit",
                                      outline: "none",
                                      background: "white",
                                      color: c.black,
                                    }}
                                  />
                                </div>

                                <div style={{ display: "grid", gap: 8 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: c.sub }}>
                                    Linked event / period
                                  </div>
                                  <input
                                    value={l.linked_event ?? ""}
                                    placeholder="e.g. 14–16 Jan flooding"
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
                                      fontWeight: 500,
                                      fontFamily: "inherit",
                                      outline: "none",
                                      background: "white",
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
                                    lineHeight: 1.5,
                                    fontFamily: "inherit",
                                    resize: "vertical",
                                    outline: "none",
                                    background: "white",
                                    color: c.black,
                                  }}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
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
                      <span style={{ color: c.black, fontWeight: 600 }}>Defined Cost</span>
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
                    onClick={() => router.push(`/app/event/${eventId}/evidence`)}
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
                    Back to evidence
                  </button>

                  <button
                    onClick={() => router.push(`/app/event/${eventId}/prelims`)}
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
          </>
        )}
      </div>
    </div>
  );
}