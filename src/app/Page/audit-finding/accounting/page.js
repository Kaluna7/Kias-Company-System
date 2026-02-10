import { headers } from "next/headers";
import AccountingClient from "./AccountingClient";

async function loadAccountingData() {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const res = await fetch(`${baseUrl}/api/audit-finding/accounting`, {
      next: { revalidate: 30 },
      cache: 'force-cache',
    });

    if (!res.ok) {
      console.error("Failed to fetch accounting data:", res.status);
      return [];
    }

    const data = await res.json();
    return Array.isArray(data.data) ? data.data : [];
  } catch (err) {
    console.error("Error loading accounting data:", err);
    return [];
  }
}

export default async function AccountingAuditFindingPage() {
  const initialData = await loadAccountingData();
  return <AccountingClient initialData={initialData} />;
}
