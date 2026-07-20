export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminLikeRole } from "@/lib/roles";
import {
  addFileRecord,
  createFileId,
  getFolderRecord,
  listFilesByYearAndFolder,
  listYearsWithFiles,
  removeFileRecord,
  sanitizeStoredName,
} from "@/app/lib/files/fileStore";

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

const ALLOWED_EXT = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
  ".rar",
  ".7z",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".txt",
  ".csv",
]);

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

function getExtension(name = "") {
  const idx = String(name).lastIndexOf(".");
  return idx >= 0 ? String(name).slice(idx).toLowerCase() : "";
}

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const year = parseYear(searchParams.get("year"));
    const folderId = String(searchParams.get("folderId") || "").trim();

    if (!year) {
      return NextResponse.json({ success: false, error: "Missing or invalid year" }, { status: 400 });
    }
    if (!folderId) {
      return NextResponse.json(
        { success: false, error: "Missing folderId. List folders via GET /api/files/folders" },
        { status: 400 },
      );
    }

    const folder = await getFolderRecord(year, folderId);
    if (!folder) {
      return NextResponse.json({ success: false, error: "Folder not found" }, { status: 404 });
    }

    const files = await listFilesByYearAndFolder(year, folderId);
    const availableYears = await listYearsWithFiles();
    if (!availableYears.includes(year)) {
      availableYears.unshift(year);
      availableYears.sort((a, b) => b - a);
    }

    return NextResponse.json({
      success: true,
      year,
      folderId,
      folder,
      files: files || [],
      availableYears: [...new Set(availableYears)].sort((a, b) => b - a),
    });
  } catch (err) {
    console.error("GET /api/files:", err);
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const year = parseYear(form.get("year"));
    const folderId = String(form.get("folderId") || "").trim();
    const file = form.get("file");

    if (!year) {
      return NextResponse.json({ success: false, error: "Missing or invalid year" }, { status: 400 });
    }
    if (!folderId) {
      return NextResponse.json({ success: false, error: "Missing folderId" }, { status: 400 });
    }
    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const folder = await getFolderRecord(year, folderId);
    if (!folder) {
      return NextResponse.json({ success: false, error: "Folder not found" }, { status: 404 });
    }
    if (folder.isLegacy) {
      return NextResponse.json(
        { success: false, error: "Cannot upload to legacy folder. Create a new folder." },
        { status: 400 },
      );
    }

    const originalName = sanitizeStoredName(file.name || "upload.dat");
    const ext = getExtension(originalName);
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { success: false, error: `File type not allowed (${ext || "unknown"})` },
        { status: 400 },
      );
    }

    const sizeBytes = Number(file.size || 0);
    if (sizeBytes > MAX_FILE_BYTES) {
      return NextResponse.json({ success: false, error: "File exceeds 100 MB limit" }, { status: 400 });
    }

    const id = createFileId();
    const record = {
      id,
      originalName,
      mimeType: file.type || "application/octet-stream",
      sizeBytes,
      uploadedBy: {
        id: session.user.id || session.user.email || "user",
        name: session.user.name || session.user.email || "User",
        email: session.user.email || "",
      },
      createdAt: new Date().toISOString(),
    };

    const buffer = Buffer.from(await file.arrayBuffer());

    const saved = await addFileRecord(year, folderId, record, buffer);

    return NextResponse.json({ success: true, year, folderId, file: saved });
  } catch (err) {
    console.error("POST /api/files:", err);
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const year = parseYear(searchParams.get("year"));
    const folderId = String(searchParams.get("folderId") || "").trim();
    const id = String(searchParams.get("id") || "").trim();

    if (!year || !folderId || !id) {
      return NextResponse.json({ success: false, error: "Missing year, folderId, or id" }, { status: 400 });
    }

    const role = String(session.user.role || "").toLowerCase();
    const isAdmin = isAdminLikeRole(role);
    const files = await listFilesByYearAndFolder(year, folderId);
    const target = files?.find((f) => f.id === id);
    if (!target) {
      return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
    }

    const uploaderId = target.uploadedBy?.id || target.uploadedBy?.email || "";
    const currentId = session.user.id || session.user.email || "";
    if (!isAdmin && String(uploaderId) !== String(currentId)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const removed = await removeFileRecord(year, folderId, id);
    if (!removed) {
      return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/files:", err);
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
