export function makeRiskIdNo(riskId) {
  const id = Number(riskId);
  // Current standard (matches existing FINANCE data): A.2.1.<risk_id>
  return `A.2.1.${Number.isFinite(id) ? id : String(riskId ?? "").trim()}`;
}

export async function ensureRiskIdNo(delegate, risk_id, risk_id_no) {
  if (risk_id_no) return risk_id_no;
  const next = makeRiskIdNo(risk_id);
  await delegate.update({
    where: { risk_id: Number(risk_id) },
    data: { risk_id_no: next },
  });
  return next;
}

export async function backfillRiskIdNoForRows(delegate, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];

  const missing = rows.filter((r) => r && !r.risk_id_no && r.risk_id != null);
  if (missing.length > 0) {
    await Promise.all(
      missing.map((r) =>
        delegate.update({
          where: { risk_id: Number(r.risk_id) },
          data: { risk_id_no: makeRiskIdNo(r.risk_id) },
        })
      )
    );
  }

  // Return rows with risk_id_no always present for downstream consumers (Audit Program / UI)
  return rows.map((r) =>
    r && !r.risk_id_no && r.risk_id != null
      ? { ...r, risk_id_no: makeRiskIdNo(r.risk_id) }
      : r
  );
}


