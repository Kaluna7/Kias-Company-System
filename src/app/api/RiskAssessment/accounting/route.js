import { PrismaClient } from "@/generated/prisma";
const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

export async function GET() {
  try {
    const accountings = await prisma.accounting.findMany({
      orderBy: { risk_id: "desc" },
    });
    return new Response(JSON.stringify(accountings), { status: 200 });
  } catch (err) {
    console.error("GET /api/accounting error:", err);
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

    // created should already contain risk_id_no because trigger runs BEFORE INSERT
    return new Response(JSON.stringify(created), { status: 201 });
  } catch (err) {
    console.error("POST /api/accounting error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Server error" }),
      { status: 500 },
    );
  }
}
