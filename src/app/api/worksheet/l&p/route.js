import { PrismaClient } from "@/generated/prisma";
import {
  buildWorksheetFindManyWhere,
  buildDraftWhereClause,
  yearCreatedAtFilter,
} from "../_shared/worksheetWhere";

const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

export async function GET(req) {
  try {
    const url = new URL(req?.url || "", "http://localhost");
    const where = buildWorksheetFindManyWhere("SECURITY L&P", url.searchParams);

    const rows = await prisma.worksheet_finance.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
    return new Response(JSON.stringify({ success: true, rows }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GET /api/worksheet/l&p error:", err);
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
        department: body.department || "SECURITY L&P",
        preparer: body.preparer || null,
        reviewer: body.reviewer || null,
        preparer_date: body.preparerDate ? new Date(body.preparerDate) : null,
        reviewer_date: body.reviewerDate ? new Date(body.reviewerDate) : null,
        status_documents: body.statusDocuments || null,
        status_worksheet: body.statusWorksheet || "IN PROGRESS",
        status_wp: body.statusWP !== undefined && body.statusWP !== "" ? body.statusWP : null,
        file_path: body.filePath || null,
        audit_area: body.auditArea || null,
        published_to_report: true,
      },
    });

    const yf = yearCreatedAtFilter(body.year);
    const delWhere = {
      department: created.department,
      id: { not: created.id },
      published_to_report: false,
    };
    if (yf) delWhere.created_at = yf;
    await prisma.worksheet_finance.deleteMany({ where: delWhere });

    await prisma.worksheet_finance.update({
      where: { id: created.id },
      data: { status_wp: null },
    });
    return new Response(JSON.stringify({ success: true, data: { ...created, status_wp: null } }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("POST /api/worksheet/l&p error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const url = new URL(req?.url || "", "http://localhost");
    const draftWhere = buildDraftWhereClause("SECURITY L&P", url.searchParams.get("year"));

    const latest = await prisma.worksheet_finance.findFirst({
      where: draftWhere,
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
          department: "SECURITY L&P",
          status_wp: body.statusWP !== undefined && body.statusWP !== "" ? body.statusWP : null,
          published_to_report: false,
        },
      });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("PATCH /api/worksheet/l&p error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message ?? "Server error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
