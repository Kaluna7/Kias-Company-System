import fs from "fs";
import path from "path";
import crypto from "crypto";
import pkg from "pg";

const { Pool } = pkg;

const FILES_ROOT = path.join(process.cwd(), "data", "files");
const MIGRATION_KEY = "disk_files_v1";

if (!global._pgPool) {
  global._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

const pool = global._pgPool;

let schemaReady = null;

export function sanitizeStoredName(name = "") {
  return String(name)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 160);
}

export function sanitizeFolderName(name = "") {
  return String(name).trim().replace(/\s+/g, " ").slice(0, 80);
}

export function createFileId() {
  return crypto.randomBytes(12).toString("hex");
}

export function createFolderId() {
  return crypto.randomBytes(12).toString("hex");
}

function parseYear(year) {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) throw new Error("Invalid year");
  return y;
}

function isValidFolderId(folderId) {
  const id = String(folderId || "").trim();
  return id === "legacy" || /^[a-f0-9]{24}$/i.test(id);
}

function parseJsonField(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToFolder(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    createdBy: parseJsonField(row.created_by, { id: "user", name: "User" }),
    year: Number(row.audit_year),
    fileCount: Number(row.file_count ?? 0),
    isLegacy: row.id === "legacy",
  };
}

function rowToFile(row) {
  if (!row) return null;
  const uploadedBy = parseJsonField(row.uploaded_by, { id: "user", name: "User" });
  return {
    id: row.id,
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type || "application/octet-stream",
    sizeBytes: Number(row.size_bytes || 0),
    uploadedBy: uploadedBy || { id: "user", name: "User" },
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    year: Number(row.audit_year),
    folderId: row.folder_id,
  };
}

