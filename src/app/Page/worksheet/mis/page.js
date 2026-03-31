"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import WorksheetDeptPage from "../_components/WorksheetDeptPage";

function MISWorksheetPageContent() {
  return (
    <WorksheetDeptPage
      apiPath="/api/worksheet/mis"
      headerLabel="B.1.8 WORKSHEET - MIS"
      departmentValue="MIS"
      uploadDepartment="mis"
    />
  );
}

export default function MISWorksheetPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <MISWorksheetPageContent />
    </Suspense>
  );
}
