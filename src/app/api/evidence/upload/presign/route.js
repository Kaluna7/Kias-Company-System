export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import {
  assertEvidenceUploadAllowed,
  prepareMinioUpload,
  isMinioEnabled,
} from "@/app/api/evidence/_shared/evidenceUpload";
import {
  createPresignedPutUrl,
  EVIDENCE_MAX_BYTES,
  guessContentType,
} from "@/app/lib/minio";

const ALLOWED_EXT = new Set(["pdf", "zip", "doc", "docx", "xlsx", "xls"]);

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      department,
      ap_id,
      ap_code,
      year,
      fileName,
      contentType,
      fileSize,
    } = body || {};

    if (!department) {
      return NextResponse.json({ success: false, error: "Department is required" }, { status: 400 });
    }

    const safeName = String(fileName || "").trim();
    if (!safeName) {
      return NextResponse.json({ success: false, error: "fileName is required" }, { status: 400 });
    }

    const ext = safeName.includes(".") ? safeName.split(".").pop()?.toLowerCase() : "";
    if (!ext || !ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported file type. Allowed: PDF, ZIP, DOC, DOCX, XLS, XLSX.",
        },
        { status: 400 },
      );
    }

    const size = fileSize != null ? Number(fileSize) : 0;
    if (size > EVIDENCE_MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "File exceeds 8 GB limit." },
        { status: 400 },
      );
    }

    if (!isMinioEnabled()) {
      return NextResponse.json({
        success: true,
        uploadMode: "legacy",
        message: "MinIO not configured; use multipart POST to department API.",
      });
    }

    await assertEvidenceUploadAllowed({ department, ap_code, year });

    const { objectKey, fileUrl } = prepareMinioUpload({
      department,
      ap_code,
      fileName: safeName,
    });

    const mime = contentType || guessContentType(safeName);
    const uploadUrl = await createPresignedPutUrl(objectKey, mime, 86400);

    return NextResponse.json({
      success: true,
      uploadMode: "minio",
      uploadUrl,
      objectKey,
      fileUrl,
      fileName: safeName,
      contentType: mime,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error("POST /api/evidence/upload/presign:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create upload URL" },
      { status },
    );
  }
}
