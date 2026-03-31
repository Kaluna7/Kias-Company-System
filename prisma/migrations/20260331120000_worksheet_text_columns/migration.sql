-- Long audit area lists and document notes exceed VARCHAR(100); file URLs can be long.
ALTER TABLE "worksheet" ALTER COLUMN "audit_area" TYPE TEXT;
ALTER TABLE "worksheet" ALTER COLUMN "status_documents" TYPE TEXT;
ALTER TABLE "worksheet" ALTER COLUMN "file_path" TYPE TEXT;
