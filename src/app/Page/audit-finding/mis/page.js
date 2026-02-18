import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function MISAuditFindingPage() {
  const { data: initialData, meta: initialMeta } = await loadAuditFindingInitialData("mis");
  return (
    <AuditFindingDeptClient
      apiPath="mis"
      titleCode="B.2.8"
      departmentLabel="MIS"
      description="Document and track MIS audit findings and recommendations"
      initialData={initialData}
      initialMeta={initialMeta}
    />
  );
}


