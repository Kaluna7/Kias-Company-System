export const AUDIT_TEAM_EXAMPLE = {
  name: "Example Name",
  role: "MEMBER",
};

/** Rows for preview/export — one example row when team is empty. */
export function resolveAuditTeamRows(team) {
  const list = Array.isArray(team) ? team : [];
  if (list.length === 0) return [{ ...AUDIT_TEAM_EXAMPLE }];
  return list.map((m) => ({
    name: String(m?.name ?? "").trim() || AUDIT_TEAM_EXAMPLE.name,
    role: String(m?.role || "MEMBER").trim() || "MEMBER",
  }));
}
