import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function TaxAuditFindingPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { data: initialData, meta: initialMeta } = await loadAuditFindingInitialData("tax", year);
  return (
    <AuditFindingDeptClient
      apiPath="tax"
      titleCode="B.2.6"
      departmentLabel="TAX"
      description="Document and track tax audit findings and recommendations"
      initialData={initialData}
      initialMeta={initialMeta}
    />
  );
}


