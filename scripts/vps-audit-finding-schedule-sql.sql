-- =============================================================================
-- Manual SQL for VPS (PostgreSQL) — Audit Finding report schedule snapshot
-- Run if you prefer raw SQL instead of: npx prisma migrate deploy
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- =============================================================================

-- Migration: 20260331220000_audit_finding_report_schedule_snapshot
-- Snapshot schedule + fieldwork dates at publish (per row).

ALTER TABLE "audit_finding_accounting" ADD COLUMN IF NOT EXISTS "report_audit_period_start" DATE;
ALTER TABLE "audit_finding_accounting" ADD COLUMN IF NOT EXISTS "report_audit_period_end" DATE;
ALTER TABLE "audit_finding_accounting" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_start" DATE;
ALTER TABLE "audit_finding_accounting" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_end" DATE;

ALTER TABLE "audit_finding_finance" ADD COLUMN IF NOT EXISTS "report_audit_period_start" DATE;
ALTER TABLE "audit_finding_finance" ADD COLUMN IF NOT EXISTS "report_audit_period_end" DATE;
ALTER TABLE "audit_finding_finance" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_start" DATE;
ALTER TABLE "audit_finding_finance" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_end" DATE;

ALTER TABLE "audit_finding_hrd" ADD COLUMN IF NOT EXISTS "report_audit_period_start" DATE;
ALTER TABLE "audit_finding_hrd" ADD COLUMN IF NOT EXISTS "report_audit_period_end" DATE;
ALTER TABLE "audit_finding_hrd" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_start" DATE;
ALTER TABLE "audit_finding_hrd" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_end" DATE;

ALTER TABLE "audit_finding_ga" ADD COLUMN IF NOT EXISTS "report_audit_period_start" DATE;
ALTER TABLE "audit_finding_ga" ADD COLUMN IF NOT EXISTS "report_audit_period_end" DATE;
ALTER TABLE "audit_finding_ga" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_start" DATE;
ALTER TABLE "audit_finding_ga" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_end" DATE;

ALTER TABLE "audit_finding_sdp" ADD COLUMN IF NOT EXISTS "report_audit_period_start" DATE;
ALTER TABLE "audit_finding_sdp" ADD COLUMN IF NOT EXISTS "report_audit_period_end" DATE;
ALTER TABLE "audit_finding_sdp" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_start" DATE;
ALTER TABLE "audit_finding_sdp" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_end" DATE;

ALTER TABLE "audit_finding_tax" ADD COLUMN IF NOT EXISTS "report_audit_period_start" DATE;
ALTER TABLE "audit_finding_tax" ADD COLUMN IF NOT EXISTS "report_audit_period_end" DATE;
ALTER TABLE "audit_finding_tax" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_start" DATE;
ALTER TABLE "audit_finding_tax" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_end" DATE;

ALTER TABLE "audit_finding_lp" ADD COLUMN IF NOT EXISTS "report_audit_period_start" DATE;
ALTER TABLE "audit_finding_lp" ADD COLUMN IF NOT EXISTS "report_audit_period_end" DATE;
ALTER TABLE "audit_finding_lp" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_start" DATE;
ALTER TABLE "audit_finding_lp" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_end" DATE;

ALTER TABLE "audit_finding_mis" ADD COLUMN IF NOT EXISTS "report_audit_period_start" DATE;
ALTER TABLE "audit_finding_mis" ADD COLUMN IF NOT EXISTS "report_audit_period_end" DATE;
ALTER TABLE "audit_finding_mis" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_start" DATE;
ALTER TABLE "audit_finding_mis" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_end" DATE;

ALTER TABLE "audit_finding_merch" ADD COLUMN IF NOT EXISTS "report_audit_period_start" DATE;
ALTER TABLE "audit_finding_merch" ADD COLUMN IF NOT EXISTS "report_audit_period_end" DATE;
ALTER TABLE "audit_finding_merch" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_start" DATE;
ALTER TABLE "audit_finding_merch" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_end" DATE;

ALTER TABLE "audit_finding_ops" ADD COLUMN IF NOT EXISTS "report_audit_period_start" DATE;
ALTER TABLE "audit_finding_ops" ADD COLUMN IF NOT EXISTS "report_audit_period_end" DATE;
ALTER TABLE "audit_finding_ops" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_start" DATE;
ALTER TABLE "audit_finding_ops" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_end" DATE;

ALTER TABLE "audit_finding_whs" ADD COLUMN IF NOT EXISTS "report_audit_period_start" DATE;
ALTER TABLE "audit_finding_whs" ADD COLUMN IF NOT EXISTS "report_audit_period_end" DATE;
ALTER TABLE "audit_finding_whs" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_start" DATE;
ALTER TABLE "audit_finding_whs" ADD COLUMN IF NOT EXISTS "report_audit_fieldwork_end" DATE;

-- Migration: 20260331233000_schedule_module_feedback_history
-- Append-only history when saving Audit Finding dates in Schedule UI.

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
