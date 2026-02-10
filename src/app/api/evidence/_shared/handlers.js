import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
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
        await prisma.evidence.update({
          where: { id: existingEvidence.id },
          data: { file_url: fileUrl, file_name: originalName, updated_at: new Date() },
        });
      } else {
        await prisma.evidence.create({
          data: {
            department: department.toUpperCase(),
            ap_id: apIdNum,
            ap_code: ap_code || null,
            file_url: fileUrl,
            file_name: originalName,
            status: "IN PROGRESS",
          },
        });
      }

      return NextResponse.json({ success: true, fileUrl, fileName: originalName, message: "File uploaded successfully" });
    } catch (error) {
      console.error("Error uploading file:", error);
      return NextResponse.json({ error: error.message || "Failed to upload file" }, { status: 500 });
    }
  };

  const PUT = async (req) => {
    try {
      const body = await req.json();
      const { department, preparer, overallStatus, evidenceData } = body;

      if (!department) return NextResponse.json({ error: "Department is required" }, { status: 400 });

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
              file_url: evidence.attachment || existingEvidence.file_url,
              file_name: evidence.file_name || existingEvidence.file_name,
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
              file_url: evidence.attachment || null,
              file_name: evidence.file_name || null,
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

  const GET = async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const department = searchParams.get("department") || defaultDepartment;
      const ap_code = searchParams.get("ap_code");
      const ap_id = searchParams.get("ap_id");

      const upperDept = department.toUpperCase();

      // Pull Audit Program list (source of truth for ap_code + substantive_test)
      const apDelegate = getApDelegate(upperDept);
      if (!apDelegate) {
        return NextResponse.json({ error: "Invalid department" }, { status: 400 });
      }

      const apList = await apDelegate.findMany({
        where: {
          ...(ap_code ? { ap_code } : {}),
          ...(ap_id ? { ap_id: parseInt(ap_id) } : {}),
        },
        select: { ap_id: true, ap_code: true, substantive_test: true },
        orderBy: { ap_id: "asc" },
      });

      // Evidence attachments/status (left join)
      const evidenceRows = await prisma.evidence.findMany({
        where: { department: upperDept },
        orderBy: { updated_at: "desc" },
      });

      const evidenceByApId = {};
      for (const ev of evidenceRows) {
        if (ev.ap_id == null) continue;
        if (!evidenceByApId[ev.ap_id]) evidenceByApId[ev.ap_id] = ev; // keep latest
      }

      const merged = apList
        .filter((ap) => ap.ap_code && String(ap.ap_code).trim() !== "")
        .map((ap) => {
          const ev = evidenceByApId[ap.ap_id];
          return {
            id: ev?.id ?? null,
            ap_id: ap.ap_id,
            ap_code: ap.ap_code || "",
            substantive_test: ap.substantive_test || "",
            attachment: ev?.file_url || "",
            file_name: ev?.file_name || "",
            status: ev?.status || "",
            created_at: ev?.created_at ?? null,
            updated_at: ev?.updated_at ?? null,
          };
        });

      const meta = evidenceRows[0]
        ? { preparer: evidenceRows[0].preparer || "", overall_status: evidenceRows[0].overall_status || "" }
        : { preparer: "", overall_status: "" };

      return NextResponse.json({ success: true, data: merged, meta });
    } catch (error) {
      console.error("Error fetching evidence data:", error);
      return NextResponse.json({ error: error.message || "Failed to fetch evidence data" }, { status: 500 });
    }
  };

  return { GET, POST, PUT };
}


