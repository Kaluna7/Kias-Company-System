"use client";
export const dynamic = "force-dynamic";

import EvidenceDeptPage from "../_components/EvidenceDeptPage";

export default function OpsEvidence() {
  return (
    <EvidenceDeptPage
      departmentLabel="OPERATIONAL"
      evidenceApiSlug="ops"
      dashboardLabel="Operational"
    />
  );
}

