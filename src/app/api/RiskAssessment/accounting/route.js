import { PrismaClient } from "@/generated/prisma";
import { backfillRiskIdNoForRows, ensureRiskIdNo } from "../_shared/riskIdNo";
const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

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

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const includeAps = searchParams.get("includeAps") === "true";
    const yearParam = searchParams.get("year");
    const page = Math.max(1, toIntSafe(searchParams.get("page"), 1));
    const pageSize = Math.max(1, Math.min(100, toIntSafe(searchParams.get("pageSize"), 50)));
    const skip = (page - 1) * pageSize;

    const where = {
      ...(status ? { status } : {}),
    };

    const year = yearParam ? parseInt(yearParam, 10) : null;
    if (!Number.isNaN(year) && year) {
      where.created_at = {
        gte: new Date(year, 0, 1),
        lt: new Date(year + 1, 0, 1),
      };
    }

    const [accountings, total] = await Promise.all([
      prisma.accounting.findMany({
        where,
        include: includeAps ? { aps: true } : undefined,
        orderBy: { risk_id: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.accounting.count({ where }),
    ]);
    const safeAccountings = await backfillRiskIdNoForRows(prisma.accounting, accountings);

    // If includeAps is true, return risk data with substantive_test from first AP (for evidence page)
    if (includeAps) {
      const flattened = safeAccountings.map((p) => {
        // Get first AP's substantive_test if exists
        const firstAp = p.aps && p.aps.length > 0 ? p.aps[0] : null;
        return {
          risk_id: p.risk_id,
          risk_id_no: p.risk_id_no ?? "",
          category: p.category ?? "",
          sub_department: p.sub_department ?? "",
          sop_related: p.sop_related ?? "",
          risk_description: p.risk_description ?? "",
          risk_details: p.risk_details ?? "",
          impact_description: p.impact_description ?? "",
          impact_level: p.impact_level ?? null,
          probability_level: p.probability_level ?? null,
          priority_level: p.priority_level ?? 0,
          mitigation_strategy: p.mitigation_strategy ?? "",
          owners: p.owners ?? "",
          root_cause_category: p.root_cause_category ?? "",
          onset_timeframe: p.onset_timeframe ?? "",
          status: p.status ?? "",

          // Use risk_id_no as AP Code
          ap_code: p.risk_id_no ?? "",
          substantive_test: firstAp?.substantive_test ?? p.risk_description ?? "",
        };
      });
      return new Response(JSON.stringify({ data: flattened, meta: { total, page, pageSize } }), { status: 200 });
    }

    return new Response(JSON.stringify({ data: safeAccountings, meta: { total, page, pageSize } }), { status: 200 });
  } catch (err) {
    console.error("GET /api/RiskAssessment/accounting error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Server error" }),
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const created = await prisma.accounting.create({
      data: {
        category: body.category ?? null,
        sub_department: body.sub_department ?? null,
        risk_description: body.risk_description ?? null,
        sop_related: body.sop_related ?? null,
        risk_details: body.risk_details ?? null,
        impact_description: body.impact_description ?? null,
        impact_level: toIntOrNull(body.impact_level),
        probability_level: toIntOrNull(body.probability_level),
        priority_level: toIntOrNull(body.priority_level),
        mitigation_strategy: body.mitigation_strategy ?? null,
        owners: body.owners ?? null,
        root_cause_category: body.root_cause_category ?? null,
        onset_timeframe: body.onset_timeframe ?? null,
      },
    });

    const risk_id_no = await ensureRiskIdNo(prisma.accounting, created.risk_id, created.risk_id_no);
    return new Response(JSON.stringify({ ...created, risk_id_no }), { status: 201 });
  } catch (err) {
    console.error("POST /api/accounting error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Server error" }),
      { status: 500 },
    );
  }
}
