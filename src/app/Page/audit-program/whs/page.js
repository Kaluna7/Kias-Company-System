import { headers } from "next/headers";
import WhsClient from "./WhsClient";

async function loadWhsData(status = "published") {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const params = new URLSearchParams({
      page: "1",
      pageSize: "50",
    });
    if (status) params.set("status", status);

    const res = await fetch(`${baseUrl}/api/AuditProgram/whs?${params.toString()}`, {
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.error("Failed to fetch whs data:", res.status);
      return { data: [], meta: { total: 0, page: 1, pageSize: 50 } };
    }

    const json = await res.json();
    return {
      data: json.data || [],
      meta: json.meta || { total: 0, page: 1, pageSize: 50 },
    };
  } catch (err) {
    console.error("Error loading whs data:", err);
    return { data: [], meta: { total: 0, page: 1, pageSize: 50 } };
  }
}

export default async function WhsPage() {
  const { data: initialData } = await loadWhsData("published");
  
  return (
    <WhsClient 
      initialData={initialData} 
      initialSortBy="risk_id_no"
      initialSortDir="asc"
    />
  );
}

