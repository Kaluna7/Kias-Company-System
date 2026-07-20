/**
 * Central role helpers.
 * Roles are free-form strings on users.role (no Prisma enum).
 *
 * - super_admin / superadmin: full access including Schedule management
 * - admin: normal admin (no Schedule card / schedule create)
 * - reviewer, user: existing roles
 */

export function normalizeRole(role) {
  return String(role ?? "")
    .toLowerCase()
    .trim();
}

/** Super admin — can manage schedules and do everything an admin can. */
export function isSuperAdmin(role) {
  const r = normalizeRole(role);
  return r === "super_admin" || r === "superadmin";
}

/** Regular admin or super admin. */
export function isAdminRole(role) {
  const r = normalizeRole(role);
  return r === "admin" || isSuperAdmin(r);
}

export function isReviewerRole(role) {
  return normalizeRole(role) === "reviewer";
}

export function isUserRole(role) {
  return normalizeRole(role) === "user";
}

/**
 * Dashboard / progress style "admin-like" access (admin, super_admin, reviewer).
 * Does NOT grant schedule management by itself.
 */
export function isAdminLikeRole(role) {
  const r = normalizeRole(role);
  return r === "admin" || r === "reviewer" || isSuperAdmin(r);
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
  return r === "user" || r === "reviewer" || r === "admin" || isSuperAdmin(r);
}

/** Privileged account roles excluded from employee pickers / assignment lists. */
export function isPrivilegedAccountRole(role) {
  const r = normalizeRole(role);
  return r === "admin" || r === "reviewer" || isSuperAdmin(r);
}
