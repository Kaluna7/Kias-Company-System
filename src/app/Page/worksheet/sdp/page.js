"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import WorksheetDeptPage from "../_components/WorksheetDeptPage";

function SDPWorksheetPageContent() {
  return (
    <WorksheetDeptPage
      apiPath="/api/worksheet/sdp"
      headerLabel="B.1.5 WORKSHEET - DESIGN STORE PLANNER"
      departmentValue="DESIGN STORE PLANNER"
      uploadDepartment="sdp"
    />
  );
}

export default function SDPWorksheetPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <SDPWorksheetPageContent />
    </Suspense>
  );
}
