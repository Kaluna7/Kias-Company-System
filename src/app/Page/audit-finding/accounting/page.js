import { headers } from "next/headers";
import AccountingClient from "./AccountingClient";

async function loadAccountingData() {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const res = await fetch(`${baseUrl}/api/audit-finding/accounting?page=1&pageSize=50`, {
      next: { revalidate: 30 },
      cache: 'force-cache',
    });

    if (!res.ok) {
      console.error("Failed to fetch accounting data:", res.status);
      return { data: [], meta: null };
    }

    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : [];
    return { data, meta: json.meta || null };
  } catch (err) {
    console.error("Error loading accounting data:", err);
    return { data: [], meta: null };
  }
}

export default async function AccountingAuditFindingPage() {
  const { data: initialData, meta: initialMeta } = await loadAccountingData();
  return <AccountingClient initialData={initialData} initialMeta={initialMeta} />;
}
