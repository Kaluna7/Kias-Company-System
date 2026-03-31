"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import WorksheetDeptPage from "../_components/WorksheetDeptPage";

function GAWorksheetPageContent() {
  return (
    <WorksheetDeptPage
      apiPath="/api/worksheet/g&a"
      headerLabel="B.1.4 WORKSHEET - G&A"
      departmentValue="G&A"
      uploadDepartment="g&a"
    />
  );
}

export default function GAWorksheetPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <GAWorksheetPageContent />
    </Suspense>
  );
}
