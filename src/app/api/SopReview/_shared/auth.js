import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * Allow only users with role "reviewer" to change SOP Review data.
 * Returns a NextResponse error when:
 * - not signed in, or
 * - role is not reviewer.
 *
 * Usage in route:
 *   const authError = await requireReviewer();
 *   if (authError) return authError;
 */
export async function requireReviewer() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user?.role || "").toLowerCase();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (role !== "reviewer") {
      return NextResponse.json(
        { success: false, error: "Forbidden: reviewer only" },
        { status: 403 }
      );
    }

    return null;
  } catch (err) {
    console.error("requireReviewer error:", err);
    return NextResponse.json(
      { success: false, error: "Auth error" },
      { status: 500 }
    );
  }
}

/**
 * Allow SOP editors (preparer / reviewer / admin) to change drafts:
 * - role "user" (preparer)
 * - role "reviewer"
 * - role "admin"
 *
 * Used for: saving SOP steps, meta (preparer/reviewer), audit period, etc.
 * Final publish still uses requireReviewer().
 */
export async function requireSopEditor() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user?.role || "").toLowerCase();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (role !== "reviewer" && role !== "user" && role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: SOP editor only" },
        { status: 403 }
      );
    }

    return null;
  } catch (err) {
    console.error("requireSopEditor error:", err);
    return NextResponse.json(
      { success: false, error: "Auth error" },
      { status: 500 }
    );
  }
}

/**
 * Editing published report data: reviewer or admin only.
 */
export async function requireSopReportPublishedEditor() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user?.role || "").toLowerCase();

    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (role !== "reviewer" && role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: only reviewer or admin can edit published report data" },
        { status: 403 },
      );
    }

    return null;
  } catch (err) {
    console.error("requireSopReportPublishedEditor error:", err);
    return NextResponse.json({ success: false, error: "Auth error" }, { status: 500 });
  }
}


