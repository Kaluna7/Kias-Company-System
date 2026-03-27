"use client";
export const dynamic = "force-dynamic";

import EvidenceDeptPage from "../_components/EvidenceDeptPage";

export default function SDPEvidence() {
  return (
    <EvidenceDeptPage
      departmentLabel="SDP"
      evidenceApiSlug="sdp"
      dashboardLabel="Store Design Planner"
    />
  );
}


