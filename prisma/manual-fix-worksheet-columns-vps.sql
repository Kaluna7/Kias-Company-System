-- === published_to_report (required — fixes "column does not exist" on upload/save) ===
ALTER TABLE "worksheet" ADD COLUMN IF NOT EXISTS "published_to_report" BOOLEAN NOT NULL DEFAULT false;
-- One-time backfill: rows that already existed should stay visible in Report as published
UPDATE "worksheet" SET "published_to_report" = true;

-- Run on VPS PostgreSQL if worksheet save fails with "value is too long" but local works.
-- Cause: DB still has VARCHAR limits; Prisma migrate deploy may not have reached these migrations.
-- Safe to run multiple times (columns already TEXT → no error in PostgreSQL for same type).

ALTER TABLE "worksheet" ALTER COLUMN "audit_area" TYPE TEXT;
ALTER TABLE "worksheet" ALTER COLUMN "status_documents" TYPE TEXT;
ALTER TABLE "worksheet" ALTER COLUMN "file_path" TYPE TEXT;
ALTER TABLE "worksheet" ALTER COLUMN "department" TYPE TEXT;
ALTER TABLE "worksheet" ALTER COLUMN "preparer" TYPE TEXT;
ALTER TABLE "worksheet" ALTER COLUMN "reviewer" TYPE TEXT;
ALTER TABLE "worksheet" ALTER COLUMN "status_worksheet" TYPE TEXT;
ALTER TABLE "worksheet" ALTER COLUMN "status_wp" TYPE TEXT;
