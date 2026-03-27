import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function WHSAuditFindingPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { data: initialData, meta: initialMeta } = await loadAuditFindingInitialData("whs", year);
  return (
    <AuditFindingDeptClient
      apiPath="whs"
      titleCode="B.2.11"
      departmentLabel="WAREHOUSE"
      description="Document and track warehouse audit findings and recommendations"
      initialData={initialData}
      initialMeta={initialMeta}
    />
  );
}


