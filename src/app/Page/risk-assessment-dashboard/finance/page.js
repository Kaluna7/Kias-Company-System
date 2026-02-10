import { headers } from "next/headers";
import FinanceClient from "./FinanceClient";

async function loadFinanceData(status = "published") {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const params = new URLSearchParams({
      status: status,
    });

    const res = await fetch(`${baseUrl}/api/RiskAssessment/finance?${params.toString()}`, {
      next: { revalidate: 30 }, // Cache for 30 seconds
      cache: 'force-cache', // Use cache when available
    });

    if (!res.ok) {
      console.error("Failed to fetch finance data:", res.status);
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Error loading finance data:", err);
    return [];
  }
}

export default async function FinancePage() {
  const initialData = await loadFinanceData("published");
  
  return <FinanceClient initialData={initialData} />;
}
