import { headers } from "next/headers";

export async function loadAuditFindingInitialData(apiPath, year) {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const url = new URL(`${baseUrl}/api/audit-finding/${encodeURIComponent(apiPath)}`);
    url.searchParams.set("page", "1");
    url.searchParams.set("pageSize", "50");
    if (!Number.isNaN(year) && year) {
      url.searchParams.set("year", String(year));
    }

    // Selalu ambil data terbaru (tanpa cache) supaya status setelah Publish
    // langsung tercermin baik di server render maupun client.
    const res = await fetch(url.toString(), {
      cache: "no-store",
      next: { revalidate: 0 },
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


