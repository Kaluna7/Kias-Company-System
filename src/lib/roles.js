/**
 * Central role helpers.
 * Roles are free-form strings on users.role (no Prisma enum).
 *
 * Allowed roles: user | reviewer | super_admin (alias: superadmin)
 * Legacy "admin" is no longer a valid account role.
 */

export function normalizeRole(role) {
  return String(role ?? "")
    .toLowerCase()
    .trim();
}

/** Super admin — full access including Schedule and Create Account. */
export function isSuperAdmin(role) {
  const r = normalizeRole(role);
  return r === "super_admin" || r === "superadmin";
}

/**
 * Privileged editor access previously shared by admin + super_admin.
 * Now: super_admin only (regular admin role removed).
 */
export function isAdminRole(role) {
  return isSuperAdmin(role);
}

export function isReviewerRole(role) {
  return normalizeRole(role) === "reviewer";
}

export function isUserRole(role) {
  return normalizeRole(role) === "user";
}

/**
 * Dashboard / progress style access (super_admin, reviewer).
 * Does NOT grant schedule management by itself.
 */
export function isAdminLikeRole(role) {
  const r = normalizeRole(role);
  return r === "reviewer" || isSuperAdmin(r);
}

/** Only super admin may open/create/edit schedules. */
export function canManageSchedule(role) {
  return isSuperAdmin(role);
}

/** Only super admin may create / delete employee accounts. */
export function canCreateAccounts(role) {
  return isSuperAdmin(role);
}

/** Roles that may edit worksheets / publish findings, etc. */
export function isEditorRole(role) {
  const r = normalizeRole(role);
  return r === "user" || r === "reviewer" || isSuperAdmin(r);
}

/** Privileged account roles excluded from employee pickers / assignment lists. */
export function isPrivilegedAccountRole(role) {
  const r = normalizeRole(role);
  return r === "reviewer" || isSuperAdmin(r);
}

/**
 * Who may edit data on published module reports (SOP / Finding / Worksheet / Evidence UI).
 * Regular "user" is view-only on reports.
 */
export function canEditPublishedReport(role) {
  return isAdminLikeRole(role);
}

/** Roles allowed when creating accounts. */
export const ALLOWED_ACCOUNT_ROLES = ["user", "reviewer", "super_admin"];

export function isAllowedAccountRole(role) {
  const r = normalizeRole(role);
  return r === "user" || r === "reviewer" || isSuperAdmin(r);
}
