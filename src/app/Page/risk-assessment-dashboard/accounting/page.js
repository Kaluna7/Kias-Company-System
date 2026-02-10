import { headers } from "next/headers";
import AccountingClient from "./AccountingClient";

async function loadAccountingData(status = "published") {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const params = new URLSearchParams({
      status: status,
    });

    const res = await fetch(`${baseUrl}/api/RiskAssessment/accounting?${params.toString()}`, {
      next: { revalidate: 30 }, // Cache for 30 seconds
      cache: 'force-cache', // Use cache when available
    });

    if (!res.ok) {
      console.error("Failed to fetch accounting data:", res.status);
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Error loading accounting data:", err);
    return [];
  }
}

export default async function AccountingPage() {
  const initialData = await loadAccountingData("published");
  
  return <AccountingClient initialData={initialData} />;
}
