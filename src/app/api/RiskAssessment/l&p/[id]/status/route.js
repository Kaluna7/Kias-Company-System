import { PrismaClient } from "@/generated/prisma";
const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { status } = body;
    if (!status) {
      return new Response(JSON.stringify({ error: "status required" }), { status: 400 });
    }

    const updated = await prisma.lp.update({
      where: { risk_id: Number(id) },
      data: { status },
    });

    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (err) {
    console.error("PUT /api/l&p/[id]/status error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Server error" }), { status: 500 });
  }
}
