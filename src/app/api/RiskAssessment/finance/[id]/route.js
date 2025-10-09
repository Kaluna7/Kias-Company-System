// /app/api/RiskAssessment/finance/[id]/route.js  (atau sesuai path Anda)
import { PrismaClient } from "@/generated/prisma";
const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  // jika sudah number, return int
  if (typeof v === "number") return Number.isInteger(v) ? v : Math.trunc(v);
  // jika string, coba parse
  const n = parseInt(String(v).trim(), 10);
  return Number.isNaN(n) ? null : n;
}

export async function PUT(req, { params }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id || Number.isNaN(id)) {
      return new Response(JSON.stringify({ error: "Invalid id" }), { status: 400 });
    }

    const body = await req.json();

    // jangan coba update primary id / generated fields
    delete body.risk_id;
    delete body.risk_id_no;

    // Daftar field yang harus dipaksa jadi integer atau null
    const numericFields = [
      "impact_level",
      "probability_level",
      "priority_level"
    ];

    const data = { ...body };

    // normalisasi numeric fields
    for (const nf of numericFields) {
      if (nf in data) {
        data[nf] = toIntOrNull(data[nf]);
      }
    }

    // jika ada field lain yang perlu transformasi (contoh: boolean), lakukan di sini

    const updated = await prisma.finance.update({
      where: { risk_id: id },
      data,
    });

    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (err) {
    console.error("PUT /api/finance/[id] error:", err);
    const message = err?.message ?? "Server error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
