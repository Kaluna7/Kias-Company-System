import fs from "fs";
import path from "path";
import crypto from "crypto";

const FILES_ROOT = path.join(process.cwd(), "data", "files");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function getYearDir(year) {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) {
    throw new Error("Invalid year");
  }
  const dir = path.join(FILES_ROOT, String(y));
  ensureDir(dir);
  return dir;
}

function getFolderDir(year, folderId) {
  const id = String(folderId || "").trim();
  if (!id || !/^[a-f0-9]{24}$/i.test(id)) {
    throw new Error("Invalid folder id");
  }
  const dir = path.join(getYearDir(year), id);
  ensureDir(dir);
  return dir;
}

function getFoldersIndexPath(year) {
  return path.join(getYearDir(year), "folders.json");
}

function getFileIndexPath(year, folderId) {
  return path.join(getFolderDir(year, folderId), "index.json");
}

async function readFoldersIndex(year) {
  const indexPath = getFoldersIndexPath(year);
  try {
    const raw = await fs.promises.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.folders) ? parsed.folders : [];
  } catch {
    return [];
  }
}

async function writeFoldersIndex(year, folders) {
  const indexPath = getFoldersIndexPath(year);
  await fs.promises.writeFile(
    indexPath,
    JSON.stringify({ year: Number(year), folders, updatedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
}

async function readFileIndex(year, folderId) {
  const indexPath = getFileIndexPath(year, folderId);
  try {
    const raw = await fs.promises.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.files) ? parsed.files : [];
  } catch {
    return [];
  }
}

async function writeFileIndex(year, folderId, files) {
  const indexPath = getFileIndexPath(year, folderId);
  await fs.promises.writeFile(
    indexPath,
    JSON.stringify(
      { year: Number(year), folderId, files, updatedAt: new Date().toISOString() },
      null,
      2,
    ),
    "utf8",
  );
}

/** Legacy year-level index (pre-folder uploads). */
async function readLegacyFileIndex(year) {
  const legacyPath = path.join(getYearDir(year), "index.json");
  try {
    const raw = await fs.promises.readFile(legacyPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.files) ? parsed.files : [];
  } catch {
    return [];
  }
}

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

export async function listYearsWithFiles() {
  ensureDir(FILES_ROOT);
  const entries = await fs.promises.readdir(FILES_ROOT, { withFileTypes: true });
  const years = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const y = parseInt(ent.name, 10);
    if (!Number.isFinite(y)) continue;
    const folders = await listFoldersByYear(y);
    const hasLegacy = (await readLegacyFileIndex(y)).length > 0;
    if (folders.length > 0 || hasLegacy) years.push(y);
  }
  years.sort((a, b) => b - a);
  return years;
}

export async function listFoldersByYear(year) {
  const folders = await readFoldersIndex(year);
  const withCounts = await Promise.all(
    folders.map(async (folder) => {
      const files = await readFileIndex(year, folder.id);
      return { ...folder, fileCount: files.length };
    }),
  );

  const legacyFiles = await readLegacyFileIndex(year);
  if (legacyFiles.length > 0 && !withCounts.some((f) => f.id === "legacy")) {
    withCounts.unshift({
      id: "legacy",
      name: "General (legacy)",
      createdAt: legacyFiles[0]?.createdAt || new Date().toISOString(),
      fileCount: legacyFiles.length,
      isLegacy: true,
    });
  }

  return withCounts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getFolderRecord(year, folderId) {
  if (folderId === "legacy") {
    const legacyFiles = await readLegacyFileIndex(year);
    if (legacyFiles.length === 0) return null;
    return {
      id: "legacy",
      name: "General (legacy)",
      year: Number(year),
      isLegacy: true,
      fileCount: legacyFiles.length,
    };
  }
  const folders = await readFoldersIndex(year);
  const folder = folders.find((f) => f.id === folderId) || null;
  if (!folder) return null;
  const files = await readFileIndex(year, folderId);
  return { ...folder, year: Number(year), fileCount: files.length };
}

export async function createFolder(year, { name, createdBy }) {
  const folderName = sanitizeFolderName(name);
  if (!folderName) throw new Error("Folder name is required");

  const folders = await readFoldersIndex(year);
  const duplicate = folders.some(
    (f) => String(f.name).toLowerCase() === folderName.toLowerCase(),
  );
  if (duplicate) throw new Error("A folder with this name already exists");

  const folder = {
    id: createFolderId(),
    name: folderName,
    createdAt: new Date().toISOString(),
    createdBy: createdBy || { id: "user", name: "User" },
  };

  folders.push(folder);
  await writeFoldersIndex(year, folders);
  getFolderDir(year, folder.id);
  await writeFileIndex(year, folder.id, []);

  return folder;
}

export async function listFilesByYearAndFolder(year, folderId) {
  if (folderId === "legacy") {
    const files = await readLegacyFileIndex(year);
    return files
      .map((f) => ({ ...f, folderId: "legacy" }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const folder = await getFolderRecord(year, folderId);
  if (!folder) return null;

  const files = await readFileIndex(year, folderId);
  return files
    .map((f) => ({ ...f, folderId }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function addFileRecord(year, folderId, record, buffer) {
  if (folderId === "legacy") {
    throw new Error("Cannot upload to legacy folder. Create a new folder.");
  }

  const folder = await getFolderRecord(year, folderId);
  if (!folder) throw new Error("Folder not found");

  const folderDir = getFolderDir(year, folderId);
  const storedName = `${record.id}_${sanitizeStoredName(record.originalName)}`;
  const filePath = path.join(folderDir, storedName);
  await fs.promises.writeFile(filePath, buffer);

  const files = await readFileIndex(year, folderId);
  const entry = {
    ...record,
    storedName,
    year: Number(year),
    folderId,
  };
  files.push(entry);
  await writeFileIndex(year, folderId, files);
  return entry;
}

export async function getFileRecord(year, folderId, id) {
  const files = await listFilesByYearAndFolder(year, folderId);
  if (!files) return null;
  return files.find((f) => f.id === id) || null;
}

export async function removeFileRecord(year, folderId, id) {
  if (folderId === "legacy") {
    const files = await readLegacyFileIndex(year);
    const target = files.find((f) => f.id === id);
    if (!target) return false;
    const filePath = path.join(getYearDir(year), target.storedName);
    try {
      await fs.promises.unlink(filePath);
    } catch {
      /* ignore */
    }
    const next = files.filter((f) => f.id !== id);
    const legacyPath = path.join(getYearDir(year), "index.json");
    await fs.promises.writeFile(
      legacyPath,
      JSON.stringify({ year: Number(year), files: next, updatedAt: new Date().toISOString() }, null, 2),
      "utf8",
    );
    return true;
  }

  const files = await readFileIndex(year, folderId);
  const target = files.find((f) => f.id === id);
  if (!target) return false;

  const filePath = path.join(getFolderDir(year, folderId), target.storedName);
  try {
    await fs.promises.unlink(filePath);
  } catch {
    /* ignore */
  }

  const next = files.filter((f) => f.id !== id);
  await writeFileIndex(year, folderId, next);
  return true;
}

export function resolveFilePath(record) {
  if (!record?.year || !record?.storedName) return null;
  if (record.folderId && record.folderId !== "legacy") {
    return path.join(getFolderDir(record.year, record.folderId), record.storedName);
  }
  return path.join(getYearDir(record.year), record.storedName);
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
