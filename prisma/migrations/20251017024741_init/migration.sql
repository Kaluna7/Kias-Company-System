-- CreateTable
CREATE TABLE "public"."notes" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finance" (
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

    CONSTRAINT "finance_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "public"."accounting" (
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

    CONSTRAINT "accounting_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "public"."general_affair" (
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

    CONSTRAINT "general_affair_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "public"."hrd" (
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

    CONSTRAINT "hrd_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "public"."lp" (
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

    CONSTRAINT "lp_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "public"."merchandise" (
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

    CONSTRAINT "merchandise_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "public"."mis" (
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

    CONSTRAINT "mis_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "public"."operational" (
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

    CONSTRAINT "operational_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "public"."sdp" (
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

    CONSTRAINT "sdp_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "public"."tax" (
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

    CONSTRAINT "tax_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "public"."warehouse" (
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

    CONSTRAINT "warehouse_pkey" PRIMARY KEY ("risk_id")
);
