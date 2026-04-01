-- If the app says: column worksheet.published_to_report does not exist
-- Run this ONCE against your production/staging DB (then restart the app).

ALTER TABLE "worksheet" ADD COLUMN IF NOT EXISTS "published_to_report" BOOLEAN NOT NULL DEFAULT false;

-- Existing rows: treat as already published so Report still shows them
UPDATE "worksheet" SET "published_to_report" = true;

-- After this, use `npx prisma migrate deploy` so Prisma history matches (migration 20260331180000),
-- or mark that migration applied if you only ran SQL manually.
