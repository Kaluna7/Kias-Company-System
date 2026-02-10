"use client";

import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";

export default function AccountingClient({ initialData = [] }) {
  return (
    <AuditFindingDeptClient
      apiPath="accounting"
      titleCode="B.2.2"
      departmentLabel="ACCOUNTING"
      description="Document and track accounting audit findings and recommendations"
      initialData={initialData}
    />
  );
}

