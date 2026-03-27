"use client";
export const dynamic = "force-dynamic";

import EvidenceDeptPage from "../_components/EvidenceDeptPage";

export default function LPEvidence() {
  return (
    <EvidenceDeptPage
      departmentLabel="L&P"
      evidenceApiSlug="l&p"
      dashboardLabel="L & P"
    />
  );
}


