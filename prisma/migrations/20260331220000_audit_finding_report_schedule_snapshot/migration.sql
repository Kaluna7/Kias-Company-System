-- Snapshot schedule + fieldwork dates at publish (per row); report no longer follows "current" schedule only.

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
