"use client";
export const dynamic = "force-dynamic";

import EvidenceDeptPage from "../_components/EvidenceDeptPage";

export default function AccountingEvidence() {
  return (
    <EvidenceDeptPage
      departmentLabel="ACCOUNTING"
      evidenceApiSlug="accounting"
      dashboardLabel="Accounting"
    />
  );
}

