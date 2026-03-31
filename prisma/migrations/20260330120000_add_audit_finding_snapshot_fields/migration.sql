ALTER TABLE "audit_finding_accounting"
ADD COLUMN "owners" VARCHAR(35),
ADD COLUMN "objective" TEXT,
ADD COLUMN "procedures" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "application" TEXT;

ALTER TABLE "audit_finding_finance"
ADD COLUMN "owners" VARCHAR(35),
ADD COLUMN "objective" TEXT,
ADD COLUMN "procedures" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "application" TEXT;

ALTER TABLE "audit_finding_hrd"
ADD COLUMN "owners" VARCHAR(35),
ADD COLUMN "objective" TEXT,
ADD COLUMN "procedures" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "application" TEXT;

ALTER TABLE "audit_finding_ga"
ADD COLUMN "owners" VARCHAR(35),
ADD COLUMN "objective" TEXT,
ADD COLUMN "procedures" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "application" TEXT;

ALTER TABLE "audit_finding_sdp"
ADD COLUMN "owners" VARCHAR(35),
ADD COLUMN "objective" TEXT,
ADD COLUMN "procedures" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "application" TEXT;

ALTER TABLE "audit_finding_tax"
ADD COLUMN "owners" VARCHAR(35),
ADD COLUMN "objective" TEXT,
ADD COLUMN "procedures" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "application" TEXT;

ALTER TABLE "audit_finding_lp"
ADD COLUMN "owners" VARCHAR(35),
ADD COLUMN "objective" TEXT,
ADD COLUMN "procedures" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "application" TEXT;

ALTER TABLE "audit_finding_mis"
ADD COLUMN "owners" VARCHAR(35),
ADD COLUMN "objective" TEXT,
ADD COLUMN "procedures" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "application" TEXT;

ALTER TABLE "audit_finding_merch"
ADD COLUMN "owners" VARCHAR(35),
ADD COLUMN "objective" TEXT,
ADD COLUMN "procedures" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "application" TEXT;

ALTER TABLE "audit_finding_ops"
ADD COLUMN "owners" VARCHAR(35),
ADD COLUMN "objective" TEXT,
ADD COLUMN "procedures" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "application" TEXT;

ALTER TABLE "audit_finding_whs"
ADD COLUMN "owners" VARCHAR(35),
ADD COLUMN "objective" TEXT,
ADD COLUMN "procedures" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "application" TEXT;
