"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { buildEventStepPath, normalizeRouteParam } from "@/lib/routeParams";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getOwnedEventOrThrow, getRequiredUser, isAuthErrorMessage, isOwnershipErrorMessage } from "@/lib/security";
import CEProgress from "@/components/CEProgress";
import CEReadinessRail from "@/components/CEReadinessRail";
import { trackAnalyticsWithUser } from "@/lib/analyticsClient";

type EvidenceCategory =
  | "instructions"
  | "photos"
  | "site_records"
  | "programme"
  | "cost_support"
  | "other";

type EventFile = {
  id: string;
  event_id: string;
  category: EvidenceCategory;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  description: string | null;
  evidence_date: string | null;
  relates_to: string | null;
  created_at?: string;
};

type PreviewMap = Record<string, string>;

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

const CATEGORY_META: {
  key: EvidenceCategory;
  title: string;
  hint: string;
  checklistLabel: string;
}[] = [
  {
    key: "instructions",
    title: "Instructions / communications",
    hint: "Upload PM instructions, emails, RFIs, marked drawings or written directions.",
    checklistLabel: "Instruction / communication",
  },
  {
    key: "photos",
    title: "Photographic evidence",
    hint: "Upload photos showing the physical change, restriction, disruption or condition encountered.",
    checklistLabel: "Photos",
  },
  {
    key: "site_records",
    title: "Site records",
    hint: "Upload diary extracts, allocation sheets, daywork sheets or site records linked to the event.",
    checklistLabel: "Site diary / records",
  },
  {
    key: "programme",
    title: "Programme evidence",
    hint: "Upload programme extracts, activity mark-ups or any record showing time or sequencing impact.",
    checklistLabel: "Programme support",
  },
  {
    key: "cost_support",
    title: "Cost support",
    hint: "Upload timesheets, plant logs, delivery tickets, quotations or records supporting the valuation.",
    checklistLabel: "Cost support",
  },
  {
    key: "other",
    title: "Other supporting documents",
    hint: "Anything else relevant that supports causation, entitlement or valuation.",
    checklistLabel: "Other support",
  },
];

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function formatBytes(bytes?: number | null) {
  const n = Number(bytes ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function niceDate(v?: string) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isImageFile(file: Pick<EventFile, "mime_type" | "file_name">) {
  if (file.mime_type?.startsWith("image/")) return true;
  const lower = file.file_name.toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].some((ext) => lower.endsWith(ext));
}

function hasNotes(file: Pick<EventFile, "description" | "evidence_date" | "relates_to">) {
  return Boolean(
    (file.description && file.description.trim()) ||
      (file.evidence_date && file.evidence_date.trim()) ||
      (file.relates_to && file.relates_to.trim())
  );
}

function Card({
  title,
  hint,
  children,
  dragActive,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  dragActive?: boolean;
  onDragEnter?: React.DragEventHandler<HTMLElement>;
  onDragOver?: React.DragEventHandler<HTMLElement>;
  onDragLeave?: React.DragEventHandler<HTMLElement>;
  onDrop?: React.DragEventHandler<HTMLElement>;
}) {
  return (
    <section
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        background: c.card,
        border: `1px solid ${dragActive ? c.greenBorder : c.border}`,
        borderRadius: 18,
        padding: 20,
        boxShadow: dragActive ? "0 0 0 4px rgba(16, 185, 129, 0.08)" : undefined,
        transition: "border-color 160ms ease, box-shadow 160ms ease",
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
            maxWidth: 760,
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
        fontWeight: 600,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.6 : 1,
        ...(props.style ?? {}),
      }}
    />
  );
}

function HiddenFileInput({
  onPick,
  multiple = true,
  accept,
  inputRef,
}: {
  onPick: (files: FileList | null) => void;
  multiple?: boolean;
  accept?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      multiple={multiple}
      accept={accept}
      style={{ display: "none" }}
      onChange={(e) => onPick(e.target.files)}
    />
  );
}

