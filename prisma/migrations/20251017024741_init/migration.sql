-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "notes" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance" (
    "risk_id" SERIAL NOT NULL,
    "category" VARCHAR(50),
    "sub_department" VARCHAR(35),
    "risk_description" TEXT,
    "sop_related" TEXT,
    "risk_details" TEXT,
    "impact_description" TEXT,
    "impact_level" INTEGER,
    "probability_level" INTEGER,
    "priority_level" INTEGER,
    "mitigation_strategy" TEXT,
    "owners" VARCHAR(35),
    "root_cause_category" TEXT,
    "onset_timeframe" VARCHAR(35),
    "risk_id_no" VARCHAR(20),
    "status" VARCHAR(20) DEFAULT 'published',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "accounting" (
    "risk_id" SERIAL NOT NULL,
    "risk_id_no" VARCHAR(20),
    "category" VARCHAR(20),
    "sub_department" VARCHAR(35),
    "sop_related" TEXT,
    "risk_description" TEXT,
    "risk_details" TEXT,
    "impact_description" TEXT,
    "impact_level" INTEGER,
    "probability_level" INTEGER,
    "priority_level" INTEGER,
    "mitigation_strategy" TEXT,
    "owners" VARCHAR(35),
    "root_cause_category" TEXT,
    "onset_timeframe" VARCHAR(35),
    "status" VARCHAR(20) DEFAULT 'published',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "general_affair" (
    "risk_id" SERIAL NOT NULL,
    "risk_id_no" VARCHAR(20),
    "category" VARCHAR(20),
    "sub_department" VARCHAR(35),
    "sop_related" TEXT,
    "risk_description" TEXT,
    "risk_details" TEXT,
    "impact_description" TEXT,
    "impact_level" INTEGER,
    "probability_level" INTEGER,
    "priority_level" INTEGER,
    "mitigation_strategy" TEXT,
    "owners" VARCHAR(35),
    "root_cause_category" TEXT,
    "onset_timeframe" VARCHAR(35),
    "status" VARCHAR(20) DEFAULT 'published',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "general_affair_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "hrd" (
    "risk_id" SERIAL NOT NULL,
    "risk_id_no" VARCHAR(20),
    "category" VARCHAR(20),
    "sub_department" VARCHAR(35),
    "sop_related" TEXT,
    "risk_description" TEXT,
    "risk_details" TEXT,
    "impact_description" TEXT,
    "impact_level" INTEGER,
    "probability_level" INTEGER,
    "priority_level" INTEGER,
    "mitigation_strategy" TEXT,
    "owners" VARCHAR(35),
    "root_cause_category" TEXT,
    "onset_timeframe" VARCHAR(35),
    "status" VARCHAR(20) DEFAULT 'published',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hrd_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "lp" (
    "risk_id" SERIAL NOT NULL,
    "risk_id_no" VARCHAR(20),
    "category" VARCHAR(20),
    "sub_department" VARCHAR(35),
    "sop_related" TEXT,
    "risk_description" TEXT,
    "risk_details" TEXT,
    "impact_description" TEXT,
    "impact_level" INTEGER,
    "probability_level" INTEGER,
    "priority_level" INTEGER,
    "mitigation_strategy" TEXT,
    "owners" VARCHAR(35),
    "root_cause_category" TEXT,
    "onset_timeframe" VARCHAR(35),
    "status" VARCHAR(20) DEFAULT 'published',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "merchandise" (
    "risk_id" SERIAL NOT NULL,
    "risk_id_no" VARCHAR(20),
    "category" VARCHAR(20),
    "sub_department" VARCHAR(35),
    "sop_related" TEXT,
    "risk_description" TEXT,
    "risk_details" TEXT,
    "impact_description" TEXT,
    "impact_level" INTEGER,
    "probability_level" INTEGER,
    "priority_level" INTEGER,
    "mitigation_strategy" TEXT,
    "owners" VARCHAR(35),
    "root_cause_category" TEXT,
    "onset_timeframe" VARCHAR(35),
    "status" VARCHAR(20) DEFAULT 'published',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchandise_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "mis" (
    "risk_id" SERIAL NOT NULL,
    "risk_id_no" VARCHAR(20),
    "category" VARCHAR(20),
    "sub_department" VARCHAR(35),
    "sop_related" TEXT,
    "risk_description" TEXT,
    "risk_details" TEXT,
    "impact_description" TEXT,
    "impact_level" INTEGER,
    "probability_level" INTEGER,
    "priority_level" INTEGER,
    "mitigation_strategy" TEXT,
    "owners" VARCHAR(35),
    "root_cause_category" TEXT,
    "onset_timeframe" VARCHAR(35),
    "status" VARCHAR(20) DEFAULT 'published',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mis_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "operational" (
    "risk_id" SERIAL NOT NULL,
    "risk_id_no" VARCHAR(20),
    "category" VARCHAR(20),
    "sub_department" VARCHAR(35),
    "sop_related" TEXT,
    "risk_description" TEXT,
    "risk_details" TEXT,
    "impact_description" TEXT,
    "impact_level" INTEGER,
    "probability_level" INTEGER,
    "priority_level" INTEGER,
    "mitigation_strategy" TEXT,
    "owners" VARCHAR(35),
    "root_cause_category" TEXT,
    "onset_timeframe" VARCHAR(35),
    "status" VARCHAR(20) DEFAULT 'published',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "sdp" (
    "risk_id" SERIAL NOT NULL,
    "risk_id_no" VARCHAR(20),
    "category" VARCHAR(20),
    "sub_department" VARCHAR(35),
    "sop_related" TEXT,
    "risk_description" TEXT,
    "risk_details" TEXT,
    "impact_description" TEXT,
    "impact_level" INTEGER,
    "probability_level" INTEGER,
    "priority_level" INTEGER,
    "mitigation_strategy" TEXT,
    "owners" VARCHAR(35),
    "root_cause_category" TEXT,
    "onset_timeframe" VARCHAR(35),
    "status" VARCHAR(20) DEFAULT 'published',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sdp_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "tax" (
    "risk_id" SERIAL NOT NULL,
    "risk_id_no" VARCHAR(20),
    "category" VARCHAR(20),
    "sub_department" VARCHAR(35),
    "sop_related" TEXT,
    "risk_description" TEXT,
    "risk_details" TEXT,
    "impact_description" TEXT,
    "impact_level" INTEGER,
    "probability_level" INTEGER,
    "priority_level" INTEGER,
    "mitigation_strategy" TEXT,
    "owners" VARCHAR(35),
    "root_cause_category" TEXT,
    "onset_timeframe" VARCHAR(35),
    "status" VARCHAR(20) DEFAULT 'published',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "warehouse" (
    "risk_id" SERIAL NOT NULL,
    "risk_id_no" VARCHAR(20),
    "category" VARCHAR(20),
    "sub_department" VARCHAR(35),
    "sop_related" TEXT,
    "risk_description" TEXT,
    "risk_details" TEXT,
    "impact_description" TEXT,
    "impact_level" INTEGER,
    "probability_level" INTEGER,
    "priority_level" INTEGER,
    "mitigation_strategy" TEXT,
    "owners" VARCHAR(35),
    "root_cause_category" TEXT,
    "onset_timeframe" VARCHAR(35),
    "status" VARCHAR(20) DEFAULT 'published',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "finance_ap" (
    "ap_id" SERIAL NOT NULL,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "objective" TEXT,
    "procedures" TEXT,
    "method" TEXT,
    "description" TEXT,
    "application" TEXT,
    "finance_risk_id" INTEGER NOT NULL,

    CONSTRAINT "finance_ap_pkey" PRIMARY KEY ("ap_id")
);

-- CreateTable
CREATE TABLE "accounting_ap" (
    "ap_id" SERIAL NOT NULL,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "objective" TEXT,
    "procedures" TEXT,
    "method" TEXT,
    "description" TEXT,
    "application" TEXT,
    "accounting_risk_id" INTEGER NOT NULL,

    CONSTRAINT "accounting_ap_pkey" PRIMARY KEY ("ap_id")
);

-- CreateTable
CREATE TABLE "general_affair_ap" (
    "ap_id" SERIAL NOT NULL,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "objective" TEXT,
    "procedures" TEXT,
    "method" TEXT,
    "description" TEXT,
    "application" TEXT,
    "general_affair_risk_id" INTEGER NOT NULL,

    CONSTRAINT "general_affair_ap_pkey" PRIMARY KEY ("ap_id")
);

-- CreateTable
CREATE TABLE "hrd_ap" (
    "ap_id" SERIAL NOT NULL,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "objective" TEXT,
    "procedures" TEXT,
    "method" TEXT,
    "description" TEXT,
    "application" TEXT,
    "hrd_risk_id" INTEGER NOT NULL,

    CONSTRAINT "hrd_ap_pkey" PRIMARY KEY ("ap_id")
);

-- CreateTable
CREATE TABLE "lp_ap" (
    "ap_id" SERIAL NOT NULL,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "objective" TEXT,
    "procedures" TEXT,
    "method" TEXT,
    "description" TEXT,
    "application" TEXT,
    "lp_risk_id" INTEGER NOT NULL,

    CONSTRAINT "lp_ap_pkey" PRIMARY KEY ("ap_id")
);

-- CreateTable
CREATE TABLE "merchandise_ap" (
    "ap_id" SERIAL NOT NULL,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "objective" TEXT,
    "procedures" TEXT,
    "method" TEXT,
    "description" TEXT,
    "application" TEXT,
    "merchandise_risk_id" INTEGER NOT NULL,

    CONSTRAINT "merchandise_ap_pkey" PRIMARY KEY ("ap_id")
);

-- CreateTable
CREATE TABLE "mis_ap" (
    "ap_id" SERIAL NOT NULL,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "objective" TEXT,
    "procedures" TEXT,
    "method" TEXT,
    "description" TEXT,
    "application" TEXT,
    "mis_risk_id" INTEGER NOT NULL,

    CONSTRAINT "mis_ap_pkey" PRIMARY KEY ("ap_id")
);

-- CreateTable
CREATE TABLE "operational_ap" (
    "ap_id" SERIAL NOT NULL,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "objective" TEXT,
    "procedures" TEXT,
    "method" TEXT,
    "description" TEXT,
    "application" TEXT,
    "operational_risk_id" INTEGER NOT NULL,

    CONSTRAINT "operational_ap_pkey" PRIMARY KEY ("ap_id")
);

-- CreateTable
CREATE TABLE "sdp_ap" (
    "ap_id" SERIAL NOT NULL,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "objective" TEXT,
    "procedures" TEXT,
    "method" TEXT,
    "description" TEXT,
    "application" TEXT,
    "sdp_risk_id" INTEGER NOT NULL,

    CONSTRAINT "sdp_ap_pkey" PRIMARY KEY ("ap_id")
);

-- CreateTable
CREATE TABLE "tax_ap" (
    "ap_id" SERIAL NOT NULL,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "objective" TEXT,
    "procedures" TEXT,
    "method" TEXT,
    "description" TEXT,
    "application" TEXT,
    "tax_risk_id" INTEGER NOT NULL,

    CONSTRAINT "tax_ap_pkey" PRIMARY KEY ("ap_id")
);

-- CreateTable
CREATE TABLE "warehouse_ap" (
    "ap_id" SERIAL NOT NULL,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "objective" TEXT,
    "procedures" TEXT,
    "method" TEXT,
    "description" TEXT,
    "application" TEXT,
    "warehouse_risk_id" INTEGER NOT NULL,

    CONSTRAINT "warehouse_ap_pkey" PRIMARY KEY ("ap_id")
);

-- CreateTable
CREATE TABLE "sop_finance" (
    "id" SERIAL NOT NULL,
    "department_name" TEXT DEFAULT 'Finance',
    "sop_status" VARCHAR(50),
    "preparer_status" VARCHAR(50),
    "preparer_name" VARCHAR(255),
    "preparer_date" DATE,
    "reviewer_comment" TEXT,
    "reviewer_status" VARCHAR(50),
    "reviewer_name" VARCHAR(255),
    "reviewer_date" DATE,

    CONSTRAINT "sop_finance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sops_finance" (
    "id" SERIAL NOT NULL,
    "no" INTEGER,
    "sop_related" TEXT NOT NULL,
    "status" VARCHAR(50),
    "comment" TEXT,
    "reviewer" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sops_finance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_finding_accounting" (
    "id" SERIAL NOT NULL,
    "risk_id" VARCHAR(50),
    "risk_description" TEXT,
    "risk_details" TEXT,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "risk" INTEGER,
    "check_yn" VARCHAR(10),
    "method" VARCHAR(100),
    "preparer" VARCHAR(255),
    "finding_result" TEXT,
    "finding_description" TEXT,
    "recommendation" TEXT,
    "auditee" VARCHAR(255),
    "completion_status" VARCHAR(50),
    "completion_date" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_finding_accounting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_finding_finance" (
    "id" SERIAL NOT NULL,
    "risk_id" VARCHAR(50),
    "risk_description" TEXT,
    "risk_details" TEXT,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "risk" INTEGER,
    "check_yn" VARCHAR(10),
    "method" VARCHAR(100),
    "preparer" VARCHAR(255),
    "finding_result" TEXT,
    "finding_description" TEXT,
    "recommendation" TEXT,
    "auditee" VARCHAR(255),
    "completion_status" VARCHAR(50),
    "completion_date" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_finding_finance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_finding_hrd" (
    "id" SERIAL NOT NULL,
    "risk_id" VARCHAR(50),
    "risk_description" TEXT,
    "risk_details" TEXT,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "risk" INTEGER,
    "check_yn" VARCHAR(10),
    "method" VARCHAR(100),
    "preparer" VARCHAR(255),
    "finding_result" TEXT,
    "finding_description" TEXT,
    "recommendation" TEXT,
    "auditee" VARCHAR(255),
    "completion_status" VARCHAR(50),
    "completion_date" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_finding_hrd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_finding_ga" (
    "id" SERIAL NOT NULL,
    "risk_id" VARCHAR(50),
    "risk_description" TEXT,
    "risk_details" TEXT,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "risk" INTEGER,
    "check_yn" VARCHAR(10),
    "method" VARCHAR(100),
    "preparer" VARCHAR(255),
    "finding_result" TEXT,
    "finding_description" TEXT,
    "recommendation" TEXT,
    "auditee" VARCHAR(255),
    "completion_status" VARCHAR(50),
    "completion_date" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_finding_ga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_finding_sdp" (
    "id" SERIAL NOT NULL,
    "risk_id" VARCHAR(50),
    "risk_description" TEXT,
    "risk_details" TEXT,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "risk" INTEGER,
    "check_yn" VARCHAR(10),
    "method" VARCHAR(100),
    "preparer" VARCHAR(255),
    "finding_result" TEXT,
    "finding_description" TEXT,
    "recommendation" TEXT,
    "auditee" VARCHAR(255),
    "completion_status" VARCHAR(50),
    "completion_date" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_finding_sdp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_finding_tax" (
    "id" SERIAL NOT NULL,
    "risk_id" VARCHAR(50),
    "risk_description" TEXT,
    "risk_details" TEXT,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "risk" INTEGER,
    "check_yn" VARCHAR(10),
    "method" VARCHAR(100),
    "preparer" VARCHAR(255),
    "finding_result" TEXT,
    "finding_description" TEXT,
    "recommendation" TEXT,
    "auditee" VARCHAR(255),
    "completion_status" VARCHAR(50),
    "completion_date" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_finding_tax_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_finding_lp" (
    "id" SERIAL NOT NULL,
    "risk_id" VARCHAR(50),
    "risk_description" TEXT,
    "risk_details" TEXT,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "risk" INTEGER,
    "check_yn" VARCHAR(10),
    "method" VARCHAR(100),
    "preparer" VARCHAR(255),
    "finding_result" TEXT,
    "finding_description" TEXT,
    "recommendation" TEXT,
    "auditee" VARCHAR(255),
    "completion_status" VARCHAR(50),
    "completion_date" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_finding_lp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_finding_mis" (
    "id" SERIAL NOT NULL,
    "risk_id" VARCHAR(50),
    "risk_description" TEXT,
    "risk_details" TEXT,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "risk" INTEGER,
    "check_yn" VARCHAR(10),
    "method" VARCHAR(100),
    "preparer" VARCHAR(255),
    "finding_result" TEXT,
    "finding_description" TEXT,
    "recommendation" TEXT,
    "auditee" VARCHAR(255),
    "completion_status" VARCHAR(50),
    "completion_date" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_finding_mis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_finding_merch" (
    "id" SERIAL NOT NULL,
    "risk_id" VARCHAR(50),
    "risk_description" TEXT,
    "risk_details" TEXT,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "risk" INTEGER,
    "check_yn" VARCHAR(10),
    "method" VARCHAR(100),
    "preparer" VARCHAR(255),
    "finding_result" TEXT,
    "finding_description" TEXT,
    "recommendation" TEXT,
    "auditee" VARCHAR(255),
    "completion_status" VARCHAR(50),
    "completion_date" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_finding_merch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_finding_ops" (
    "id" SERIAL NOT NULL,
    "risk_id" VARCHAR(50),
    "risk_description" TEXT,
    "risk_details" TEXT,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "risk" INTEGER,
    "check_yn" VARCHAR(10),
    "method" VARCHAR(100),
    "preparer" VARCHAR(255),
    "finding_result" TEXT,
    "finding_description" TEXT,
    "recommendation" TEXT,
    "auditee" VARCHAR(255),
    "completion_status" VARCHAR(50),
    "completion_date" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_finding_ops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_finding_whs" (
    "id" SERIAL NOT NULL,
    "risk_id" VARCHAR(50),
    "risk_description" TEXT,
    "risk_details" TEXT,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "risk" INTEGER,
    "check_yn" VARCHAR(10),
    "method" VARCHAR(100),
    "preparer" VARCHAR(255),
    "finding_result" TEXT,
    "finding_description" TEXT,
    "recommendation" TEXT,
    "auditee" VARCHAR(255),
    "completion_status" VARCHAR(50),
    "completion_date" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_finding_whs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worksheet" (
    "id" SERIAL NOT NULL,
    "department" VARCHAR(100) DEFAULT 'FINANCE',
    "preparer" VARCHAR(255),
    "reviewer" VARCHAR(255),
    "preparer_date" DATE,
    "reviewer_date" DATE,
    "status_documents" VARCHAR(100),
    "status_worksheet" VARCHAR(50) DEFAULT 'IN PROGRESS',
    "status_wp" VARCHAR(50) DEFAULT 'Not Checked',
    "file_path" TEXT,
    "audit_area" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "worksheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" SERIAL NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "preparer" VARCHAR(255),
    "ap_id" INTEGER,
    "ap_code" VARCHAR(50),
    "substantive_test" TEXT,
    "file_url" TEXT,
    "file_name" TEXT,
    "status" VARCHAR(50) DEFAULT 'IN PROGRESS',
    "overall_status" VARCHAR(50) DEFAULT 'IN PROGRESS',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "evidence_department_idx" ON "evidence"("department");

-- CreateIndex
CREATE INDEX "evidence_ap_id_idx" ON "evidence"("ap_id");

-- AddForeignKey
ALTER TABLE "finance_ap" ADD CONSTRAINT "finance_ap_finance_risk_id_fkey" FOREIGN KEY ("finance_risk_id") REFERENCES "finance"("risk_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_ap" ADD CONSTRAINT "accounting_ap_accounting_risk_id_fkey" FOREIGN KEY ("accounting_risk_id") REFERENCES "accounting"("risk_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "general_affair_ap" ADD CONSTRAINT "general_affair_ap_general_affair_risk_id_fkey" FOREIGN KEY ("general_affair_risk_id") REFERENCES "general_affair"("risk_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrd_ap" ADD CONSTRAINT "hrd_ap_hrd_risk_id_fkey" FOREIGN KEY ("hrd_risk_id") REFERENCES "hrd"("risk_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_ap" ADD CONSTRAINT "lp_ap_lp_risk_id_fkey" FOREIGN KEY ("lp_risk_id") REFERENCES "lp"("risk_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchandise_ap" ADD CONSTRAINT "merchandise_ap_merchandise_risk_id_fkey" FOREIGN KEY ("merchandise_risk_id") REFERENCES "merchandise"("risk_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mis_ap" ADD CONSTRAINT "mis_ap_mis_risk_id_fkey" FOREIGN KEY ("mis_risk_id") REFERENCES "mis"("risk_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_ap" ADD CONSTRAINT "operational_ap_operational_risk_id_fkey" FOREIGN KEY ("operational_risk_id") REFERENCES "operational"("risk_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sdp_ap" ADD CONSTRAINT "sdp_ap_sdp_risk_id_fkey" FOREIGN KEY ("sdp_risk_id") REFERENCES "sdp"("risk_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_ap" ADD CONSTRAINT "tax_ap_tax_risk_id_fkey" FOREIGN KEY ("tax_risk_id") REFERENCES "tax"("risk_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_ap" ADD CONSTRAINT "warehouse_ap_warehouse_risk_id_fkey" FOREIGN KEY ("warehouse_risk_id") REFERENCES "warehouse"("risk_id") ON DELETE CASCADE ON UPDATE CASCADE;

