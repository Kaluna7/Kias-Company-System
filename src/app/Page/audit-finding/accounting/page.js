import { headers } from "next/headers";
import AccountingClient from "./AccountingClient";

async function loadAccountingData(year) {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const url = new URL(`${baseUrl}/api/audit-finding/accounting`);
    url.searchParams.set("page", "1");
    url.searchParams.set("pageSize", "50");
    if (!Number.isNaN(year) && year) {
      url.searchParams.set("year", String(year));
    }

    // Selalu ambil data terbaru supaya hasil Save / Publish langsung terlihat
    // saat user keluar lalu masuk kembali ke halaman.
    const res = await fetch(url.toString(), {
      cache: "no-store",
      next: { revalidate: 0 },
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

export default async function AccountingAuditFindingPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const { data: initialData, meta: initialMeta } = await loadAccountingData(year);
  return <AccountingClient initialData={initialData} initialMeta={initialMeta} />;
}
