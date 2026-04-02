/**
 * Audit-finding report: resolve period dates when DB row snapshot is NULL.
 * History rows are appended on each schedule save (POST /api/schedule/module).
 */

export function pickScheduleAsOfFromHistory(historyRows, asOf) {
  if (!historyRows?.length || asOf == null || asOf === "") return null;
  const t = new Date(asOf).getTime();
  if (Number.isNaN(t)) return null;
  let best = null;
  for (const h of historyRows) {
    const ht = new Date(h.created_at).getTime();
    if (Number.isNaN(ht)) continue;
    if (ht <= t) best = h;
  }
  return best;
}

export async function loadAuditFindingScheduleHistories(prisma) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT department_id, start_date::text AS start_date, end_date::text AS end_date, created_at
      FROM schedule_module_feedback_history
      WHERE module_key = 'audit-finding'
      ORDER BY department_id ASC, created_at ASC
    `;
    const byDept = {};
    for (const r of rows || []) {
      const id = String(r.department_id || "");
      if (!byDept[id]) byDept[id] = [];
      byDept[id].push(r);
    }
    return byDept;
  } catch {
    return {};
  }
}
