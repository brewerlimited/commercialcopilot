"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type ContractType =
  | "nec4_ecs_option_a"
  | "nec4_ecs_option_b"
  | "nec4_ecc_option_a"
  | "nec4_ecc_option_b";

type ContractSource = "standard_logic" | "upload_contract";

const CONTRACT_TYPE_OPTIONS: { value: ContractType; label: string }[] = [
  { value: "nec4_ecs_option_a", label: "NEC4 ECS Option A" },
  { value: "nec4_ecs_option_b", label: "NEC4 ECS Option B" },
  { value: "nec4_ecc_option_a", label: "NEC4 ECC Option A" },
  { value: "nec4_ecc_option_b", label: "NEC4 ECC Option B" },
];

const CONTRACT_SOURCE_OPTIONS: { value: ContractSource; label: string }[] = [
  { value: "standard_logic", label: "Use standard contract logic" },
  { value: "upload_contract", label: "Upload contract documents" },
];

const c = {
  card: "#ffffff",
  border: "#e5e7eb",
  sub: "#475569",
  black: "#111827",
  soft: "#f8fafc",
  redBg: "#fef2f2",
  redBorder: "#fecaca",
  redText: "#991b1b",
  amberBg: "#fffbeb",
  amberBorder: "#fde68a",
  amberText: "#92400e",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontWeight: 900,
        fontSize: 13,
        color: c.sub,
      }}
    >
      {children}
    </span>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 14,
        border: `1px solid ${c.border}`,
        outline: "none",
        background: "#fff",
        color: c.black,
        fontSize: 14,
        ...(props.style ?? {}),
      }}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 14,
        border: `1px solid ${c.border}`,
        outline: "none",
        background: "#fff",
        color: c.black,
        fontSize: 14,
        ...(props.style ?? {}),
      }}
    />
  );
}

export default function NewEvent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [contractType, setContractType] = useState<ContractType>("nec4_ecs_option_b");
  const [contractSource, setContractSource] = useState<ContractSource>("standard_logic");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canCreate = useMemo(() => {
    if (!title.trim()) return false;
    if (contractSource === "upload_contract" && files.length === 0) return false;
    return !loading;
  }, [title, contractSource, files, loading]);

  function handlePickedFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const next = Array.from(fileList);
    setFiles((prev) => {
      const existing = new Map(prev.map((f) => [`${f.name}_${f.size}`, f]));
      for (const f of next) {
        existing.set(`${f.name}_${f.size}`, f);
      }
      return Array.from(existing.values());
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function create() {
    setErr(null);
    setLoading(true);

    try {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();

      const user = data.session?.user;
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: insertData, error } = await supabase
        .from("events")
        .insert([
          {
            user_id: user.id,
            title: title.trim(),
            status: "draft",
            contract_type: contractType,
            contract_source: contractSource,
          },
        ])
        .select("id")
        .single();

      if (error) throw error;

      const eventId = insertData.id as string;

      if (contractSource === "upload_contract" && files.length > 0) {
        for (const file of files) {
          const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
          const filePath = `${user.id}/${eventId}/${Date.now()}-${safeName}`;

          const upload = await supabase.storage
            .from("contract-files")
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (upload.error) throw upload.error;

          const fileInsert = await supabase.from("event_contract_files").insert({
            event_id: eventId,
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type || null,
          });

          if (fileInsert.error) throw fileInsert.error;
        }
      }

      router.push(`/app/event/${eventId}`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create CE draft");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: 18,
        padding: 28,
      }}
    >
      <h1
        style={{
          fontSize: 22,
          fontWeight: 950,
          margin: 0,
          color: c.black,
        }}
      >
        New CE
      </h1>

      <p
        style={{
          marginTop: 8,
          marginBottom: 0,
          color: c.sub,
          fontSize: 13,
          lineHeight: 1.5,
          maxWidth: 760,
        }}
      >
        Give it a title that makes sense to your team, then choose the contract basis the CE should
        be written against.
      </p>

      <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <Label>Title</Label>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. ST43 Flooding Standing Time – 16/01/26"
          />
        </label>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              contractSource === "upload_contract"
                ? "minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1.6fr)"
                : "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 14,
            alignItems: "start",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <Label>Contract type</Label>
            <SelectInput
              value={contractType}
              onChange={(e) => setContractType(e.target.value as ContractType)}
            >
              {CONTRACT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <Label>Contract source</Label>
            <SelectInput
              value={contractSource}
              onChange={(e) => {
                const value = e.target.value as ContractSource;
                setContractSource(value);
                if (value === "standard_logic") {
                  setFiles([]);
                }
              }}
            >
              {CONTRACT_SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </label>

          {contractSource === "upload_contract" ? (
            <div style={{ display: "grid", gap: 6 }}>
              <Label>Contract documents</Label>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => handlePickedFiles(e.target.files)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              />

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handlePickedFiles(e.dataTransfer.files);
                }}
                style={{
                  border: `1px dashed ${c.border}`,
                  background: c.soft,
                  borderRadius: 14,
                  padding: 12,
                  minHeight: 50,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontSize: 12, color: c.sub, lineHeight: 1.4 }}>
                    Upload subcontract agreement, Z clauses, amendments, scope extracts or other
                    contract documents.
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: `1px solid ${c.black}`,
                      background: c.black,
                      color: "#fff",
                      fontWeight: 800,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Upload files
                  </button>
                </div>

                {files.length > 0 ? (
                  <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    {files.map((file, index) => (
                      <div
                        key={`${file.name}_${file.size}_${index}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: `1px solid ${c.border}`,
                          background: "#fff",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: c.black,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {file.name}
                          </div>
                          <div style={{ fontSize: 12, color: c.sub }}>
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          style={{
                            border: `1px solid ${c.border}`,
                            background: "#fff",
                            borderRadius: 10,
                            padding: "8px 10px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            border: `1px solid ${c.border}`,
            background: c.soft,
            borderRadius: 14,
            padding: 14,
            fontSize: 12,
            color: c.sub,
            lineHeight: 1.5,
          }}
        >
          {contractSource === "standard_logic" ? (
            <>
              The CE will start from the standard clause structure for the selected contract type.
              This is best where the contract generally follows the standard NEC wording and there are
              no major bespoke amendments.
            </>
          ) : (
            <>
              Uploaded contract documents will be attached to the CE so later AI drafting can review
              amended clauses, notice requirements, risk allocation, Defined Cost changes, fee changes
              and programme obligations.
            </>
          )}
        </div>

        {err ? (
          <div
            style={{
              border: `1px solid ${c.redBorder}`,
              background: c.redBg,
              color: c.redText,
              padding: 12,
              borderRadius: 14,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {err}
          </div>
        ) : null}

        <button
          onClick={create}
          disabled={!canCreate}
          style={{
            padding: "12px 14px",
            borderRadius: 14,
            border: `1px solid ${c.black}`,
            background: c.black,
            color: "#fff",
            fontWeight: 950,
            cursor: !canCreate ? "not-allowed" : "pointer",
            opacity: !canCreate ? 0.6 : 1,
          }}
        >
          {loading ? "Creating…" : "Create draft"}
        </button>
      </div>
    </div>
  );
}