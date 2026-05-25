import { aiDebugLog, aiLogAlways } from "@/app/lib/aiDebugLog";
import { detectSopStructureWithGpt } from "@/app/lib/sopExtractStructure";
import { mergePageTexts } from "@/app/lib/sopPdfPipeline/mergeText";
import { pageNeedsOcr } from "@/app/lib/sopPdfPipeline/needsOcr";
import { ocrPageImageWithVision } from "@/app/lib/sopPdfPipeline/ocrVision";
import { parsePdfTextFromBuffer } from "@/app/lib/sopPdfPipeline/parsePdfText";

/**
 * Full SOP PDF pipeline:
 * Upload PDF → PDF Parser → OCR Fallback → Merge Text → GPT Structure → JSON
 *
 * @param {Buffer|Uint8Array|ArrayBuffer} pdfBytes
 * @param {{ ocrPages?: Array<{ page: number, imageBase64: string, mime?: string }>, reqId?: string }} [opts]
 */
export async function runSopPdfPipeline(pdfBytes, opts = {}) {
  const reqId = opts.reqId || `pipe-${Date.now().toString(36)}`;
  const pipeline = [];
  const ocrByPage = new Map(
    (opts.ocrPages || []).map((p) => [Number(p.page), p])
  );

  aiLogAlways("sop-pipeline", `[${reqId}] start`, {
    pdfBytes: pdfBytes?.length ?? pdfBytes?.byteLength ?? 0,
    clientOcrPages: ocrByPage.size,
  });

  /* 1. PDF Parser */
  pipeline.push({ step: "pdf_parser", status: "start" });
  const { pages: parsedPages, numPages } = await parsePdfTextFromBuffer(pdfBytes);
  pipeline.push({
    step: "pdf_parser",
    status: "done",
    numPages,
    charCounts: parsedPages.map((p) => p.charCount),
  });

  /* 2. OCR Fallback */
  pipeline.push({ step: "ocr_fallback", status: "start" });
  const pagesWithOcr = [];

  const parserPreview = parsedPages.map((p) => p.parserText).join("\n\n---PAGE---\n\n");

  for (const p of parsedPages) {
    const need = pageNeedsOcr(p, parserPreview) || ocrByPage.has(p.page);
    let ocrText = "";
    let ocrSource = null;

    if (need) {
      const clientImg = ocrByPage.get(p.page);
      if (clientImg?.imageBase64) {
        const ocrRes = await ocrPageImageWithVision(
          clientImg.imageBase64,
          p.page,
          clientImg.mime || "image/png"
        );
        if (ocrRes.ok) {
          ocrText = ocrRes.text;
          ocrSource = "client_image+openai";
        } else {
          ocrSource = `client_image_failed:${ocrRes.error}`;
        }
      } else {
        ocrSource = "skipped_no_image";
      }
    }

    pagesWithOcr.push({
      page: p.page,
      parserText: p.parserText,
      charCount: p.charCount,
      needsOcr: need,
      ocrText,
      ocrSource,
    });
  }

  pipeline.push({
    step: "ocr_fallback",
    status: "done",
    ocrPages: pagesWithOcr.filter((p) => p.needsOcr).map((p) => ({
      page: p.page,
      ocrSource: p.ocrSource,
      ocrLen: p.ocrText?.length ?? 0,
    })),
  });

  /* 3. Merge Text */
  pipeline.push({ step: "merge_text", status: "start" });
  const { pages: mergedPages, fullText } = mergePageTexts(pagesWithOcr);
  pipeline.push({
    step: "merge_text",
    status: "done",
    totalChars: fullText.length,
  });

  if (!fullText || fullText.trim().length < 30) {
    return {
      success: false,
      error: "Teks PDF kosong setelah parser + OCR. Pastikan PDF valid atau halaman gambar dikirim untuk OCR.",
      steps: [],
      mergedText: fullText || "",
      pipeline,
      debug: { reqId, step: "empty_merged_text" },
    };
  }

  /* 4. GPT Detect SOP Structure */
  pipeline.push({ step: "gpt_structure", status: "start" });
  aiDebugLog("sop-pipeline", `[${reqId}] gpt_structure`, { mergedChars: fullText.length });

  const gptResult = await detectSopStructureWithGpt(fullText);
  pipeline.push({
    step: "gpt_structure",
    status: gptResult.success ? "done" : "failed",
    stepsCount: gptResult.steps?.length ?? 0,
    error: gptResult.error || null,
  });

  /* 5. Return Structured JSON */
  return {
    success: gptResult.success,
    steps: gptResult.steps || [],
    error: gptResult.error,
    mergedText: fullText,
    model: gptResult.model,
    pipeline,
    debug: {
      reqId,
      numPages,
      mergedChars: fullText.length,
      procedureChars: gptResult.procedureChars,
      architecture: [
        "upload_pdf",
        "pdf_parser",
        "ocr_fallback",
        "merge_text",
        "gpt_detect_sop_structure",
        "return_structured_json",
      ],
    },
  };
}
