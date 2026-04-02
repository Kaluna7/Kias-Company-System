-- Append-only history of module schedule saves (audit-finding dates at save time).
-- Used by audit-finding report when row snapshot columns are NULL (e.g. published before snapshot existed).

CREATE TABLE IF NOT EXISTS "schedule_module_feedback_history" (
  "id" SERIAL PRIMARY KEY,
  "module_key" VARCHAR(32) NOT NULL,
  "department_id" VARCHAR(20) NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_smfh_module_dept_created"
  ON "schedule_module_feedback_history" ("module_key", "department_id", "created_at" DESC);
