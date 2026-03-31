"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import WorksheetDeptPage from "../_components/WorksheetDeptPage";

function AccountingWorksheetPageContent() {
  return (
    <WorksheetDeptPage
      apiPath="/api/worksheet/accounting"
      headerLabel="B.1.2 WORKSHEET - ACCOUNTING"
      departmentValue="ACCOUNTING"
      uploadDepartment="accounting"
    />
  );
}

export default function AccountingWorksheetPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <AccountingWorksheetPageContent />
    </Suspense>
  );
}
