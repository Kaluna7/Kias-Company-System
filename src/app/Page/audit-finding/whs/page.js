import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function WHSAuditFindingPage() {
  const initialData = await loadAuditFindingInitialData("whs");
  return (
    <AuditFindingDeptClient
      apiPath="whs"
      titleCode="B.2.11"
      departmentLabel="WAREHOUSE"
      description="Document and track warehouse audit findings and recommendations"
      initialData={initialData}
    />
  );
}


