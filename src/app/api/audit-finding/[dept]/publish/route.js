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

// Map audit-finding dept slug to Evidence department name (uppercase)
const deptToEvidenceDept = {
  accounting: "ACCOUNTING",
  finance: "FINANCE",
  hrd: "HRD",
  "g&a": "G&A",
  ga: "G&A",
  sdp: "DESIGN STORE PLANNER",
  tax: "TAX",
  "l&p": "SECURITY L&P",
  lp: "SECURITY L&P",
  mis: "MIS",
  merch: "MERCHANDISE",
  ops: "OPERATIONAL",
  whs: "WAREHOUSE",
};

// Publish findings for a department:
// - "Ready" ditentukan dari Evidence: ada file + overall_status = COMPLETE untuk AP-code tsb.
// - Semua finding dengan ap_code di set tersebut dan belum COMPLETED akan di-set ke COMPLETED.
// - Setelah itu Audit Program terkait dihapus seperti sebelumnya.
export async function PUT(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const delegate = getDelegate(dept);
    
    if (!delegate) {
      return NextResponse.json({ error: "Invalid department" }, { status: 400 });
    }

    // Cari AP code yang sudah publish di Evidence (overall_status = COMPLETE + ada file)
    const evidenceDept = deptToEvidenceDept[dept];
    const readyApCodes = new Set();
    if (evidenceDept) {
      const evidenceRows = await prisma.evidence.findMany({
        where: {
          department: evidenceDept,
          file_url: { not: null },
          overall_status: {
            equals: "COMPLETE",
            mode: "insensitive",
          },
        },
        select: { ap_code: true },
      });
      for (const ev of evidenceRows || []) {
        if (!ev.ap_code) continue;
        const code = String(ev.ap_code).trim();
        if (code) readyApCodes.add(code);
      }
    }

    if (readyApCodes.size === 0) {
      return NextResponse.json(
        {
          success: true,
          message: `No AP codes with published Evidence to publish for ${dept}`,
          count: 0,
        },
        { status: 200 },
      );
    }

    // Ambil semua finding yang punya ap_code di dalam set readyApCodes dan belum COMPLETED
    const readyFindings = await delegate.findMany({
      where: {
        ap_code: {
          in: Array.from(readyApCodes),
        },
        NOT: {
          completion_status: {
            equals: "COMPLETED",
            mode: "insensitive",
          },
        },
      },
    });

    if (readyFindings.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: `No findings with published Evidence to publish for ${dept}`,
        count: 0 
      }, { status: 200 });
    }

    // Update findings: set completion_status to COMPLETED dan updated_at supaya muncul di report
    const updated = await delegate.updateMany({
      where: {
        id: {
          in: readyFindings.map((f) => f.id),
        },
      },
      data: {
        completion_status: "COMPLETED",
        updated_at: new Date(),
      },
    });

    // Tambahkan baris COMPLETED baru untuk AP code yang punya Evidence publish,
    // tetapi belum pernah disimpan sebagai finding (tidak ada di readyFindings).
    const existingApCodes = new Set(
      readyFindings
        .map((f) => (f.ap_code != null ? String(f.ap_code).trim() : ""))
        .filter(Boolean),
    );
    const missingApCodes = Array.from(readyApCodes).filter((code) => !existingApCodes.has(code));

    const apMapping = deptToAuditProgram[dept];
    const apModel = apMapping ? getAuditProgramAp(dept) : null;
    const parentModel = apMapping ? getAuditProgramParent(dept) : null;
    const riskIdField = apMapping ? getApRiskIdField(dept) : null;

    if (missingApCodes.length > 0 && apModel && parentModel && riskIdField) {
      for (const apCode of missingApCodes) {
        try {
          const ap = await apModel.findFirst({
            where: { ap_code: apCode },
            include: {
              [apMapping.relation]: true,
            },
          });

          const parent = ap ? ap[apMapping.relation] : null;

          await delegate.create({
            data: {
              risk_id:
                (parent?.risk_id_no != null && String(parent.risk_id_no).trim() !== "")
                  ? String(parent.risk_id_no).trim()
                  : parent?.risk_id != null
                    ? String(parent.risk_id)
                    : null,
              risk_description: parent?.risk_description ?? null,
              risk_details: parent?.risk_details ?? null,
              ap_code: apCode,
              substantive_test: ap?.substantive_test ?? null,
              risk: null,
              check_yn: null,
              method: ap?.method ?? null,
              preparer: null,
              finding_result: null,
              finding_description: null,
              recommendation: null,
              auditee: null,
              completion_status: "COMPLETED",
              completion_date: new Date(),
            },
          });
        } catch (createErr) {
          console.error(`Failed to create COMPLETED finding for ${dept} ap_code=${apCode}:`, createErr);
        }
      }
    }

    // Get audit-program mapping for this department
    const apMappingForCleanup = deptToAuditProgram[dept];
    if (apMappingForCleanup) {
      const apModel = getAuditProgramAp(dept);
      const parentModel = getAuditProgramParent(dept);
      const riskIdField = getApRiskIdField(dept);

      if (apModel && parentModel && riskIdField) {
        // Delete related audit-program data for each published finding
        for (const finding of readyFindings) {
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
                  [apMappingForCleanup.relation]: {
                    select: {
                      risk_id: true,
                    },
                  },
                },
              });

              if (ap) {
                parentRiskId = ap[apMappingForCleanup.relation]?.risk_id;
                
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

    return NextResponse.json(
      {
        success: true,
        message: `Published ${updated.count} finding(s) for ${dept} based on Evidence.`,
        count: updated.count,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error(`PUT /api/audit-finding/[dept]/publish error:`, err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

