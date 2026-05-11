import { FINANCE_RISK_PREFIX, RISK_GAP_CONFIG, RISK_ID_PREFIX_BY_API_PATH } from "@/app/data/riskIdNoPrefixes";

export { FINANCE_RISK_PREFIX, RISK_GAP_CONFIG, RISK_ID_PREFIX_BY_API_PATH };

export function makeRiskIdNo(riskId) {
  const id = Number(riskId);
  return `A.2.1.${Number.isFinite(id) ? id : String(riskId ?? "").trim()}`;
}

function prismaDelegate(prisma, prismaKey) {
  const d = prisma[prismaKey];
  if (!d || typeof d.findMany !== "function") {
    throw new Error(`Invalid prisma model key: ${prismaKey}`);
  }
  return d;
}

function escapeRegexPrefix(prefix) {
  return String(prefix).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseGapRiskIdSuffix(riskIdNo, prefix) {
  const re = new RegExp(`^${escapeRegexPrefix(prefix)}(\\d+)$`);
  const m = String(riskIdNo ?? "").trim().match(re);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseFinanceRiskIdSuffix(riskIdNo) {
  return parseGapRiskIdSuffix(riskIdNo, FINANCE_RISK_PREFIX);
}

export async function nextGapRiskIdNo(prisma, prismaKey, prefix) {
  const delegate = prismaDelegate(prisma, prismaKey);
  const rows = await delegate.findMany({
    select: { risk_id_no: true },
  });
  const used = new Set();
  for (const { risk_id_no } of rows) {
    const n = parseGapRiskIdSuffix(risk_id_no, prefix);
    if (n != null) used.add(n);
  }
  let next = 1;
  while (used.has(next)) next += 1;
  return `${prefix}${next}`;
}

export async function assignGapRiskIdNo(prisma, prismaKey, risk_id, status, prefix) {
  // Sequence must be global per department (published + draft).
  const risk_id_no = await nextGapRiskIdNo(prisma, prismaKey, prefix);
  await prismaDelegate(prisma, prismaKey).update({
    where: { risk_id: Number(risk_id) },
    data: { risk_id_no },
  });
  return risk_id_no;
}

export async function backfillGapRiskIdNoForRows(prisma, prismaKey, rows, prefix) {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];
  const delegate = prismaDelegate(prisma, prismaKey);
  const out = rows.map((r) => (r ? { ...r } : r));
  const missing = out
    .filter((r) => r && !r.risk_id_no)
    .sort((a, b) => Number(a.risk_id) - Number(b.risk_id));
  for (const r of missing) {
    const risk_id_no = await nextGapRiskIdNo(prisma, prismaKey, prefix);
    await delegate.update({
      where: { risk_id: Number(r.risk_id) },
      data: { risk_id_no },
    });
    r.risk_id_no = risk_id_no;
  }
  return out;
}

export async function assignGapRiskIdNoForApiPath(prisma, apiPath, risk_id, status) {
  const cfg = RISK_GAP_CONFIG[apiPath];
  if (!cfg) throw new Error(`Unknown risk assessment api path: ${apiPath}`);
  return assignGapRiskIdNo(prisma, cfg.prismaKey, risk_id, status, cfg.prefix);
}

export async function backfillGapRiskIdNoForApiPath(prisma, apiPath, rows) {
  const cfg = RISK_GAP_CONFIG[apiPath];
  if (!cfg) throw new Error(`Unknown risk assessment api path: ${apiPath}`);
  return backfillGapRiskIdNoForRows(prisma, cfg.prismaKey, rows, cfg.prefix);
}

export async function resequenceGapRiskIdNo(prisma, prismaKey, prefix) {
  const delegate = prismaDelegate(prisma, prismaKey);
  const rows = await delegate.findMany({
    select: { risk_id: true, risk_id_no: true },
  });
  if (!rows.length) return;

  const normalized = rows
    .map((r) => ({ ...r, suffix: parseGapRiskIdSuffix(r.risk_id_no, prefix) }))
    .sort((a, b) => {
      const aHas = a.suffix != null;
      const bHas = b.suffix != null;
      if (aHas && bHas && a.suffix !== b.suffix) return a.suffix - b.suffix;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return Number(a.risk_id) - Number(b.risk_id);
    });

  for (let i = 0; i < normalized.length; i += 1) {
    const row = normalized[i];
    const expected = `${prefix}${i + 1}`;
    if (row.risk_id_no !== expected) {
      await delegate.update({
        where: { risk_id: Number(row.risk_id) },
        data: { risk_id_no: expected },
      });
    }
  }
}

export async function resequenceGapRiskIdNoForApiPath(prisma, apiPath) {
  const cfg = RISK_GAP_CONFIG[apiPath];
  if (!cfg) throw new Error(`Unknown risk assessment api path: ${apiPath}`);
  return resequenceGapRiskIdNo(prisma, cfg.prismaKey, cfg.prefix);
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

  return rows.map((r) =>
    r && !r.risk_id_no && r.risk_id != null ? { ...r, risk_id_no: makeRiskIdNo(r.risk_id) } : r
  );
}
