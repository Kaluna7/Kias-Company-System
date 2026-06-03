export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { readDocx, saveDocx, docxExists } from "@/app/lib/report/documentStore";
import { appendPlainTextToDocx } from "@/app/lib/report/ai/appendDocxText";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.sessionId || "").trim();
    const text = String(body.text || "").trim();

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Missing sessionId" }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ success: false, error: "Missing text" }, { status: 400 });
    }

    if (!(await docxExists(sessionId))) {
      return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
    }

    const docxBuffer = await readDocx(sessionId);
    const updated = appendPlainTextToDocx(docxBuffer, text);
    await saveDocx(sessionId, updated);

    return NextResponse.json({
      success: true,
      sessionId,
      message:
        "Teks ditambahkan di akhir dokumen. Dokumen akan dimuat ulang di editor — pindahkan ke bagian Conclusion jika perlu.",
    });
  } catch (err) {
    console.error("POST /api/report/ai/insert:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
