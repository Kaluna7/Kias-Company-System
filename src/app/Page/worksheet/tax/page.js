"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import WorksheetDeptPage from "../_components/WorksheetDeptPage";

function TaxWorksheetPageContent() {
  return (
    <WorksheetDeptPage
      apiPath="/api/worksheet/tax"
      headerLabel="B.1.6 WORKSHEET - TAX"
      departmentValue="TAX"
      uploadDepartment="tax"
    />
  );
}

export default function TaxWorksheetPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <TaxWorksheetPageContent />
    </Suspense>
  );
}
