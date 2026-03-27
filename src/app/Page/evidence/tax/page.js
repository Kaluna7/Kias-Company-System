"use client";
export const dynamic = "force-dynamic";

import EvidenceDeptPage from "../_components/EvidenceDeptPage";

export default function TaxEvidence() {
  return (
    <EvidenceDeptPage
      departmentLabel="TAX"
      evidenceApiSlug="tax"
      dashboardLabel="Tax"
    />
  );
}


