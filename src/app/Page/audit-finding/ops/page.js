import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function OpsAuditFindingPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { data: initialData, meta: initialMeta } = await loadAuditFindingInitialData("ops", year);
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


