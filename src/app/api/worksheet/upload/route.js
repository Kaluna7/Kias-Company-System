import { NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

const WORKSHEET_DEPARTMENT_BY_SLUG = {
  finance: "FINANCE",
  accounting: "ACCOUNTING",
  hrd: "HRD",
  "g&a": "G&A",
  sdp: "DESIGN STORE PLANNER",
  tax: "TAX",
  "l&p": "SECURITY L&P",
  mis: "MIS",
  merch: "MERCHANDISE",
  ops: "OPERATIONAL",
  whs: "WAREHOUSE",
};

function sanitizeFilename(name = "") {
  // Keep it filesystem-friendly (Windows-safe) and URL-safe enough for our use.
  return String(name)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

function sanitizeDeptSlug(value = "") {
  const slug = String(value)
    .trim()
    .toLowerCase()
    // Allow simple slugs, plus '&' for existing folder names like g&a / l&p
    .replace(/[^a-z0-9&-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "unknown";
}

function getWorksheetDepartmentName(deptSlug) {
  return WORKSHEET_DEPARTMENT_BY_SLUG[deptSlug] || "FINANCE";
}

function getYearRange(year) {
  const parsedYear = parseInt(String(year || ""), 10);
  if (!Number.isInteger(parsedYear)) return null;
  return {
    start: new Date(parsedYear, 0, 1),
    end: new Date(parsedYear + 1, 0, 1),
  };
}

async function syncWorksheetFilePath({ department, year, fileUrl }) {
  const yearRange = getYearRange(year);
  const where = { department };

  if (yearRange) {
    where.created_at = { gte: yearRange.start, lt: yearRange.end };
  }

  const latest = await prisma.worksheet_finance.findFirst({
    where,
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
  });

  if (latest) {
    return prisma.worksheet_finance.update({
      where: { id: latest.id },
      data: {
        file_path: fileUrl || null,
        status_worksheet: fileUrl ? "Available" : "Not Available",
      },
    });
  }

  if (!fileUrl) {
    return null;
  }

  const createData = {
    department,
    file_path: fileUrl || null,
    status_worksheet: fileUrl ? "Available" : "Not Available",
  };

  if (yearRange) {
    createData.created_at = yearRange.start;
  }

  return prisma.worksheet_finance.create({
    data: createData,
  });
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const department = formData.get("department");
    const year = formData.get("year");

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!department) return NextResponse.json({ error: "Department is required" }, { status: 400 });

    const deptSlug = sanitizeDeptSlug(department);
    const worksheetDepartment = getWorksheetDepartmentName(deptSlug);
    const uploadsDir = join(process.cwd(), "public", "uploads", "worksheet", deptSlug);
    if (!existsSync(uploadsDir)) await mkdir(uploadsDir, { recursive: true });

    const timestamp = Date.now();
    const originalName = file.name || "file";
    const safeOriginal = sanitizeFilename(originalName);

    const ext = safeOriginal.includes(".") ? safeOriginal.split(".").pop() : "";
    const base = ext ? safeOriginal.slice(0, -(ext.length + 1)) : safeOriginal;
    const fileName = `${sanitizeFilename(base)}_${timestamp}${ext ? `.${ext}` : ""}`;

    const filePath = join(uploadsDir, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/worksheet/${deptSlug}/${fileName}`;
    await syncWorksheetFilePath({
      department: worksheetDepartment,
      year,
      fileUrl,
    });

    return NextResponse.json({ success: true, fileUrl, fileName: originalName });
  } catch (error) {
    console.error("Error uploading worksheet file:", error);
    return NextResponse.json({ error: error.message || "Failed to upload file" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const deptSlug = sanitizeDeptSlug(body?.department || "");
    const worksheetDepartment = getWorksheetDepartmentName(deptSlug);
    const year = body?.year;
    const fileUrl = String(body?.fileUrl || "").trim();

    if (!fileUrl) {
      return NextResponse.json({ success: false, error: "fileUrl is required" }, { status: 400 });
    }

    const publicPrefix = `/uploads/worksheet/${deptSlug}/`;
    if (!fileUrl.startsWith(publicPrefix)) {
      return NextResponse.json({ success: false, error: "Invalid file URL" }, { status: 400 });
    }

    const relativePath = fileUrl.replace("/uploads/", "");
    const absolutePath = join(process.cwd(), "public", relativePath);
    if (existsSync(absolutePath)) {
      await unlink(absolutePath).catch(() => {});
    }

    await syncWorksheetFilePath({
      department: worksheetDepartment,
      year,
      fileUrl: null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting worksheet file:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to delete file" }, { status: 500 });
  }
}


