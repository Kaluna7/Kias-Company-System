import { NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import prisma from "@/app/lib/prisma";

const deptToApDelegate = {
  FINANCE: "financeAp",
  ACCOUNTING: "accountingAp",
  "G&A": "generalAffairAp",
  HRD: "hrdAp",
  "L&P": "lpAp",
  MERCHANDISE: "merchandiseAp",
  MIS: "misAp",
  OPERATIONAL: "operationalAp",
  SDP: "sdpAp",
  TAX: "taxAp",
  WAREHOUSE: "warehouseAp",
};

// Map department to related Audit Finding prisma model
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

// Relasi ke tabel Risk Assessment/Audit Program parent di masing-masing *_ap model
const deptToApParentRelation = {
  FINANCE: "finance",
  ACCOUNTING: "accounting",
  "G&A": "general_affair",
  HRD: "hrd",
  "L&P": "lp",
  MERCHANDISE: "merchandise",
  MIS: "mis",
  OPERATIONAL: "operational",
  SDP: "sdp",
  TAX: "tax",
  WAREHOUSE: "warehouse",
};

function getApDelegate(department) {
  const key = String(department || "").toUpperCase();
  const delegateName = deptToApDelegate[key];
  if (!delegateName) return null;
  return prisma[delegateName];
}

function getFindingDelegate(department) {
  const key = String(department || "").toUpperCase();
  const delegateName = deptToFindingDelegate[key];
  if (!delegateName) return null;
  return prisma[delegateName];
}

function parseAttachmentsField(fileUrl, fileName) {
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
  } catch (e) {
    // fall through to treat as single string
  }
  if (typeof fileUrl === "string") {
    return [
      {
        url: fileUrl,
        name: fileName || "",
        uploaded_at: null,
      },
    ];
  }
  return [];
}

