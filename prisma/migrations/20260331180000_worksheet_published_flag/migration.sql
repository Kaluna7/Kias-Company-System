ALTER TABLE "worksheet" ADD COLUMN IF NOT EXISTS "published_to_report" BOOLEAN NOT NULL DEFAULT false;
-- Historical rows already appeared in report; new drafts stay false until POST publish
UPDATE "worksheet" SET "published_to_report" = true;
