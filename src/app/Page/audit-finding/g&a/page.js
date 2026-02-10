import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function GAAuditFindingPage() {
  const initialData = await loadAuditFindingInitialData("g&a");
  return (
    <AuditFindingDeptClient
      apiPath="g&a"
      titleCode="B.2.4"
      departmentLabel="G&A"
      description="Document and track G&A audit findings and recommendations"
      initialData={initialData}
    />
  );
}


