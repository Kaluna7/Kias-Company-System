import { NextResponse } from "next/server";
import { pool } from "./pool";
import { requireReviewer } from "./auth";

const API_KEY = process.env.GOOGLE_API_KEY;
const MODEL = process.env.GOOGLE_AI_MODEL;
const BASE_URL = process.env.GOOGLE_AI_BASEURL;
const GEN_PATH = process.env.GOOGLE_AI_GENPATH;
const GOOGLE_URL = `${BASE_URL}/models/${MODEL}:${GEN_PATH}`;

const MAX_BATCH_ITEMS = 40;
const MAX_SINGLE_TEXT_CHARS = 1500;

async function callGemini(prompt) {
  try {
    const body = { contents: [{ parts: [{ text: prompt }] }], temperature: 0.0 };
    const res = await fetch(GOOGLE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": API_KEY },
      body: JSON.stringify(body),
    });
    const raw = await res.text().catch(() => "");
    let data = null;
    try { data = raw ? JSON.parse(raw) : {}; } catch (e) { data = null; }
    let candidate =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.content ||
      data?.candidates?.[0]?.text ||
      "";
    candidate = (candidate && candidate.toString()) || raw || "";
    return { ok: res.ok, status: res.status, generated: candidate, rawResponse: raw, data };
  } catch (err) {
    return { ok: false, status: 500, error: String(err) };
  }
}

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
  let prompt = "Task: Untuk daftar langkah SOP berikut, buat JSON ARRAY berisi objek {\"id\": <id or null>, \"comment\": \"<komentar reviewer>\"}.\n";
  prompt += "WAJIB: HANYA keluarkan JSON array, tanpa teks tambahan.\n";
  prompt += "WAJIB: Bahasa comment harus mengikuti bahasa pada langkah SOP masing-masing (jika langkah Indonesia, jawab Indonesia; jika English, jawab English).\n";
  prompt += "WAJIB: Gaya profesional, jelas, mudah dipahami, actionable, dan maksimal 2 kalimat.\n\n";
  prompt += "Daftar (id | teks):\n";
  for (const it of safeItems) {
    const text = (it.sop_related || "").replace(/\s+/g, " ").trim().slice(0, 800);
    prompt += `- id:${it.id ?? "null"} | ${text}\n`;
  }
  prompt += `\nCatatan: kembalikan TEPAT satu JSON array valid. Maks items: ${safeItems.length}.\n`;
  return prompt;
}

function buildSinglePrompt(item) {
  const text = (item.sop_related || "").replace(/\s+/g, " ").trim().slice(0, MAX_SINGLE_TEXT_CHARS);
  let prompt = "Buat komentar reviewer profesional untuk langkah SOP berikut.\n";
  prompt += "WAJIB: gunakan bahasa yang sama dengan langkah SOP.\n";
  prompt += "WAJIB: mudah dipahami, actionable, dan maksimal 2 kalimat.\n";
  prompt += "WAJIB: keluarkan HANYA isi komentar (tanpa numbering, tanpa label, tanpa JSON).\n\n";
  prompt += `Langkah: ${text}\n\n`;
  return prompt;
}

export function makeGenerateCommentsHandler({ stepsTable }) {
  return async function POST(req) {
    try {
      // Hanya reviewer yang boleh generate & menyimpan komentar ke DB
      const authError = await requireReviewer();
      if (authError) return authError;

      if (!API_KEY) return NextResponse.json({ success: false, error: "Server missing GOOGLE_API_KEY" }, { status: 500 });

      const body = await req.json().catch(() => ({}));
      const items = Array.isArray(body?.items) ? body.items : null;
      if (!items || items.length === 0) {
        return NextResponse.json({ success: false, error: "Provide items: [{id?, sop_related}]" }, { status: 400 });
      }

      const diagnostic = { batch: null, perItem: [] };
      let updates = [];

      try {
        const batchRes = await callGemini(buildBatchPrompt(items));
        diagnostic.batch = { ok: batchRes.ok, status: batchRes.status };
        const parsed = tryParseJsonArray(batchRes.generated || batchRes.rawResponse || "");
        if (parsed && parsed.length > 0) {
          for (const p of parsed) {
            const id = (p && (typeof p.id === "number" ? p.id : (p.id == null ? null : p.id))) ?? null;
            const comment = (p && (p.comment || "")).toString().trim();
            if (comment) updates.push({ id, comment: comment.slice(0, 400), sop_related: p.sop_related ?? null });
          }
        }
      } catch (e) {
        diagnostic.batchError = String(e);
      }

      if (updates.length === 0) {
        for (const it of items) {
          const singleRes = await callGemini(buildSinglePrompt(it));
          const gen = (singleRes.generated || singleRes.rawResponse || "").trim();
          diagnostic.perItem.push({ id: it.id ?? null, ok: singleRes.ok, status: singleRes.status });
          if (!gen) continue;
          let comment = gen.replace(/^[\"\s]+|[\"\s]+$/g, "").split(/\r?\n/)[0].trim();
          if (comment.length > 500) comment = comment.slice(0, 500);
          if (comment) updates.push({ id: it.id ?? null, comment, sop_related: it.sop_related });
        }
      }

      if (updates.length === 0) {
        return NextResponse.json({ success: false, error: "AI tidak menghasilkan komentar valid.", diagnostic }, { status: 200 });
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
        return NextResponse.json({ success: true, updated: applied, diagnostic }, { status: 200 });
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


