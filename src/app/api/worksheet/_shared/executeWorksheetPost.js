import { yearCreatedAtFilter } from "./worksheetWhere";

/**
 * Create worksheet row; optionally publish to report (reviewer/admin).
 * Draft saves (user) keep status_wp; published flow matches legacy (clears status_wp on created row).
 */
export async function executeWorksheetPost(prisma, defaultDepartment, body, publishedToReport) {
  const created = await prisma.worksheet_finance.create({
    data: {
      department: body.department || defaultDepartment,
      preparer: body.preparer || null,
      reviewer: body.reviewer || null,
      preparer_date: body.preparerDate ? new Date(body.preparerDate) : null,
      reviewer_date: body.reviewerDate ? new Date(body.reviewerDate) : null,
      status_documents: body.statusDocuments || null,
      status_worksheet: body.statusWorksheet || "Not Available",
      status_wp: body.statusWP !== undefined && body.statusWP !== "" ? body.statusWP : null,
      file_path: body.filePath || null,
      audit_area: body.auditArea || null,
      custom_audit_areas:
        Array.isArray(body.customAuditAreas) && body.customAuditAreas.length > 0
          ? JSON.stringify(body.customAuditAreas)
          : null,
      published_to_report: publishedToReport,
    },
  });

  const yf = yearCreatedAtFilter(body.year);
  const delWhere = {
    department: created.department,
    id: { not: created.id },
    published_to_report: false,
  };
  if (yf) delWhere.created_at = yf;
  await prisma.worksheet_finance.deleteMany({ where: delWhere });

  if (publishedToReport) {
    await prisma.worksheet_finance.update({
      where: { id: created.id },
      data: { status_wp: null },
    });
    return { ...created, status_wp: null };
  }

  return { ...created };
}
