"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Category = "labour" | "plant" | "materials";

type RateCard = {
  id: string;
  user_id: string;
  category: Category;
  name: string;
  unit: string;
  rate: number;
  notes: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

const c = {
  bg: "#f6f7fb",
  card: "#ffffff",
  border: "rgba(15,23,42,0.08)",
  text: "#0f172a",
  sub: "#475569",
  black: "#111827",
  soft: "rgba(255,255,255,0.78)",
  activeBg: "rgba(17,24,39,0.08)",
  hoverBg: "rgba(17,24,39,0.05)",
  redBg: "#fef2f2",
  redBd: "#fecaca",
  redTx: "#991b1b",
};

const CATEGORY_TABS: { key: Category; label: string; hint: string }[] = [
  { key: "labour", label: "Labour", hint: "Operatives + supervision rates used in deterministic costing." },
  { key: "plant", label: "Plant", hint: "Machines, attachments, wagons, small tools." },
  { key: "materials", label: "Materials", hint: "Supply-only items (or supply+fix later)." },
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
        padding: "8px 10px",
        borderRadius: 999,
        border: `1px solid ${c.border}`,
        background: active ? c.black : "#fff",
        color: active ? "#fff" : c.black,
        fontWeight: 950,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 950, color: c.sub }}>{label}</span>
      {children}
    </label>
  );
}

