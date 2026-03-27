import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function LPAuditFindingPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { data: initialData, meta: initialMeta } = await loadAuditFindingInitialData("l&p", year);
  return (
    <AuditFindingDeptClient
      apiPath="l&p"
      titleCode="B.2.7"
      departmentLabel="SECURITY L&P"
      description="Document and track security L&P audit findings and recommendations"
      initialData={initialData}
      initialMeta={initialMeta}
    />
  );
}


