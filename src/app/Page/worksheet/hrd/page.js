"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import WorksheetDeptPage from "../_components/WorksheetDeptPage";

function HRDWorksheetPageContent() {
  return (
    <WorksheetDeptPage
      apiPath="/api/worksheet/hrd"
      headerLabel="B.1.3 WORKSHEET - HRD"
      departmentValue="HRD"
      uploadDepartment="hrd"
    />
  );
}

export default function HRDWorksheetPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <HRDWorksheetPageContent />
    </Suspense>
  );
}
