export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  createFolder,
  listFoldersByYear,
  listYearsWithFiles,
  sanitizeFolderName,
} from "@/app/lib/files/fileStore";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const year = parseYear(searchParams.get("year"));
    if (!year) {
      return NextResponse.json({ success: false, error: "Missing or invalid year" }, { status: 400 });
    }

    const folders = await listFoldersByYear(year);
    const availableYears = await listYearsWithFiles();
    if (!availableYears.includes(year)) {
      availableYears.unshift(year);
      availableYears.sort((a, b) => b - a);
    }

    return NextResponse.json({
      success: true,
      year,
      folders,
      availableYears: [...new Set(availableYears)].sort((a, b) => b - a),
    });
  } catch (err) {
    console.error("GET /api/files/folders:", err);
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const year = parseYear(body.year);
    const name = sanitizeFolderName(body.name);

    if (!year) {
      return NextResponse.json({ success: false, error: "Missing or invalid year" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ success: false, error: "Folder name is required" }, { status: 400 });
    }

    const folder = await createFolder(year, {
      name,
      createdBy: {
        id: session.user.id || session.user.email || "user",
        name: session.user.name || session.user.email || "User",
        email: session.user.email || "",
      },
    });

    return NextResponse.json({ success: true, year, folder });
  } catch (err) {
    console.error("POST /api/files/folders:", err);
    const msg = err?.message || String(err);
    const status = msg.includes("already exists") ? 409 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
