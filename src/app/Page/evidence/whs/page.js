"use client";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import EvidenceDeptPage from "../_components/EvidenceDeptPage";

export default function WHSEvidence() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <EvidenceDeptPage
        departmentLabel="WAREHOUSE"
        evidenceApiSlug="whs"
        dashboardLabel="Warehouse"
      />
    </Suspense>
  );
}