function DropZone({
  title,
  subtitle,
  onSelectClick,
  onDropFiles,
  busy,
}: {
  title: string;
  subtitle: string;
  onSelectClick: () => void;
  onDropFiles: (files: FileList | null) => void;
  busy?: boolean;
}) {
  const [drag, setDrag] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDrag(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDrag(false);
        onDropFiles(e.dataTransfer.files);
      }}
      style={{
        border: `1px dashed ${drag ? c.black : c.border}`,
        background: drag ? "#fcfcfd" : c.soft,
        borderRadius: 18,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.black }}>{title}</div>
          <div style={{ fontSize: 12, color: c.sub, marginTop: 4 }}>{subtitle}</div>
        </div>

        <SmallBtn
          type="button"
          disabled={busy}
          onClick={onSelectClick}
          style={{
            background: c.black,
            color: c.blackContrast,
            borderColor: c.black,
          }}
        >
          {busy ? "Uploading…" : "Upload files"}
        </SmallBtn>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 12,
        fontWeight: 700,
        color: c.sub,
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

export default function EvidencePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = normalizeRouteParam(params?.id);

  const supabase = useMemo(() => supabaseBrowser(), []);
  const inputRefs = useRef<Record<EvidenceCategory, HTMLInputElement | null>>({
    instructions: null,
    photos: null,
    site_records: null,
    programme: null,
    cost_support: null,
    other: null,
  });

  const [eventTitle, setEventTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<EventFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyCategory, setBusyCategory] = useState<EvidenceCategory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingMetaId, setSavingMetaId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<PreviewMap>({});
  const [openNotesFor, setOpenNotesFor] = useState<Record<string, boolean>>({});
  const [dragCategory, setDragCategory] = useState<EvidenceCategory | null>(null);
  const lastSavedSnapshotRef = useRef<string>("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  function serialiseFiles(nextFiles: EventFile[]) {
    return JSON.stringify(
      nextFiles
        .map((f) => ({
          id: f.id,
          category: f.category,
          file_name: f.file_name,
          file_path: f.file_path,
          file_size: f.file_size ?? null,
          mime_type: f.mime_type ?? null,
          description: f.description ?? null,
          evidence_date: f.evidence_date ?? null,
          relates_to: f.relates_to ?? null,
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
    );
  }

  async function load() {
    if (!eventId || !isUuid(eventId)) return;

    setLoading(true);
    setError(null);

    try {
      const user = await getRequiredUser(supabase);
      const ev = await getOwnedEventOrThrow(supabase, eventId, user.id, "id,title,user_id");
      setEventTitle((ev as { title?: string | null }).title ?? "");

      const fl = await (supabase as any).from("event_files")
        .select(
          "id,event_id,category,file_name,file_path,file_size,mime_type,description,evidence_date,relates_to,created_at"
        )
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (fl.error) throw fl.error;

      const data = (fl.data ?? []) as EventFile[];
      setFiles(data);
      lastSavedSnapshotRef.current = serialiseFiles(data);
      setSaveState("saved");
      setLastSavedAt(data.length > 0 ? Date.now() : null);

      setOpenNotesFor((prev) => {
        const next = { ...prev };
        for (const f of data) {
          if (prev[f.id] === undefined) {
            next[f.id] = hasNotes(f);
          }
        }
        return next;
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [eventId]);

  useEffect(() => {
    let alive = true;

    async function buildPreviews() {
      const imageFiles = files.filter((f) => isImageFile(f));
      if (imageFiles.length === 0) {
        if (alive) setPreviews({});
        return;
      }

      const next: PreviewMap = {};
      for (const f of imageFiles) {
        const signed = await supabase.storage
          .from("event-files")
          .createSignedUrl(f.file_path, 60 * 30);
        if (!signed.error && (signed.data as any)?.signedUrl) {
          next[f.id] = (signed.data as any)?.signedUrl;
        }
      }

      if (alive) setPreviews(next);
    }

    buildPreviews();
    return () => {
      alive = false;
    };
  }, [files, supabase]);

  const grouped = useMemo(() => {
    const map: Record<EvidenceCategory, EventFile[]> = {
      instructions: [],
      photos: [],
      site_records: [],
      programme: [],
      cost_support: [],
      other: [],
    };

    for (const f of files) {
      if (map[f.category]) map[f.category].push(f);
    }

    return map;
  }, [files]);

  const currentSnapshot = useMemo(() => serialiseFiles(files), [files]);

  useEffect(() => {
    if (loading) return;
    if (busyCategory || deletingId || savingMetaId) return;
    if (!lastSavedSnapshotRef.current) {
      setSaveState(files.length > 0 ? "saved" : "saved");
      return;
    }
    setSaveState(currentSnapshot !== lastSavedSnapshotRef.current ? "unsaved" : "saved");
  }, [currentSnapshot, loading, busyCategory, deletingId, savingMetaId, files.length]);

  useEffect(() => {
    if (!error || busyCategory || deletingId || savingMetaId) return;
    setSaveState("error");
  }, [error, busyCategory, deletingId, savingMetaId]);

  const evidenceBadge = useMemo(() => {
    if (saveState === "error") return { bg: c.redBg, bd: c.redBorder, tx: c.redText, label: "Save failed" };
    if (saveState === "saving") return { bg: c.amberBg, bd: c.amberBorder, tx: c.amberText, label: "Saving…" };
    if (saveState === "unsaved") return { bg: c.amberBg, bd: c.amberBorder, tx: c.amberText, label: "Unsaved" };
    return { bg: c.greenBg, bd: c.greenBorder, tx: c.greenText, label: "Saved" };
  }, [saveState]);

  const checklist = useMemo(() => {
    return [
      { label: "Instruction / communication", ok: grouped.instructions.length > 0 },
      { label: "Photos", ok: grouped.photos.length > 0 },
      { label: "Site diary / records", ok: grouped.site_records.length > 0 },
      { label: "Programme support", ok: grouped.programme.length > 0 },
      { label: "Cost support", ok: grouped.cost_support.length > 0 },
    ];
  }, [grouped]);

  const evidenceReadiness = useMemo(() => {
    const total = checklist.length || 1;
    return Math.round((checklist.filter((item) => item.ok).length / total) * 100);
  }, [checklist]);

  async function handleFiles(category: EvidenceCategory, picked: FileList | null) {
    if (!picked || picked.length === 0 || !eventId) return;

    setBusyCategory(category);
    setSaveState("saving");
    setError(null);

    try {
      const user = await getRequiredUser(supabase);
      const userId = user.id;
      await getOwnedEventOrThrow(supabase, eventId, userId);

      const files = Array.from(picked);
      for (const file of files) {
        const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
        const path = `${userId}/${eventId}/${category}/${Date.now()}-${safeName}`;

        const up = await supabase.storage.from("event-files").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

        if (up.error) throw up.error;

        const ins = await (supabase as any).from("event_files").insert({
          event_id: eventId,
          category,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type || null,
          description: null,
          evidence_date: null,
          relates_to: null,
        });

        if (ins.error) throw ins.error;
      }

      void trackAnalyticsWithUser(supabase, "evidence_uploaded", {
        event_id: eventId,
        category,
        file_count: files.length,
      });

      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload evidence");
    } finally {
      setBusyCategory(null);
      const input = inputRefs.current[category];
      if (input) input.value = "";
    }
  }

  function handleSectionDragEnter(category: EvidenceCategory, e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    if (busyCategory) return;
    setDragCategory(category);
  }

  function handleSectionDragOver(category: EvidenceCategory, e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    if (busyCategory) {
      e.dataTransfer.dropEffect = "none";
      return;
    }
    e.dataTransfer.dropEffect = "copy";
    setDragCategory(category);
  }

  function handleSectionDragLeave(category: EvidenceCategory, e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    const nextTarget = e.relatedTarget;
    if (nextTarget instanceof Node && e.currentTarget.contains(nextTarget)) return;
    if (dragCategory === category) setDragCategory(null);
  }

  function handleSectionDrop(category: EvidenceCategory, e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragCategory(null);
    if (busyCategory) return;
    void handleFiles(category, e.dataTransfer.files);
  }

  async function removeFile(file: EventFile) {
    if (!confirm(`Remove ${file.file_name}?`)) return;

    setDeletingId(file.id);
    setSaveState("saving");
    setError(null);

    try {
      const delStorage = await supabase.storage.from("event-files").remove([file.file_path]);
      if (delStorage.error) throw delStorage.error;

      const delRow = await (supabase as any).from("event_files").delete().eq("id", file.id).eq("event_id", eventId);
      if (delRow.error) throw delRow.error;

      setFiles((prev) => prev.filter((x) => x.id !== file.id));
      setPreviews((prev) => {
        const next = { ...prev };
        delete next[file.id];
        return next;
      });
      const nextFiles = files.filter((x) => x.id !== file.id);
      lastSavedSnapshotRef.current = serialiseFiles(nextFiles);
      setLastSavedAt(Date.now());
      setSaveState("saved");
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete file");
    } finally {
      setDeletingId(null);
    }
  }

  async function openFile(file: EventFile) {
    const signed = await supabase.storage
      .from("event-files")
      .createSignedUrl(file.file_path, 60 * 10);
    if (signed.error) {
      setError(signed.error.message);
      return;
    }
    window.open((signed.data as any)?.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function saveMetadata(file: EventFile) {
    setSavingMetaId(file.id);
    setSaveState("saving");
    setError(null);

    try {
      const upd = await (supabase as any).from("event_files")
        .update({
          description: file.description,
          evidence_date: file.evidence_date || null,
          relates_to: file.relates_to,
        })
        .eq("id", file.id).eq("event_id", eventId);

      if (upd.error) throw upd.error;
      const nextFiles = files.map((f) => (f.id === file.id ? { ...f, description: file.description, evidence_date: file.evidence_date || null, relates_to: file.relates_to } : f));
      lastSavedSnapshotRef.current = serialiseFiles(nextFiles);
      setLastSavedAt(Date.now());
      setSaveState("saved");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save evidence details");
    } finally {
      setSavingMetaId(null);
    }
  }

  function patchFile(fileId: string, patch: Partial<EventFile>) {
    setFiles((prev) => {
      const next = prev.map((f) => (f.id === fileId ? { ...f, ...patch } : f));
      setSaveState(serialiseFiles(next) !== lastSavedSnapshotRef.current ? "unsaved" : "saved");
      return next;
    });
  }

  function toggleNotes(fileId: string) {
    setOpenNotesFor((prev) => ({
      ...prev,
      [fileId]: !prev[fileId],
    }));
  }

  if (!eventId || !isUuid(eventId)) {
    return <div style={{ padding: 28 }}>Invalid event id.</div>;
  }

  return (
    <div style={{ background: c.bg, minHeight: "100vh" }}>
      <div style={{ padding: "22px 24px", maxWidth: 1680, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 340px",
            gap: 24,
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
                Evidence
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
                Upload the documents, records and photographs that support the event and strengthen the final pack.
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
                    border: `1px solid ${evidenceBadge.bd}`,
                    background: evidenceBadge.bg,
                    color: evidenceBadge.tx,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {evidenceBadge.label}
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
                  {files.length} file{files.length === 1 ? "" : "s"}
                </span>

                {lastSavedAt ? (
                  <span style={{ fontSize: 12, color: c.sub }}>
                    Last saved at {new Date(lastSavedAt).toLocaleTimeString()}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: c.sub }}>Autosave on</span>
                )}
              </div>

              <div style={{ marginTop: 18 }}>
                <CEProgress eventId={eventId} currentStep="evidence" />
              </div>
            </div>

            {error ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: `1px solid ${c.redBorder}`,
                  background: c.redBg,
                  color: c.redText,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {error}
              </div>
            ) : null}

            {CATEGORY_META.map((cat) => {
              const list = grouped[cat.key];
              const busy = busyCategory === cat.key;

              return (
                <Card
                  key={cat.key}
                  title={cat.title}
                  hint={dragCategory === cat.key ? "Drop files here to add them to this evidence section." : cat.hint}
                  dragActive={dragCategory === cat.key}
                  onDragEnter={(e) => handleSectionDragEnter(cat.key, e)}
                  onDragOver={(e) => handleSectionDragOver(cat.key, e)}
                  onDragLeave={(e) => handleSectionDragLeave(cat.key, e)}
                  onDrop={(e) => handleSectionDrop(cat.key, e)}
                >
                  <HiddenFileInput
                    inputRef={{
                      get current() {
                        return inputRefs.current[cat.key];
                      },
                      set current(v) {
                        inputRefs.current[cat.key] = v;
                      },
                    }}
                    onPick={(picked) => handleFiles(cat.key, picked)}
                    accept={cat.key === "photos" ? "image/*,.pdf" : undefined}
                  />

                  <DropZone
                    title="Drag files here or browse"
                    subtitle="PDFs, images, emails saved as PDF, marked drawings and records are all fine for MVP."
                    busy={busy}
                    onSelectClick={() => inputRefs.current[cat.key]?.click()}
                    onDropFiles={(picked) => handleFiles(cat.key, picked)}
                  />

                  <div style={{ marginTop: 14 }}>
                    {list.length === 0 ? (
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: 14,
                          border: `1px solid ${c.border}`,
                          background: c.input,
                          color: c.sub,
                          fontSize: 13,
                        }}
                      >
                        No files uploaded yet.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 12 }}>
                        {list.map((file) => {
                          const previewUrl = previews[file.id];
                          const showPreview = Boolean(previewUrl && isImageFile(file));
                          const notesOpen = !!openNotesFor[file.id];
                          const noteState = hasNotes(file) ? "Edit notes" : "Add notes";

                          return (
                            <div
                              key={file.id}
                              style={{
                                border: `1px solid ${c.border}`,
                                borderRadius: 18,
                                background: c.card,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  padding: 14,
                                  display: "grid",
                                  gridTemplateColumns: showPreview
                                    ? "96px minmax(0,1fr) auto"
                                    : "minmax(0,1fr) auto",
                                  gap: 14,
                                  alignItems: "center",
                                }}
                              >
                                {showPreview ? (
                                  <div
                                    style={{
                                      width: 96,
                                      height: 96,
                                      borderRadius: 12,
                                      overflow: "hidden",
                                      border: `1px solid ${c.border}`,
                                      background: c.soft,
                                      flexShrink: 0,
                                    }}
                                  >
                                    <img
                                      src={previewUrl}
                                      alt={file.file_name}
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        display: "block",
                                      }}
                                    />
                                  </div>
                                ) : null}

                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: c.black,
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {file.file_name}
                                  </div>

                                  <div style={{ fontSize: 12, color: c.sub, marginTop: 4 }}>
                                    {formatBytes(file.file_size)} • {niceDate(file.created_at)}
                                  </div>

                                  {(file.description || file.evidence_date || file.relates_to) && (
                                    <div
                                      style={{
                                        marginTop: 8,
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 8,
                                      }}
                                    >
                                      {file.evidence_date ? (
                                        <span
                                          style={{
                                            fontSize: 11,
                                            color: c.sub,
                                            border: `1px solid ${c.border}`,
                                            background: c.soft,
                                            padding: "4px 8px",
                                            borderRadius: 999,
                                            fontWeight: 600,
                                          }}
                                        >
                                          {file.evidence_date}
                                        </span>
                                      ) : null}

                                      {file.relates_to ? (
                                        <span
                                          style={{
                                            fontSize: 11,
                                            color: c.sub,
                                            border: `1px solid ${c.border}`,
                                            background: c.soft,
                                            padding: "4px 8px",
                                            borderRadius: 999,
                                            fontWeight: 600,
                                            maxWidth: 260,
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                          }}
                                          title={file.relates_to}
                                        >
                                          {file.relates_to}
                                        </span>
                                      ) : null}
                                    </div>
                                  )}
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    flexWrap: "wrap",
                                    justifyContent: "flex-end",
                                  }}
                                >
                                  <SmallBtn type="button" onClick={() => openFile(file)}>
                                    Open
                                  </SmallBtn>

                                  <SmallBtn type="button" onClick={() => toggleNotes(file.id)}>
                                    {notesOpen ? "Hide notes" : noteState}
                                  </SmallBtn>

                                  <SmallBtn
                                    type="button"
                                    onClick={() => removeFile(file)}
                                    disabled={deletingId === file.id}
                                    style={{ color: c.redText }}
                                  >
                                    {deletingId === file.id ? "Removing…" : "Remove"}
                                  </SmallBtn>
                                </div>
                              </div>

                              {notesOpen ? (
                                <div
                                  style={{
                                    borderTop: `1px solid ${c.border}`,
                                    background: c.soft,
                                    padding: 14,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "1.4fr 0.8fr 1fr",
                                      gap: 12,
                                      alignItems: "start",
                                    }}
                                  >
                                    <div>
                                      <FieldLabel>Comment / description</FieldLabel>
                                      <textarea
                                        value={file.description ?? ""}
                                        onChange={(e) =>
                                          patchFile(file.id, { description: e.target.value })
                                        }
                                        rows={4}
                                        placeholder="e.g. Photo of flooded access preventing base pour works at ST43."
                                        style={{
                                          width: "100%",
                                          padding: 12,
                                          borderRadius: 12,
                                          border: `1px solid ${c.border}`,
                                          resize: "vertical",
                                          fontSize: 13,
                                          outline: "none",
                                          background: c.input,
                                          color: c.black,
                                        }}
                                      />
                                    </div>

                                    <div>
                                      <FieldLabel>Date taken / date of record</FieldLabel>
                                      <input
                                        type="date"
                                        value={file.evidence_date ?? ""}
                                        onChange={(e) =>
                                          patchFile(file.id, { evidence_date: e.target.value })
                                        }
                                        style={{
                                          width: "100%",
                                          padding: 12,
                                          borderRadius: 12,
                                          border: `1px solid ${c.border}`,
                                          fontSize: 13,
                                          outline: "none",
                                          background: c.input,
                                          color: c.black,
                                        }}
                                      />
                                    </div>

                                    <div>
                                      <FieldLabel>Relates to</FieldLabel>
                                      <input
                                        value={file.relates_to ?? ""}
                                        onChange={(e) =>
                                          patchFile(file.id, { relates_to: e.target.value })
                                        }
                                        placeholder="e.g. ST43 / flooding / restricted access"
                                        style={{
                                          width: "100%",
                                          padding: 12,
                                          borderRadius: 12,
                                          border: `1px solid ${c.border}`,
                                          fontSize: 13,
                                          outline: "none",
                                          background: c.input,
                                          color: c.black,
                                        }}
                                      />
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "flex-end",
                                      marginTop: 12,
                                    }}
                                  >
                                    <SmallBtn
                                      type="button"
                                      onClick={() => saveMetadata(file)}
                                      disabled={savingMetaId === file.id}
                                      style={{
                                        background: c.black,
                                        color: c.blackContrast,
                                        borderColor: c.black,
                                      }}
                                    >
                                      {savingMetaId === file.id ? "Saving…" : "Save notes"}
                                    </SmallBtn>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
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
            <CEReadinessRail
              readiness={evidenceReadiness}
              readinessLabel={evidenceReadiness >= 80 ? "Evidence strong" : evidenceReadiness > 0 ? "Building support" : "Just started"}
              rows={checklist.map((item) => ({
                label: item.label,
                value: item.ok ? "Uploaded" : "Missing",
              }))}
              coach="Evidence is stronger when each record is dated, described and linked back to the issue. Add notes as you upload so the pack can explain why each record matters."
              nextCopy="Once the evidence support is in place, move to resources and build the labour, plant, material and cost support."
              primaryHref={buildEventStepPath(eventId, "resources")}
              primaryLabel="Continue to Resources"
              secondaryHref={buildEventStepPath(eventId, "details")}
              secondaryLabel="Back to Basis of Change"
              backHref="/app"
            />

          </div>
        </div>

        {loading ? <div style={{ marginTop: 18, color: c.sub, fontSize: 13 }}>Loading…</div> : null}
      </div>
    </div>
  );
}
