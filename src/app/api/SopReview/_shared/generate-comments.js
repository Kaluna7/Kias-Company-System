import { NextResponse } from "next/server";
import { pool } from "./pool";
import { requireReviewer } from "./auth";
import { callOpenAIForComments, hasOpenAIKey } from "@/app/lib/openaiChat";
import {
  SOP_REVIEW_COMMENT_SYSTEM,
  buildSingleReviewCommentPrompt,
  buildBatchReviewCommentIntro,
} from "./sopReviewCommentPrompt";

const MAX_BATCH_ITEMS = 40;
const MAX_SINGLE_TEXT_CHARS = 1500;
const MAX_COMMENT_CHARS = 320;
const AI_SYSTEM =
  SOP_REVIEW_COMMENT_SYSTEM +
  " For batch tasks return only a valid JSON array.";

function tryParseJsonArray(s) {
  if (!s || typeof s !== "string") return null;
  const fenced = s.match(/```json\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    try { const p = JSON.parse(fenced[1]); if (Array.isArray(p)) return p; } catch(e) {}
  }
  const first = s.indexOf("[");
  const last = s.lastIndexOf("]");
  if (first >= 0 && last > first) {
    const candidate = s.slice(first, last + 1);
    try { const p = JSON.parse(candidate); if (Array.isArray(p)) return p; } catch (e) {}
  }
  try { const p = JSON.parse(s); if (Array.isArray(p)) return p; } catch (e) {}
  return null;
}

function buildBatchPrompt(items) {
  const safeItems = items.slice(0, MAX_BATCH_ITEMS);
  let prompt = buildBatchReviewCommentIntro() + "\n";
  for (const it of safeItems) {
    const text = (it.sop_related || "").replace(/\s+/g, " ").trim().slice(0, 800);
    prompt += `- id:${it.id ?? "null"} | ${text}\n`;
  }
  prompt += `\nKembalikan TEPAT satu JSON array valid (${safeItems.length} item).\n`;
  return prompt;
}

function buildSinglePrompt(item) {
  const text = (item.sop_related || "").replace(/\s+/g, " ").trim().slice(0, MAX_SINGLE_TEXT_CHARS);
  return buildSingleReviewCommentPrompt(text);
}

function trimComment(text) {
  const s = String(text || "").trim();
  if (s.length <= MAX_COMMENT_CHARS) return s;
  const cut = s.slice(0, MAX_COMMENT_CHARS);
  const lastStop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
  return (lastStop > 80 ? cut.slice(0, lastStop + 1) : cut).trim();
}

export function makeGenerateCommentsHandler({ stepsTable }) {
  return async function POST(req) {
    try {
      // Hanya reviewer yang boleh generate & menyimpan komentar ke DB
      const authError = await requireReviewer();
      if (authError) return authError;

      if (!hasOpenAIKey()) {
        return NextResponse.json({ success: false, error: "Server missing OPENAI_API_KEY" }, { status: 500 });
      }

      const body = await req.json().catch(() => ({}));
      const items = Array.isArray(body?.items) ? body.items : null;
      if (!items || items.length === 0) {
        return NextResponse.json({ success: false, error: "Provide items: [{id?, sop_related}]" }, { status: 400 });
      }

      const diagnostic = { batch: null, perItem: [] };
      let updates = [];

      try {
        const batchRes = await callOpenAIForComments(buildBatchPrompt(items), {
          temperature: 0.4,
          system: AI_SYSTEM,
        });
        diagnostic.batch = {
          ok: batchRes.ok,
          status: batchRes.status,
          model: batchRes.model,
          provider: batchRes.provider,
        };
        if (!batchRes.ok) {
          diagnostic.batchError = batchRes.error || "OpenAI batch failed";
        }
        const parsed = tryParseJsonArray(batchRes.generated || batchRes.rawResponse || "");
        if (parsed && parsed.length > 0) {
          for (const p of parsed) {
            const id = (p && (typeof p.id === "number" ? p.id : (p.id == null ? null : p.id))) ?? null;
            const comment = (p && (p.comment || "")).toString().trim();
            if (comment) updates.push({ id, comment: trimComment(comment), sop_related: p.sop_related ?? null });
          }
        }
      } catch (e) {
        diagnostic.batchError = String(e);
      }

      if (updates.length === 0) {
        for (const it of items) {
          const singleRes = await callOpenAIForComments(buildSinglePrompt(it), {
            temperature: 0.4,
            system: AI_SYSTEM,
          });
          const gen = (singleRes.generated || singleRes.rawResponse || "").trim();
          diagnostic.perItem.push({
            id: it.id ?? null,
            ok: singleRes.ok,
            status: singleRes.status,
            error: singleRes.ok ? undefined : singleRes.error,
          });
          if (!gen) continue;
          let comment = gen.replace(/^[\"\s]+|[\"\s]+$/g, "").split(/\r?\n/)[0].trim();
          comment = trimComment(comment);
          if (comment) updates.push({ id: it.id ?? null, comment, sop_related: it.sop_related });
        }
      }

      if (updates.length === 0) {
        const apiErr =
          diagnostic.batchError ||
          diagnostic.perItem.find((p) => p.error)?.error ||
          "OpenAI tidak menghasilkan komentar valid.";
        return NextResponse.json(
          { success: false, error: apiErr, provider: "openai", diagnostic },
          { status: 502 },
        );
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const applied = [];
        for (const u of updates) {
          let appliedThis = false;
          const commentVal = u.comment ?? "";
          const sopText = (u.sop_related || "").toString().trim();

          if (u.id != null) {
            const r = await client.query(
              `UPDATE ${stepsTable} SET comment = $1 WHERE id = $2 RETURNING id, no, sop_related, status, comment, reviewer_feedback, reviewer`,
              [commentVal, u.id]
            );
            if (r.rows?.[0]) { applied.push(r.rows[0]); appliedThis = true; }
          }

          if (!appliedThis && sopText) {
            const r2 = await client.query(
              `UPDATE ${stepsTable} SET comment = $1 WHERE TRIM(LOWER(sop_related)) = TRIM(LOWER($2)) RETURNING id, no, sop_related, status, comment, reviewer_feedback, reviewer`,
              [commentVal, sopText]
            );
            if (r2.rows?.length) { applied.push(...r2.rows); appliedThis = true; }
          }

          if (!appliedThis) {
            const ri = await client.query(
              `INSERT INTO ${stepsTable} (no, sop_related, status, comment, reviewer_feedback, reviewer) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, no, sop_related, status, comment, reviewer_feedback, reviewer`,
              [null, sopText || (u.sop_related ?? ""), "DRAFT", commentVal, "", ""]
            );
            if (ri.rows?.[0]) applied.push(ri.rows[0]);
          }
        }
        await client.query("COMMIT");
        return NextResponse.json(
          { success: true, updated: applied, provider: "openai", diagnostic },
          { status: 200 },
        );
      } catch (dbErr) {
        await client.query("ROLLBACK");
        console.error("DB update error:", dbErr);
        return NextResponse.json({ success: false, error: "DB update failed", details: String(dbErr) }, { status: 500 });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Critical error in generate-comments:", err);
      return NextResponse.json({ success: false, error: "Server error", details: String(err) }, { status: 500 });
    }
  };
}


