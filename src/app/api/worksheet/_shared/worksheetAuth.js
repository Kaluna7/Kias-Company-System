import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { canEditReviewerFields as canEditReviewerFieldsFromRole } from "@/lib/canEditReviewerFields";
import { isEditorRole } from "@/lib/roles";

/** Session required; role must be user, reviewer, admin, or super_admin (worksheet editors). */
export async function requireWorksheetEditorSession() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return {
        error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
        role: null,
      };
    }
    const role = String(session.user.role || "").toLowerCase();
    if (!isEditorRole(role)) {
      return {
        error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }),
        role: null,
      };
    }
    return { error: null, role };
  } catch (err) {
    console.error("requireWorksheetEditorSession:", err);
    return {
      error: NextResponse.json({ success: false, error: "Auth error" }, { status: 500 }),
      role: null,
    };
  }
}

/**
 * Any worksheet editor may publish to report (user / reviewer / admin / super_admin).
 * Draft vs publish is controlled by body.publishToReport on POST.
 */
export function isWorksheetPublisherRole(role) {
  return isEditorRole(role);
}

/** True when client explicitly requests publish (not a draft save). */
export function wantsWorksheetPublish(body) {
  return body?.publishToReport === true || body?.publish_to_report === true;
}

/** Reviewer name / date on worksheet: only reviewer or admin (PATCH or POST). */
export function canEditWorksheetReviewerFields(role) {
  return canEditReviewerFieldsFromRole(role);
}
