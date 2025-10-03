import { PrismaClient } from "@/generated/prisma";
const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

export async function PUT(req, { params }) {
  try {
    const id = parseInt(params.id, 10);
    const body = await req.json();
    delete body.risk_id;
    delete body.risk_id_no;

    const updated = await prisma.general_affair.update({
      where: { risk_id: id },
      data: body,
    });

    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (err) {
    console.error("PUT /api/g&a/[id] error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Server error" }), { status: 500 });
  }
}
