"use client";
export const dynamic = "force-dynamic";

import EvidenceDeptPage from "../_components/EvidenceDeptPage";

export default function FinanceEvidence() {
  return (
    <EvidenceDeptPage
      departmentLabel="FINANCE"
      evidenceApiSlug="finance"
      dashboardLabel="Finance"
    />
  );
}

