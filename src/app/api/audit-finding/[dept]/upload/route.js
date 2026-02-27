import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const deptToSlug = {
  accounting: "accounting",
  finance: "finance",
  hrd: "hrd",
  "g&a": "ga",
  ga: "ga",
  sdp: "sdp",
  tax: "tax",
  "l&p": "lp",
  lp: "lp",
  mis: "mis",
  merch: "merch",
  ops: "ops",
  whs: "whs",
};

function sanitizeFilename(name = "") {
  return String(name)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

export async function POST(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const dept = (p?.dept || "").toLowerCase().trim();
    const slug = deptToSlug[dept];
    if (!slug) return NextResponse.json({ error: "Invalid department" }, { status: 400 });

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const uploadsDir = join(process.cwd(), "public", "uploads", "audit-finding", slug);
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

    const fileUrl = `/uploads/audit-finding/${slug}/${fileName}`;
    return NextResponse.json({ success: true, fileUrl, fileName: originalName });
  } catch (error) {
    console.error("Error uploading audit-finding file:", error);
    return NextResponse.json({ error: error.message || "Failed to upload file" }, { status: 500 });
  }
}
