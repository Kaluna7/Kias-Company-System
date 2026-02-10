import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function LPAuditFindingPage() {
  const initialData = await loadAuditFindingInitialData("l&p");
  return (
    <AuditFindingDeptClient
      apiPath="l&p"
      titleCode="B.2.7"
      departmentLabel="SECURITY L&P"
      description="Document and track security L&P audit findings and recommendations"
      initialData={initialData}
    />
  );
}


