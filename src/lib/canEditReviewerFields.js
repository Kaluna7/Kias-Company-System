/** Admin, super admin, and reviewer may edit reviewer name, date, status, and related header fields. */
import { isAdminRole, isReviewerRole } from "@/lib/roles";

export function canEditReviewerFields(role) {
  return isAdminRole(role) || isReviewerRole(role);
}
