import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function OpsAuditFindingPage() {
  const { data: initialData, meta: initialMeta } = await loadAuditFindingInitialData("ops");
  return (
    <AuditFindingDeptClient
      apiPath="ops"
      titleCode="B.2.10"
      departmentLabel="OPERATIONAL"
      description="Document and track operational audit findings and recommendations"
      initialData={initialData}
      initialMeta={initialMeta}
    />
  );
}


