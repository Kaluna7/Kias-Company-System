/**
 * Dashboard file library — persisted in PostgreSQL (survives Docker build/redeploy).
 * Legacy disk files under data/files/ are imported once on first DB access.
 */
export {
  sanitizeStoredName,
  sanitizeFolderName,
  createFileId,
  createFolderId,
  listYearsWithFiles,
  listFoldersByYear,
  getFolderRecord,
  createFolder,
  listFilesByYearAndFolder,
  addFileRecord,
  getFileRecord,
  getFileBuffer,
  removeFileRecord,
  resolveFilePath,
  listFilesByYear,
} from "./fileDbStore";
