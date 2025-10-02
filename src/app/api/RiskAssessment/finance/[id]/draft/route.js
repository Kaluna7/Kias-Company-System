import { PrismaClient } from "@/generated/prisma";
const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

export async function PUT(req, { params }) {
  try {
    const { id } = params;

    // update status ke draft
    const updated = await prisma.finance.update({
      where: { risk_id: Number(id) }, // pastikan risk_id di DB berupa int
      data: { status: "draft" },
    });

    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (err) {
    console.error("PUT /api/finance/[id]/draft error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Server error" }),
      { status: 500 }
    );
  }
}
