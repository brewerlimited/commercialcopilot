import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ShareRow = {
  id: string;
  token: string;
  is_active: boolean | null;
  expires_at: string | null;
  issued_file_name: string | null;
  event_file_id: string;
};

type EventFileRow = {
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  category?: string | null;
  description?: string | null;
  relates_to?: string | null;
  evidence_date?: string | null;
};

function safeDownloadName(name: string) {
  return name.replace(/[\r\n\\/]+/g, "_").trim() || "evidence-file";
}

function isValidShareToken(token: string) {
  return /^[A-Za-z0-9_-]{32,160}$/.test(token);
}

function isDemoEvidencePath(path?: string | null) {
  return String(path || "").startsWith("demo/");
}

function demoEvidenceResponse(share: ShareRow, file: EventFileRow) {
  const filename = safeDownloadName(share.issued_file_name || file.file_name || "demo-evidence.txt");
  const body = [
    "Commercial Co-Pilot demo evidence placeholder",
    "",
    `File: ${file.file_name || filename}`,
    `Category: ${file.category || "Evidence"}`,
    `Evidence date: ${file.evidence_date || "Not set"}`,
    `Relates to: ${file.relates_to || "Not set"}`,
    "",
    file.description || "This demo account contains evidence register metadata only. Upload real files on a live matter to download the original evidence file.",
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/\.[^.]+$/, "")}-demo-placeholder.txt"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    if (!isValidShareToken(token || "")) {
      return new Response("Invalid evidence link", { status: 400 });
    }

    const supabase = supabaseAdmin();

    const shareRes = await (supabase as any).from("event_file_share_links")
      .select("id,token,is_active,expires_at,issued_file_name,event_file_id")
      .eq("token", token)
      .maybeSingle();

    if (shareRes.error) throw shareRes.error;
    const share = shareRes.data as ShareRow | null;
    if (!share || share.is_active === false) {
      return new Response("Evidence link not found", { status: 404 });
    }

    const expiresAt = share.expires_at ? new Date(share.expires_at) : null;
    if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      return new Response("Evidence link has expired", { status: 410 });
    }

    const fileRes = await (supabase as any).from("event_files")
      .select("file_path,file_name,mime_type,category,description,relates_to,evidence_date")
      .eq("id", share.event_file_id)
      .maybeSingle();

    if (fileRes.error) throw fileRes.error;
    const file = fileRes.data as EventFileRow | null;
    if (!file?.file_path) {
      return new Response("Evidence file not found", { status: 404 });
    }

    const downloadRes = await supabase.storage.from("event-files").download(file.file_path);
    if (downloadRes.error) {
      if (isDemoEvidencePath(file.file_path)) return demoEvidenceResponse(share, file);
      console.warn("Evidence storage download failed", downloadRes.error.message || downloadRes.error);
      return new Response("Evidence file could not be downloaded from storage", { status: 404 });
    }

    const fileBlob = downloadRes.data;
    const arrayBuffer = await fileBlob.arrayBuffer();
    const filename = safeDownloadName(share.issued_file_name || file.file_name || "evidence-file");
    const contentType = file.mime_type || fileBlob.type || "application/octet-stream";

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(arrayBuffer.byteLength),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error: any) {
    console.warn("Evidence download failed", error?.message || error);
    return new Response("Failed to download evidence", { status: 500 });
  }
}
