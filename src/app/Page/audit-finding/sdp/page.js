import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function SDPAuditFindingPage() {
  const initialData = await loadAuditFindingInitialData("sdp");
  return (
    <AuditFindingDeptClient
      apiPath="sdp"
      titleCode="B.2.5"
      departmentLabel="STORE DESIGN PLANNER"
      description="Document and track store design planner audit findings and recommendations"
      initialData={initialData}
    />
  );
}


