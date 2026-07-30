import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const EVIDENCE_MAX_BYTES = 8 * 1024 * 1024 * 1024;

const STORAGE_PREFIX = "/api/evidence/storage/";

let internalClientSingleton = null;
let presignClientSingleton = null;

function getInternalEndpoint() {
  return String(process.env.MINIO_ENDPOINT || "").replace(/\/$/, "");
}

/** URL reachable from the user's browser (not Docker hostname "minio"). */
export function getPublicEndpoint() {
  const pub = String(process.env.MINIO_PUBLIC_URL || "").replace(/\/$/, "");
  if (pub) return pub;
  const internal = getInternalEndpoint();
  if (internal && !/:\/\/minio(?::|\/?|$)/i.test(internal)) {
    return internal;
  }
  return "";
}

export function isMinioEnabled() {
  return Boolean(
    getInternalEndpoint() &&
      process.env.MINIO_ACCESS_KEY &&
      process.env.MINIO_SECRET_KEY &&
      process.env.MINIO_BUCKET,
  );
}

/** Shown to users when MinIO is configured but unreachable — file was not saved. */
export const MINIO_DOWN_MESSAGE =
  "Storage MinIO sedang mati / tidak dapat dihubungi. File TIDAK tersimpan. Hubungi admin untuk menyalakan MinIO, lalu upload ulang.";

export const MINIO_DISABLED_MESSAGE =
  "Storage MinIO belum dikonfigurasi. Upload dibatalkan — file tidak tersimpan. Hubungi admin.";

/**
 * Verify MinIO is reachable before creating upload URLs.
 * Throws an Error with statusCode 503 and code MINIO_DOWN / MINIO_DISABLED.
 */
export async function assertMinioHealthy(timeoutMs = 5000) {
  if (!isMinioEnabled()) {
    const err = new Error(MINIO_DISABLED_MESSAGE);
    err.statusCode = 503;
    err.code = "MINIO_DISABLED";
    throw err;
  }

  try {
    await Promise.race([
      ensureMinioBucket(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("MinIO health check timed out")), timeoutMs);
      }),
    ]);
  } catch (cause) {
    const err = new Error(MINIO_DOWN_MESSAGE);
    err.statusCode = 503;
    err.code = "MINIO_DOWN";
    err.cause = cause;
    throw err;
  }
}

export function isMinioConnectionError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || error?.name || "").toLowerCase();
  return (
    code === "minio_down" ||
    code === "minio_disabled" ||
    code === "econnrefused" ||
    code === "enotfound" ||
    code === "etimedout" ||
    code === "econnreset" ||
    code === "networkingerror" ||
    code === "timeouterror" ||
    (msg.includes("minio") &&
      (msg.includes("mati") || msg.includes("tidak dapat") || msg.includes("timed out"))) ||
    msg.includes("econnrefused") ||
    msg.includes("connect econnrefused") ||
    msg.includes("getaddrinfo") ||
    (msg.includes("network") && msg.includes("unreachable"))
  );
}

function getCredentials() {
  return {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY,
  };
}

function getRegion() {
  return process.env.MINIO_REGION || "us-east-1";
}

/** Server-side calls (head/get/delete) — Docker network host `minio`. */
function getInternalS3Client() {
  if (!isMinioEnabled()) {
    throw new Error("MinIO is not configured");
  }
  if (!internalClientSingleton) {
    internalClientSingleton = new S3Client({
      endpoint: getInternalEndpoint(),
      region: getRegion(),
      credentials: getCredentials(),
      forcePathStyle: true,
    });
  }
  return internalClientSingleton;
}

