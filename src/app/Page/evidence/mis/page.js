"use client";
export const dynamic = "force-dynamic";

import EvidenceDeptPage from "../_components/EvidenceDeptPage";

export default function MISEvidence() {
  return (
    <EvidenceDeptPage
      departmentLabel="MIS"
      evidenceApiSlug="mis"
      dashboardLabel="MIS"
    />
  );
}


