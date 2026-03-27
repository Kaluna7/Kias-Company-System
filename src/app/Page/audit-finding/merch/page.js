import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function MerchAuditFindingPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { data: initialData, meta: initialMeta } = await loadAuditFindingInitialData("merch", year);
  return (
    <AuditFindingDeptClient
      apiPath="merch"
      titleCode="B.2.9"
      departmentLabel="MERCHANDISE"
      description="Document and track merchandise audit findings and recommendations"
      initialData={initialData}
      initialMeta={initialMeta}
    />
  );
}


