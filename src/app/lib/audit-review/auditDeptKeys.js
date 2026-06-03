/** Route / report deptKey → audit-review API path */
export const DEPT_KEY_TO_API_PATH = {
  finance: "finance",
  accounting: "accounting",
  hrd: "hrd",
  ga: "g&a",
  sdp: "sdp",
  tax: "tax",
  lp: "l&p",
  mis: "mis",
  merch: "merch",
  ops: "ops",
  whs: "whs",
};

/** Audit-review route param or apiPath → report preview deptKey */
export function reportDeptKeyFromRouteOrApi(routeDept, apiPath) {
  const key = String(routeDept || "").trim();
  if (key && DEPT_KEY_TO_API_PATH[key]) return key;
  const path = String(apiPath || "").trim();
  if (path === "g&a") return "ga";
  if (path === "l&p") return "lp";
  for (const [deptKey, p] of Object.entries(DEPT_KEY_TO_API_PATH)) {
    if (p === path) return deptKey;
  }
  return key || "finance";
}

export const REPORT_DEPT_KEYS = Object.keys(DEPT_KEY_TO_API_PATH);
