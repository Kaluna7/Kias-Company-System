export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import {
  appendEvidenceAttachment,
  assertEvidenceUploadAllowed,
  validateObjectKeyForDepartment,
  parseSelectedYear,
  isMinioEnabled,
} from "@/app/api/evidence/_shared/evidenceUpload";
import { getStorageProxyUrl, headMinioObject } from "@/app/lib/minio";

export async function POST(req) {
  try {
    if (!isMinioEnabled()) {
      return NextResponse.json(
        { success: false, error: "MinIO is not configured" },
        { status: 503 },
      );
    }

    const body = await req.json();
    const { department, ap_id, ap_code, year, objectKey, fileName } = body || {};

    if (!department || !objectKey) {
      return NextResponse.json(
        { success: false, error: "department and objectKey are required" },
        { status: 400 },
      );
    }

    const key = validateObjectKeyForDepartment(objectKey, department);

    // Verify object exists in MinIO before saving metadata
    try {
      await headMinioObject(key);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "File not found in storage. Upload may have failed or expired.",
        },
        { status: 400 },
      );
    }

    await assertEvidenceUploadAllowed({ department, ap_code, year });

    const fileUrl = getStorageProxyUrl(key);
    const result = await appendEvidenceAttachment({
      department,
      ap_id,
      ap_code,
      year: parseSelectedYear(year) ?? year,
      fileUrl,
      fileName: fileName || key.split("/").pop(),
    });

    return NextResponse.json({
      success: true,
      ...result,
      objectKey: key,
      message: "File uploaded successfully",
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error("POST /api/evidence/upload/complete:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to complete upload" },
      { status },
    );
  }
}
