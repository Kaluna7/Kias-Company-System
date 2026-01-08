import { PrismaClient } from "@/generated/prisma";
const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const includeAps = searchParams.get("includeAps") === "true";

    const operationals = await prisma.operational.findMany({
      where: status ? { status } : undefined,
      include: includeAps ? { aps: true } : undefined,
      orderBy: { risk_id: "desc" },
    });

    // If includeAps is true, return risk data with substantive_test from first AP (for evidence page)
    if (includeAps) {
      const flattened = operationals.map((p) => {
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
      return new Response(JSON.stringify(flattened), { status: 200 });
    }

    return new Response(JSON.stringify(operationals), { status: 200 });
  } catch (err) {
    console.error("GET /api/RiskAssessment/ops error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Server error" }),
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const created = await prisma.operational.create({
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

    // created should already contain risk_id_no because trigger runs BEFORE INSERT
    return new Response(JSON.stringify(created), { status: 201 });
  } catch (err) {
    console.error("POST /api/operational error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Server error" }),
      { status: 500 },
    );
  }
}
