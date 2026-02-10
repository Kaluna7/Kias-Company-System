import { headers } from "next/headers";

export async function loadAuditFindingInitialData(apiPath) {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const res = await fetch(`${baseUrl}/api/audit-finding/${encodeURIComponent(apiPath)}`, {
      next: { revalidate: 30 },
      cache: "force-cache",
    });

    if (!res.ok) {
      console.error(`Failed to fetch ${apiPath} audit-finding data:`, res.status);
      return [];
    }

    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.data) ? data.data : [];
  } catch (err) {
    console.error(`Error loading ${apiPath} audit-finding data:`, err);
    return [];
  }
}


