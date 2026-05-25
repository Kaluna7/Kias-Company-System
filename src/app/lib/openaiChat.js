import { aiDebugError, aiDebugLog } from "@/app/lib/aiDebugLog";

const BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const RESPONSES_URL = `${BASE_URL}/responses`;
const CHAT_URL = `${BASE_URL}/chat/completions`;

/** OpenAI model for SOP AI (extract steps + comments). */
export const GPT54_MODEL = "gpt-5.4";

const MODEL_ALIASES = {
  gbt54: GPT54_MODEL,
  "gbt-54": GPT54_MODEL,
  "gbt-5.4": GPT54_MODEL,
  gpt54: GPT54_MODEL,
  "gpt-5.4": GPT54_MODEL,
  "gpt-5.5": GPT54_MODEL,
  gpt55: GPT54_MODEL,
};

export const SOP_STEPS_JSON_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          step: { type: "number" },
          text: { type: "string" },
        },
        required: ["step", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["steps"],
  additionalProperties: false,
};

export function resolveOpenAIModel(name) {
  const raw = String(
    name ||
      process.env.OPENAI_EXTRACT_STEPS_MODEL ||
      process.env.OPENAI_COMMENTS_MODEL ||
      GPT54_MODEL
  )
    .trim()
    .toLowerCase();
  return MODEL_ALIASES[raw] || GPT54_MODEL;
}

/** Model khusus generate komentar reviewer SOP (OPENAI_COMMENTS_MODEL). */
export function resolveOpenAICommentsModel() {
  const raw = String(process.env.OPENAI_COMMENTS_MODEL || GPT54_MODEL)
    .trim()
    .toLowerCase();
  return MODEL_ALIASES[raw] || GPT54_MODEL;
}

function getApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

export function hasOpenAIKey() {
  return Boolean(getApiKey());
}

function openAIErrorMessage(data, raw, status) {
  const msg =
    data?.error?.message ||
    (typeof data?.error === "string" ? data.error : null) ||
    data?.message;
  if (msg) return String(msg);
  if (raw && raw.length < 500) return raw;
  return `OpenAI request failed (${status})`;
}

function summarizeResponsesOutput(data) {
  if (!data) return { hasOutputText: false, outputCount: 0, blockTypes: [] };
  const blockTypes = [];
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      blockTypes.push(item?.type || "unknown");
      if (item?.type === "message" && Array.isArray(item.content)) {
        for (const block of item.content) {
          blockTypes.push(`content:${block?.type || "?"}`);
        }
      }
    }
  }
  return {
    hasOutputText: Boolean(data.output_text),
    outputTextLen: data.output_text?.length ?? 0,
    status: data.status,
    outputCount: data.output?.length ?? 0,
    blockTypes,
  };
}

function extractResponsesOutputText(data) {
  if (!data) return "";
  if (typeof data.output_text === "string" && data.output_text) return data.output_text;

  if (!Array.isArray(data.output)) return "";

  const parts = [];
  for (const item of data.output) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const block of item.content) {
        if (block?.type === "output_text" && block.text) parts.push(block.text);
        if (block?.type === "refusal" && block.refusal) {
          aiDebugError("openai-responses", "model refusal", { refusal: block.refusal });
        }
      }
    }
  }
  return parts.join("");
}

function extractChatMessageText(message) {
  if (!message) return "";
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part) return "";
        if (typeof part === "string") return part;
        return part.text || part.output_text || part.content || "";
      })
      .join("");
  }
  return "";
}

function useResponsesApi() {
  const mode = (process.env.OPENAI_API_MODE || "responses").toLowerCase();
  return mode !== "chat";
}

/**
 * @param {string} prompt
 * @param {{ model?: string, instructions?: string, system?: string, jsonSchema?: object, jsonSchemaName?: string, maxOutputTokens?: number }} [opts]
 */
