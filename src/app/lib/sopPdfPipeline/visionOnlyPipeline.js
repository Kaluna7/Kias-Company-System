import { aiDebugError, aiLogAlways, aiDebugLog } from "@/app/lib/aiDebugLog";
import {
  resolveOpenAIModel,
  SOP_STEPS_JSON_SCHEMA,
  GPT54_MODEL,
} from "@/app/lib/openaiChat";
import { tryParseStepsPayload } from "@/app/lib/sopExtractStructure";
import { formatStepTextForDisplay } from "@/app/utils/sopProcedureText";

const BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
  /\/+$/,
  ""
);
const RESPONSES_URL = `${BASE_URL}/responses`;
const VISION_MODEL =
  process.env.OPENAI_VISION_EXTRACT_MODEL ||
  process.env.OPENAI_EXTRACT_STEPS_MODEL ||
  GPT54_MODEL;

const VISION_INSTRUCTIONS = `You are an expert SOP (Standard Operating Procedure) extractor reading PDF page images.

OUTPUT: Return JSON only, matching the provided schema: {"steps":[{"step":1,"text":"..."}, ...]}.

SCOPE — WHAT TO EXTRACT:
- Extract executable procedure / work steps only (actions someone must perform).
- Typical section titles (any language): Prosedur, Procedure, Work Instruction, Alur Kerja, Process Flow, Steps, Activities, NO Prosedur, numbered workflow tables.
- Include steps shown inside tables, numbered lists (1. 2. 3.), lettered lists (a. b.), bullet lists when each bullet is a distinct action, and text in flowchart/boxes that describes an action.
- Include text visible in images, diagrams, or screenshots when it is part of a numbered/bulleted procedure step or a clear action caption.
- Read ALL provided pages in order; continue step numbering sequentially across pages (do not restart at 1 on each page unless the document clearly restarts).

SCOPE — WHAT TO SKIP:
- Document title, revision history, approval blocks, signatures, page headers/footers, table of contents.
- Section headers alone (e.g. "5. Prosedur", "Procedure", "ALUR KERJA") without action text.
- Column/row headers only (NO, PROSEDUR KERJA, ALUR KERJA, PIC, Department, Status, etc.).
- Repeated merged-cell category labels in middle columns (e.g. process group names spanning rows) — not the step text unless that cell is the only action description for that row.
- Definitions, scope, purpose, references, attachments lists — unless written as numbered procedure steps.

LAYOUT RULES (documents vary — apply what fits):
- TABLE (multi-column): Usually extract from the workflow/procedure column (often rightmost). One row number = one step with the full cell text for that row. Do not merge row 1 with row 2.
- NUMBERED LIST (no table): One number (1, 2, 3 or 1. 2. 3.) = one step; include the full text until the next number.
- BULLET / DASH LIST: One bullet = one step if it describes an action; skip decorative bullets.
- PARAGRAPH BLOCK: Split only when clear numbered/lettered markers or distinct actions; do not split one sentence across steps.
- FLOWCHART: Each action box or numbered node = one step; copy box text verbatim.
- MIXED: Prefer the main procedure sequence; do not duplicate the same step from header/footer repeats.

LANGUAGE (CRITICAL):
- Copy text VERBATIM in the original language as shown in the document.
- If a step is in English, keep it in English — do NOT translate to Indonesian or any other language.
- If a step is in Indonesian, keep it in Indonesian.
- If a document mixes languages, each step stays in the language used for that step.
- Do not paraphrase, summarize, simplify, or fix grammar.

TEXT FORMAT PER STEP:
- One step = one "text" field = one clean paragraph (single line of prose; no excess line breaks).
- Preserve meaning, names, numbers, dates, document references, conditions (if/when), and list items inline.
- For "including / antara lain / among others" lists, keep items in the same step separated by " • " if needed.

QUALITY:
- Do not merge two separate steps into one.
- Do not split one complete step into multiple steps.
- If unsure whether text is a step, include it only if it describes an action; otherwise skip.
- step field must be 1, 2, 3, … in extraction order.`;

/**
 * PDF → page images → single GPT Vision call → structured steps.
 * @param {{ pageImages: Array<{ page: number, imageBase64: string, mime?: string }>, reqId?: string }} opts
 */
