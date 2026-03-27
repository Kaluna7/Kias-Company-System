import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function HRDAuditFindingPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { data: initialData, meta: initialMeta } = await loadAuditFindingInitialData("hrd", year);
  return (
    <AuditFindingDeptClient
      apiPath="hrd"
      titleCode="B.2.3"
      departmentLabel="HRD"
      description="Document and track HRD audit findings and recommendations"
      initialData={initialData}
      initialMeta={initialMeta}
    />
  );
}


