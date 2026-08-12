export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { pool } from "@/app/api/SopReview/_shared/pool";
import { resolveSopDept } from "@/app/api/SopReview/_shared/dept";
import { requireSopEditor } from "@/app/api/SopReview/_shared/auth";

function sanitizeFilename(name = "") {
  return String(name)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

function sanitizeDeptFolder(value = "") {
  const slug = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9&-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "unknown";
}

async function ensureMetaFileColumns(client, metaTable) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${metaTable} (
      id SERIAL PRIMARY KEY,
      department_name VARCHAR(255),
      sop_status VARCHAR(50),
      preparer_status VARCHAR(50),
      preparer_name VARCHAR(255),
      preparer_date DATE,
      reviewer_comment TEXT,
      reviewer_status VARCHAR(50),
      reviewer_name VARCHAR(255),
      reviewer_date DATE,
      file_url TEXT,
      file_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await client.query(`ALTER TABLE ${metaTable} ADD COLUMN IF NOT EXISTS file_url TEXT`);
  await client.query(`ALTER TABLE ${metaTable} ADD COLUMN IF NOT EXISTS file_name TEXT`);
}

async function upsertDraftDocumentMeta({ slug, departmentName, fileUrl, fileName }) {
  const metaTable = `sop_${slug}`;
  const client = await pool.connect();
  try {
    await ensureMetaFileColumns(client, metaTable);
    const latest = await client.query(
      `SELECT id FROM ${metaTable} ORDER BY id DESC LIMIT 1`,
    );
    if (latest.rows?.[0]?.id) {
      await client.query(
        `UPDATE ${metaTable}
         SET file_url = $1, file_name = $2, updated_at = NOW()
         WHERE id = $3`,
        [fileUrl, fileName, latest.rows[0].id],
      );
    } else {
      await client.query(
        `INSERT INTO ${metaTable}
          (department_name, sop_status, preparer_status, reviewer_status, file_url, file_name, updated_at)
         VALUES ($1, 'AVAILABLE', 'DRAFT', 'DRAFT', $2, $3, NOW())`,
        [departmentName, fileUrl, fileName],
      );
    }
  } finally {
    client.release();
  }
}

export async function POST(req, { params }) {
  try {
    const authError = await requireSopEditor();
    if (authError) return authError;

    const p = await Promise.resolve(params);
    const resolved = resolveSopDept(p?.dept);
    if (!resolved) {
      return NextResponse.json({ success: false, error: "Invalid department" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const mime = String(file.type || "").toLowerCase();
    const originalName = String(file.name || "document.pdf");
    if (mime && mime !== "application/pdf" && !originalName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ success: false, error: "Only PDF files are allowed" }, { status: 400 });
    }

    const deptFolder = sanitizeDeptFolder(p?.dept);
    const uploadsDir = join(process.cwd(), "public", "uploads", "sop-review", deptFolder);
    if (!existsSync(uploadsDir)) await mkdir(uploadsDir, { recursive: true });

    const timestamp = Date.now();
    const safeOriginal = sanitizeFilename(originalName);
    const ext = safeOriginal.includes(".") ? safeOriginal.split(".").pop() : "pdf";
    const base = ext ? safeOriginal.slice(0, -(ext.length + 1)) : safeOriginal;
    const fileName = `${sanitizeFilename(base)}_${timestamp}.${ext || "pdf"}`;
    const absolutePath = join(uploadsDir, fileName);

    const bytes = await file.arrayBuffer();
    await writeFile(absolutePath, Buffer.from(bytes));

    const fileUrl = `/uploads/sop-review/${deptFolder}/${fileName}`;
    await upsertDraftDocumentMeta({
      slug: resolved.slug,
      departmentName: resolved.departmentName,
      fileUrl,
      fileName: originalName,
    });

    return NextResponse.json({
      success: true,
      fileUrl,
      fileName: originalName,
    });
  } catch (error) {
    console.error("POST /api/SopReview/[dept]/document:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to upload document" },
      { status: 500 },
    );
  }
}

export async function GET(_req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const resolved = resolveSopDept(p?.dept);
    if (!resolved) {
      return NextResponse.json({ success: false, error: "Invalid department" }, { status: 400 });
    }

    const metaTable = `sop_${resolved.slug}`;
    const client = await pool.connect();
    try {
      await ensureMetaFileColumns(client, metaTable);
      const r = await client.query(
        `SELECT file_url, file_name FROM ${metaTable}
         WHERE file_url IS NOT NULL AND TRIM(file_url) <> ''
         ORDER BY id DESC LIMIT 1`,
      );
      const row = r.rows?.[0] || null;
      return NextResponse.json({
        success: true,
        fileUrl: row?.file_url || null,
        fileName: row?.file_name || null,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("GET /api/SopReview/[dept]/document:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load document" },
      { status: 500 },
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const authError = await requireSopEditor();
    if (authError) return authError;

    const p = await Promise.resolve(params);
    const resolved = resolveSopDept(p?.dept);
    if (!resolved) {
      return NextResponse.json({ success: false, error: "Invalid department" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const fileUrl = String(body?.fileUrl || "").trim();
    const deptFolder = sanitizeDeptFolder(p?.dept);
    const publicPrefix = `/uploads/sop-review/${deptFolder}/`;

    if (fileUrl && fileUrl.startsWith(publicPrefix)) {
      const diskPath = join(process.cwd(), "public", fileUrl.replace(/^\//, ""));
      if (existsSync(diskPath)) {
        await unlink(diskPath).catch(() => {});
      }
    }

    const metaTable = `sop_${resolved.slug}`;
    const client = await pool.connect();
    try {
      await ensureMetaFileColumns(client, metaTable);
      await client.query(
        `UPDATE ${metaTable}
         SET file_url = NULL, file_name = NULL, updated_at = NOW()
         WHERE id = (SELECT id FROM ${metaTable} ORDER BY id DESC LIMIT 1)`,
      );
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/SopReview/[dept]/document:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to delete document" },
      { status: 500 },
    );
  }
}
