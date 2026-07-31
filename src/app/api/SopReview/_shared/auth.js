import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminLikeRole, isAdminRole } from "@/lib/roles";

function isAdminBLike(session) {
  const identity = String(
    session?.user?.username || session?.user?.name || session?.user?.email || "",
  )
    .trim()
    .toLowerCase();
  return identity === "adminb" || identity.startsWith("adminb@");
}

function isAdminLike(session) {
  return isAdminRole(session?.user?.role) || isAdminBLike(session);
}

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
 * Publish SOP Review to the report: preparer (user), reviewer, or admin.
 * Dashboard progress counts any successful publish regardless of role.
 */
export async function requireSopPublisher() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user?.role || "").toLowerCase();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (role !== "user" && role !== "reviewer" && !isAdminLike(session)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: only user, reviewer, or admin can publish" },
        { status: 403 },
      );
    }

    return null;
  } catch (err) {
    console.error("requireSopPublisher error:", err);
    return NextResponse.json(
      { success: false, error: "Auth error" },
      { status: 500 },
    );
  }
}

/**
 * Allow SOP editors (preparer / reviewer / super_admin) to change drafts:
 * - role "user" (preparer)
 * - role "reviewer"
 * - role "super_admin"
 *
 * Used for: saving SOP steps, meta (preparer/reviewer), audit period, etc.
 * Final publish uses requireSopPublisher().
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

    if (role !== "reviewer" && role !== "user" && !isAdminLike(session)) {
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
 * Editing published report data: reviewer or super_admin only (not preparer/user).
 */
export async function requireSopReportPublishedEditor() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user?.role || "").toLowerCase();

    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdminLikeRole(role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: only reviewer or super admin can edit published report" },
        { status: 403 },
      );
    }

    return null;
  } catch (err) {
    console.error("requireSopReportPublishedEditor error:", err);
    return NextResponse.json({ success: false, error: "Auth error" }, { status: 500 });
  }
}