/** Presigned URLs for browser upload — must use public host/IP. */
function getPresignS3Client() {
  if (!isMinioEnabled()) {
    throw new Error("MinIO is not configured");
  }
  const publicEndpoint = getPublicEndpoint();
  if (!publicEndpoint) {
    throw new Error(
      "MINIO_PUBLIC_URL is required (e.g. http://76.13.20.134:9000). Browser cannot resolve Docker hostname 'minio'.",
    );
  }
  if (!presignClientSingleton) {
    presignClientSingleton = new S3Client({
      endpoint: publicEndpoint,
      region: getRegion(),
      credentials: getCredentials(),
      forcePathStyle: true,
    });
  }
  return presignClientSingleton;
}

export function getMinioBucket() {
  return process.env.MINIO_BUCKET || "evidence";
}

export async function ensureMinioBucket() {
  const client = getInternalS3Client();
  const bucket = getMinioBucket();
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export function sanitizeUploadBaseName(apCode) {
  const base = String(apCode || "file").trim() || "file";
  return base.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 120);
}

export function departmentToStorageFolder(department) {
  return String(department || "file")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9&.-]+/g, "_");
}

/** Object key inside bucket, e.g. accounting/AP.1.1_1710000000.pdf */
export function buildEvidenceObjectKey(department, apCode, originalName) {
  const folder = departmentToStorageFolder(department);
  const name = String(originalName || "upload.dat").trim() || "upload.dat";
  const extMatch = name.match(/\.([^.]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "dat";
  const timestamp = Date.now();
  return `${folder}/${sanitizeUploadBaseName(apCode)}_${timestamp}.${ext}`;
}

export function getStorageProxyUrl(objectKey) {
  const encoded = objectKey
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${STORAGE_PREFIX}${encoded}`;
}

function safeDecodeURIComponent(value) {
  const s = String(value ?? "");
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Extract object key from stored attachment URL / path.
 * Handles proxy URLs, legacy uploads paths, and public MinIO URLs.
 */
export function objectKeyFromFileUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") return null;
  let url = fileUrl.trim();
  if (!url) return null;

  // Strip origin if absolute app URL accidentally stored
  try {
    if (/^https?:\/\//i.test(url)) {
      const u = new URL(url);
      url = `${u.pathname}${u.search || ""}`;
    }
  } catch {
    // keep raw
  }

  // Drop query/hash from path-only values
  url = url.split("?")[0].split("#")[0];

  if (url.startsWith(STORAGE_PREFIX)) {
    const raw = url.slice(STORAGE_PREFIX.length);
    return raw
      .split("/")
      .filter(Boolean)
      .map((s) => safeDecodeURIComponent(s))
      .join("/");
  }

  // Legacy disk path → same relative key used in MinIO folder layout
  if (url.startsWith("/uploads/evidence/")) {
    const raw = url.slice("/uploads/evidence/".length);
    return raw
      .split("/")
      .filter(Boolean)
      .map((s) => safeDecodeURIComponent(s))
      .join("/");
  }

  const publicBase = (process.env.MINIO_PUBLIC_URL || "").replace(/\/$/, "");
  const bucket = getMinioBucket();
  if (publicBase && fileUrl.startsWith(`${publicBase}/${bucket}/`)) {
    return fileUrl
      .slice(`${publicBase}/${bucket}/`.length)
      .split("?")[0]
      .split("/")
      .filter(Boolean)
      .map((s) => safeDecodeURIComponent(s))
      .join("/");
  }

  // Path-style MinIO: http://host:9000/bucket/key...
  const bucketPrefix = `/${bucket}/`;
  const bucketIdx = url.indexOf(bucketPrefix);
  if (bucketIdx >= 0) {
    return url
      .slice(bucketIdx + bucketPrefix.length)
      .split("/")
      .filter(Boolean)
      .map((s) => safeDecodeURIComponent(s))
      .join("/");
  }

  return null;
}

/** Build candidate keys to try when the exact stored key is missing. */
export function buildMinioKeyCandidates(fileUrl, preferredName = "") {
  const primary = objectKeyFromFileUrl(fileUrl);
  const candidates = [];
  const push = (k) => {
    const key = String(k || "").replace(/^\/+/, "").trim();
    if (!key) return;
    if (!candidates.includes(key)) candidates.push(key);
  };

  push(primary);
  if (primary) {
    push(safeDecodeURIComponent(primary));
    // If bucket name was wrongly included in key: evidence/hrd/file.xlsx
    const bucket = getMinioBucket();
    if (primary.startsWith(`${bucket}/`)) {
      push(primary.slice(bucket.length + 1));
    }
  }

  // Preferred original filename under same folder
  if (primary && preferredName) {
    const folder = primary.includes("/") ? primary.slice(0, primary.lastIndexOf("/")) : "";
    const safeName = String(preferredName).replace(/[/\\]/g, "_").trim();
    if (folder && safeName) push(`${folder}/${safeName}`);
  }

  return candidates;
}

export async function createPresignedPutUrl(objectKey, contentType, expiresInSeconds = 86400) {
  await ensureMinioBucket();
  const client = getPresignS3Client();
  const command = new PutObjectCommand({
    Bucket: getMinioBucket(),
    Key: objectKey,
    ContentType: contentType || "application/octet-stream",
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  return uploadUrl;
}

export async function headMinioObject(objectKey) {
  const client = getInternalS3Client();
  await client.send(
    new HeadObjectCommand({
      Bucket: getMinioBucket(),
      Key: objectKey,
    }),
  );
}

/**
 * Resolve a working MinIO object key: try candidates, then list by folder prefix.
 */
export async function resolveExistingMinioKey(fileUrl, preferredName = "") {
  const candidates = buildMinioKeyCandidates(fileUrl, preferredName);
  for (const key of candidates) {
    try {
      await headMinioObject(key);
      return key;
    } catch {
      // try next
    }
  }

  // Fallback: list objects under folder and match by basename / preferred name
  const primary = candidates[0] || "";
  const folder = primary.includes("/") ? primary.slice(0, primary.lastIndexOf("/") + 1) : "";
  const baseName = primary.includes("/") ? primary.slice(primary.lastIndexOf("/") + 1) : primary;
  const wantNames = [baseName, preferredName]
    .map((n) => String(n || "").trim().toLowerCase())
    .filter(Boolean);

  if (!folder && !wantNames.length) {
    const err = new Error("The specified key does not exist.");
    err.code = "NoSuchKey";
    throw err;
  }

  const client = getInternalS3Client();
  const listed = await client.send(
    new ListObjectsV2Command({
      Bucket: getMinioBucket(),
      Prefix: folder || undefined,
      MaxKeys: 200,
    }),
  );

  const contents = listed.Contents || [];
  for (const obj of contents) {
    const key = obj.Key || "";
    const name = key.includes("/") ? key.slice(key.lastIndexOf("/") + 1) : key;
    const lower = name.toLowerCase();
    if (wantNames.some((w) => lower === w || lower.includes(w) || w.includes(lower))) {
      return key;
    }
  }

  // Last resort: if only one object in folder, use it
  if (folder && contents.length === 1 && contents[0].Key) {
    return contents[0].Key;
  }

  const err = new Error(
    `File not found in storage (tried key: ${primary || "unknown"}). The object may have been deleted or uploaded to a different path.`,
  );
  err.code = "NoSuchKey";
  throw err;
}

export async function getObjectStream(objectKey) {
  const client = getInternalS3Client();
  const result = await client.send(
    new GetObjectCommand({
      Bucket: getMinioBucket(),
      Key: objectKey,
    }),
  );
  return result;
}

export async function deleteMinioObject(objectKey) {
  if (!objectKey) return;
  const client = getInternalS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getMinioBucket(),
      Key: objectKey,
    }),
  );
}

export function guessContentType(fileName) {
  const ext = String(fileName || "").split(".").pop()?.toLowerCase();
  const map = {
    pdf: "application/pdf",
    zip: "application/zip",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return map[ext] || "application/octet-stream";
}
