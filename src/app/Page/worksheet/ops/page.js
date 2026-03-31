"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import WorksheetDeptPage from "../_components/WorksheetDeptPage";

function OperationalWorksheetPageContent() {
  return (
    <WorksheetDeptPage
      apiPath="/api/worksheet/ops"
      headerLabel="B.1.10 WORKSHEET - OPERATIONAL"
      departmentValue="OPERATIONAL"
      uploadDepartment="ops"
    />
  );
}

export default function OperationalWorksheetPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <OperationalWorksheetPageContent />
    </Suspense>
  );
}