export function makeEvidenceHandlers(defaultDepartment) {
  const POST = async (req) => {
    try {
      const formData = await req.formData();
      const file = formData.get("file");
      const ap_id = formData.get("ap_id") || formData.get("risk_id"); // legacy compatibility
      const ap_code = formData.get("ap_code");
      const department = formData.get("department") || defaultDepartment;

      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

      const uploadsDir = join(process.cwd(), "public", "uploads", "evidence", department.toLowerCase());
      if (!existsSync(uploadsDir)) await mkdir(uploadsDir, { recursive: true });

      const timestamp = Date.now();
      const originalName = file.name;
      const fileExtension = originalName.split(".").pop();
      const fileName = `${ap_code || "file"}_${timestamp}.${fileExtension}`;
      const filePath = join(uploadsDir, fileName);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      const fileUrl = `/uploads/evidence/${department.toLowerCase()}/${fileName}`;
      const apIdNum = ap_id ? parseInt(ap_id) : null;

      const existingEvidence = await prisma.evidence.findFirst({
        where: {
          department: department.toUpperCase(),
          ...(apIdNum ? { ap_id: apIdNum } : { ap_code: ap_code || undefined }),
        },
      });

      if (existingEvidence) {
        const currentAttachments = parseAttachmentsField(existingEvidence.file_url, existingEvidence.file_name);
        if (currentAttachments.length >= 5) {
          return NextResponse.json(
            { success: false, error: "Maximum 5 documents allowed for each AP." },
            { status: 400 },
          );
        }
        const updatedAttachments = [
          ...currentAttachments,
          { url: fileUrl, name: originalName, uploaded_at: new Date().toISOString() },
        ];
        await prisma.evidence.update({
          where: { id: existingEvidence.id },
          data: {
            file_url: JSON.stringify(updatedAttachments),
            file_name: updatedAttachments[0]?.name || null,
            updated_at: new Date(),
          },
        });
      } else {
        const attachments = [
          { url: fileUrl, name: originalName, uploaded_at: new Date().toISOString() },
        ];
        await prisma.evidence.create({
          data: {
            department: department.toUpperCase(),
            ap_id: apIdNum,
            ap_code: ap_code || null,
            file_url: JSON.stringify(attachments),
            file_name: originalName,
            status: "IN PROGRESS",
          },
        });
      }

      return NextResponse.json({
        success: true,
        fileUrl,
        fileName: originalName,
        message: "File uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      return NextResponse.json({ error: error.message || "Failed to upload file" }, { status: 500 });
    }
  };

  const PUT = async (req) => {
    try {
      const body = await req.json();
      const { department, preparer, overallStatus, evidenceData } = body;

      if (!department) {
        return NextResponse.json({ success: false, error: "Department is required" }, { status: 400 });
      }

      if (!evidenceData || !Array.isArray(evidenceData)) {
        return NextResponse.json({ success: false, error: "Evidence data must be an array" }, { status: 400 });
      }

      const upperDept = String(department).toUpperCase();
      const findingDelegate = getFindingDelegate(upperDept);

      for (const evidence of evidenceData) {
        const apIdNum = evidence.ap_id
          ? parseInt(evidence.ap_id)
          : evidence.risk_id
            ? parseInt(evidence.risk_id)
            : null;
        const apCode = evidence.ap_code || null;
        const overallUpper = String(overallStatus || "").toUpperCase().trim();

        const existingEvidence = await prisma.evidence.findFirst({
          where: {
            department: department.toUpperCase(),
            ...(apIdNum ? { ap_id: apIdNum } : { ap_code: apCode || undefined }),
          },
          orderBy: { created_at: "desc" },
        });

        if (existingEvidence) {
          // Satu baris per AP: update status/metadata, lampiran tetap dari POST/DELETE
          await prisma.evidence.update({
            where: { id: existingEvidence.id },
            data: {
              preparer: preparer || null,
              ap_id: apIdNum ?? existingEvidence.ap_id,
              ap_code: apCode || existingEvidence.ap_code || null,
              substantive_test: evidence.substantive_test || existingEvidence.substantive_test || null,
              file_url: existingEvidence.file_url,
              file_name: existingEvidence.file_name,
              status: evidence.status || existingEvidence.status || "IN PROGRESS",
              overall_status: overallUpper || "IN PROGRESS",
              updated_at: new Date(),
            },
          });
        } else {
          // Belum ada evidence untuk AP ini: buat baru (tanpa file, file di-handle POST)
          await prisma.evidence.create({
            data: {
              department: department.toUpperCase(),
              preparer: preparer || null,
              ap_id: apIdNum,
              ap_code: apCode || null,
              substantive_test: evidence.substantive_test || null,
              file_url: null,
              file_name: null,
              status: evidence.status || "IN PROGRESS",
              overall_status: overallUpper || "IN PROGRESS",
            },
          });
        }
      }

      return NextResponse.json({ success: true, message: "Evidence data saved successfully" });
    } catch (error) {
      console.error("Error saving evidence data:", error);
      return NextResponse.json({ error: error.message || "Failed to save evidence data" }, { status: 500 });
    }
  };

  function toIntSafe(v, fallback) {
    if (v === undefined || v === null || v === "") return fallback;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? fallback : n;
  }

  const GET = async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const department = searchParams.get("department") || defaultDepartment;
      const ap_code = searchParams.get("ap_code");
      const ap_id = searchParams.get("ap_id");
      const yearParam = searchParams.get("year");
      const page = Math.max(1, toIntSafe(searchParams.get("page"), 1));
      const pageSize = Math.max(1, Math.min(100, toIntSafe(searchParams.get("pageSize"), 50)));
      const skip = (page - 1) * pageSize;

      const upperDept = department.toUpperCase();

      // Pull Audit Program list (source of truth for ap_code + substantive_test)
      const apDelegate = getApDelegate(upperDept);
      if (!apDelegate) {
        return NextResponse.json({ error: "Invalid department" }, { status: 400 });
      }

      const year = yearParam ? parseInt(yearParam, 10) : null;
      const hasValidYear = !Number.isNaN(year) && !!year;

      const where = {
        ...(ap_code ? { ap_code } : {}),
        ...(ap_id ? { ap_id: parseInt(ap_id) } : {}),
      };

      // Filter AP list berdasarkan tahun Risk Assessment/Audit Program parent (created_at)
      if (hasValidYear) {
        const parentRelation = deptToApParentRelation[upperDept];
        if (parentRelation) {
          const from = new Date(year, 0, 1);
          const to = new Date(year + 1, 0, 1);
          where[parentRelation] = { created_at: { gte: from, lt: to } };
        }
      }

      const excludePublished = searchParams.get("exclude_published") === "1" || searchParams.get("exclude_published") === "true";
      const apFetchSize = excludePublished ? 10000 : pageSize;
      const apFetchSkip = excludePublished ? 0 : skip;

      const [apList, totalApCount] = await Promise.all([
        apDelegate.findMany({
          where,
          select: { ap_id: true, ap_code: true, substantive_test: true },
          orderBy: { ap_id: "asc" },
          skip: apFetchSkip,
          take: apFetchSize,
        }),
        apDelegate.count({ where }),
      ]);
      let total = totalApCount;

      // Evidence attachments/status (left join)
      // Evidence tetap mengikuti filter tahun dari dashboard,
      // tetapi berbasis tanggal aktivitas (updated_at) agar upload/publish di tahun berjalan
      // selalu ikut terbaca untuk semua akun di tahun tersebut.
      const evidenceWhere = { department: upperDept };
      if (hasValidYear) {
        const fromEv = new Date(year, 0, 1);
        const toEv = new Date(year + 1, 0, 1);
        evidenceWhere.updated_at = { gte: fromEv, lt: toEv };
      }
      const evidenceRows = await prisma.evidence.findMany({
        where: evidenceWhere,
        orderBy: { updated_at: "desc" },
      });

      // Index evidence baik berdasarkan ap_id maupun ap_code,
      // karena ada departemen yang hanya mengisi ap_code tanpa ap_id.
      const evidenceByKey = {};
      for (const ev of evidenceRows) {
        const attachments = parseAttachmentsField(ev.file_url, ev.file_name);
        const hasFile = attachments.length > 0;
        const isComplete =
          hasFile && (ev.overall_status || "").toUpperCase().trim() === "COMPLETE";

        const keys = [];
        if (ev.ap_id != null) {
          keys.push(`ID:${ev.ap_id}`);
        }
        if (ev.ap_code) {
          keys.push(`CODE:${String(ev.ap_code).trim()}`);
        }
        if (keys.length === 0) continue;

        for (const key of keys) {
          const existing = evidenceByKey[key];
          if (!existing) {
            evidenceByKey[key] = {
              base: ev,
              attachments,
              hasPublished: isComplete,
            };
          } else {
            // merge additional attachments (keep max 5 for response)
            const combined = [...attachments, ...existing.attachments];
            const seen = new Set();
            const unique = [];
            for (const att of combined) {
              if (!att || !att.url || seen.has(att.url)) continue;
              seen.add(att.url);
              unique.push(att);
              if (unique.length >= 5) break;
            }
            evidenceByKey[key] = {
              base: existing.base, // pertahankan base sebelumnya (latest by updated_at)
              attachments: unique,
              hasPublished: existing.hasPublished || isComplete,
            };
          }
        }
      }

      let merged = apList
        .filter((ap) => ap.ap_code && String(ap.ap_code).trim() !== "")
        .map((ap) => {
          const keyById = ap.ap_id != null ? `ID:${ap.ap_id}` : null;
          const keyByCode = ap.ap_code ? `CODE:${String(ap.ap_code).trim()}` : null;
          const evGroup = (keyById && evidenceByKey[keyById]) || (keyByCode && evidenceByKey[keyByCode]);
          const base = evGroup?.base;
          const attachments = evGroup?.attachments || [];
          const primary = attachments[0] || null;
          const hasFile = !!(primary?.url || base?.file_url);
          const isPublished = evGroup?.hasPublished || false;
          return {
            id: base?.id ?? null,
            ap_id: ap.ap_id,
            ap_code: ap.ap_code || "",
            substantive_test: ap.substantive_test || "",
            attachment: primary?.url || "",
            file_name: primary?.name || "",
            attachments,
            status: base?.status || "",
            overall_status: base?.overall_status ?? "",
            created_at: base?.created_at ?? null,
            updated_at: base?.updated_at ?? null,
            _isPublished: isPublished,
          };
        });

      if (excludePublished) {
        merged = merged.filter((row) => !row._isPublished);
        total = merged.length;
        merged = merged.slice(skip, skip + pageSize);
      }
      // Expose is_published flag to consumers (e.g. Audit Finding sync, Evidence Report)
      merged = merged.map(({ _isPublished, ...row }) => ({
        ...row,
        is_published: _isPublished,
      }));

      const rowMeta = evidenceRows[0]
        ? { preparer: evidenceRows[0].preparer || "", overall_status: evidenceRows[0].overall_status || "" }
        : { preparer: "", overall_status: "" };

      const meta = { ...rowMeta, total, page, pageSize };

      return NextResponse.json({ success: true, data: merged, meta });
    } catch (error) {
      console.error("Error fetching evidence data:", error);
      return NextResponse.json({ error: error.message || "Failed to fetch evidence data" }, { status: 500 });
    }
  };

  const DELETE = async (req) => {
    try {
      const body = await req.json();
      const { department, ap_id, ap_code, fileUrl } = body || {};

      const dept = (department || defaultDepartment || "").toUpperCase();
      if (!dept) {
        return NextResponse.json({ success: false, error: "Department is required" }, { status: 400 });
      }
      if (!fileUrl) {
        return NextResponse.json({ success: false, error: "fileUrl is required" }, { status: 400 });
      }

      const apIdNum = ap_id ? parseInt(ap_id, 10) : null;
      const where = {
        department: dept,
        ...(apIdNum ? { ap_id: apIdNum } : { ap_code: ap_code || undefined }),
      };

      const existingEvidence = await prisma.evidence.findFirst({ where });
      if (!existingEvidence) {
        return NextResponse.json(
          { success: false, error: "Evidence record not found for this AP." },
          { status: 404 },
        );
      }

      const currentAttachments = parseAttachmentsField(
        existingEvidence.file_url,
        existingEvidence.file_name,
      );
      if (!currentAttachments.length) {
        return NextResponse.json(
          { success: false, error: "No attachments found for this AP." },
          { status: 400 },
        );
      }

      const remaining = currentAttachments.filter((att) => att.url !== fileUrl);
      if (remaining.length === currentAttachments.length) {
        return NextResponse.json(
          { success: false, error: "Attachment not found for this AP." },
          { status: 404 },
        );
      }

      // Try to remove physical file as best-effort (ignore errors)
      try {
        const publicPathPrefix = "/uploads/";
        if (fileUrl.startsWith(publicPathPrefix)) {
          const filePath = join(process.cwd(), "public", fileUrl.replace(publicPathPrefix, ""));
          if (existsSync(filePath)) {
            await unlink(filePath).catch(() => {});
          }
        }
      } catch (e) {
        console.warn("Failed to delete evidence file from disk:", e);
      }

      await prisma.evidence.update({
        where: { id: existingEvidence.id },
        data: {
          file_url: remaining.length ? JSON.stringify(remaining) : null,
          file_name: remaining[0]?.name || null,
          updated_at: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Attachment removed successfully.",
        attachments: remaining,
      });
    } catch (error) {
      console.error("Error deleting evidence attachment:", error);
      return NextResponse.json(
        { success: false, error: error.message || "Failed to delete attachment" },
        { status: 500 },
      );
    }
  };

  return { GET, POST, PUT, DELETE };
}


