import { headers } from "next/headers";
import HrdClient from "./HrdClient";

async function loadHrdData(status = "published") {
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

    const res = await fetch(`${baseUrl}/api/AuditProgram/hrd?${params.toString()}`, {
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.error("Failed to fetch hrd data:", res.status);
      return { data: [], meta: { total: 0, page: 1, pageSize: 50 } };
    }

    const json = await res.json();
    return {
      data: json.data || [],
      meta: json.meta || { total: 0, page: 1, pageSize: 50 },
    };
  } catch (err) {
    console.error("Error loading hrd data:", err);
    return { data: [], meta: { total: 0, page: 1, pageSize: 50 } };
  }
}

export default async function HrdPage() {
  const { data: initialData } = await loadHrdData("published");
  
  return (
    <HrdClient 
      initialData={initialData} 
      initialSortBy="risk_id_no"
      initialSortDir="asc"
    />
  );
}

