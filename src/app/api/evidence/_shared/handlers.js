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

function getApDelegate(department) {
  const key = String(department || "").toUpperCase();
  const delegateName = deptToApDelegate[key];
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

      for (const evidence of evidenceData) {
        const apIdNum = evidence.ap_id
          ? parseInt(evidence.ap_id)
          : evidence.risk_id
            ? parseInt(evidence.risk_id)
            : null;
        const apCode = evidence.ap_code || null;

        const existingEvidence = await prisma.evidence.findFirst({
          where: {
            department: department.toUpperCase(),
            ...(apIdNum ? { ap_id: apIdNum } : { ap_code: apCode || undefined }),
          },
        });

        if (existingEvidence) {
          await prisma.evidence.update({
            where: { id: existingEvidence.id },
            data: {
              preparer: preparer || null,
              ap_id: apIdNum ?? existingEvidence.ap_id,
              ap_code: apCode || null,
              substantive_test: evidence.substantive_test || null,
              // keep existing attachments; uploads handled via POST/DELETE
              file_url: existingEvidence.file_url,
              file_name: existingEvidence.file_name,
              status: evidence.status || "IN PROGRESS",
              overall_status: overallStatus || "IN PROGRESS",
              updated_at: new Date(),
            },
          });
        } else {
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
              overall_status: overallStatus || "IN PROGRESS",
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
      const page = Math.max(1, toIntSafe(searchParams.get("page"), 1));
      const pageSize = Math.max(1, Math.min(100, toIntSafe(searchParams.get("pageSize"), 50)));
      const skip = (page - 1) * pageSize;

      const upperDept = department.toUpperCase();

      // Pull Audit Program list (source of truth for ap_code + substantive_test)
      const apDelegate = getApDelegate(upperDept);
      if (!apDelegate) {
        return NextResponse.json({ error: "Invalid department" }, { status: 400 });
      }

      const where = {
        ...(ap_code ? { ap_code } : {}),
        ...(ap_id ? { ap_id: parseInt(ap_id) } : {}),
      };

      const [apList, total] = await Promise.all([
        apDelegate.findMany({
          where,
          select: { ap_id: true, ap_code: true, substantive_test: true },
          orderBy: { ap_id: "asc" },
          skip,
          take: pageSize,
        }),
        apDelegate.count({ where }),
      ]);

      // Evidence attachments/status (left join)
      const evidenceRows = await prisma.evidence.findMany({
        where: { department: upperDept },
        orderBy: { updated_at: "desc" },
      });

      const evidenceByApId = {};
      for (const ev of evidenceRows) {
        if (ev.ap_id == null) continue;
        const attachments = parseAttachmentsField(ev.file_url, ev.file_name);
        if (!evidenceByApId[ev.ap_id]) {
          evidenceByApId[ev.ap_id] = {
            base: ev,
            attachments,
          };
        } else {
          // merge additional attachments (keep max 5 for response)
          const existing = evidenceByApId[ev.ap_id];
          const combined = [...attachments, ...existing.attachments];
          // de-duplicate by url
          const seen = new Set();
          const unique = [];
          for (const att of combined) {
            if (!att || !att.url || seen.has(att.url)) continue;
            seen.add(att.url);
            unique.push(att);
            if (unique.length >= 5) break;
          }
          evidenceByApId[ev.ap_id] = {
            base: ev,
            attachments: unique,
          };
        }
      }

      const merged = apList
        .filter((ap) => ap.ap_code && String(ap.ap_code).trim() !== "")
        .map((ap) => {
          const evGroup = evidenceByApId[ap.ap_id];
          const base = evGroup?.base;
          const attachments = evGroup?.attachments || [];
          const primary = attachments[0] || null;
          return {
            id: base?.id ?? null,
            ap_id: ap.ap_id,
            ap_code: ap.ap_code || "",
            substantive_test: ap.substantive_test || "",
            attachment: primary?.url || "",
            file_name: primary?.name || "",
            attachments,
            status: base?.status || "",
            created_at: base?.created_at ?? null,
            updated_at: base?.updated_at ?? null,
          };
        });

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


