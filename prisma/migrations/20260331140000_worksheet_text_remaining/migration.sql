-- Remaining VARCHAR limits on worksheet (preparer names, department labels, status_wp, etc.)
ALTER TABLE "worksheet" ALTER COLUMN "department" TYPE TEXT;
ALTER TABLE "worksheet" ALTER COLUMN "preparer" TYPE TEXT;
ALTER TABLE "worksheet" ALTER COLUMN "reviewer" TYPE TEXT;
ALTER TABLE "worksheet" ALTER COLUMN "status_worksheet" TYPE TEXT;
ALTER TABLE "worksheet" ALTER COLUMN "status_wp" TYPE TEXT;
