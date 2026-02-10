import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import FinanceClient from "./FinanceClient";

// Server-side function to load finance data
async function loadFinanceData(status = "published") {
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

    const res = await fetch(`${baseUrl}/api/AuditProgram/finance?${params.toString()}`, {
      next: { revalidate: 0 }, // Always fetch fresh but allow Next.js to optimize
    });

    if (!res.ok) {
      console.error("Failed to fetch finance data:", res.status);
      return { data: [], meta: { total: 0, page: 1, pageSize: 50 } };
    }

    const json = await res.json();
    return {
      data: json.data || [],
      meta: json.meta || { total: 0, page: 1, pageSize: 50 },
    };
  } catch (err) {
    console.error("Error loading finance data:", err);
    return { data: [], meta: { total: 0, page: 1, pageSize: 50 } };
  }
}

export default async function FinancePage() {
  // Load initial data on server
  const { data: initialData } = await loadFinanceData("published");
  
  // Get session on server (optional, for future use)
  // const session = await getServerSession(authOptions);
  
  return (
    <FinanceClient 
      initialData={initialData} 
      initialSortBy="risk_id_no"
      initialSortDir="asc"
    />
  );
}
