"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import WorksheetDeptPage from "../_components/WorksheetDeptPage";

function LPWorksheetPageContent() {
  return (
    <WorksheetDeptPage
      apiPath="/api/worksheet/l&p"
      headerLabel="B.1.7 WORKSHEET - SECURITY L&P"
      departmentValue="SECURITY L&P"
      uploadDepartment="l&p"
    />
  );
}

export default function LPWorksheetPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <LPWorksheetPageContent />
    </Suspense>
  );
}
