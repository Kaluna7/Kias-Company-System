import { getInternalFetchBaseUrl } from "@/lib/getInternalFetchBaseUrl";
import OpsClient from "./OpsClient";

export const dynamic = "force-dynamic";

async function loadOpsData(status = "published", year) {
  try {
    const baseUrl = getInternalFetchBaseUrl();

    const params = new URLSearchParams({
      page: "1",
      pageSize: "50",
    });
    if (status) params.set("status", status);
    if (year) params.set("year", String(year));

    const res = await fetch(`${baseUrl}/api/AuditProgram/ops?${params.toString()}`, {
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.error("Failed to fetch ops data:", res.status);
      return { data: [], meta: { total: 0, page: 1, pageSize: 50 } };
    }

    const json = await res.json();
    return {
      data: json.data || [],
      meta: json.meta || { total: 0, page: 1, pageSize: 50 },
    };
  } catch (err) {
    console.error("Error loading ops data:", err);
    return { data: [], meta: { total: 0, page: 1, pageSize: 50 } };
  }
}

export default async function OpsPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : undefined;

  const { data: initialData } = await loadOpsData("published", !Number.isNaN(year) ? year : undefined);
  
  return (
    <OpsClient 
      initialData={initialData} 
      initialSortBy="risk_id_no"
      initialSortDir="asc"
    />
  );
}

