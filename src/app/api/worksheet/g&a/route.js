import { PrismaClient } from "@/generated/prisma";
import { buildWorksheetFindManyWhere } from "../_shared/worksheetWhere";
import { requireWorksheetEditorSession, isWorksheetPublisherRole } from "../_shared/worksheetAuth";
import { executeWorksheetPost } from "../_shared/executeWorksheetPost";
import { executeWorksheetPatch } from "../_shared/executeWorksheetPatch";

const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

export async function GET(req) {
  try {
    const url = new URL(req?.url || "", "http://localhost");
    const where = buildWorksheetFindManyWhere("G&A", url.searchParams);

    const rows = await prisma.worksheet_finance.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
    return new Response(JSON.stringify({ success: true, rows }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GET /api/worksheet/g&a error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(req) {
  try {
    const { error, role } = await requireWorksheetEditorSession();
    if (error) return error;
    const body = await req.json();
    const publish = isWorksheetPublisherRole(role);
    const data = await executeWorksheetPost(prisma, "G&A", body, publish);
    return new Response(
      JSON.stringify({ success: true, data, published_to_report: publish }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("POST /api/worksheet/g&a error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function PATCH(req) {
  try {
    const { error } = await requireWorksheetEditorSession();
    if (error) return error;
    const body = await req.json();
    const url = new URL(req?.url || "", "http://localhost");
    await executeWorksheetPatch(prisma, "G&A", body, url.searchParams.get("year"));
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("PATCH /api/worksheet/g&a error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message ?? "Server error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
