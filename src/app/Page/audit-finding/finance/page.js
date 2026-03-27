import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function FinanceAuditFindingPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { data: initialData, meta: initialMeta } = await loadAuditFindingInitialData("finance", year);
  return (
    <AuditFindingDeptClient
      apiPath="finance"
      titleCode="B.2.1"
      departmentLabel="FINANCE"
      description="Document and track finance audit findings and recommendations"
      initialData={initialData}
      initialMeta={initialMeta}
    />
  );
}


