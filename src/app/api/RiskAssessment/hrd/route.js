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
    const page = Math.max(1, toIntSafe(searchParams.get("page"), 1));
    const pageSize = Math.max(1, Math.min(100, toIntSafe(searchParams.get("pageSize"), 50)));
    const skip = (page - 1) * pageSize;

    const where = {
      ...(status ? { status } : {}),
    };

    const [hrds, total] = await Promise.all([
      prisma.hrd.findMany({
        where,
        include: includeAps ? { aps: true } : undefined,
        orderBy: { risk_id: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.hrd.count({ where: where ?? {} }),
    ]);

    const safeHrd = await backfillRiskIdNoForRows(prisma.hrd, hrds);

    if (includeAps) {
      const flattened = safeHrd.map((p) => {
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
          ap_code: p.risk_id_no ?? "",
          substantive_test: firstAp?.substantive_test ?? p.risk_description ?? "",
        };
      });
      return new Response(JSON.stringify({ data: flattened, meta: { total, page, pageSize } }), { status: 200 });
    }

    return new Response(JSON.stringify({ data: safeHrd, meta: { total, page, pageSize } }), { status: 200 });
  } catch (err) {
    console.error("GET /api/hrd error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Server error" }),
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const created = await prisma.hrd.create({
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

    const risk_id_no = await ensureRiskIdNo(prisma.hrd, created.risk_id, created.risk_id_no);
    return new Response(JSON.stringify({ ...created, risk_id_no }), { status: 201 });
  } catch (err) {
    console.error("POST /api/hrd error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Server error" }),
      { status: 500 },
    );
  }
}
