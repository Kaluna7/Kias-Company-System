"use client";
export const dynamic = "force-dynamic";

import EvidenceDeptPage from "../_components/EvidenceDeptPage";

export default function HRDEvidence() {
  return (
    <EvidenceDeptPage
      departmentLabel="HRD"
      evidenceApiSlug="hrd"
      dashboardLabel="HRD"
    />
  );
}


