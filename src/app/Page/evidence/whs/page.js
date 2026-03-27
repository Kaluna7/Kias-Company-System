"use client";
export const dynamic = "force-dynamic";

import EvidenceDeptPage from "../_components/EvidenceDeptPage";

export default function WHSEvidence() {
  return (
    <EvidenceDeptPage
      departmentLabel="WAREHOUSE"
      evidenceApiSlug="whs"
      dashboardLabel="Warehouse"
    />
  );
}


