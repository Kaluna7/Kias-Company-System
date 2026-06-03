/** TOC department titles — mirror preview page.js */
export function formatDeptTocTitle(row) {
  const name = row?.name || "";
  if (name === "SECURITY") return "Department Security (L&P) - Finding & Recommendation";
  if (name === "GENERAL & AFFAIR") return "Department General Affairs - Finding & Recommendation";
  if (name === "MANAGEMENT INFORMATION SYS.") {
    return "Department Management Information System (MIS) - Finding & Recommendation";
  }
  if (name === "HRD") return "Department Human Resources Department - Finding & Recommendation";
  return `Department ${name.charAt(0) + name.slice(1).toLowerCase()} - Finding & Recommendation`;
}
