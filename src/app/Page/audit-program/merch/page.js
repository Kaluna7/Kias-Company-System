import { headers } from "next/headers";
import MerchClient from "./MerchClient";

async function loadMerchData(status = "published") {
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

    const res = await fetch(`${baseUrl}/api/AuditProgram/merch?${params.toString()}`, {
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.error("Failed to fetch merch data:", res.status);
      return { data: [], meta: { total: 0, page: 1, pageSize: 50 } };
    }

    const json = await res.json();
    return {
      data: json.data || [],
      meta: json.meta || { total: 0, page: 1, pageSize: 50 },
    };
  } catch (err) {
    console.error("Error loading merch data:", err);
    return { data: [], meta: { total: 0, page: 1, pageSize: 50 } };
  }
}

export default async function MerchPage() {
  const { data: initialData } = await loadMerchData("published");
  
  return (
    <MerchClient 
      initialData={initialData} 
      initialSortBy="risk_id_no"
      initialSortDir="asc"
    />
  );
}

