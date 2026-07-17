function normalizeRiskKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/** Derive parent risk id (e.g. A.2.3.1) from AP code (e.g. A.2.3.1.1). */
export function deriveRiskIdNoFromApNo(apNo) {
  const raw = String(apNo ?? "").trim();
  if (!raw) return "";

  const parts = raw.split(".").filter(Boolean);
  if (parts.length >= 5) {
    return parts.slice(0, -1).join(".");
  }
  return raw;
}

export function resolveRiskIdNoForFindingRow(row) {
  const direct = String(row?.riskId || row?.risk_id || "").trim();
  if (direct) return direct;
  return deriveRiskIdNoFromApNo(row?.apNo || row?.ap_code || row?.apCode || "");
}

export function buildRiskDescriptionLookup(riskRows = []) {
  const lookup = new Map();

  for (const row of riskRows) {
    const description =
      row?.risk_description ??
      row?.riskDescription ??
      row?.risk_details ??
      row?.riskDetails ??
      "";
    const keys = [
      row?.risk_id_no,
      row?.riskIdNo,
      row?.risk_id != null ? String(row.risk_id) : "",
    ]
      .map(normalizeRiskKey)
      .filter(Boolean);

    for (const key of keys) {
      if (!lookup.has(key)) {
        lookup.set(key, {
          riskIdNo: row?.risk_id_no || row?.riskIdNo || "",
          riskDescription: String(description || "").trim(),
        });
      }
    }
  }

  return lookup;
}

export function resolveRiskMetaForFindingRow(row, lookup) {
  const riskIdNo = resolveRiskIdNoForFindingRow(row);
  const fromLookup = lookup?.get(normalizeRiskKey(riskIdNo));
  const fallbackDescription = String(
    row?.riskDetails ||
      row?.risk_details ||
      row?.risk_description ||
      row?.riskDescription ||
      "",
  ).trim();

  return {
    riskIdNo: riskIdNo || fromLookup?.riskIdNo || "",
    riskDescription: fromLookup?.riskDescription || fallbackDescription || "",
  };
}

export async function fetchAllRiskAssessmentRows(apiPath) {
  const safePath = String(apiPath || "").trim();
  if (!safePath) return [];

  const pageSize = 100;
  let page = 1;
  const allRows = [];

  while (true) {
    const params = new URLSearchParams({
      status: "published",
      page: String(page),
      pageSize: String(pageSize),
    });
    const res = await fetch(`/api/RiskAssessment/${encodeURIComponent(safePath)}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to load risk assessment data (${res.status})`);
    }

    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    allRows.push(...rows);

    const total = Number(json?.meta?.total);
    if (!Number.isFinite(total) || allRows.length >= total || rows.length < pageSize) {
      break;
    }
    page += 1;
  }

  return allRows;
}
