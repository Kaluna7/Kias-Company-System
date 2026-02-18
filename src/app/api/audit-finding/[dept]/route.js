import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";

const prisma = globalThis.prisma || new PrismaClient();
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

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function toIntSafe(v, fallback) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

// Truncate string to max length
function truncateString(str, maxLength) {
  if (!str || str === null || str === undefined) return null;
  const s = String(str);
  if (s.length <= maxLength) return s;
  return s.substring(0, maxLength);
}

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
    accounting: () => prisma.AccountingAp,
    finance: () => prisma.FinanceAp,
    hrd: () => prisma.HrdAp,
    "g&a": () => prisma.GeneralAffairAp,
    ga: () => prisma.GeneralAffairAp,
    sdp: () => prisma.SdpAp,
    tax: () => prisma.TaxAp,
    "l&p": () => prisma.LpAp,
    lp: () => prisma.LpAp,
    mis: () => prisma.MisAp,
    merch: () => prisma.MerchandiseAp,
    ops: () => prisma.OperationalAp,
    whs: () => prisma.WarehouseAp,
  };
  const getter = mapping[dept];
  return getter ? getter() : null;
}

export async function GET(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const delegate = getDelegate(dept);
    if (!delegate) return NextResponse.json({ error: "Invalid department" }, { status: 400 });

    const url = new URL(req.url);
    const page = Math.max(1, toIntSafe(url.searchParams.get("page"), 1));
    const pageSize = Math.max(1, Math.min(100, toIntSafe(url.searchParams.get("pageSize"), 50)));
    const skip = (page - 1) * pageSize;

    const where = {
      NOT: {
        completion_status: {
          equals: "COMPLETED",
          mode: "insensitive",
        },
      },
    };

    // Exclude findings with completion_status = "COMPLETED" (already published)
    const [findings, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy: { id: "desc" },
        skip,
        take: pageSize,
      }),
      delegate.count({ where }),
    ]);

    // Get audit-program mapping for this department
    // This mapping ensures ALL departments in audit-finding connect to their corresponding audit-program
    const apMapping = deptToAuditProgram[dept];
    if (!apMapping) {
      // If no mapping exists for this department, return findings as-is
      console.warn(`[audit-finding/${dept}] No audit-program mapping found for department: ${dept}`);
      return NextResponse.json({ data: findings, meta: { total, page, pageSize } }, { status: 200 });
    }

    const apModel = getAuditProgramAp(dept);
    const parentModel = getAuditProgramParent(dept);

    // For ALL departments: If no findings exist, get all data from audit-program (published) as base data
    // This ensures every department in audit-finding pulls data from audit-program
    if (findings.length === 0 && apModel && parentModel) {
      try {
        console.log(`[audit-finding/${dept}] Loading audit-program data for department: ${dept}`);
        console.log(`[audit-finding/${dept}] Parent model: ${apMapping.parent}, AP model: ${apMapping.ap}`);
        
        const parents = await parentModel.findMany({
          where: { status: "published" },
          include: { aps: true },
          orderBy: { risk_id: "asc" },
        });

        console.log(`[audit-finding/${dept}] Found ${parents.length} published parents`);
        const totalAps = parents.reduce((sum, p) => sum + (p.aps?.length || 0), 0);
        console.log(`[audit-finding/${dept}] Total APs: ${totalAps}`);

        // Flatten: 1 row per AP (same structure as audit-program API)
        const auditProgramData = parents.flatMap((p) =>
          p.aps && p.aps.length > 0
            ? p.aps.map((ap) => ({
                // Finding fields (empty/null since no finding exists yet)
                id: null, // No finding ID yet
                risk_id: p.risk_id_no ?? String(p.risk_id) ?? null,
                risk_description: p.risk_description ?? null,
                risk_details: p.risk_details ?? null,
                ap_code: ap.ap_code ?? null,
                substantive_test: ap.substantive_test ?? null,
                risk: null,
                check_yn: null,
                method: ap.method ?? null,
                preparer: null,
                finding_result: null,
                finding_description: null,
                recommendation: null,
                auditee: null,
                completion_status: null,
                completion_date: null,
                created_at: null,
                updated_at: null,
                // Audit Program fields (populated)
                objective: ap.objective ?? null,
                procedures: ap.procedures ?? null,
                description: ap.description ?? null,
                application: ap.application ?? null,
                owners: p.owners ?? null,
              }))
            : [
                {
                  // Finding fields
                  id: null,
                  risk_id: p.risk_id_no ?? String(p.risk_id) ?? null,
                  risk_description: p.risk_description ?? null,
                  risk_details: p.risk_details ?? null,
                  ap_code: null,
                  substantive_test: null,
                  risk: null,
                  check_yn: null,
                  method: null,
                  preparer: null,
                  finding_result: null,
                  finding_description: null,
                  recommendation: null,
                  auditee: null,
                  completion_status: null,
                  completion_date: null,
                  created_at: null,
                  updated_at: null,
                  // Audit Program fields
                  objective: null,
                  procedures: null,
                  description: null,
                  application: null,
                  owners: p.owners ?? null,
                },
              ]
        );

        console.log(`[audit-finding/${dept}] Returning ${auditProgramData.length} rows from audit-program`);
        return NextResponse.json({ data: auditProgramData }, { status: 200 });
      } catch (err) {
        console.error(`[audit-finding/${dept}] Failed to load audit-program data:`, err);
        console.error(`[audit-finding/${dept}] Error details:`, err.message, err.stack);
        // If failed, return empty array
        return NextResponse.json({ data: [], error: err.message }, { status: 200 });
      }
    }

    // For ALL departments: Enrich existing findings with data from audit-program
    // This ensures that even if findings exist, they are enriched with latest audit-program data
    const enrichedFindings = await Promise.all(
      findings.map(async (finding) => {
        const enriched = { ...finding };
        
        try {
          const apModel = getAuditProgramAp(dept);
          const parentModel = getAuditProgramParent(dept);
          
          if (!apModel || !parentModel) {
            return enriched;
          }

          // Strategy 1: Try to find matching AP by ap_code (exact match, trim whitespace)
          // Only get published audit programs
          if (finding.ap_code) {
            const apCodeTrimmed = String(finding.ap_code).trim();
            const ap = await apModel.findFirst({
              where: { 
                ap_code: apCodeTrimmed,
                [apMapping.relation]: {
                  status: "published"
                }
              },
              include: {
                [apMapping.relation]: {
                  select: {
                    owners: true,
                    risk_id_no: true,
                    risk_id: true,
                  },
                },
              },
            });
            
            if (ap) {
              enriched.objective = ap.objective ?? null;
              enriched.procedures = ap.procedures ?? null;
              enriched.description = ap.description ?? null;
              enriched.application = ap.application ?? null;
              enriched.owners = ap[apMapping.relation]?.owners ?? null;
            }
          }
          
          // Strategy 2: If no AP match by ap_code, try to find by risk_id or risk_id_no
          if (!enriched.objective && finding.risk_id) {
            const riskIdTrimmed = String(finding.risk_id).trim();
            
            // First try to find parent by risk_id_no (string match), only published
            let parent = await parentModel.findFirst({
              where: {
                risk_id_no: riskIdTrimmed,
                status: "published"
              },
              include: {
                aps: {
                  where: finding.ap_code ? {
                    ap_code: String(finding.ap_code).trim()
                  } : undefined,
                  take: 1,
                },
              },
            });

            // If not found by risk_id_no, try by risk_id (integer), only published
            if (!parent) {
              const riskIdInt = toIntOrNull(finding.risk_id);
              if (riskIdInt) {
                parent = await parentModel.findFirst({
                  where: { 
                    risk_id: riskIdInt,
                    status: "published"
                  },
                  include: {
                    aps: {
                      where: finding.ap_code ? {
                        ap_code: String(finding.ap_code).trim()
                      } : undefined,
                      take: 1,
                    },
                  },
                });
              }
            }

            if (parent) {
              enriched.owners = parent.owners ?? null;
              
              // If we have an AP from the parent, use its data
              if (parent.aps && parent.aps.length > 0) {
                const ap = parent.aps[0];
                enriched.objective = ap.objective ?? null;
                enriched.procedures = ap.procedures ?? null;
                enriched.description = ap.description ?? null;
                enriched.application = ap.application ?? null;
              } else if (finding.ap_code) {
                // If we have parent but no matching AP, try to find any AP with matching code
                const apCodeTrimmed = String(finding.ap_code).trim();
                const ap = await apModel.findFirst({
                  where: {
                    ap_code: apCodeTrimmed,
                    [apMapping.relation]: {
                      risk_id: parent.risk_id,
                    },
                  },
                });
                
                if (ap) {
                  enriched.objective = ap.objective ?? null;
                  enriched.procedures = ap.procedures ?? null;
                  enriched.description = ap.description ?? null;
                  enriched.application = ap.application ?? null;
                }
              }
            }
          }

          // Strategy 3: Try to match by risk_id_no if risk_id didn't match, only published
          if (!enriched.objective && finding.risk_id) {
            // Try to find parent by risk_id_no directly (maybe risk_id in finding is actually risk_id_no)
            const parent = await parentModel.findFirst({
              where: {
                risk_id_no: String(finding.risk_id).trim(),
                status: "published"
              },
              include: {
                aps: {
                  where: finding.ap_code ? {
                    ap_code: String(finding.ap_code).trim()
                  } : undefined,
                  take: 1,
                },
              },
            });

            if (parent) {
              enriched.owners = parent.owners ?? null;
              if (parent.aps && parent.aps.length > 0) {
                const ap = parent.aps[0];
                enriched.objective = ap.objective ?? null;
                enriched.procedures = ap.procedures ?? null;
                enriched.description = ap.description ?? null;
                enriched.application = ap.application ?? null;
              }
            }
          }

          // Strategy 4: If still no match and we have risk_description, try fuzzy match, only published
          if (!enriched.objective && finding.risk_description) {
            const parent = await parentModel.findFirst({
              where: {
                risk_description: {
                  contains: finding.risk_description.substring(0, 50), // First 50 chars
                  mode: 'insensitive',
                },
                status: "published"
              },
              include: {
                aps: {
                  take: 1,
                },
              },
            });

            if (parent && parent.aps && parent.aps.length > 0) {
              const ap = parent.aps[0];
              enriched.objective = ap.objective ?? null;
              enriched.procedures = ap.procedures ?? null;
              enriched.description = ap.description ?? null;
              enriched.application = ap.application ?? null;
              enriched.owners = parent.owners ?? null;
            }
          }
        } catch (err) {
          // If join fails, continue with original data
          console.error(`Failed to enrich finding ${finding.id} with audit-program data:`, err);
        }
        
        return enriched;
      })
    );

    return NextResponse.json({ data: enrichedFindings, meta: { total, page, pageSize } }, { status: 200 });
  } catch (err) {
    console.error(`GET /api/audit-finding/[dept] error:`, err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const delegate = getDelegate(dept);
    if (!delegate) return NextResponse.json({ error: "Invalid department" }, { status: 400 });

    const body = await req.json();
    const created = await delegate.create({
      data: {
        risk_id: truncateString(body.riskId, 50),
        risk_description: body.riskDescription ?? null,
        risk_details: body.riskDetails ?? null,
        ap_code: truncateString(body.apCode, 50),
        substantive_test: body.substantiveTest ?? null,
        risk: toIntOrNull(body.risk),
        check_yn: truncateString(body.checkYN, 10),
        method: truncateString(body.method, 100),
        preparer: truncateString(body.preparer, 255),
        finding_result: truncateString(body.findingResult, 100),
        finding_description: body.findingDescription ?? null,
        recommendation: body.recommendation ?? null,
        auditee: truncateString(body.auditee, 255),
        completion_status: truncateString(body.completionStatus, 50),
        completion_date: body.completionDate ? new Date(body.completionDate) : null,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error(`POST /api/audit-finding/[dept] error:`, err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}


