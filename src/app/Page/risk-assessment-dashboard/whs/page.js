import { headers } from "next/headers";
import WhsClient from "./WhsClient";

async function loadWhsData(status = "published") {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const params = new URLSearchParams({
      status: status,
    });

    const res = await fetch(`${baseUrl}/api/RiskAssessment/whs?${params.toString()}`, {
      next: { revalidate: 30 }, // Cache for 30 seconds
      cache: 'force-cache', // Use cache when available
    });

    if (!res.ok) {
      console.error("Failed to fetch whs data:", res.status);
      return [];
    }

    const json = await res.json();
    const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
    return list;
  } catch (err) {
    console.error("Error loading whs data:", err);
    return [];
  }
}

export default async function WhsPage() {
  const initialData = await loadWhsData("published");
  
  return <WhsClient initialData={initialData} />;
}