async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS file_store_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS file_folders (
          id VARCHAR(24) PRIMARY KEY,
          audit_year INTEGER NOT NULL,
          name VARCHAR(80) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          created_by JSONB
        );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS file_folders_audit_year_idx
        ON file_folders (audit_year);
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS file_folders_year_name_lower_idx
        ON file_folders (audit_year, LOWER(name));
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS file_uploads (
          id VARCHAR(24) PRIMARY KEY,
          audit_year INTEGER NOT NULL,
          folder_id VARCHAR(24) NOT NULL,
          original_name VARCHAR(160) NOT NULL,
          stored_name VARCHAR(200) NOT NULL,
          mime_type TEXT,
          size_bytes BIGINT NOT NULL DEFAULT 0,
          uploaded_by JSONB,
          file_data BYTEA NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS file_uploads_year_folder_idx
        ON file_uploads (audit_year, folder_id);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS file_uploads_year_idx
        ON file_uploads (audit_year);
      `);
    } finally {
      client.release();
    }
    await migrateDiskStoreIfNeeded();
  })();
  return schemaReady;
}

async function migrationDone() {
  const res = await pool.query(
    `SELECT value FROM file_store_meta WHERE key = $1 LIMIT 1`,
    [MIGRATION_KEY],
  );
  return res.rows[0]?.value === "done";
}

async function markMigrationDone() {
  await pool.query(
    `
      INSERT INTO file_store_meta (key, value, updated_at)
      VALUES ($1, 'done', NOW())
      ON CONFLICT (key) DO UPDATE SET value = 'done', updated_at = NOW()
    `,
    [MIGRATION_KEY],
  );
}

/** One-time import from data/files/ (local dev) into PostgreSQL. */
async function migrateDiskStoreIfNeeded() {
  if (await migrationDone()) return;
  if (!fs.existsSync(FILES_ROOT)) {
    await markMigrationDone();
    return;
  }

  const client = await pool.connect();
  try {
    const yearDirs = await fs.promises.readdir(FILES_ROOT, { withFileTypes: true });
    for (const ent of yearDirs) {
      if (!ent.isDirectory()) continue;
      const year = parseInt(ent.name, 10);
      if (!Number.isFinite(year)) continue;
      const yearDir = path.join(FILES_ROOT, String(year));

      const foldersIndexPath = path.join(yearDir, "folders.json");
      let folders = [];
      try {
        const raw = await fs.promises.readFile(foldersIndexPath, "utf8");
        folders = JSON.parse(raw)?.folders || [];
      } catch {
        folders = [];
      }

      for (const folder of folders) {
        if (!folder?.id || folder.id === "legacy") continue;
        await client.query(
          `
            INSERT INTO file_folders (id, audit_year, name, created_at, created_by)
            VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), $5::jsonb)
            ON CONFLICT (id) DO NOTHING
          `,
          [
            folder.id,
            year,
            folder.name || "Folder",
            folder.createdAt || null,
            JSON.stringify(folder.createdBy || { id: "user", name: "User" }),
          ],
        );

        const indexPath = path.join(yearDir, folder.id, "index.json");
        let files = [];
        try {
          const raw = await fs.promises.readFile(indexPath, "utf8");
          files = JSON.parse(raw)?.files || [];
        } catch {
          files = [];
        }
        for (const file of files) {
          await importDiskFile(client, year, folder.id, file, yearDir);
        }
      }

      const legacyIndexPath = path.join(yearDir, "index.json");
      try {
        const raw = await fs.promises.readFile(legacyIndexPath, "utf8");
        const files = JSON.parse(raw)?.files || [];
        for (const file of files) {
          await importDiskFile(client, year, "legacy", file, yearDir);
        }
      } catch {
        /* no legacy index */
      }
    }
  } finally {
    client.release();
  }
  await markMigrationDone();
}

async function importDiskFile(client, year, folderId, file, yearDir) {
  if (!file?.id || !file?.storedName) return;
  const exists = await client.query(`SELECT 1 FROM file_uploads WHERE id = $1`, [file.id]);
  if (exists.rows.length > 0) return;

  let diskPath = path.join(yearDir, folderId, file.storedName);
  if (folderId === "legacy") {
    diskPath = path.join(yearDir, file.storedName);
  }
  if (!fs.existsSync(diskPath)) return;

  const buffer = await fs.promises.readFile(diskPath);
  await client.query(
    `
      INSERT INTO file_uploads (
        id, audit_year, folder_id, original_name, stored_name,
        mime_type, size_bytes, uploaded_by, file_data, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, COALESCE($10::timestamptz, NOW()))
      ON CONFLICT (id) DO NOTHING
    `,
    [
      file.id,
      year,
      folderId,
      file.originalName || file.storedName,
      file.storedName,
      file.mimeType || "application/octet-stream",
      Number(file.sizeBytes || buffer.length),
      JSON.stringify(file.uploadedBy || { id: "user", name: "User" }),
      buffer,
      file.createdAt || null,
    ],
  );
}

async function legacyFileCount(year) {
  const res = await pool.query(
    `SELECT COUNT(*)::int AS c FROM file_uploads WHERE audit_year = $1 AND folder_id = 'legacy'`,
    [year],
  );
  return res.rows[0]?.c ?? 0;
}

export async function listYearsWithFiles() {
  await ensureSchema();
  const res = await pool.query(`
    SELECT DISTINCT audit_year AS year FROM (
      SELECT audit_year FROM file_folders
      UNION
      SELECT audit_year FROM file_uploads
    ) t
    ORDER BY year DESC
  `);
  return res.rows.map((r) => Number(r.year)).filter(Number.isFinite);
}

export async function listFoldersByYear(year) {
  await ensureSchema();
  const y = parseYear(year);
  const res = await pool.query(
    `
      SELECT f.id, f.audit_year, f.name, f.created_at, f.created_by,
             COUNT(u.id)::int AS file_count
      FROM file_folders f
      LEFT JOIN file_uploads u
        ON u.folder_id = f.id AND u.audit_year = f.audit_year
      WHERE f.audit_year = $1
      GROUP BY f.id, f.audit_year, f.name, f.created_at, f.created_by
      ORDER BY f.created_at DESC
    `,
    [y],
  );

  const folders = res.rows.map(rowToFolder);
  const legacyCount = await legacyFileCount(y);
  if (legacyCount > 0 && !folders.some((f) => f.id === "legacy")) {
    folders.unshift({
      id: "legacy",
      name: "General (legacy)",
      createdAt: new Date().toISOString(),
      fileCount: legacyCount,
      isLegacy: true,
      year: y,
    });
  }
  return folders;
}

export async function getFolderRecord(year, folderId) {
  await ensureSchema();
  const y = parseYear(year);
  const id = String(folderId || "").trim();
  if (!isValidFolderId(id)) return null;

  if (id === "legacy") {
    const legacyCount = await legacyFileCount(y);
    if (legacyCount === 0) return null;
    return {
      id: "legacy",
      name: "General (legacy)",
      year: y,
      isLegacy: true,
      fileCount: legacyCount,
    };
  }

  const res = await pool.query(
    `
      SELECT f.id, f.audit_year, f.name, f.created_at, f.created_by,
             COUNT(u.id)::int AS file_count
      FROM file_folders f
      LEFT JOIN file_uploads u
        ON u.folder_id = f.id AND u.audit_year = f.audit_year
      WHERE f.audit_year = $1 AND f.id = $2
      GROUP BY f.id, f.audit_year, f.name, f.created_at, f.created_by
    `,
    [y, id],
  );
  return rowToFolder(res.rows[0]);
}

export async function createFolder(year, { name, createdBy }) {
  await ensureSchema();
  const y = parseYear(year);
  const folderName = sanitizeFolderName(name);
  if (!folderName) throw new Error("Folder name is required");

  const dup = await pool.query(
    `SELECT 1 FROM file_folders WHERE audit_year = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
    [y, folderName],
  );
  if (dup.rows.length > 0) throw new Error("A folder with this name already exists");

  const folder = {
    id: createFolderId(),
    name: folderName,
    createdAt: new Date().toISOString(),
    createdBy: createdBy || { id: "user", name: "User" },
  };

  await pool.query(
    `
      INSERT INTO file_folders (id, audit_year, name, created_at, created_by)
      VALUES ($1, $2, $3, NOW(), $4::jsonb)
    `,
    [folder.id, y, folder.name, JSON.stringify(folder.createdBy)],
  );

  return folder;
}

