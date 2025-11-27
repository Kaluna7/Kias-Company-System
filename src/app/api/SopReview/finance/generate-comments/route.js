// app/api/SopReview/finance/generate-comments/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pkg from "pg";
const { Pool } = pkg;

// global PG pool
if (!global._pgPool) {
  global._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}
const pool = global._pgPool;

// AI config (can override via env)
const API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyCt45GfaaJzw_r33Nc_PGIDn_KcmO4wVIU";
const MODEL = process.env.GOOGLE_AI_MODEL || "gemini-2.5-flash";
const BASE_URL = process.env.GOOGLE_AI_BASEURL || "https://generativelanguage.googleapis.com/v1beta";
const // endpoint path can be :generateContent or :generateText depending on model & API
      GEN_PATH = process.env.GOOGLE_AI_GENPATH || "generateContent";
const GOOGLE_URL = `${BASE_URL}/models/${MODEL}:${GEN_PATH}`;

// small safety limits
const MAX_BATCH_ITEMS = 40;
const MAX_SINGLE_TEXT_CHARS = 1500;

/* callGemini: call AI Studio / Gemini endpoint and try to return { ok, status, generated, rawResponse, data } */
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

    // try common shapes
    let candidate = "";
    if (data) {
      // new AI Studio shapes
      candidate =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        data?.candidates?.[0]?.content ||
        data?.candidates?.[0]?.text ||
        data?.candidates?.[0]?.output?.[0]?.content?.parts?.[0]?.text ||
        "";
    }
    // fallback to raw
    candidate = (candidate && candidate.toString()) || raw || "";

    return { ok: res.ok, status: res.status, generated: candidate, rawResponse: raw, data };
  } catch (err) {
    return { ok: false, status: 500, error: String(err) };
  }
}

