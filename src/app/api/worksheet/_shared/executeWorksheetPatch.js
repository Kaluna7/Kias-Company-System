import { buildDraftWhereClause } from "./worksheetWhere";

/** Fields allowed on PATCH (partial update of latest draft row). */
export function buildWorksheetPatchData(body) {
  const data = {};
  if (Object.prototype.hasOwnProperty.call(body, "statusWP")) {
    data.status_wp =
      body.statusWP !== undefined && body.statusWP !== "" ? body.statusWP : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "auditArea")) {
    const a = body.auditArea;
    data.audit_area =
      a != null && String(a).trim() !== "" ? String(a).trim() : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "customAuditAreas")) {
    const v = body.customAuditAreas;
    data.custom_audit_areas =
      Array.isArray(v) && v.length > 0 ? JSON.stringify(v) : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "reviewer")) {
    const r = body.reviewer;
    data.reviewer =
      r != null && String(r).trim() !== "" ? String(r).trim() : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "reviewerDate")) {
    const d = body.reviewerDate;
    data.reviewer_date = d ? new Date(d) : null;
  }
  return data;
}

/**
 * Update latest draft row for department/year, or create a minimal draft if none exists.
 * @param {boolean} [canPatchReviewerFields] if false, reviewer / reviewerDate in body are ignored
 */
export async function executeWorksheetPatch(
  prisma,
  department,
  body,
  yearParam,
  canPatchReviewerFields = false,
) {
  const safeBody = { ...body };
  if (!canPatchReviewerFields) {
    delete safeBody.reviewer;
    delete safeBody.reviewerDate;
  }
  const patch = buildWorksheetPatchData(safeBody);
  if (Object.keys(patch).length === 0) return;

  const draftWhere = buildDraftWhereClause(department, yearParam);
  const latest = await prisma.worksheet_finance.findFirst({
    where: draftWhere,
    orderBy: { created_at: "desc" },
  });

  if (latest) {
    await prisma.worksheet_finance.update({
      where: { id: latest.id },
      data: patch,
    });
  } else {
    await prisma.worksheet_finance.create({
      data: {
        department,
        published_to_report: false,
        ...patch,
      },
    });
  }
}
