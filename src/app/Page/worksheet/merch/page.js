"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import WorksheetDeptPage from "../_components/WorksheetDeptPage";

function MerchandiseWorksheetPageContent() {
  return (
    <WorksheetDeptPage
      apiPath="/api/worksheet/merch"
      headerLabel="B.1.9 WORKSHEET - MERCHANDISE"
      departmentValue="MERCHANDISE"
      uploadDepartment="merch"
    />
  );
}

export default function MerchandiseWorksheetPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <MerchandiseWorksheetPageContent />
    </Suspense>
  );
}