/* tryParseJsonArray: find first JSON array in text and parse */
function tryParseJsonArray(s) {
  if (!s || typeof s !== "string") return null;
  // try fenced JSON first
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

/* buildBatchPrompt: concise; limited size */
function buildBatchPrompt(items) {
  const safeItems = items.slice(0, MAX_BATCH_ITEMS);
  let prompt = "Tugas: Untuk daftar langkah SOP berikut, buat sebuah JSON ARRAY yang berisi objek {\"id\": <id or null>, \"comment\": \"<komentar singkat 1 kalimat>\"}.\n";
  prompt += "HANYA kembalikan JSON array, TIDAK ADA teks lain. Gunakan bahasa Indonesia, profesional, padat.\n\n";
  prompt += "Contoh output: [{\"id\":1,\"comment\":\"Periksa kelengkapan formulir; jika kurang, minta pelengkapannya.\"}]\n\n";
  prompt += "Daftar (id | teks):\n";
  for (const it of safeItems) {
    const text = (it.sop_related || "").replace(/\s+/g, " ").trim().slice(0, 800);
    prompt += `- id:${it.id ?? "null"} | ${text}\n`;
  }
  prompt += `\nCatatan: kembalikan TEPAT sebuah JSON array. Maks items: ${safeItems.length}.\n`;
  return prompt;
}

/* buildSinglePrompt: produce one-sentence comment only */
function buildSinglePrompt(item) {
  const text = (item.sop_related || "").replace(/\s+/g, " ").trim().slice(0, MAX_SINGLE_TEXT_CHARS);
  let prompt = "Buat satu komentar reviewer singkat (1 kalimat) dalam bahasa Indonesia yang membantu Team Audit menilai langkah berikut. Jangan menambahkan penjelasan lain — KELUARKAN HANYA KALIMAT KOMENTAR.\n\n";
  prompt += `Langkah: ${text}\n\n`;
  prompt += "Output example: \"Periksa kelengkapan dokumen dan lampiran; jika kurang, minta pelengkapannya.\"\n";
  return prompt;
}

export async function POST(req) {
  try {
    if (!API_KEY) {
      console.error("Missing GOOGLE_API_KEY");
      return NextResponse.json({ success: false, error: "Server missing GOOGLE_API_KEY" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items || items.length === 0) {
      return NextResponse.json({ success:false, error:"Provide items: [{id?, sop_related}]"}, { status:400 });
    }

    // Attempt batch generation (short prompt)
    const diagnostic = { batch: null, perItem: [] };
    let updates = [];

    try {
      const batchPrompt = buildBatchPrompt(items);
      const batchRes = await callGemini(batchPrompt);
      diagnostic.batch = { ok: batchRes.ok, status: batchRes.status, raw: (batchRes.rawResponse||"").slice(0,6000), generated: (batchRes.generated||"").slice(0,6000) };

      // try parse JSON array from generated
      const parsed = tryParseJsonArray(batchRes.generated || batchRes.rawResponse || "");
      if (parsed && parsed.length > 0) {
        // normalize parsed entries
        for (const p of parsed) {
          const id = (p && (typeof p.id === "number" ? p.id : (p.id == null ? null : p.id))) ?? null;
          const comment = (p && (p.comment || p.comment_text || p.c || "")).toString().trim();
          const sop_related = p.sop_related ?? null;
          if (comment && comment.length > 0) updates.push({ id, comment: comment.slice(0,400), sop_related });
        }
      }
    } catch (e) {
      diagnostic.batchError = String(e);
    }

    // if batch failed or returned nothing, fallback per-item
    if (updates.length === 0) {
      for (const it of items) {
        try {
          const singleRes = await callGemini(buildSinglePrompt(it));
          const gen = (singleRes.generated || singleRes.rawResponse || "").trim();
          diagnostic.perItem.push({ id: it.id ?? null, ok: singleRes.ok, status: singleRes.status, generated: gen.slice(0,800) });
          if (!gen) continue;
          // extract first line / sentence
          let comment = gen.replace(/^[\"\s]+|[\"\s]+$/g,"").split(/\r?\n/)[0].trim();
          // safety truncate
          if (comment.length > 500) comment = comment.slice(0, 500);
          if (comment) updates.push({ id: it.id ?? null, comment, sop_related: it.sop_related });
        } catch (e) {
          diagnostic.perItem.push({ id: it.id ?? null, error: String(e) });
        }
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ success:false, error:"AI tidak menghasilkan komentar valid.", diagnostic }, { status:200 });
    }

    // Apply updates to DB: try update by id, then by text (case-insensitive trimmed), then INSERT if not found
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const applied = [];
      for (const u of updates) {
        let appliedThis = false;
        const commentVal = u.comment ?? "";
        const sopText = (u.sop_related || "").toString().trim();

        if (u.id != null) {
          const q = `UPDATE sops_finance SET comment = $1 WHERE id = $2 RETURNING id, no, sop_related, status, comment, reviewer`;
          const r = await client.query(q, [commentVal, u.id]);
          if (r.rows && r.rows[0]) { applied.push(r.rows[0]); appliedThis = true; }
        }

        if (!appliedThis && sopText) {
          const q2 = `UPDATE sops_finance SET comment = $1 WHERE TRIM(LOWER(sop_related)) = TRIM(LOWER($2)) RETURNING id, no, sop_related, status, comment, reviewer`;
          const r2 = await client.query(q2, [commentVal, sopText]);
          if (r2.rows && r2.rows.length > 0) { applied.push(...r2.rows); appliedThis = true; }
        }

        if (!appliedThis) {
          // Insert fallback — useful if you want generated comments even when row missing
          const insQ = `INSERT INTO sops_finance (no, sop_related, status, comment, reviewer) VALUES ($1,$2,$3,$4,$5) RETURNING id, no, sop_related, status, comment, reviewer`;
          const insVals = [null, sopText || (u.sop_related ?? ""), "DRAFT", commentVal, ""];
          const ri = await client.query(insQ, insVals);
          if (ri.rows && ri.rows[0]) applied.push(ri.rows[0]);
        }
      }
      await client.query("COMMIT");
      return NextResponse.json({ success:true, updated: applied, diagnostic }, { status:200 });
    } catch (dbErr) {
      await client.query("ROLLBACK");
      console.error("DB update error:", dbErr);
      diagnostic.dbError = String(dbErr);
      return NextResponse.json({ success:false, error:"DB update failed", diagnostic }, { status:500 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Critical error in generate-comments:", err);
    return NextResponse.json({ success:false, error:"Server error", details:String(err) }, { status:500 });
  }
}
