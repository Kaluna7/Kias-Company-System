"use client";
export const dynamic = "force-dynamic";

import EvidenceDeptPage from "../_components/EvidenceDeptPage";

export default function GAEvidence() {
  return (
    <EvidenceDeptPage
      departmentLabel="G&A"
      evidenceApiSlug="g&a"
      dashboardLabel="General Affair"
    />
  );
}


