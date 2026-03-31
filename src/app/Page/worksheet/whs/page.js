"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import WorksheetDeptPage from "../_components/WorksheetDeptPage";

function WarehouseWorksheetPageContent() {
  return (
    <WorksheetDeptPage
      apiPath="/api/worksheet/whs"
      headerLabel="B.1.11 WORKSHEET - WAREHOUSE"
      departmentValue="WAREHOUSE"
      uploadDepartment="whs"
    />
  );
}

export default function WarehouseWorksheetPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <WarehouseWorksheetPageContent />
    </Suspense>
  );
}