export async function callOpenAIResponses(prompt, opts = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, status: 500, error: "Server missing OPENAI_API_KEY", api: "responses" };
  }

  const model = resolveOpenAIModel(opts.model);
  const instructions = opts.instructions || opts.system || "Follow instructions precisely.";

  const body = {
    model,
    instructions,
    input: prompt,
    max_output_tokens: opts.maxOutputTokens ?? 16000,
  };

  if (/^gpt-5/i.test(model)) {
    body.reasoning = { effort: "low" };
  }

  if (opts.jsonSchema) {
    body.text = {
      format: {
        type: "json_schema",
        name: opts.jsonSchemaName || "response",
        strict: true,
        schema: opts.jsonSchema,
      },
    };
  }

  aiDebugLog("openai-responses", "request start", {
    model,
    url: RESPONSES_URL,
    promptChars: prompt?.length ?? 0,
    jsonSchema: Boolean(opts.jsonSchema),
    maxOutputTokens: body.max_output_tokens,
  });

  try {
    const started = Date.now();
    const res = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const raw = await res.text().catch(() => "");
    const ms = Date.now() - started;
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (parseErr) {
      aiDebugError("openai-responses", "response JSON parse failed", {
        status: res.status,
        ms,
        rawPreview: raw.slice(0, 500),
        parseErr: String(parseErr),
      });
      data = null;
    }
    const generated = extractResponsesOutputText(data) || (res.ok ? "" : raw) || "";
    const error = res.ok ? null : openAIErrorMessage(data, raw, res.status);

    if (res.ok) {
      aiDebugLog("openai-responses", "request ok", {
        status: res.status,
        ms,
        generatedLen: generated.length,
        generatedPreview: generated.slice(0, 200),
        output: summarizeResponsesOutput(data),
      });
    } else {
      aiDebugError("openai-responses", "request failed", {
        status: res.status,
        ms,
        error,
        rawPreview: raw.slice(0, 800),
      });
    }

    return {
      ok: res.ok,
      status: res.status,
      rawResponse: raw,
      generated,
      data,
      error,
      model,
      api: "responses",
    };
  } catch (err) {
    aiDebugError("openai-responses", "fetch exception", { error: String(err), model });
    return { ok: false, status: 500, error: String(err), model, api: "responses" };
  }
}

/**
 * @param {string} prompt
 * @param {{ model?: string, temperature?: number, system?: string, jsonObject?: boolean }} [opts]
 */
export async function callOpenAIChat(prompt, opts = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, status: 500, error: "Server missing OPENAI_API_KEY", api: "chat" };
  }

  const model = resolveOpenAIModel(opts.model);
  const system =
    opts.system || "You are a helpful assistant. Follow instructions precisely.";

  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  };

  if (opts.jsonObject) {
    body.response_format = { type: "json_object" };
  }

  if (/^gpt-5/i.test(model)) {
    body.reasoning_effort = "low";
  } else if (opts.temperature !== undefined) {
    body.temperature = opts.temperature;
  } else {
    body.temperature = 0.2;
  }

  aiDebugLog("openai-chat", "request start", {
    model,
    url: CHAT_URL,
    promptChars: prompt?.length ?? 0,
    jsonObject: Boolean(opts.jsonObject),
  });

  try {
    const started = Date.now();
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const raw = await res.text().catch(() => "");
    const ms = Date.now() - started;
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (parseErr) {
      aiDebugError("openai-chat", "response JSON parse failed", {
        status: res.status,
        ms,
        rawPreview: raw.slice(0, 500),
        parseErr: String(parseErr),
      });
      data = null;
    }
    const generated = extractChatMessageText(data?.choices?.[0]?.message) || (res.ok ? "" : raw) || "";
    const error = res.ok ? null : openAIErrorMessage(data, raw, res.status);

    if (res.ok) {
      aiDebugLog("openai-chat", "request ok", {
        status: res.status,
        ms,
        generatedLen: generated.length,
        generatedPreview: generated.slice(0, 200),
        finishReason: data?.choices?.[0]?.finish_reason,
      });
    } else {
      aiDebugError("openai-chat", "request failed", {
        status: res.status,
        ms,
        error,
        rawPreview: raw.slice(0, 800),
      });
    }

    return {
      ok: res.ok,
      status: res.status,
      rawResponse: raw,
      generated,
      data,
      error,
      model,
      api: "chat",
    };
  } catch (err) {
    aiDebugError("openai-chat", "fetch exception", { error: String(err), model });
    return { ok: false, status: 500, error: String(err), model, api: "chat" };
  }
}

