import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function HRDAuditFindingPage() {
  const initialData = await loadAuditFindingInitialData("hrd");
  return (
    <AuditFindingDeptClient
      apiPath="hrd"
      titleCode="B.2.3"
      departmentLabel="HRD"
      description="Document and track HRD audit findings and recommendations"
      initialData={initialData}
    />
  );
}


