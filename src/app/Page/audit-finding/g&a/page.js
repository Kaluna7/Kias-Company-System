import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function GAAuditFindingPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { data: initialData, meta: initialMeta } = await loadAuditFindingInitialData("g&a", year);
  return (
    <AuditFindingDeptClient
      apiPath="g&a"
      titleCode="B.2.4"
      departmentLabel="G&A"
      description="Document and track G&A audit findings and recommendations"
      initialData={initialData}
      initialMeta={initialMeta}
    />
  );
}


