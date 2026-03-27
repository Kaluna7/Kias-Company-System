"use client";
export const dynamic = "force-dynamic";

import EvidenceDeptPage from "../_components/EvidenceDeptPage";

export default function MerchEvidence() {
  return (
    <EvidenceDeptPage
      departmentLabel="MERCHANDISE"
      evidenceApiSlug="merch"
      dashboardLabel="Merchandise"
    />
  );
}


