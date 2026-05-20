import { compareCode } from "./compareCode";

function readRiskId(row) {
  return row?.risk_id ?? row?.riskId ?? row?.risk_id_no ?? row?.riskIdNo ?? "";
}

function readApCode(row) {
  return row?.ap_code ?? row?.apCode ?? row?.apNo ?? "";
}

export function compareByRiskId(a, b) {
  const riskA = String(readRiskId(a)).trim();
  const riskB = String(readRiskId(b)).trim();
  const apA = String(readApCode(a)).trim();
  const apB = String(readApCode(b)).trim();

  const riskCmp = compareCode(riskA, riskB);
  if (riskCmp !== 0) return riskCmp;

  return compareCode(apA, apB);
}

/** Sort rows by Risk ID ascending (smallest to largest), then AP code. */
export function sortByRiskId(rows) {
  return [...(Array.isArray(rows) ? rows : [])].sort(compareByRiskId);
}
