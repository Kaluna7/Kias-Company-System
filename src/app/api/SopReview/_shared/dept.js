export function resolveSopDept(deptParam) {
  const dept = String(deptParam || "").trim().toLowerCase();

  const map = {
    finance: { slug: "finance", departmentName: "Finance" },
    accounting: { slug: "accounting", departmentName: "Accounting" },
    hrd: { slug: "hrd", departmentName: "HRD" },
    "g&a": { slug: "g_a", departmentName: "General Affair" },
    ga: { slug: "g_a", departmentName: "General Affair" },
    sdp: { slug: "sdp", departmentName: "Store Design & Planner" },
    tax: { slug: "tax", departmentName: "Tax" },
    "l&p": { slug: "l_p", departmentName: "L & P" },
    lp: { slug: "l_p", departmentName: "L & P" },
    mis: { slug: "mis", departmentName: "MIS" },
    merch: { slug: "merch", departmentName: "Merchandise" },
    ops: { slug: "ops", departmentName: "Operational" },
    whs: { slug: "whs", departmentName: "Warehouse" },
  };

  return map[dept] || null;
}


