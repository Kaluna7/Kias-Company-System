export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createPreviewWsTicket } from "@/app/lib/report/previewWsAuth";

/**
 * Issue a short-lived WebSocket ticket (browser sends this on WS upgrade query string).
 * GET /api/report/preview-ws-token
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json(
        { success: false, error: "NEXTAUTH_SECRET not configured" },
        { status: 500 },
      );
    }

    const token = createPreviewWsTicket(session.user, secret);
    if (!token) {
      return NextResponse.json({ success: false, error: "Failed to create ticket" }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, token },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("GET /api/report/preview-ws-token:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
