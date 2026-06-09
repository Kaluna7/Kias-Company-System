/** Rows for preview/export — empty when user has not added members. */
export function resolveAuditTeamRows(team) {
  const list = Array.isArray(team) ? team : [];
  return list
    .map((m) => ({
      name: String(m?.name ?? "").trim(),
      role: String(m?.role || "MEMBER").trim() || "MEMBER",
    }))
    .filter((m) => m.name.length > 0);
}
