import { getContractFamily, getContractLabel } from "@/lib/contracts";
import { getDraftTemplateForContractType } from "@/lib/draftTemplates";
import {
  COMPANY_PROFILE_SELECT,
  cleanCompanyProfile,
  companyDisplayName,
  companyLegalName,
} from "@/lib/companyProfile";
import { inflateRawSync } from "zlib";

type SupabaseAdminClient = any;

function num(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function compactObject<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as T;
}

function safeArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function sum(lines: any[], predicate: (line: any) => boolean) {
  return lines
    .filter(predicate)
    .reduce((total, line) => total + num(line.total), 0);
}

function lower(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function isTextLikeFile(file: any) {
  const mime = lower(file?.mime_type);
  const name = lower(file?.file_name);
  return (
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.includes("xml") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    name.endsWith(".json") ||
    name.endsWith(".xml")
  );
}

function isPdfFile(file: any) {
  const mime = lower(file?.mime_type);
  const name = lower(file?.file_name);
  return mime.includes("pdf") || name.endsWith(".pdf");
}

function isDocxFile(file: any) {
  const mime = lower(file?.mime_type);
  const name = lower(file?.file_name);
  return mime.includes("wordprocessingml") || name.endsWith(".docx");
}

function isLegacyDocFile(file: any) {
  const name = lower(file?.file_name);
  const mime = lower(file?.mime_type);
  return name.endsWith(".doc") || mime === "application/msword";
}

function cleanExtractedText(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripXmlText(xml: string) {
  return cleanExtractedText(
    xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'"),
  );
}

function decodeZipEntry(
  buffer: Buffer,
  offset: number,
  compressionMethod: number,
  compressedSize: number,
) {
  const compressed = buffer.subarray(offset, offset + compressedSize);
  if (compressionMethod === 0) return compressed;
  if (compressionMethod === 8) return inflateRawSync(compressed);
  return Buffer.alloc(0);
}

function extractDocxTextFromBuffer(buffer: Buffer) {
  const parts: string[] = [];
  let offset = 0;

  while (offset < buffer.length - 30) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    const fileName = buffer.subarray(nameStart, nameEnd).toString("utf8");
    const dataStart = nameEnd + extraLength;
    const nextOffset = dataStart + compressedSize;

    if (
      /^word\/(document|footnotes|endnotes|header\d*|footer\d*)\.xml$/i.test(
        fileName,
      )
    ) {
      try {
        const xml = decodeZipEntry(
          buffer,
          dataStart,
          compressionMethod,
          compressedSize,
        ).toString("utf8");
        const extracted = stripXmlText(xml);
        if (extracted) parts.push(extracted);
      } catch {
        // Keep scanning the DOCX if one XML part fails.
      }
    }

    offset = Math.max(nextOffset, offset + 30);
  }

  return cleanExtractedText(parts.join("\n\n"));
}

function decodePdfEscapedText(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function extractPdfTextBestEffort(buffer: Buffer) {
  // Best-effort only: this catches text-based PDFs and clearly reports scanned/encoded PDFs as unreadable.
  const latin = buffer.toString("latin1");
  const literalMatches = Array.from(
    latin.matchAll(/\(([^()]{3,2000})\)\s*Tj/g),
  ).map((match) => decodePdfEscapedText(match[1]));
  const arrayMatches = Array.from(
    latin.matchAll(/\[((?:\([^()]{1,1000}\)\s*)+)\]\s*TJ/g),
  ).map((match) =>
    Array.from(match[1].matchAll(/\(([^()]+)\)/g))
      .map((item) => decodePdfEscapedText(item[1]))
      .join(""),
  );
  return cleanExtractedText([...literalMatches, ...arrayMatches].join("\n"));
}

type ContractExtractionResult = {
  id: string | null;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
  extraction_status: "extracted" | "failed" | "no_readable_text";
  extracted_text: string;
  extracted_characters: number;
  extraction_error: string | null;
  extracted_at: string | null;
};

async function updateContractExtractionMetadata(
  admin: SupabaseAdminClient,
  file: any,
  result: ContractExtractionResult,
) {
  if (!file?.id) return;

  try {
    const update = await (admin as any).from("event_contract_files")
      .update({
        extracted_text: result.extracted_text || null,
        extraction_status: result.extraction_status,
        extraction_error: result.extraction_error,
        extracted_characters: result.extracted_characters,
        extracted_at: result.extracted_at || new Date().toISOString(),
      })
      .eq("id", file.id);

    if (update?.error) throw update.error;
  } catch (error) {
    console.warn(
      "Contract extraction metadata update skipped. Apply the SQL patch to persist extraction status.",
      error,
    );
  }
}

async function extractContractFileText(
  admin: SupabaseAdminClient,
  file: any,
): Promise<ContractExtractionResult> {
  const base: ContractExtractionResult = {
    id: file?.id || null,
    file_name: file?.file_name || "Unnamed contract file",
    mime_type: file?.mime_type || null,
    file_size: typeof file?.file_size === "number" ? file.file_size : null,
    uploaded_at: file?.created_at || null,
    extraction_status: "failed",
    extracted_text: "",
    extracted_characters: 0,
    extraction_error: null,
    extracted_at: file?.extracted_at || null,
  };

  const storedText = cleanExtractedText(file?.extracted_text);
  if (storedText) {
    return {
      ...base,
      extraction_status: "extracted",
      extracted_text: storedText,
      extracted_characters: storedText.length,
      extraction_error: file?.extraction_error || null,
      extracted_at: file?.extracted_at || null,
    };
  }

  if (!file?.file_path) {
    const result = {
      ...base,
      extraction_status: "failed" as const,
      extraction_error: "No storage file path recorded for this contract file.",
      extracted_at: new Date().toISOString(),
    };
    await updateContractExtractionMetadata(admin, file, result);
    return result;
  }

  if (isLegacyDocFile(file)) {
    const result = {
      ...base,
      extraction_status: "failed" as const,
      extraction_error:
        "Legacy .doc files cannot be safely extracted server-side. Upload DOCX, PDF, TXT, or convert the contract wording to a readable text-based format.",
      extracted_at: new Date().toISOString(),
    };
    await updateContractExtractionMetadata(admin, file, result);
    return result;
  }

  try {
    const downloaded = await admin.storage
      .from("contract-files")
      .download(file.file_path);
    if (downloaded.error || !downloaded.data) {
      const result = {
        ...base,
        extraction_status: "failed" as const,
        extraction_error:
          downloaded.error?.message ||
          "Could not download contract file from storage.",
        extracted_at: new Date().toISOString(),
      };
      await updateContractExtractionMetadata(admin, file, result);
      return result;
    }

    let extracted = "";
    let extractionError: string | null = null;

    if (isTextLikeFile(file)) {
      extracted = await (downloaded.data as any)?.text();
    } else {
      const buffer = Buffer.from(await (downloaded.data as any)?.arrayBuffer());
      if (isDocxFile(file)) {
        extracted = extractDocxTextFromBuffer(buffer);
        if (!extracted)
          extractionError =
            "DOCX was downloaded but no readable document text was found.";
      } else if (isPdfFile(file)) {
        extracted = extractPdfTextBestEffort(buffer);
        if (!extracted)
          extractionError =
            "PDF was downloaded but no readable text was found. It may be scanned/image-based or encoded in a way this extractor cannot read.";
      } else {
        extractionError = "Unsupported contract file type for text extraction.";
      }
    }

    const cleaned = cleanExtractedText(extracted);
    const result: ContractExtractionResult = {
      ...base,
      extraction_status: cleaned ? "extracted" : "no_readable_text",
      extracted_text: cleaned,
      extracted_characters: cleaned.length,
      extraction_error: cleaned
        ? null
        : extractionError || "No readable contract text extracted.",
      extracted_at: new Date().toISOString(),
    };
    await updateContractExtractionMetadata(admin, file, result);
    return result;
  } catch (error: any) {
    const result = {
      ...base,
      extraction_status: "failed" as const,
      extraction_error: error?.message || "Contract text extraction failed.",
      extracted_at: new Date().toISOString(),
    };
    await updateContractExtractionMetadata(admin, file, result);
    return result;
  }
}

async function fetchContractFiles(admin: SupabaseAdminClient, eventId: string) {
  const withExtraction = await (admin as any).from("event_contract_files")
    .select(
      "id,file_name,file_path,file_size,mime_type,created_at,extracted_text,extraction_status,extraction_error,extracted_characters,extracted_at",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (!withExtraction.error) return withExtraction;

  const message = String(withExtraction.error.message || "");
  const missingExtractionColumns =
    /extracted_text|extraction_status|extraction_error|extracted_characters|extracted_at/i.test(
      message,
    );
  if (!missingExtractionColumns) return withExtraction;

  return (admin as any).from("event_contract_files")
    .select("id,file_name,file_path,file_size,mime_type,created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
}

async function fetchEvent(
  admin: SupabaseAdminClient,
  eventId: string,
  userId: string,
) {
  const selectWithSummary =
    "id,user_id,title,status,created_at,delay_days,contract_type,contract_source,project_name,main_contractor,event_financial_summary";
  const selectFallback =
    "id,user_id,title,status,created_at,delay_days,contract_type,contract_source,project_name,main_contractor";

  const primary = await (admin as any).from("events")
    .select(selectWithSummary)
    .eq("id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!primary.error) return primary;

  const message = String(primary.error.message || "");
  const missingSummary =
    /event_financial_summary/i.test(message) &&
    /does not exist|schema cache|column/i.test(message);
  if (!missingSummary) return primary;

  return (admin as any).from("events")
    .select(selectFallback)
    .eq("id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
}

export async function buildGenerateDraftPayload(params: {
  admin: SupabaseAdminClient;
  eventId: string;
  userId: string;
}) {
  const { admin, eventId, userId } = params;

  const eventRes = await fetchEvent(admin, eventId, userId);
  if (eventRes.error) throw eventRes.error;
  const event = eventRes.data;
  if (!event) throw new Error("Event not found");

  const [
    basisRes,
    evidenceRes,
    resourcesRes,
    valuationRes,
    prelimsRes,
    contractFilesRes,
    reviewRes,
    companyProfileRes,
  ] = await Promise.all([
    (admin as any).from("event_basis")
      .select(
        "happened_summary,cause_type,cause_summary,difference_from_plan,mechanism_tags,time_impact_toggle,mitigation_summary",
      )
      .eq("event_id", eventId)
      .maybeSingle(),
    (admin as any).from("event_files")
      .select(
        "id,category,file_name,file_path,file_size,mime_type,description,evidence_date,relates_to,created_at",
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: true }),
    (admin as any).from("event_resource_lines")
      .select(
        "id,category,item_name,unit,hours,qty,rate,total,notes,tags,start_date,end_date,linked_event,created_at",
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: true }),
    (admin as any).from("event_valuation_settings")
      .select("fee_percent,fee_basis,work_days_per_week")
      .eq("event_id", eventId)
      .maybeSingle(),
    (admin as any).from("event_prelim_lines")
      .select("id,name,qty,unit,rate,notes,prelim_type,created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true }),
    fetchContractFiles(admin, eventId),
    (admin as any).from("event_review_settings")
      .select(
        "include_basis,include_entitlement,include_time_impact,include_evidence_register,include_cost_summary,include_prelims_fee,include_risk_notes,include_excel,include_pdf,qualifications_notes",
      )
      .eq("event_id", eventId)
      .maybeSingle(),
    (admin as any).from("company_profiles")
      .select(COMPANY_PROFILE_SELECT)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  for (const res of [
    basisRes,
    evidenceRes,
    resourcesRes,
    valuationRes,
    prelimsRes,
    contractFilesRes,
    reviewRes,
  ]) {
    if (res.error) throw res.error;
  }

  if (companyProfileRes.error) {
    console.warn(
      "Company profile unavailable for AI payload:",
      companyProfileRes.error,
    );
  }

  const basis = basisRes.data || {};
  const companyProfile = cleanCompanyProfile(companyProfileRes.data || null);
  const submittingPartyName = companyDisplayName(companyProfile);
  const submittingPartyLegalName = companyLegalName(companyProfile);
  const evidenceRows = evidenceRes.data || [];
  const resourceRows = resourcesRes.data || [];
  const prelimRows = prelimsRes.data || [];
  const contractFiles = contractFilesRes.data || [];
  const valuation = valuationRes.data || {};
  const review = reviewRes.data || {};

  const contractFamily = getContractFamily(event.contract_type);
  const contractLabel = getContractLabel(event.contract_type);
  const draftTemplate = getDraftTemplateForContractType(event.contract_type);
  const isJct = contractFamily === "JCT";

  const contractExtractionResults = await Promise.all(
    contractFiles.map((file: any) => extractContractFileText(admin, file)),
  );

  const uploadedContractText = contractExtractionResults
    .filter(
      (file) => file.extraction_status === "extracted" && file.extracted_text,
    )
    .map((file) =>
      [
        `--- ${file.file_name || "Uploaded contract text"} ---`,
        file.extracted_text,
      ].join("\n"),
    )
    .join("\n\n")
    .trim();

  const extractedContractFiles = contractExtractionResults.filter(
    (file) => file.extraction_status === "extracted",
  );
  const failedContractFiles = contractExtractionResults.filter(
    (file) => file.extraction_status === "failed",
  );
  const unreadableContractFiles = contractExtractionResults.filter(
    (file) => file.extraction_status === "no_readable_text",
  );
  const contractExtractionWarnings = [
    ...failedContractFiles.map(
      (file) =>
        `${file.file_name}: ${file.extraction_error || "extraction failed"}`,
    ),
    ...unreadableContractFiles.map(
      (file) =>
        `${file.file_name}: ${file.extraction_error || "no readable text extracted"}`,
    ),
  ];

  const financialSummary = (event as any).event_financial_summary || {};

  const labourLines = resourceRows.filter(
    (line: any) => line.category === "labour",
  );
  const plantLines = resourceRows.filter(
    (line: any) => line.category === "plant",
  );
  const materialLines = resourceRows.filter(
    (line: any) => line.category === "material",
  );
  const subcontractLines = resourceRows.filter(
    (line: any) => line.category === "subcontract",
  );
  const staffPrelims = prelimRows.filter(
    (line: any) => line.prelim_type === "staff",
  );
  const otherPrelims = prelimRows.filter(
    (line: any) => line.prelim_type !== "staff",
  );

  const resourceTotals = {
    labour_total: num(
      financialSummary.labour_total,
      sum(resourceRows, (line) => line.category === "labour"),
    ),
    plant_total: num(
      financialSummary.plant_total,
      sum(resourceRows, (line) => line.category === "plant"),
    ),
    materials_total: num(
      financialSummary.materials_total,
      sum(resourceRows, (line) => line.category === "material"),
    ),
    subcontract_total: num(
      financialSummary.subcontract_total,
      sum(resourceRows, (line) => line.category === "subcontract"),
    ),
    defined_cost_total: num(
      financialSummary.defined_cost_total,
      sum(resourceRows, (line) =>
        ["labour", "plant", "material", "subcontract"].includes(line.category),
      ),
    ),
    prelims_total: num(financialSummary.prelims_total),
    staff_prelims_total: num(financialSummary.staff_prelims_total),
    other_prelims_total: num(financialSummary.other_prelims_total),
    fee_total: num(financialSummary.fee_total),
    final_total: num(financialSummary.final_total),
  };

  const payload = {
    generation_context: {
      purpose:
        "Generate detailed, submission-ready CE / claim narrative JSON for the selected Excel submission pack sections.",
      output_schema: draftTemplate.sections.map((section) => ({
        key: section.key,
        label: section.label,
      })),
      required_json_keys: draftTemplate.sections.map((section) => section.key),
      currency: "GBP",
      do_not_calculate_costs: true,
      use_provided_totals_only: true,
    },
    contract: {
      family: contractFamily,
      form: contractLabel,
      raw_contract_type: event.contract_type,
      source: event.contract_source || "standard_form_selected",
      uploaded_contract_text: uploadedContractText,
      uploaded_contract_text_status: uploadedContractText
        ? "full_text_included"
        : contractFiles.length > 0 &&
            unreadableContractFiles.length === contractFiles.length
          ? "uploaded_files_no_readable_text"
          : contractFiles.length > 0 && failedContractFiles.length > 0
            ? "uploaded_files_failed_extraction"
            : contractFiles.length > 0
              ? "contract_files_uploaded_but_text_not_extracted"
              : "no_uploaded_contract_text",
      uploaded_contract_files: contractExtractionResults.map((file) => ({
        id: file.id,
        file_name: file.file_name,
        mime_type: file.mime_type,
        file_size: file.file_size,
        uploaded_at: file.uploaded_at,
        extraction_status: file.extraction_status,
        extracted_characters: file.extracted_characters,
        extraction_error: file.extraction_error,
        extracted_at: file.extracted_at,
      })),
      contract_extraction_debug: {
        selected_contract_family: contractFamily,
        selected_contract_form: contractLabel,
        raw_contract_type: event.contract_type,
        uploaded_contract_file_count: contractFiles.length,
        extracted_contract_file_count: extractedContractFiles.length,
        failed_contract_file_count: failedContractFiles.length,
        no_readable_text_file_count: unreadableContractFiles.length,
        uploaded_contract_text_characters: uploadedContractText.length,
        full_contract_text_included: Boolean(uploadedContractText),
        uploaded_contract_file_names: contractFiles.map(
          (file: any) => file.file_name,
        ),
        extraction_status_by_file: contractExtractionResults.map((file) => ({
          file_name: file.file_name,
          status: file.extraction_status,
          characters: file.extracted_characters,
          error: file.extraction_error,
        })),
        warnings: contractExtractionWarnings,
      },
      debug: {
        uploaded_contract_file_count: contractFiles.length,
        uploaded_contract_text_characters: uploadedContractText.length,
        uploaded_contract_text_included: Boolean(uploadedContractText),
        uploaded_contract_file_names: contractFiles.map(
          (file: any) => file.file_name,
        ),
        extraction_status_by_file: contractExtractionResults.map((file) => ({
          file_name: file.file_name,
          status: file.extraction_status,
          characters: file.extracted_characters,
        })),
        warnings: contractExtractionWarnings,
      },
      instruction_for_ai: uploadedContractText
        ? "Review the uploaded contract text and selected contract form together. Use clause references only where supported by the contract text and event facts. Treat uploaded project contract documents, Z clauses, bespoke amendments, subcontract terms, scope documents, appendices and T&Cs as higher-priority project-specific contract context where relevant."
        : contractFiles.length > 0
          ? `Contract file(s) were uploaded but no readable contract text reached the AI payload. Extraction warnings: ${contractExtractionWarnings.join(" | ") || "No readable text extracted."} Use the selected standard form cautiously and state this limitation in assumptions/internal commercial intelligence rather than guessing.`
          : "No extracted contract text is available. Use the selected standard form cautiously and state any limitations where clause certainty depends on contract amendments.",
    },
    company_profile: {
      company_name: companyProfile.company_name || "",
      trading_name: companyProfile.trading_name || "",
      role: companyProfile.role || "Subcontractor",
      logo_url: companyProfile.logo_url || "",
      address: companyProfile.address || "",
      email: companyProfile.email || "",
      phone: companyProfile.phone || "",
      vat_number: companyProfile.vat_number || "",
      company_registration_number:
        companyProfile.company_registration_number || "",
      instruction_for_ai: submittingPartyName
        ? "Use company_profile as the authoritative source for the submitting party identity. Do not infer or invent the company name, trading name, address, logo or role."
        : "No company profile has been set. Do not infer the submitting party identity; state this limitation where relevant.",
    },
    project: {
      project_name: event.project_name || "",
      contractor: event.main_contractor || "",
      subcontractor: submittingPartyLegalName || submittingPartyName || "",
    },
    event: {
      id: event.id,
      title: event.title || "",
      status: event.status || "draft",
      created_at: event.created_at || null,
      delay_days: num(event.delay_days, 0),
    },
    basis_of_change: {
      what_happened: basis.happened_summary || "",
      cause_type: basis.cause_type || "",
      cause: basis.cause_summary || "",
      difference_from_planned_basis: basis.difference_from_plan || "",
      mechanism_tags: safeArray<string>(basis.mechanism_tags),
      mitigation: basis.mitigation_summary || "",
      time_impact_toggle: basis.time_impact_toggle || "unsure",
    },
    programme: {
      delay_days: num(event.delay_days, 0),
      programme_impact:
        basis.time_impact_toggle === "yes"
          ? `${num(event.delay_days, 0)} days stated in CE basis.`
          : "Programme impact not confirmed in the CE basis.",
      time_impact_toggle: basis.time_impact_toggle || "unsure",
      sequence_disruption:
        text(basis.difference_from_plan) || text(basis.happened_summary),
      critical_path_notes:
        "Use only if supported by programme evidence or user notes. Do not assert critical path impact if not evidenced.",
    },
    evidence: evidenceRows.map((file: any) => ({
      id: file.id,
      category: file.category,
      file_name: file.file_name,
      description: file.description || "",
      evidence_date: file.evidence_date || null,
      relates_to: file.relates_to || "",
      mime_type: file.mime_type || "",
      created_at: file.created_at || null,
    })),
    resources: {
      totals: resourceTotals,
      labour: labourLines,
      plant: plantLines,
      materials: materialLines,
      subcontract: subcontractLines,
      all_lines: resourceRows,
      activity_breakdown: resourceRows.reduce(
        (acc: Record<string, any[]>, line: any) => {
          const key = text(line.linked_event) || "General activity";
          acc[key] = acc[key] || [];
          acc[key].push(
            compactObject({
              category: line.category,
              item_name: line.item_name,
              unit: line.unit,
              hours: line.hours,
              qty: line.qty,
              rate: line.rate,
              total: line.total,
              notes: line.notes,
              tags: line.tags,
              start_date: line.start_date,
              end_date: line.end_date,
            }),
          );
          return acc;
        },
        {},
      ),
    },
    prelims: {
      valuation_settings: {
        fee_percent: num(valuation.fee_percent, 0),
        fee_basis: valuation.fee_basis || "defined_cost",
        work_days_per_week: num(valuation.work_days_per_week, 5),
      },
      delay_days: num(event.delay_days, 0),
      staff_prelims: staffPrelims,
      other_prelims: otherPrelims,
      all_prelim_lines: prelimRows,
    },
    financial_summary: resourceTotals,
    review_settings: {
      include_basis: review.include_basis ?? true,
      include_entitlement: review.include_entitlement ?? true,
      include_time_impact: review.include_time_impact ?? true,
      include_evidence_register: review.include_evidence_register ?? true,
      include_cost_summary: review.include_cost_summary ?? true,
      include_prelims_fee: review.include_prelims_fee ?? true,
      include_risk_notes: review.include_risk_notes ?? true,
      include_excel: review.include_excel ?? true,
      include_pdf: review.include_pdf ?? false,
      qualifications_notes: review.qualifications_notes || "",
    },
    excel_output_mapping: {
      background: ["Basis of Change", "Summary"],
      change_to_contract_basis: ["Basis of Change"],
      effect_on_defined_cost: isJct
        ? ["Prelims + Fee", "Summary"]
        : ["Prelims + Fee"],
      effect_on_programme: ["Time Impact"],
      commercial_impact: ["Summary", "Prelims + Fee"],
      contractual_position: ["Basis of Change", "Summary"],
      assumptions: ["Time Impact", "Basis of Change"],
      conclusion: ["Summary", "Basis of Change"],
    },
    ai_instructions: {
      contract_language: isJct
        ? "Use JCT-appropriate language. Do not use NEC-specific phrases such as Defined Cost unless explaining why they are not applicable."
        : "Use NEC-appropriate language including Defined Cost and programme effect where supported.",
      clause_instruction:
        "Consider all relevant clauses in the selected contract form and any uploaded contract text. Reference only clauses that are supported by the facts and contract information. If uncertain, state the limitation in assumptions or internal_commercial_intelligence, without creating a separate risks and qualifications section.",
      company_identity_instruction:
        "Use company_profile as the only source of truth for the submitting party identity. Do not use hardcoded or assumed company names.",
      output_instruction:
        "Return JSON only, matching the required_json_keys exactly. Do not include markdown or commentary.",
    },
  };

  return payload;
}

export async function tryStoreDraftPayload(params: {
  admin: SupabaseAdminClient;
  eventId: string;
  userId: string;
  packId?: string | null;
  payload: any;
  aiDraft?: any;
}) {
  const { admin, eventId, userId, packId, payload, aiDraft } = params;
  const now = new Date().toISOString();

  try {
    const stored = await (admin as any).from("event_ai_drafts").insert({
      event_id: eventId,
      user_id: userId,
      pack_id: packId || null,
      draft_payload: payload,
      draft_output: aiDraft || null,
      status: aiDraft ? "draft_generated" : "payload_ready",
      created_at: now,
      updated_at: now,
    });
    if (stored?.error) throw stored.error;
  } catch (error) {
    console.warn("AI draft payload storage skipped:", error);
  }
}
