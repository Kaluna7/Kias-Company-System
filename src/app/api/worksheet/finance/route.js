import { PrismaClient } from "@/generated/prisma";
import { buildWorksheetFindManyWhere } from "../_shared/worksheetWhere";
import {
  requireWorksheetEditorSession,
  isWorksheetPublisherRole,
  canEditWorksheetReviewerFields,
} from "../_shared/worksheetAuth";
import { executeWorksheetPost } from "../_shared/executeWorksheetPost";
import { executeWorksheetPatch } from "../_shared/executeWorksheetPatch";
import {
  worksheetStatusWpAllowsPublish,
  worksheetFilePathAllowsPublish,
  worksheetAuditAreaAllowsPublish,
  worksheetReviewerAllowsPublish,
  worksheetReviewerDateAllowsPublish,
  WORKSHEET_PUBLISH_REQUIRES_CHECKED_MESSAGE,
  WORKSHEET_PUBLISH_REQUIRES_FILE_MESSAGE,
  WORKSHEET_PUBLISH_REQUIRES_AUDIT_AREA_MESSAGE,
  WORKSHEET_PUBLISH_REQUIRES_REVIEWER_MESSAGE,
  WORKSHEET_PUBLISH_REQUIRES_REVIEWER_DATE_MESSAGE,
} from "../_shared/worksheetPublishValidation";

const prisma = new PrismaClient();

export async function GET(req) {
  try {
    const url = new URL(req?.url || "", "http://localhost");
    const where = buildWorksheetFindManyWhere("FINANCE", url.searchParams);

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
    const { error, role } = await requireWorksheetEditorSession();
    if (error) return error;
    const body = await req.json();
    const publish = isWorksheetPublisherRole(role);
    if (publish && !worksheetFilePathAllowsPublish(body.filePath)) {
      return new Response(
        JSON.stringify({ success: false, error: WORKSHEET_PUBLISH_REQUIRES_FILE_MESSAGE }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    if (publish && !worksheetStatusWpAllowsPublish(body.statusWP)) {
      return new Response(
        JSON.stringify({ success: false, error: WORKSHEET_PUBLISH_REQUIRES_CHECKED_MESSAGE }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    if (publish && !worksheetAuditAreaAllowsPublish(body.auditArea)) {
      return new Response(
        JSON.stringify({ success: false, error: WORKSHEET_PUBLISH_REQUIRES_AUDIT_AREA_MESSAGE }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    if (publish && !worksheetReviewerAllowsPublish(body.reviewer)) {
      return new Response(
        JSON.stringify({ success: false, error: WORKSHEET_PUBLISH_REQUIRES_REVIEWER_MESSAGE }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    if (publish && !worksheetReviewerDateAllowsPublish(body.reviewerDate)) {
      return new Response(
        JSON.stringify({ success: false, error: WORKSHEET_PUBLISH_REQUIRES_REVIEWER_DATE_MESSAGE }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    const data = await executeWorksheetPost(prisma, "FINANCE", body, publish);
    return new Response(
      JSON.stringify({ success: true, data, published_to_report: publish }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
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
    const { error, role } = await requireWorksheetEditorSession();
    if (error) return error;
    const body = await req.json();
    const url = new URL(req?.url || "", "http://localhost");
    await executeWorksheetPatch(
      prisma,
      "FINANCE",
      body,
      url.searchParams.get("year"),
      canEditWorksheetReviewerFields(role),
    );
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
