import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const EVIDENCE_MAX_BYTES = 8 * 1024 * 1024 * 1024;

const STORAGE_PREFIX = "/api/evidence/storage/";

let clientSingleton = null;

export function isMinioEnabled() {
  return Boolean(
    process.env.MINIO_ENDPOINT &&
      process.env.MINIO_ACCESS_KEY &&
      process.env.MINIO_SECRET_KEY &&
      process.env.MINIO_BUCKET,
  );
}

function getS3Client() {
  if (!isMinioEnabled()) {
    throw new Error("MinIO is not configured");
  }
  if (!clientSingleton) {
    clientSingleton = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT,
      region: process.env.MINIO_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY,
        secretAccessKey: process.env.MINIO_SECRET_KEY,
      },
      forcePathStyle: true,
    });
  }
  return clientSingleton;
}

export function getMinioBucket() {
  return process.env.MINIO_BUCKET || "evidence";
}

export async function ensureMinioBucket() {
  const client = getS3Client();
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

export function objectKeyFromFileUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") return null;
  if (fileUrl.startsWith(STORAGE_PREFIX)) {
    const raw = fileUrl.slice(STORAGE_PREFIX.length);
    return raw
      .split("/")
      .map((s) => decodeURIComponent(s))
      .join("/");
  }
  const publicBase = (process.env.MINIO_PUBLIC_URL || "").replace(/\/$/, "");
  const bucket = getMinioBucket();
  if (publicBase && fileUrl.startsWith(`${publicBase}/${bucket}/`)) {
    return fileUrl.slice(`${publicBase}/${bucket}/`.length);
  }
  return null;
}

export async function createPresignedPutUrl(objectKey, contentType, expiresInSeconds = 86400) {
  await ensureMinioBucket();
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: getMinioBucket(),
    Key: objectKey,
    ContentType: contentType || "application/octet-stream",
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  return uploadUrl;
}

export async function headMinioObject(objectKey) {
  const client = getS3Client();
  await client.send(
    new HeadObjectCommand({
      Bucket: getMinioBucket(),
      Key: objectKey,
    }),
  );
}

export async function getObjectStream(objectKey) {
  const client = getS3Client();
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
  const client = getS3Client();
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
