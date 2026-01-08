import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const rows = await prisma.worksheet_finance.findMany({
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
        status_wp: body.statusWP || "Not Checked",
        file_path: body.filePath || null,
        audit_area: body.auditArea || null,
      },
    });
    return new Response(JSON.stringify({ success: true, data: created }), {
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

