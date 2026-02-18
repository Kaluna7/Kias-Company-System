import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function FinanceAuditFindingPage() {
  const { data: initialData, meta: initialMeta } = await loadAuditFindingInitialData("finance");
  return (
    <AuditFindingDeptClient
      apiPath="finance"
      titleCode="B.2.1"
      departmentLabel="FINANCE"
      description="Document and track finance audit findings and recommendations"
      initialData={initialData}
      initialMeta={initialMeta}
    />
  );
}


