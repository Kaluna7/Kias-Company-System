import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function TaxAuditFindingPage() {
  const initialData = await loadAuditFindingInitialData("tax");
  return (
    <AuditFindingDeptClient
      apiPath="tax"
      titleCode="B.2.6"
      departmentLabel="TAX"
      description="Document and track tax audit findings and recommendations"
      initialData={initialData}
    />
  );
}