export async function runSopVisionOnlyPipeline(opts = {}) {
  const reqId = opts.reqId || `vis-${Date.now().toString(36)}`;
  const pageImages = opts.pageImages || [];

  aiLogAlways("sop-vision", `[${reqId}] start`, {
    pages: pageImages.length,
    model: resolveOpenAIModel(VISION_MODEL),
  });

  if (pageImages.length === 0) {
    return {
      success: false,
      error:
        "Mode vision: tidak ada gambar halaman. Client harus mengirim field visionPages (PNG per halaman).",
      steps: [],
      mergedText: "",
      pipeline: [{ step: "vision_pages", status: "missing" }],
      debug: { reqId, mode: "vision_only" },
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      success: false,
      error: "OPENAI_API_KEY belum diset.",
      steps: [],
      pipeline: [],
      debug: { reqId, mode: "vision_only" },
    };
  }

  const content = [
    {
      type: "input_text",
      text: [
        `Extract all SOP procedure steps from these ${pageImages.length} PDF page image(s).`,
        `Page numbers: ${pageImages.map((p) => p.page).join(", ")}.`,
        "The document may use tables, lists, paragraphs, or flowcharts — Indonesian, English, or mixed.",
        "Copy each step verbatim; never translate English to Indonesian or vice versa.",
      ].join(" "),
    },
  ];

  for (const img of pageImages) {
    const mime = img.mime || "image/png";
    const b64 = img.imageBase64?.startsWith("data:")
      ? img.imageBase64
      : `data:${mime};base64,${img.imageBase64}`;
    content.push({
      type: "input_image",
      image_url: b64,
    });
  }

  const model = resolveOpenAIModel(VISION_MODEL);
  const body = {
    model,
    instructions: VISION_INSTRUCTIONS,
    input: [{ role: "user", content }],
    reasoning: { effort: "low" },
    max_output_tokens: 16000,
    text: {
      format: {
        type: "json_schema",
        name: "sop_steps",
        strict: true,
        schema: SOP_STEPS_JSON_SCHEMA,
      },
    },
  };

  aiDebugLog("sop-vision", `[${reqId}] request`, { model, images: pageImages.length });

  try {
    const res = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const raw = await res.text().catch(() => "");
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = null;
    }

    if (!res.ok) {
      const err =
        data?.error?.message || data?.message || raw.slice(0, 400) || `Vision failed ${res.status}`;
      aiDebugError("sop-vision", `[${reqId}] failed`, { err });
      return {
        success: false,
        error: err,
        steps: [],
        mergedText: "",
        pipeline: [
          { step: "vision_extract", status: "failed", error: err },
        ],
        debug: { reqId, mode: "vision_only", model },
      };
    }

    const generated =
      data?.output_text ||
      (data?.output || [])
        .flatMap((o) => o.content || [])
        .filter((c) => c.type === "output_text")
        .map((c) => c.text)
        .join("") ||
      "";

    const rawSteps = tryParseStepsPayload(generated);
    const steps = (rawSteps || []).map((s, idx) => ({
      step: typeof s.step === "number" ? s.step : idx + 1,
      text: formatStepTextForDisplay(s.text || s.instruction || ""),
      instruction: formatStepTextForDisplay(s.text || s.instruction || ""),
    })).filter((s) => s.text.length >= 3);

    aiLogAlways("sop-vision", `[${reqId}] done`, { steps: steps.length });

    return {
      success: steps.length > 0,
      steps,
      error: steps.length > 0 ? null : "GPT Vision tidak mengembalikan langkah JSON.",
      mergedText: "",
      model,
      pipeline: [
        { step: "pdf_to_images", status: "done", pages: pageImages.length },
        { step: "gpt_vision_extract", status: steps.length > 0 ? "done" : "failed", stepsCount: steps.length },
        { step: "json_steps", status: steps.length > 0 ? "done" : "failed" },
      ],
      debug: {
        reqId,
        mode: "vision_only",
        architecture: ["upload_pdf", "render_pages_client", "gpt_vision", "json_steps"],
        pageNumbers: pageImages.map((p) => p.page),
        generatedPreview: generated.slice(0, 400),
      },
    };
  } catch (err) {
    aiDebugError("sop-vision", `[${reqId}] exception`, { error: String(err) });
    return {
      success: false,
      error: String(err),
      steps: [],
      pipeline: [{ step: "vision_extract", status: "exception" }],
      debug: { reqId, mode: "vision_only" },
    };
  }
}
