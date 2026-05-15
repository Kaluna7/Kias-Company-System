import prisma from "@/app/lib/prisma";

export function parseApSequence(apCode = "", base = "") {
  const code = String(apCode ?? "").trim();
  if (!code) return 0;

  const baseStr = String(base ?? "").trim();
  if (baseStr) {
    const lowerCode = code.toLowerCase();
    const lowerBase = baseStr.toLowerCase();
    if (lowerCode.startsWith(`${lowerBase}.`)) {
      const part = code.slice(baseStr.length + 1);
      const num = parseInt(part, 10);
      return Number.isFinite(num) ? num : 0;
    }
  }

  const match = code.match(/(\d+)(?!.*\d)/);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  return Number.isFinite(num) ? num : 0;
}

export function normalizeBaseCode(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/^\.+/, "")
    .replace(/\.+$/, "");
}

export function formatApCode(baseCode, sequence) {
  return `${normalizeBaseCode(baseCode)}.${sequence}`;
}

export const AUDIT_PROGRAM_DEPARTMENTS = {
  finance: {
    parentModel: "finance",
    apModel: "financeAp",
    riskIdField: "finance_risk_id",
    defaultPrefix: "FIN",
  },
  accounting: {
    parentModel: "accounting",
    apModel: "accountingAp",
    riskIdField: "accounting_risk_id",
    defaultPrefix: "ACC",
  },
  tax: {
    parentModel: "tax",
    apModel: "taxAp",
    riskIdField: "tax_risk_id",
    defaultPrefix: "TAX",
  },
  hrd: {
    parentModel: "hrd",
    apModel: "hrdAp",
    riskIdField: "hrd_risk_id",
    defaultPrefix: "HRD",
  },
  mis: {
    parentModel: "mis",
    apModel: "misAp",
    riskIdField: "mis_risk_id",
    defaultPrefix: "MIS",
  },
  merch: {
    parentModel: "merchandise",
    apModel: "merchandiseAp",
    riskIdField: "merchandise_risk_id",
    defaultPrefix: "MERCH",
  },
  ops: {
    parentModel: "operational",
    apModel: "operationalAp",
    riskIdField: "operational_risk_id",
    defaultPrefix: "OPS",
  },
  sdp: {
    parentModel: "sdp",
    apModel: "sdpAp",
    riskIdField: "sdp_risk_id",
    defaultPrefix: "SDP",
  },
  lp: {
    parentModel: "lp",
    apModel: "lpAp",
    riskIdField: "lp_risk_id",
    defaultPrefix: "LP",
  },
  ga: {
    parentModel: "general_affair",
    apModel: "generalAffairAp",
    riskIdField: "general_affair_risk_id",
    defaultPrefix: "GA",
  },
  whs: {
    parentModel: "warehouse",
    apModel: "warehouseAp",
    riskIdField: "warehouse_risk_id",
    defaultPrefix: "WHS",
  },
};

export function getAuditProgramDepartment(deptKey) {
  const key = String(deptKey ?? "").trim().toLowerCase();
  return AUDIT_PROGRAM_DEPARTMENTS[key] ?? null;
}

/**
 * Delete one AP and renumber siblings: A.2.1.2.3 -> A.2.1.2.2 when .2 is removed.
 */
export async function deleteAuditProgramApAndRenumber(departmentKey, apId) {
  const dept = getAuditProgramDepartment(departmentKey);
  if (!dept) {
    throw new Error(`Unknown department: ${departmentKey}`);
  }

  const apModel = prisma[dept.apModel];
  const parentModel = prisma[dept.parentModel];

  const existing = await apModel.findUnique({ where: { ap_id: apId } });
  if (!existing) {
    throw new Error(`AP with ap_id=${apId} not found`);
  }

  const riskId = existing[dept.riskIdField];
  const parent = await parentModel.findUnique({ where: { risk_id: riskId } });
  if (!parent) {
    throw new Error(`Parent risk with risk_id=${riskId} not found`);
  }

  if (parent.status && parent.status !== "draft") {
    throw new Error("Only draft AP records can be deleted");
  }

  const baseCode = normalizeBaseCode(
    parent.risk_id_no || `${dept.defaultPrefix}-${parent.risk_id}`
  );

  return prisma.$transaction(async (tx) => {
    const txAp = tx[dept.apModel];

    await txAp.delete({ where: { ap_id: apId } });

    const remaining = await txAp.findMany({
      where: { [dept.riskIdField]: riskId },
    });

    remaining.sort(
      (a, b) => parseApSequence(a.ap_code, baseCode) - parseApSequence(b.ap_code, baseCode)
    );

    for (let i = 0; i < remaining.length; i++) {
      const newCode = formatApCode(baseCode, i + 1);
      if (remaining[i].ap_code !== newCode) {
        await txAp.update({
          where: { ap_id: remaining[i].ap_id },
          data: { ap_code: newCode },
        });
        remaining[i].ap_code = newCode;
      }
    }

    return { deleted_ap_id: apId, renumbered: remaining };
  });
}
