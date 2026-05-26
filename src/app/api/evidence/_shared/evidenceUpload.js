import prisma from "@/app/lib/prisma";
import { isAuditFindingCheckYes } from "@/lib/auditFindingCheckYn";
import {
  buildEvidenceObjectKey,
  departmentToStorageFolder,
  getStorageProxyUrl,
  isMinioEnabled,
} from "@/app/lib/minio";

const deptToFindingDelegate = {
  FINANCE: "audit_finding_finance",
  ACCOUNTING: "audit_finding_accounting",
  "G&A": "audit_finding_ga",
  HRD: "audit_finding_hrd",
  "L&P": "audit_finding_lp",
  MERCHANDISE: "audit_finding_merch",
  MIS: "audit_finding_mis",
  OPERATIONAL: "audit_finding_ops",
  SDP: "audit_finding_sdp",
  TAX: "audit_finding_tax",
  WAREHOUSE: "audit_finding_whs",
};

export function parseSelectedYear(value) {
  const year = value ? parseInt(String(value), 10) : null;
  return !Number.isNaN(year) && year ? year : null;
}

export function alignDateToSelectedYear(dateValue, selectedYear) {
  const date = new Date(dateValue);
  if (!selectedYear || Number.isNaN(date.getTime())) return date;
  date.setFullYear(selectedYear);
  return date;
}

function applyEvidenceYearScope(where, selectedYear) {
  if (!selectedYear) return where;
  const from = new Date(selectedYear, 0, 1);
  const to = new Date(selectedYear + 1, 0, 1);
  return {
    ...where,
    updated_at: { gte: from, lt: to },
  };
}

function applyFindingYearScope(where, selectedYear) {
  if (!selectedYear) return where;
  const from = new Date(selectedYear, 0, 1);
  const to = new Date(selectedYear + 1, 0, 1);
  return {
    ...where,
    OR: [{ created_at: { gte: from, lt: to } }, { updated_at: { gte: from, lt: to } }],
  };
}

export function parseApIdFromForm(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!raw || raw === "null" || raw === "undefined") return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

export function parseAttachmentsField(fileUrl, fileName) {
  if (!fileUrl) return [];
  try {
    const parsed = JSON.parse(fileUrl);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item && typeof item.url === "string")
        .map((item) => ({
          url: item.url,
          name: item.name || "",
          uploaded_at: item.uploaded_at || null,
        }));
    }
  } catch {
    // single url string
  }
  if (typeof fileUrl === "string") {
    return [{ url: fileUrl, name: fileName || "", uploaded_at: null }];
  }
  return [];
}

function getFindingDelegate(department) {
  const key = String(department || "").toUpperCase();
  const delegateName = deptToFindingDelegate[key];
  if (!delegateName) return null;
  return prisma[delegateName];
}

export async function assertEvidenceUploadAllowed({ department, ap_code, year }) {
  const upperDept = String(department || "").toUpperCase();
  const selectedYear = parseSelectedYear(year);
  const apCodeTrim = ap_code != null ? String(ap_code).trim() : "";

  const findingDelegate = getFindingDelegate(upperDept);
  if (findingDelegate && selectedYear && apCodeTrim) {
    const checkRows = await findingDelegate.findMany({
      where: applyFindingYearScope({ ap_code: apCodeTrim }, selectedYear),
      select: { check_yn: true },
    });
    if (!checkRows.some((r) => isAuditFindingCheckYes(r.check_yn))) {
      const err = new Error(
        "Upload is only allowed when Audit Finding has CHECK (Y/N) = Yes for this AP (save the finding row first).",
      );
      err.statusCode = 403;
      throw err;
    }
  }
}

export async function appendEvidenceAttachment({
  department,
  ap_id,
  ap_code,
  year,
  fileUrl,
  fileName,
}) {
  const upperDept = String(department || "").toUpperCase();
  const selectedYear = parseSelectedYear(year);
  const requestTimestamp = alignDateToSelectedYear(new Date(), selectedYear);
  const apIdNum = parseApIdFromForm(ap_id);
  const originalName = String(fileName || "").trim() || "upload.dat";

  const existingEvidence = await prisma.evidence.findFirst({
    where: applyEvidenceYearScope(
      {
        department: upperDept,
        ...(apIdNum != null ? { ap_id: apIdNum } : { ap_code: ap_code || undefined }),
      },
      selectedYear,
    ),
    orderBy: { updated_at: "desc" },
  });

  if (existingEvidence) {
    const currentAttachments = parseAttachmentsField(existingEvidence.file_url, existingEvidence.file_name);
    if (currentAttachments.length >= 5) {
      const err = new Error("Maximum 5 documents allowed for each AP.");
      err.statusCode = 400;
      throw err;
    }
    const updatedAttachments = [
      ...currentAttachments,
      { url: fileUrl, name: originalName, uploaded_at: requestTimestamp.toISOString() },
    ];
    await prisma.evidence.update({
      where: { id: existingEvidence.id },
      data: {
        file_url: JSON.stringify(updatedAttachments),
        file_name: updatedAttachments[0]?.name || null,
        updated_at: requestTimestamp,
        overall_status: "IN PROGRESS",
      },
    });
  } else {
    const attachments = [
      { url: fileUrl, name: originalName, uploaded_at: requestTimestamp.toISOString() },
    ];
    await prisma.evidence.create({
      data: {
        department: upperDept,
        ap_id: apIdNum,
        ap_code: ap_code || null,
        file_url: JSON.stringify(attachments),
        file_name: originalName,
        status: "IN PROGRESS",
        overall_status: "IN PROGRESS",
        created_at: requestTimestamp,
        updated_at: requestTimestamp,
      },
    });
  }

  return { fileUrl, fileName: originalName };
}

export function validateObjectKeyForDepartment(objectKey, department) {
  const folder = departmentToStorageFolder(department);
  const key = String(objectKey || "");
  if (!key.startsWith(`${folder}/`)) {
    const err = new Error("Invalid storage key for this department.");
    err.statusCode = 400;
    throw err;
  }
  return key;
}

export function prepareMinioUpload({ department, ap_code, fileName }) {
  const objectKey = buildEvidenceObjectKey(department, ap_code, fileName);
  const fileUrl = getStorageProxyUrl(objectKey);
  return { objectKey, fileUrl };
}

export { isMinioEnabled };
