export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { callOpenAIChat, hasOpenAIKey } from "@/app/lib/openaiChat";
import {
  buildDeptConclusionAiContext,
  buildReportAiContext,
  formatReportAiContextForPrompt,
} from "@/app/lib/report/ai/buildReportAiContext";
import {
  buildReportAiUserMessage,
  REPORT_AI_TASKS,
} from "@/app/lib/report/ai/reportAiPrompts";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!hasOpenAIKey()) {
      return NextResponse.json(
        {
          success: false,
          error: "OPENAI_API_KEY belum diset di server. Hubungi admin.",
        },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.sessionId || "").trim();
    const year = parseInt(String(body.year || ""), 10);
    const taskId = String(body.task || "custom").trim();
    const customPrompt = String(body.prompt || "").trim();
    const deptKey = String(body.deptKey || "").trim();
    const deptSection =
      body.deptSection && typeof body.deptSection === "object" ? body.deptSection : undefined;

    if (!sessionId && !Number.isFinite(year)) {
      return NextResponse.json(
        { success: false, error: "Missing year or sessionId" },
        { status: 400 },
      );
    }

    if (taskId === "custom" && !customPrompt) {
      return NextResponse.json(
        { success: false, error: "Tulis instruksi untuk AI terlebih dahulu." },
        { status: 400 },
      );
    }

    if (taskId === "conclusion_dept" && !deptKey) {
      return NextResponse.json(
        { success: false, error: "Missing deptKey for conclusion_dept" },
        { status: 400 },
      );
    }

    const context =
      taskId === "conclusion_dept"
        ? await buildDeptConclusionAiContext({
            sessionId: sessionId || undefined,
            year: Number.isFinite(year) ? year : undefined,
            deptKey,
            deptSection,
          })
        : await buildReportAiContext({
            sessionId: sessionId || undefined,
            year: Number.isFinite(year) ? year : undefined,
          });
    const contextJson = formatReportAiContextForPrompt(context);
    const task = REPORT_AI_TASKS[taskId] || REPORT_AI_TASKS.custom;
    const userMessage = buildReportAiUserMessage(taskId, contextJson, customPrompt);

    const model =
      process.env.OPENAI_REPORT_MODEL?.trim() ||
      process.env.OPENAI_COMMENTS_MODEL?.trim() ||
      undefined;

    const result = await callOpenAIChat(userMessage, {
      model,
      system: task.system,
      temperature: 0.3,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || "AI request failed" },
        { status: result.status || 500 },
      );
    }

    const text = String(result.generated || "").trim();
    if (!text) {
      return NextResponse.json(
        { success: false, error: "AI tidak mengembalikan teks. Coba lagi." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      task: taskId,
      text,
      year: context.year,
      deptKey: taskId === "conclusion_dept" ? deptKey : undefined,
      deptCount: context.departments?.length ?? (context.department ? 1 : 0),
    });
  } catch (err) {
    console.error("POST /api/report/ai/assist:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