/**
 * Extract SOP steps — prefers Responses API + JSON schema (OpenAI quickstart).
 */
export async function callOpenAIForExtractSteps(prompt, instructions) {
  const model = resolveOpenAIModel();
  const mode = useResponsesApi() ? "responses" : "chat";

  aiDebugLog("extract-openai", "callOpenAIForExtractSteps start", {
    model,
    mode,
    promptChars: prompt?.length ?? 0,
    hasKey: hasOpenAIKey(),
    keyLen: getApiKey().length,
  });

  if (useResponsesApi()) {
    const primary = await callOpenAIResponses(prompt, {
      model,
      instructions,
      jsonSchema: SOP_STEPS_JSON_SCHEMA,
      jsonSchemaName: "sop_steps",
      maxOutputTokens: 32000,
    });
    if (primary.ok && primary.generated) {
      aiDebugLog("extract-openai", "responses primary success", {
        generatedLen: primary.generated.length,
      });
      return primary;
    }

    aiDebugError("extract-openai", "responses primary failed, trying chat fallback", {
      status: primary.status,
      error: primary.error,
      generatedLen: primary.generated?.length ?? 0,
    });

    const chatFallback = await callOpenAIChat(prompt, {
      model,
      system: instructions,
      jsonObject: true,
    });
    return {
      ...chatFallback,
      api: chatFallback.ok ? "chat" : primary.api,
      fallbackFrom: "responses",
      primaryError: primary.error,
    };
  }

  return callOpenAIChat(prompt, { model, system: instructions, jsonObject: true });
}

/**
 * Generate komentar reviewer SOP via OpenAI (bukan Gemini).
 */
export async function callOpenAIForComments(prompt, opts = {}) {
  const model = resolveOpenAICommentsModel();
  aiDebugLog("openai-comments", "request start", {
    model,
    promptChars: prompt?.length ?? 0,
    hasKey: hasOpenAIKey(),
  });
  const res = await callOpenAI(prompt, { ...opts, model });
  return { ...res, model, provider: "openai", purpose: "sop-comments" };
}

/**
 * General text generation (comments, etc.)
 */
export async function callOpenAI(prompt, opts = {}) {
  const model = resolveOpenAIModel(opts.model);

  if (useResponsesApi() && /^gpt-5/i.test(model)) {
    const res = await callOpenAIResponses(prompt, {
      model,
      instructions: opts.system,
      maxOutputTokens: opts.maxOutputTokens ?? 4000,
    });
    if (res.ok) return res;
    const chat = await callOpenAIChat(prompt, opts);
    return { ...chat, fallbackFrom: "responses", primaryError: res.error };
  }

  return callOpenAIChat(prompt, opts);
}

/** Quick connectivity check for debugging deployments. */
export async function pingOpenAI() {
  if (!hasOpenAIKey()) {
    return { ok: false, error: "OPENAI_API_KEY missing", hasKey: false };
  }

  const model = resolveOpenAIModel();
  const res = await callOpenAIResponses('Return JSON only: {"ok":true}', {
    model,
    instructions: 'Reply with JSON only: {"ok":true}',
    jsonSchema: {
      type: "object",
      properties: { ok: { type: "boolean" } },
      required: ["ok"],
      additionalProperties: false,
    },
    jsonSchemaName: "ping",
    maxOutputTokens: 100,
  });

  return {
    ok: res.ok,
    hasKey: true,
    model,
    api: res.api,
    error: res.error,
    preview: (res.generated || "").slice(0, 120),
  };
}
