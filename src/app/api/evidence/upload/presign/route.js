export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import {
  assertEvidenceUploadAllowed,
  prepareMinioUpload,
  isMinioEnabled,
} from "@/app/api/evidence/_shared/evidenceUpload";
import {
  assertMinioHealthy,
  createPresignedPutUrl,
  EVIDENCE_MAX_BYTES,
  guessContentType,
  isMinioConnectionError,
  MINIO_DISABLED_MESSAGE,
  MINIO_DOWN_MESSAGE,
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

    // MinIO not configured (e.g. local): allow legacy multipart upload.
    // When MinIO IS configured but down, fail below — never pretend upload worked.
    if (!isMinioEnabled()) {
      return NextResponse.json({
        success: true,
        uploadMode: "legacy",
        message: "MinIO not configured; use multipart POST to department API.",
      });
    }

    await assertMinioHealthy();
    await assertEvidenceUploadAllowed({ department, ap_code, year });

    const { objectKey, fileUrl } = prepareMinioUpload({
      department,
      ap_code,
      fileName: safeName,
    });

    const mime = contentType || guessContentType(safeName);
    let uploadUrl;
    try {
      uploadUrl = await createPresignedPutUrl(objectKey, mime, 86400);
    } catch (presignErr) {
      if (isMinioConnectionError(presignErr)) {
        const err = new Error(MINIO_DOWN_MESSAGE);
        err.statusCode = 503;
        err.code = "MINIO_DOWN";
        throw err;
      }
      throw presignErr;
    }

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
    const status = error.statusCode || (isMinioConnectionError(error) ? 503 : 500);
    if (status >= 500) console.error("POST /api/evidence/upload/presign:", error);
    const message =
      error.code === "MINIO_DOWN" || isMinioConnectionError(error)
        ? MINIO_DOWN_MESSAGE
        : error.code === "MINIO_DISABLED"
          ? MINIO_DISABLED_MESSAGE
          : error.message || "Failed to create upload URL";
    return NextResponse.json(
      {
        success: false,
        error: message,
        code: error.code || (status === 503 ? "MINIO_DOWN" : undefined),
      },
      { status },
    );
  }
}
