import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/** Session required; role must be user, reviewer, or admin (worksheet editors). */
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
    if (role !== "user" && role !== "reviewer" && role !== "admin") {
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

/** Only reviewer/admin may publish to report; preparer (user) saves drafts only. */
export function isWorksheetPublisherRole(role) {
  return role === "reviewer" || role === "admin";
}
