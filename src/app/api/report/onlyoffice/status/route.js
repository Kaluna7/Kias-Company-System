export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isOnlyOfficeEnabled } from "@/app/lib/report/onlyoffice/jwt";
import {
  checkOnlyOfficeDocumentServer,
  getOnlyOfficeLocalStartHint,
} from "@/app/lib/report/onlyoffice/health";

/** Diagnostic: why OnlyOffice editor returns 503. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const enabled = isOnlyOfficeEnabled();
  const health = enabled
    ? await checkOnlyOfficeDocumentServer()
    : { ok: false, internalUrl: "", publicUrl: "", detail: "ONLYOFFICE_* env not set" };

  return NextResponse.json({
    configured: enabled,
    documentServerReachable: health.ok,
    health,
    env: {
      ONLYOFFICE_URL: process.env.ONLYOFFICE_URL || null,
      NEXT_PUBLIC_ONLYOFFICE_URL: process.env.NEXT_PUBLIC_ONLYOFFICE_URL || null,
      hasJwtSecret: Boolean(process.env.ONLYOFFICE_JWT_SECRET),
      REPORT_DOCUMENT_HOST_URL: process.env.REPORT_DOCUMENT_HOST_URL || null,
    },
    setupHint: getOnlyOfficeLocalStartHint(),
    configApiWouldReturn503: enabled && !health.ok,
  });
}
