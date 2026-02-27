import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { pool } from "@/app/api/SopReview/_shared/pool";

const prisma = globalThis.prisma || new PrismaClient();

const deptToSlug = {
  accounting: "accounting",
  finance: "finance",
  hrd: "hrd",
  "g&a": "ga",
  ga: "ga",
  sdp: "sdp",
  tax: "tax",
  "l&p": "lp",
  lp: "lp",
  mis: "mis",
  merch: "merch",
  ops: "ops",
  whs: "whs",
};

function qIdent(name) {
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Invalid identifier: ${name}`);
  return name;
}
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

const deptToModel = {
  accounting: "audit_finding_accounting",
  finance: "audit_finding_finance",
  hrd: "audit_finding_hrd",
  "g&a": "audit_finding_ga",
  ga: "audit_finding_ga",
  sdp: "audit_finding_sdp",
  tax: "audit_finding_tax",
  "l&p": "audit_finding_lp",
  lp: "audit_finding_lp",
  mis: "audit_finding_mis",
  merch: "audit_finding_merch",
  ops: "audit_finding_ops",
  whs: "audit_finding_whs",
};

// Map department to audit-program parent model, AP model, and relation name
const deptToAuditProgram = {
  accounting: { parent: "accounting", ap: "AccountingAp", relation: "accounting" },
  finance: { parent: "finance", ap: "FinanceAp", relation: "finance" },
  hrd: { parent: "hrd", ap: "HrdAp", relation: "hrd" },
  "g&a": { parent: "general_affair", ap: "GeneralAffairAp", relation: "general_affair" },
  ga: { parent: "general_affair", ap: "GeneralAffairAp", relation: "general_affair" },
  sdp: { parent: "sdp", ap: "SdpAp", relation: "sdp" },
  tax: { parent: "tax", ap: "TaxAp", relation: "tax" },
  "l&p": { parent: "lp", ap: "LpAp", relation: "lp" },
  lp: { parent: "lp", ap: "LpAp", relation: "lp" },
  mis: { parent: "mis", ap: "MisAp", relation: "mis" },
  merch: { parent: "merchandise", ap: "MerchandiseAp", relation: "merchandise" },
  ops: { parent: "operational", ap: "OperationalAp", relation: "operational" },
  whs: { parent: "warehouse", ap: "WarehouseAp", relation: "warehouse" },
};

function getDelegate(dept) {
  const model = deptToModel[dept];
  if (!model) return null;
  return prisma[model];
}

// Helper to get audit-program parent model
function getAuditProgramParent(dept) {
  const mapping = {
    accounting: () => prisma.accounting,
    finance: () => prisma.finance,
    hrd: () => prisma.hrd,
    "g&a": () => prisma.general_affair,
    ga: () => prisma.general_affair,
    sdp: () => prisma.sdp,
    tax: () => prisma.tax,
    "l&p": () => prisma.lp,
    lp: () => prisma.lp,
    mis: () => prisma.mis,
    merch: () => prisma.merchandise,
    ops: () => prisma.operational,
    whs: () => prisma.warehouse,
  };
  const getter = mapping[dept];
  return getter ? getter() : null;
}

// Helper to get audit-program AP model
function getAuditProgramAp(dept) {
  const mapping = {
    accounting: () => prisma.accountingAp,
    finance: () => prisma.financeAp,
    hrd: () => prisma.hrdAp,
    "g&a": () => prisma.generalAffairAp,
    ga: () => prisma.generalAffairAp,
    sdp: () => prisma.sdpAp,
    tax: () => prisma.taxAp,
    "l&p": () => prisma.lpAp,
    lp: () => prisma.lpAp,
    mis: () => prisma.misAp,
    merch: () => prisma.merchandiseAp,
    ops: () => prisma.operationalAp,
    whs: () => prisma.warehouseAp,
  };
  const getter = mapping[dept];
  return getter ? getter() : null;
}

// Helper to get the foreign key field name for AP model
function getApRiskIdField(dept) {
  const mapping = {
    accounting: "accounting_risk_id",
    finance: "finance_risk_id",
    hrd: "hrd_risk_id",
    "g&a": "general_affair_risk_id",
    ga: "general_affair_risk_id",
    sdp: "sdp_risk_id",
    tax: "tax_risk_id",
    "l&p": "lp_risk_id",
    lp: "lp_risk_id",
    mis: "mis_risk_id",
    merch: "merchandise_risk_id",
    ops: "operational_risk_id",
    whs: "warehouse_risk_id",
  };
  return mapping[dept] || null;
}

// Publish only findings with completion_status = "COMPLETED" for a department
// After publishing, delete related data from audit-program
export async function PUT(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const delegate = getDelegate(dept);
    
    if (!delegate) {
      return NextResponse.json({ error: "Invalid department" }, { status: 400 });
    }

    // Get all findings with completion_status = "COMPLETED" (case-insensitive)
    const completedFindings = await delegate.findMany({
      where: {
        completion_status: {
          equals: "COMPLETED",
          mode: "insensitive",
        },
      },
    });

    if (completedFindings.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: `No completed findings to publish for ${dept}`,
        count: 0 
      }, { status: 200 });
    }

    // Update completed findings to mark them as published (update updated_at)
    // Don't delete them - they need to remain in the table for the report page
    const updated = await delegate.updateMany({
      where: {
        completion_status: {
          equals: "COMPLETED",
          mode: "insensitive",
        },
      },
      data: {
        updated_at: new Date(),
      },
    });

    // Get audit-program mapping for this department
    const apMapping = deptToAuditProgram[dept];
    if (apMapping) {
      const apModel = getAuditProgramAp(dept);
      const parentModel = getAuditProgramParent(dept);
      const riskIdField = getApRiskIdField(dept);

      if (apModel && parentModel && riskIdField) {
        // Delete related audit-program data for each published finding
        for (const finding of completedFindings) {
          try {
            let deletedAp = false;
            let parentRiskId = null;

            // Strategy 1: Delete by ap_code
            if (finding.ap_code) {
              const apCodeTrimmed = String(finding.ap_code).trim();
              
              // Find AP by ap_code
              const ap = await apModel.findFirst({
                where: {
                  ap_code: apCodeTrimmed,
                },
                include: {
                  [apMapping.relation]: {
                    select: {
                      risk_id: true,
                    },
                  },
                },
              });

              if (ap) {
                parentRiskId = ap[apMapping.relation]?.risk_id;
                
                // Delete the AP
                await apModel.delete({
                  where: { ap_id: ap.ap_id },
                });
                deletedAp = true;
              }
            }

            // Strategy 2: Delete by risk_id or risk_id_no if ap_code didn't match or didn't find AP
            if (!deletedAp && finding.risk_id) {
              const riskIdTrimmed = String(finding.risk_id).trim();
              
              // Try to find parent by risk_id_no
              const parent = await parentModel.findFirst({
                where: {
                  risk_id_no: riskIdTrimmed,
                },
                include: {
                  aps: true,
                },
              });

              if (parent) {
                parentRiskId = parent.risk_id;
                
                // Delete all APs for this parent
                await apModel.deleteMany({
                  where: {
                    [riskIdField]: parent.risk_id,
                  },
                });

                // Delete the parent (risk-assessment)
                await parentModel.delete({
                  where: { risk_id: parent.risk_id },
                });
              } else {
                // Try to find by risk_id (integer) if risk_id_no didn't match
                const riskIdInt = parseInt(riskIdTrimmed, 10);
                if (!isNaN(riskIdInt)) {
                  const parentById = await parentModel.findFirst({
                    where: {
                      risk_id: riskIdInt,
                    },
                    include: {
                      aps: true,
                    },
                  });

                  if (parentById) {
                    parentRiskId = parentById.risk_id;
                    
                    // Delete all APs for this parent
                    await apModel.deleteMany({
                      where: {
                        [riskIdField]: parentById.risk_id,
                      },
                    });

                    // Delete the parent (risk-assessment)
                    await parentModel.delete({
                      where: { risk_id: parentById.risk_id },
                    });
                  }
                }
              }
            }

            // If we deleted an AP but not the parent, check if parent has any other APs
            if (deletedAp && parentRiskId) {
              const remainingAps = await apModel.findMany({
                where: {
                  [riskIdField]: parentRiskId,
                },
              });

              // If no other APs, delete the parent (risk-assessment)
              if (remainingAps.length === 0) {
                await parentModel.delete({
                  where: { risk_id: parentRiskId },
                });
              }
            }
          } catch (err) {
            // Log error but continue with other findings
            console.error(`Error deleting audit-program data for finding ${finding.id}:`, err);
          }
        }
      }
    }

    // Reset all meta after publish: status and finding result/file so form is clean
    const slug = deptToSlug[dept?.toLowerCase()];
    if (slug) {
      try {
        const metaTable = qIdent(`audit_finding_meta_${slug}`);
        const client = await pool.connect();
        try {
          await client.query(
            `UPDATE ${metaTable} SET preparer_status = NULL, final_status = NULL, finding_result = NULL, finding_result_file_name = NULL, updated_at = NOW()`
          );
        } finally {
          client.release();
        }
      } catch (metaErr) {
        console.warn(`Publish: could not reset meta for ${dept}:`, metaErr.message);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Published ${updated.count} completed findings for ${dept}`,
      count: updated.count 
    }, { status: 200 });
  } catch (err) {
    console.error(`PUT /api/audit-finding/[dept]/publish error:`, err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

