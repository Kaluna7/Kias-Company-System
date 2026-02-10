import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

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

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const department = formData.get("department");

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!department) return NextResponse.json({ error: "Department is required" }, { status: 400 });

    const deptSlug = sanitizeDeptSlug(department);
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
    return NextResponse.json({ success: true, fileUrl, fileName: originalName });
  } catch (error) {
    console.error("Error uploading worksheet file:", error);
    return NextResponse.json({ error: error.message || "Failed to upload file" }, { status: 500 });
  }
}


