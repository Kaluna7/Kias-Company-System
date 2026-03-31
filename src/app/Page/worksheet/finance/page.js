"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import WorksheetDeptPage from "../_components/WorksheetDeptPage";

function FinanceWorksheetPageContent() {
  return (
    <WorksheetDeptPage
      apiPath="/api/worksheet/finance"
      headerLabel="B.1.1 WORKSHEET - FINANCE"
      departmentValue="FINANCE"
      uploadDepartment="finance"
      enableRoleRestrictions
    />
  );
}

export default function FinanceWorksheet() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <FinanceWorksheetPageContent />
    </Suspense>
  );
}

