import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function MerchAuditFindingPage() {
  const { data: initialData, meta: initialMeta } = await loadAuditFindingInitialData("merch");
  return (
    <AuditFindingDeptClient
      apiPath="merch"
      titleCode="B.2.9"
      departmentLabel="MERCHANDISE"
      description="Document and track merchandise audit findings and recommendations"
      initialData={initialData}
      initialMeta={initialMeta}
    />
  );
}


