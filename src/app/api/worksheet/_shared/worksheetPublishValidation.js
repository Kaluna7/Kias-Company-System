/** Publish to report only when Status WP is exactly "Checked". */
export function worksheetStatusWpAllowsPublish(statusWP) {
  return String(statusWP ?? "").trim() === "Checked";
}

export const WORKSHEET_PUBLISH_REQUIRES_CHECKED_MESSAGE =
  "Publishing requires Status WP to be set to Checked. Update Status WP and try again.";

/** Publish requires a non-empty file path (uploaded worksheet file). */
export function worksheetFilePathAllowsPublish(filePath) {
  return String(filePath ?? "").trim().length > 0;
}

export const WORKSHEET_PUBLISH_REQUIRES_FILE_MESSAGE =
  "No file to publish. Upload a worksheet file before publishing to the Report.";

export function worksheetAuditAreaAllowsPublish(auditArea) {
  return String(auditArea ?? "").trim().length > 0;
}

export const WORKSHEET_PUBLISH_REQUIRES_AUDIT_AREA_MESSAGE =
  "Publishing requires at least one audit area. Open Audit area, select area(s), click Done, then try again.";

export function worksheetReviewerAllowsPublish(reviewer) {
  return String(reviewer ?? "").trim().length > 0;
}

export const WORKSHEET_PUBLISH_REQUIRES_REVIEWER_MESSAGE =
  "Publishing requires Reviewer to be filled in. Enter the reviewer name and try again.";

export function worksheetReviewerDateAllowsPublish(reviewerDate) {
  const s =
    reviewerDate == null
      ? ""
      : typeof reviewerDate === "string"
        ? reviewerDate.trim()
        : String(reviewerDate).trim();
  return s.length > 0;
}

export const WORKSHEET_PUBLISH_REQUIRES_REVIEWER_DATE_MESSAGE =
  "Publishing requires Reviewer date to be set. Choose a date and try again.";
