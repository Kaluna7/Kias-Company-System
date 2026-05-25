import { NextResponse } from "next/server";
import { callOpenAIForComments, hasOpenAIKey } from "@/app/lib/openaiChat";
import {
  SOP_REVIEW_COMMENT_SYSTEM,
  buildSingleReviewCommentPrompt,
} from "./sopReviewCommentPrompt";

const MAX_COMMENT_CHARS = 320;

function normalizeGeneratedText(s) {
  if (!s || typeof s !== "string") return "";
  let t = s
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^(comment|komentar|review)\s*:\s*/i, "")
    .replace(/^\s*["']?/, "")
    .replace(/["']?\s*$/, "")
    .replace(/\|/g, " ")
    .replace(/[\{\}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  const short = sentences.slice(0, 2).join(" ").trim();
  const out = short || t.split(/\r?\n/)[0]?.trim() || t;
  if (out.length <= MAX_COMMENT_CHARS) return out;
  const cut = out.slice(0, MAX_COMMENT_CHARS);
  const lastStop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
  return (lastStop > 80 ? cut.slice(0, lastStop + 1) : cut).trim();
}

export async function POST(req) {
  try {
    if (!hasOpenAIKey()) {
      return NextResponse.json(
        { success: false, error: "Server missing OPENAI_API_KEY", provider: "openai" },
        { status: 500 },
      );
    }
    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Provide items: [{id, sop_related}]" },
        { status: 400 },
      );
    }

    const comments = [];
    let modelUsed = null;
    for (const it of items) {
      const step = it.sop_related || "";
      const r = await callOpenAIForComments(buildSingleReviewCommentPrompt(step), {
        temperature: 0.25,
        system: SOP_REVIEW_COMMENT_SYSTEM,
      });
      if (!r.ok) {
        return NextResponse.json(
          {
            success: false,
            error: r.error || "OpenAI gagal membuat komentar",
            provider: "openai",
            model: r.model,
            failedStep: step.slice(0, 120),
          },
          { status: r.status && r.status >= 400 ? r.status : 502 },
        );
      }
      modelUsed = r.model || modelUsed;
      let comment = normalizeGeneratedText(r.generated || r.rawResponse || "");
      comments.push({ id: it.id ?? null, sop_related: step, comment });
    }

    return NextResponse.json(
      { success: true, comments, provider: "openai", model: modelUsed },
      { status: 200 },
    );
  } catch (err) {
    console.error("Preview error:", err);
    return NextResponse.json(
      { success: false, error: "Server error", details: String(err), provider: "openai" },
      { status: 500 },
    );
  }
}
