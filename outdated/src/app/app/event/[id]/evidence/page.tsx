"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import CEProgress from "@/components/CEProgress";

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
        borderRadius: 16,
        padding: 18,
      }}
    >
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
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
            lineHeight: 1.5,
            color: c.sub,
            maxWidth: 760,
          }}
        >
          {hint}
        </p>
      ) : null}

      <div style={{ marginTop: 14 }}>{children}</div>
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
        borderRadius: 12,
        padding: "16px 18px",
        background: "#fff",
      }}
    >
      <div
        style={{
          fontSize: 14,
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

function SmallBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${c.border}`,
        background: "#fff",
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
        setDrag(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        onDropFiles(e.dataTransfer.files);
      }}
      style={{
        border: `1px dashed ${drag ? c.black : c.border}`,
        background: drag ? "#fcfcfd" : c.soft,
        borderRadius: 16,
        padding: 18,
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
            color: "#fff",
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
        fontWeight: 500,
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
  const eventId = (params?.id ?? "").toString();

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

  async function load() {
    if (!eventId || !isUuid(eventId)) return;

    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        router.push("/login");
        return;
      }

      const ev = await supabase.from("events").select("id,title").eq("id", eventId).single();
      if (ev.error) throw ev.error;
      setEventTitle(ev.data?.title ?? "");

      const fl = await supabase
        .from("event_files")
        .select(
          "id,event_id,category,file_name,file_path,file_size,mime_type,description,evidence_date,relates_to,created_at"
        )
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (fl.error) throw fl.error;

      const data = (fl.data ?? []) as EventFile[];
      setFiles(data);

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
        if (!signed.error && signed.data?.signedUrl) {
          next[f.id] = signed.data.signedUrl;
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

  const checklist = useMemo(() => {
    return [
      { label: "Instruction / communication", ok: grouped.instructions.length > 0 },
      { label: "Photos", ok: grouped.photos.length > 0 },
      { label: "Site diary / records", ok: grouped.site_records.length > 0 },
      { label: "Programme support", ok: grouped.programme.length > 0 },
      { label: "Cost support", ok: grouped.cost_support.length > 0 },
    ];
  }, [grouped]);

  async function handleFiles(category: EvidenceCategory, picked: FileList | null) {
    if (!picked || picked.length === 0 || !eventId) return;

    setBusyCategory(category);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        router.push("/login");
        return;
      }

      for (const file of Array.from(picked)) {
        const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
        const path = `${userId}/${eventId}/${category}/${Date.now()}-${safeName}`;

        const up = await supabase.storage.from("event-files").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

        if (up.error) throw up.error;

        const ins = await supabase.from("event_files").insert({
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

      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload evidence");
    } finally {
      setBusyCategory(null);
      const input = inputRefs.current[category];
      if (input) input.value = "";
    }
  }

  async function removeFile(file: EventFile) {
    if (!confirm(`Remove ${file.file_name}?`)) return;

    setDeletingId(file.id);
    setError(null);

    try {
      const delStorage = await supabase.storage.from("event-files").remove([file.file_path]);
      if (delStorage.error) throw delStorage.error;

      const delRow = await supabase.from("event_files").delete().eq("id", file.id);
      if (delRow.error) throw delRow.error;

      setFiles((prev) => prev.filter((x) => x.id !== file.id));
      setPreviews((prev) => {
        const next = { ...prev };
        delete next[file.id];
        return next;
      });
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
    window.open(signed.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function saveMetadata(file: EventFile) {
    setSavingMetaId(file.id);
    setError(null);

    try {
      const upd = await supabase
        .from("event_files")
        .update({
          description: file.description,
          evidence_date: file.evidence_date || null,
          relates_to: file.relates_to,
        })
        .eq("id", file.id);

      if (upd.error) throw upd.error;
    } catch (e: any) {
      setError(e?.message ?? "Failed to save evidence details");
    } finally {
      setSavingMetaId(null);
    }
  }

  function patchFile(fileId: string, patch: Partial<EventFile>) {
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, ...patch } : f)));
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
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 380px",
            gap: 20,
            alignItems: "start",
          }}
        >
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
                Evidence
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
              <p
                style={{
                  margin: "10px 0 0",
                  color: c.sub,
                  maxWidth: 760,
                  lineHeight: 1.5,
                  fontSize: 13,
                }}
              >
                Upload the documents, records and photographs that support the change while the facts
                are still fresh. Add notes against each item so the evidence register is stronger later.
              </p>
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
                <Card key={cat.key} title={cat.title} hint={cat.hint}>
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
                          background: "#fff",
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
                                borderRadius: 16,
                                background: "#fff",
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
                                          background: "#fff",
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
                                          background: "#fff",
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
                                          background: "#fff",
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
                                        color: "#fff",
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
            <div
              style={{
                border: `1px solid ${c.border}`,
                borderRadius: 12,
                padding: "14px 16px",
                background: "#fff",
              }}
            >
              <CEProgress eventId={eventId} currentStep="evidence" />
            </div>

            <SidebarCard title="Evidence completeness">
              <div style={{ display: "grid", gap: 10 }}>
                {checklist.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: `1px solid ${c.border}`,
                      background: "#fff",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: c.black }}>
                      {item.label}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: item.ok ? c.greenText : c.amberText,
                      }}
                    >
                      {item.ok ? "Uploaded" : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
            </SidebarCard>

            <SidebarCard title="Next step">
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  Once evidence is in, move on to the resource build-up while the event is still clear
                  in your mind.
                </div>

                <SmallBtn type="button" onClick={() => router.push(`/app/event/${eventId}`)}>
                  Back to change details
                </SmallBtn>

                <SmallBtn
                  type="button"
                  onClick={() => router.push(`/app/event/${eventId}/resources`)}
                  style={{
                    background: c.black,
                    color: "#fff",
                    borderColor: c.black,
                  }}
                >
                  Continue to resources
                </SmallBtn>

                <SmallBtn
                  type="button"
                  onClick={() => router.push(`/app`)}
                  style={{
                    background: c.lightGrey,
                  }}
                >
                  Back to dashboard
                </SmallBtn>
              </div>
            </SidebarCard>
          </div>
        </div>

        {loading ? <div style={{ marginTop: 18, color: c.sub, fontSize: 13 }}>Loading…</div> : null}
      </div>
    </div>
  );
}