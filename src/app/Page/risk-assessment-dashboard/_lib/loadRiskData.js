import { headers } from "next/headers";

/**
 * Server-side fetch for risk assessment data. Used for SSR.
 * @param {string} apiPath - e.g. "finance", "sdp", "mis", "ops", "merch", "l&p", "g&a", "hrd", "tax", "whs"
 */
export async function loadRiskData(apiPath, status = "published") {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const params = new URLSearchParams({
      status,
      page: "1",
      pageSize: "50",
    });

    const res = await fetch(`${baseUrl}/api/RiskAssessment/${apiPath}?${params.toString()}`, {
      next: { revalidate: 30 },
      cache: "force-cache",
    });

    if (!res.ok) {
      console.error(`Failed to fetch ${apiPath} data:`, res.status);
      return { initialData: [], initialMeta: null };
    }

    const json = await res.json();
    const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    const meta = json?.meta ?? null;
    return { initialData: list, initialMeta: meta };
  } catch (err) {
    console.error(`Error loading ${apiPath} data:`, err);
    return { initialData: [], initialMeta: null };
  }
}