export default function RateCardsPage() {
  const router = useRouter();

  const [tab, setTab] = useState<Category>("labour");
  const [rows, setRows] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [err, setErr] = useState<string | null>(null);

  // Modal state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RateCard | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<{
    category: Category;
    name: string;
    unit: string;
    rate: string;
    notes: string;
    active: boolean;
  }>({
    category: "labour",
    name: "",
    unit: "hour",
    rate: "0",
    notes: "",
    active: true,
  });

  function resetForm(category: Category) {
    setEditing(null);
    setForm({
      category,
      name: "",
      unit: category === "materials" ? "each" : "hour",
      rate: "0",
      notes: "",
      active: true,
    });
  }

  function openNew() {
    resetForm(tab);
    setOpen(true);
  }

  function openEdit(r: RateCard) {
    setEditing(r);
    setForm({
      category: r.category,
      name: r.name,
      unit: r.unit || "hour",
      rate: String(r.rate ?? 0),
      notes: r.notes ?? "",
      active: r.active ?? true,
    });
    setOpen(true);
  }

  async function load() {
    setErr(null);
    setLoading(true);

    const supabase = supabaseBrowser();
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("rate_cards")
      .select("id,user_id,category,name,unit,rate,notes,active,created_at,updated_at")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      setErr(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => r.category === tab)
      .filter((r) => (showInactive ? true : r.active))
      .filter((r) => (s ? (r.name ?? "").toLowerCase().includes(s) : true));
  }, [rows, tab, q, showInactive]);

  const activeCount = useMemo(
    () => rows.filter((r) => r.category === tab && r.active).length,
    [rows, tab]
  );

  async function saveModal() {
    setErr(null);

    const name = form.name.trim();
    if (!name) {
      setErr("Name is required.");
      return;
    }

    const rateNum = cleanNumber(form.rate);
    if (rateNum < 0) {
      setErr("Rate cannot be negative.");
      return;
    }

    setSaving(true);
    try {
      const supabase = supabaseBrowser();
      const { data: s } = await supabase.auth.getSession();
      const user = s.session?.user;
      if (!user) {
        router.push("/login");
        return;
      }

      const payload: any = {
        category: form.category,
        name,
        unit: form.unit,
        rate: rateNum,
        notes: form.notes.trim() ? form.notes.trim() : null,
        active: form.active,
        updated_at: new Date().toISOString(),
      };

      if (!editing) {
        payload.user_id = user.id;
        const { error } = await supabase.from("rate_cards").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rate_cards")
          .update(payload)
          .eq("id", editing.id);
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

  async function setActive(r: RateCard, next: boolean) {
    setErr(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase
      .from("rate_cards")
      .update({ active: next, updated_at: new Date().toISOString() })
      .eq("id", r.id);

    if (error) {
      setErr(error.message);
      return;
    }
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: next } : x)));
  }

  async function duplicate(r: RateCard) {
    setErr(null);
    const supabase = supabaseBrowser();
    const { data: s } = await supabase.auth.getSession();
    const user = s.session?.user;
    if (!user) {
      router.push("/login");
      return;
    }

    const payload: any = {
      user_id: user.id,
      category: r.category,
      name: `${r.name} (copy)`,
      unit: r.unit,
      rate: r.rate,
      notes: r.notes,
      active: true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("rate_cards").insert(payload);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  }

  const Card = ({
    title,
    hint,
    children,
  }: {
    title: string;
    hint?: string;
    children: React.ReactNode;
  }) => (
    <section
      style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: 18,
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 950, color: c.black }}>{title}</h1>
          {hint ? <div style={{ marginTop: 6, color: c.sub, fontWeight: 850 }}>{hint}</div> : null}
        </div>
      </div>
      <div style={{ marginTop: 14 }}>{children}</div>
    </section>
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card
        title="Rate cards"
        hint="Build your company’s labour/plant/material libraries. These drive deterministic valuations (no AI maths)."
      >
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {CATEGORY_TABS.map((t) => (
            <Pill
              key={t.key}
              label={t.label}
              active={tab === t.key}
              onClick={() => {
                setTab(t.key);
                setQ("");
              }}
            />
          ))}

          <div style={{ flex: 1 }} />

          <button
            onClick={openNew}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${c.black}`,
              background: c.black,
              color: "#fff",
              fontWeight: 950,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + Add {CATEGORY_TABS.find((x) => x.key === tab)?.label}
          </button>
        </div>

        {/* Controls */}
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
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
              background: "#fff",
              color: c.text,
              fontWeight: 850,
            }}
          />

          <button
            onClick={() => setShowInactive((p) => !p)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${c.border}`,
              background: "#fff",
              fontWeight: 950,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            title="Show/hide inactive items"
          >
            {showInactive ? "Hide inactive" : "Show inactive"}
          </button>
        </div>

        {/* Summary */}
        <div style={{ marginTop: 10, color: c.sub, fontWeight: 900, fontSize: 13 }}>
          Active in {CATEGORY_TABS.find((x) => x.key === tab)?.label}: {activeCount}
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
              fontWeight: 900,
              fontSize: 13,
            }}
          >
            {err}
          </div>
        ) : null}

        {/* Table */}
        <div style={{ marginTop: 12, border: `1px solid ${c.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 0.6fr 0.6fr 0.9fr",
              gap: 0,
              background: "rgba(17,24,39,0.04)",
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 950,
              color: c.sub,
            }}
          >
            <div>Name</div>
            <div>Unit</div>
            <div style={{ textAlign: "right" }}>Rate</div>
            <div style={{ textAlign: "right" }}>Actions</div>
          </div>

          {loading ? (
            <div style={{ padding: 14, color: c.sub, fontWeight: 900 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 14, color: c.sub, fontWeight: 900 }}>
              No items yet. Click “Add” to create your first {tab} rate.
            </div>
          ) : (
            filtered.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 0.6fr 0.6fr 0.9fr",
                  padding: "12px 12px",
                  borderTop: `1px solid ${c.border}`,
                  alignItems: "center",
                  background: r.active ? "#fff" : "rgba(17,24,39,0.02)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 950,
                      color: c.black,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={r.name}
                  >
                    {r.name}
                  </div>
                  {r.notes ? (
                    <div style={{ marginTop: 4, fontSize: 12, color: c.sub, fontWeight: 850 }}>
                      {r.notes}
                    </div>
                  ) : null}
                  {!r.active ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: c.sub, fontWeight: 900 }}>
                      Inactive
                    </div>
                  ) : null}
                </div>

                <div style={{ color: c.sub, fontWeight: 900 }}>{r.unit}</div>

                <div style={{ textAlign: "right", fontWeight: 950, color: c.black }}>
                  {money(Number(r.rate ?? 0))}
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    onClick={() => openEdit(r)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: `1px solid ${c.border}`,
                      background: "#fff",
                      fontWeight: 950,
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => duplicate(r)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: `1px solid ${c.border}`,
                      background: "#fff",
                      fontWeight: 950,
                      cursor: "pointer",
                    }}
                  >
                    Duplicate
                  </button>

                  <button
                    onClick={() => setActive(r, !r.active)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: `1px solid ${c.border}`,
                      background: r.active ? "#fff" : c.black,
                      color: r.active ? c.black : "#fff",
                      fontWeight: 950,
                      cursor: "pointer",
                    }}
                    title={r.active ? "Deactivate (keeps history but hides from assisted typing)" : "Activate"}
                  >
                    {r.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Modal */}
      {open && (
        <div
          onMouseDown={(e) => {
            // click outside closes
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
            padding: 16,
          }}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              background: "#fff",
              border: `1px solid ${c.border}`,
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 950, fontSize: 16, color: c.black }}>
                  {editing ? "Edit rate card item" : "Add rate card item"}
                </div>
                <div style={{ marginTop: 6, color: c.sub, fontWeight: 850, fontSize: 13 }}>
                  Keep it consistent — this is what powers assisted typing + deterministic valuations.
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${c.border}`,
                  background: "#fff",
                  fontWeight: 950,
                  cursor: "pointer",
                }}
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
                  fontWeight: 900,
                  fontSize: 13,
                }}
              >
                {err}
              </div>
            ) : null}

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Category">
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as Category }))}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 14,
                    border: `1px solid ${c.border}`,
                    background: "#fff",
                    fontWeight: 900,
                    color: c.text,
                  }}
                  disabled={!!editing}
                  title={editing ? "Category locked while editing" : ""}
                >
                  <option value="labour">Labour</option>
                  <option value="plant">Plant</option>
                  <option value="materials">Materials</option>
                </select>
              </Field>

              <Field label="Unit">
                <select
                  value={form.unit}
                  onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 14,
                    border: `1px solid ${c.border}`,
                    background: "#fff",
                    fontWeight: 900,
                    color: c.text,
                  }}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder={form.category === "labour" ? "e.g. Groundworker" : form.category === "plant" ? "e.g. 13T Excavator" : "e.g. C32/40 Concrete"}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 14,
                    border: `1px solid ${c.border}`,
                    background: "#fff",
                    fontWeight: 900,
                    color: c.text,
                  }}
                />
              </Field>

              <Field label="Rate (GBP)">
                <input
                  value={form.rate}
                  onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))}
                  inputMode="decimal"
                  placeholder="e.g. 25.00"
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 14,
                    border: `1px solid ${c.border}`,
                    background: "#fff",
                    fontWeight: 900,
                    color: c.text,
                  }}
                />
                <div style={{ marginTop: 6, fontSize: 12, color: c.sub, fontWeight: 900 }}>
                  Preview: {money(cleanNumber(form.rate))} / {form.unit}
                </div>
              </Field>

              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Notes (optional)">
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    placeholder="e.g. includes operator / standby min 4 hours / internal ref"
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 14,
                      border: `1px solid ${c.border}`,
                      background: "#fff",
                      fontWeight: 850,
                      color: c.text,
                      resize: "vertical",
                    }}
                  />
                </Field>
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  id="active"
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                />
                <label htmlFor="active" style={{ fontWeight: 900, color: c.black }}>
                  Active (shows in assisted typing)
                </label>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${c.border}`,
                  background: "#fff",
                  fontWeight: 950,
                  cursor: "pointer",
                }}
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
                  color: "#fff",
                  fontWeight: 950,
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
