import { headers } from "next/headers";

export async function loadAuditFindingInitialData(apiPath) {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const res = await fetch(`${baseUrl}/api/audit-finding/${encodeURIComponent(apiPath)}?page=1&pageSize=50`, {
      next: { revalidate: 30 },
      cache: "force-cache",
    });

    if (!res.ok) {
      console.error(`Failed to fetch ${apiPath} audit-finding data:`, res.status);
      return { data: [], meta: null };
    }

    const json = await res.json().catch(() => ({}));
    const data = Array.isArray(json.data) ? json.data : [];
    const meta = json.meta || null;
    return { data, meta };
  } catch (err) {
    console.error(`Error loading ${apiPath} audit-finding data:`, err);
    return { data: [], meta: null };
  }
}


