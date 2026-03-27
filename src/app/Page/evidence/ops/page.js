"use client";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import EvidenceDeptPage from "../_components/EvidenceDeptPage";

export default function OpsEvidence() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <EvidenceDeptPage
        departmentLabel="OPERATIONAL"
        evidenceApiSlug="ops"
        dashboardLabel="Operational"
      />
    </Suspense>
  );
}

