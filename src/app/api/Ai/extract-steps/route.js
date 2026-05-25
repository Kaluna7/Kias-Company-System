export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { hasOpenAIKey, GPT54_MODEL } from "@/app/lib/openaiChat";
import { aiDebugError, aiDebugLog, aiLogAlways, isAiDebugEnabled } from "@/app/lib/aiDebugLog";
import { isVisionOnlyExtractMode } from "@/app/lib/sopExtractMode";
import { runSopPdfPipeline } from "@/app/lib/sopPdfPipeline/runPipeline";
import { runSopVisionOnlyPipeline } from "@/app/lib/sopPdfPipeline/visionOnlyPipeline";
import { toPdfUint8Array } from "@/app/lib/sopPdfPipeline/pdfBytes";
import { detectSopStructureWithGpt } from "@/app/lib/sopExtractStructure";
import { extractProcedureSection } from "@/app/utils/sopProcedureText";

async function handlePdfUpload(req, reqId) {
  const form = await req.formData();
  const file = form.get("pdf");
  const pipelineMode = String(form.get("pipeline") || "").toLowerCase();
  const visionOnly = pipelineMode === "vision" || isVisionOnlyExtractMode();
  const visionPagesRaw = form.get("visionPages");
  const ocrPagesRaw = form.get("ocrPages");
  const wantDebug = form.get("debug") === "true";

  if (!file || typeof file === "string") {
    return NextResponse.json(
      { success: false, error: "Field 'pdf' (file) wajib di FormData.", debug: { step: "missing_pdf", reqId } },
      { status: 400 }
    );
  }

  let ocrPages = [];
  if (ocrPagesRaw && typeof ocrPagesRaw === "string") {
    try {
      const parsed = JSON.parse(ocrPagesRaw);
      if (Array.isArray(parsed)) ocrPages = parsed;
    } catch {
      aiDebugError("extract-steps", `[${reqId}] invalid ocrPages JSON`);
    }
  }

  if (visionOnly) {
    let visionPages = [];
    if (visionPagesRaw && typeof visionPagesRaw === "string") {
      try {
        const parsed = JSON.parse(visionPagesRaw);
        if (Array.isArray(parsed)) visionPages = parsed;
      } catch {
        aiDebugError("extract-steps", `[${reqId}] invalid visionPages JSON`);
      }
    }

    aiLogAlways("extract-steps", `[${reqId}] VISION-ONLY upload`, {
      fileName: file.name,
      visionPageImages: visionPages.length,
    });

    let result;
    try {
      result = await runSopVisionOnlyPipeline({ pageImages: visionPages, reqId });
    } catch (pipeErr) {
      aiDebugError("extract-steps", `[${reqId}] vision exception`, { error: String(pipeErr) });
      return NextResponse.json(
        {
          success: false,
          error: `GPT Vision error: ${pipeErr?.message || pipeErr}`,
          debug: { step: "vision_exception", reqId, mode: "vision_only" },
        },
        { status: 500 }
      );
    }

    const debug = {
      ...(result.debug || {}),
      reqId,
      wantDebug,
      mode: "vision_only",
      pipeline: result.pipeline,
      architecture: result.debug?.architecture,
    };

    if (result.success) {
      return NextResponse.json({
        success: true,
        steps: result.steps,
        model: result.model || GPT54_MODEL,
        mergedText: result.mergedText || "",
        debug,
        pipeline: result.pipeline,
        extractMode: "vision",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error || "GPT Vision gagal mengekstrak langkah.",
        steps: [],
        mergedText: "",
        debug,
        pipeline: result.pipeline,
        extractMode: "vision",
      },
      { status: 200 }
    );
  }

  const pdfBytes = toPdfUint8Array(await file.arrayBuffer());
  aiLogAlways("extract-steps", `[${reqId}] PDF pipeline upload`, {
    fileName: file.name,
    bytes: pdfBytes.length,
    ocrPageImages: ocrPages.length,
  });

  let result;
  try {
    result = await runSopPdfPipeline(pdfBytes, { ocrPages, reqId });
  } catch (pipeErr) {
    aiDebugError("extract-steps", `[${reqId}] pipeline exception`, { error: String(pipeErr) });
    return NextResponse.json(
      {
        success: false,
        error: `PDF pipeline error: ${pipeErr?.message || pipeErr}`,
        debug: { step: "pipeline_exception", reqId },
      },
      { status: 500 }
    );
  }

  const debug = {
    ...(result.debug || {}),
    reqId,
    wantDebug,
    pipeline: result.pipeline,
    mergedChars: result.mergedText?.length ?? 0,
    architecture: result.debug?.architecture,
  };

  if (result.success) {
    return NextResponse.json({
      success: true,
      steps: result.steps,
      model: result.model || GPT54_MODEL,
      mergedText: result.mergedText,
      debug,
      pipeline: result.pipeline,
    });
  }

  return NextResponse.json(
    {
      success: false,
      error: result.error || "Pipeline gagal",
      steps: [],
      mergedText: result.mergedText,
      debug,
      pipeline: result.pipeline,
    },
    { status: 200 }
  );
}

async function handleTextOnly(body, reqId, wantDebug) {
  const { text: fullText } = body;

  if (!fullText || typeof fullText !== "string") {
    return NextResponse.json(
      {
        success: false,
        error: "Field 'text' wajib, atau upload PDF via multipart field 'pdf'.",
        debug: { step: "missing_input", reqId },
      },
      { status: 400 }
    );
  }

  const trimmed = fullText.trim();
  if (trimmed.length < 30) {
    return NextResponse.json(
      {
        success: false,
        error: "Teks terlalu sedikit.",
        debug: { step: "text_too_short", reqId, fullTextChars: trimmed.length },
      },
      { status: 400 }
    );
  }

  const gptResult = await detectSopStructureWithGpt(trimmed);
  const procedureText = extractProcedureSection(trimmed);

  const debug = {
    reqId,
    mode: "text_only",
    fullTextChars: trimmed.length,
    procedureChars: procedureText.length,
    pipeline: [
      { step: "client_text", status: "done" },
      { step: "gpt_structure", status: gptResult.success ? "done" : "failed" },
    ],
  };

  if (gptResult.success) {
    return NextResponse.json({
      success: true,
      steps: gptResult.steps,
      model: gptResult.model,
      mergedText: trimmed,
      debug,
    });
  }

  return NextResponse.json({
    success: false,
    error: gptResult.error,
    steps: [],
    mergedText: trimmed,
    debug,
  });
}

export async function POST(req) {
  const reqId = `ext-${Date.now().toString(36)}`;
  const contentType = req.headers.get("content-type") || "";

  aiLogAlways("extract-steps", `[${reqId}] POST`, {
    hasKey: hasOpenAIKey(),
    contentType: contentType.slice(0, 40),
    debugVerbose: isAiDebugEnabled(),
  });

  try {
    if (!hasOpenAIKey()) {
      return NextResponse.json(
        {
          success: false,
          error: "OPENAI_API_KEY belum diset di server.",
          debug: { step: "missing_api_key", reqId },
        },
        { status: 500 }
      );
    }

    if (contentType.includes("multipart/form-data")) {
      return handlePdfUpload(req, reqId);
    }

    const body = await req.json().catch(() => ({}));
    const wantDebugJson = Boolean(body.debug);
    return handleTextOnly(body, reqId, wantDebugJson);
  } catch (err) {
    aiDebugError("extract-steps", "exception", { reqId, error: String(err), stack: err?.stack?.slice(0, 500) });
    return NextResponse.json(
      { success: false, error: "Server error", details: String(err), debug: { step: "exception", reqId } },
      { status: 500 }
    );
  }
}