export async function listFilesByYearAndFolder(year, folderId) {
  await ensureSchema();
  const y = parseYear(year);
  const id = String(folderId || "").trim();
  if (!isValidFolderId(id)) return null;

  if (id !== "legacy") {
    const folder = await getFolderRecord(y, id);
    if (!folder) return null;
  } else if ((await legacyFileCount(y)) === 0) {
    return null;
  }

  const res = await pool.query(
    `
      SELECT id, audit_year, folder_id, original_name, stored_name,
             mime_type, size_bytes, uploaded_by, created_at
      FROM file_uploads
      WHERE audit_year = $1 AND folder_id = $2
      ORDER BY created_at DESC
    `,
    [y, id],
  );
  return res.rows.map(rowToFile);
}

export async function addFileRecord(year, folderId, record, buffer) {
  await ensureSchema();
  const y = parseYear(year);
  const id = String(folderId || "").trim();
  if (id === "legacy") throw new Error("Cannot upload to legacy folder. Create a new folder.");
  if (!isValidFolderId(id)) throw new Error("Invalid folder id");

  const folder = await getFolderRecord(y, id);
  if (!folder) throw new Error("Folder not found");

  const storedName = `${record.id}_${sanitizeStoredName(record.originalName)}`;
  const entry = {
    ...record,
    storedName,
    year: y,
    folderId: id,
  };

  await pool.query(
    `
      INSERT INTO file_uploads (
        id, audit_year, folder_id, original_name, stored_name,
        mime_type, size_bytes, uploaded_by, file_data, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, COALESCE($10::timestamptz, NOW()))
    `,
    [
      record.id,
      y,
      id,
      record.originalName,
      storedName,
      record.mimeType || "application/octet-stream",
      Number(record.sizeBytes || buffer.length),
      JSON.stringify(record.uploadedBy || { id: "user", name: "User" }),
      buffer,
      record.createdAt || null,
    ],
  );

  return entry;
}

export async function getFileRecord(year, folderId, fileId) {
  const files = await listFilesByYearAndFolder(year, folderId);
  if (!files) return null;
  return files.find((f) => f.id === fileId) || null;
}

export async function getFileBuffer(year, folderId, fileId) {
  await ensureSchema();
  const y = parseYear(year);
  const id = String(folderId || "").trim();
  const fid = String(fileId || "").trim();
  if (!isValidFolderId(id) || !fid) return null;

  const res = await pool.query(
    `
      SELECT file_data, original_name, mime_type, size_bytes
      FROM file_uploads
      WHERE audit_year = $1 AND folder_id = $2 AND id = $3
      LIMIT 1
    `,
    [y, id, fid],
  );
  const row = res.rows[0];
  if (!row?.file_data) return null;
  return {
    buffer: row.file_data,
    originalName: row.original_name,
    mimeType: row.mime_type || "application/octet-stream",
    sizeBytes: Number(row.size_bytes || row.file_data.length),
  };
}

export async function removeFileRecord(year, folderId, fileId) {
  await ensureSchema();
  const y = parseYear(year);
  const id = String(folderId || "").trim();
  const fid = String(fileId || "").trim();
  if (!isValidFolderId(id) || !fid) return false;

  const res = await pool.query(
    `DELETE FROM file_uploads WHERE audit_year = $1 AND folder_id = $2 AND id = $3`,
    [y, id, fid],
  );
  return (res.rowCount ?? 0) > 0;
}

/** @deprecated Disk paths no longer used for new uploads. */
export function resolveFilePath() {
  return null;
}

/** @deprecated Use listFilesByYearAndFolder */
export async function listFilesByYear(year) {
  const folders = await listFoldersByYear(year);
  const all = [];
  for (const folder of folders) {
    const files = await listFilesByYearAndFolder(year, folder.id);
    if (files) all.push(...files);
  }
  return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
