import AuditFindingDeptClient from "@/app/Page/audit-finding/_components/AuditFindingDeptClient";
import { loadAuditFindingInitialData } from "../_components/loadAuditFindingInitialData";

export default async function SDPAuditFindingPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { data: initialData, meta: initialMeta } = await loadAuditFindingInitialData("sdp", year);
  return (
    <AuditFindingDeptClient
      apiPath="sdp"
      titleCode="B.2.5"
      departmentLabel="STORE DESIGN PLANNER"
      description="Document and track store design planner audit findings and recommendations"
      initialData={initialData}
      initialMeta={initialMeta}
    />
  );
}


