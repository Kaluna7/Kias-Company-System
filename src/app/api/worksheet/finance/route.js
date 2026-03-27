import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

export async function GET(req) {
  try {
    const url = new URL(req?.url || "", "http://localhost");
    const yearParam = url.searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : null;

    const where = { department: "FINANCE" };
    if (!Number.isNaN(year) && year) {
      const from = new Date(year, 0, 1);
      const to = new Date(year + 1, 0, 1);
      where.created_at = { gte: from, lt: to };
    }

    const rows = await prisma.worksheet_finance.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
    return new Response(JSON.stringify({ success: true, rows }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GET /api/worksheet/finance error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const created = await prisma.worksheet_finance.create({
      data: {
        department: body.department || "FINANCE",
        preparer: body.preparer || null,
        reviewer: body.reviewer || null,
        preparer_date: body.preparerDate ? new Date(body.preparerDate) : null,
        reviewer_date: body.reviewerDate ? new Date(body.reviewerDate) : null,
        status_documents: body.statusDocuments || null,
        status_worksheet: body.statusWorksheet || "IN PROGRESS",
        status_wp: (body.statusWP !== undefined && body.statusWP !== "" ? body.statusWP : null),
        file_path: body.filePath || null,
        audit_area: body.auditArea || null,
      },
    });
    await prisma.worksheet_finance.update({
      where: { id: created.id },
      data: { status_wp: null },
    });
    return new Response(JSON.stringify({ success: true, data: { ...created, status_wp: null } }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("POST /api/worksheet/finance error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const latest = await prisma.worksheet_finance.findFirst({
      where: { department: "FINANCE" },
      orderBy: { created_at: "desc" },
    });
    if (latest) {
      await prisma.worksheet_finance.update({
        where: { id: latest.id },
        data: { status_wp: body.statusWP !== undefined && body.statusWP !== "" ? body.statusWP : null },
      });
    } else {
      await prisma.worksheet_finance.create({
        data: {
          department: "FINANCE",
          status_wp: body.statusWP !== undefined && body.statusWP !== "" ? body.statusWP : null,
        },
      });
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("PATCH /api/worksheet/finance error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

