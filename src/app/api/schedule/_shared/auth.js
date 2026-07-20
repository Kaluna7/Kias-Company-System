import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { canManageSchedule, isAdminLikeRole } from "@/lib/roles";

/**
 * Schedule create/update/delete — super admin only.
 * Returns { error, session } — if error is set, return it from the route.
 */
export async function requireScheduleManager() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return {
        error: NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 },
        ),
        session: null,
      };
    }
    if (!canManageSchedule(session.user.role)) {
      return {
        error: NextResponse.json(
          { success: false, error: "Forbidden: super admin only" },
          { status: 403 },
        ),
        session: null,
      };
    }
    return { error: null, session };
  } catch (err) {
    console.error("requireScheduleManager:", err);
    return {
      error: NextResponse.json(
        { success: false, error: "Auth error" },
        { status: 500 },
      ),
      session: null,
    };
  }
}

/** Archive / finish module from dashboard — admin, reviewer, or super admin. */
export async function requireScheduleArchiver() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return {
        error: NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 },
        ),
        session: null,
      };
    }
    if (!isAdminLikeRole(session.user.role)) {
      return {
        error: NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 },
        ),
        session: null,
      };
    }
    return { error: null, session };
  } catch (err) {
    console.error("requireScheduleArchiver:", err);
    return {
      error: NextResponse.json(
        { success: false, error: "Auth error" },
        { status: 500 },
      ),
      session: null,
    };
  }
}
