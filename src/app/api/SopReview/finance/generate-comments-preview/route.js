// app/api/SopReview/finance/generate-comments-preview/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyCt45GfaaJzw_r33Nc_PGIDn_KcmO4wVIU";
const MODEL = process.env.GOOGLE_AI_MODEL || "gemini-2.5-flash";
const BASE_URL = process.env.GOOGLE_AI_BASEURL || "https://generativelanguage.googleapis.com/v1beta";
const GOOGLE_URL = `${BASE_URL}/models/${MODEL}:generateContent`;

/** simple wrapper to call Gemini / AI Studio */
async function callGemini(prompt) {
  const body = { contents: [{ parts: [{ text: prompt }] }] };
  try {
    const res = await fetch(GOOGLE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": API_KEY },
      body: JSON.stringify(body),
    });
    const raw = await res.text().catch(() => "");
    let data = null;
    try { data = raw ? JSON.parse(raw) : {}; } catch(e) { data = null; }
    const candidate =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.text ||
      raw || "";
    return { ok: res.ok, status: res.status, rawResponse: raw, generated: candidate, data };
  } catch (err) {
    return { ok: false, status: 500, error: String(err) };
  }
}

/** clean up model output: remove fences, braces, pipes, extra whitespace; return first sentence */
function normalizeGeneratedText(s) {
  if (!s || typeof s !== "string") return "";
  let t = s.replace(/```[\s\S]*?```/g, "")
           .replace(/^\s*["']?/, "")
           .replace(/["']?\s*$/, "")
           .replace(/\|/g, " ")
           .replace(/[\{\}]/g, " ")
           .replace(/\s+/g, " ")
           .trim();
  const firstLine = t.split(/\r?\n/)[0].trim();
  const m = firstLine.match(/^(.+?[\.!?])(\s|$)/);
  return (m && m[1]) ? m[1].trim() : firstLine;
}

/** compute token/word overlap fraction step vs comment */
function wordOverlapFraction(step, comment) {
  if (!step || !comment) return 0;
  const s = step.toLowerCase().replace(/[^\p{L}\d\s]/gu, " ").split(/\s+/).filter(Boolean);
  const c = comment.toLowerCase().replace(/[^\p{L}\d\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (s.length === 0 || c.length === 0) return 0;
  const setC = new Set(c);
  let common = 0;
  for (const w of s) if (setC.has(w)) common++;
  return common / Math.max(1, s.length);
}

/** decide if comment is "echo" of step (too similar) */
function isEchoOfStep(comment, step, threshold = 0.35) {
  return wordOverlapFraction(step, comment) > threshold;
}

/** build strict single-item prompt (no reason, fix spelling, do not copy) */
function buildSinglePromptStrict(item) {
  const step = (item.sop_related || "").replace(/\n+/g, " ").trim().slice(0, 1400);
  return [
    "Anda adalah asisten HR profesional. Buat TEPAT SATU KALIMAT (1 sentence) dalam bahasa Indonesia sebagai komentar reviewer untuk langkah SOP di bawah.",
    "PERSYARATAN (WAJIB):",
    "1) KELUARKAN HANYA 1 KALIMAT. Jangan keluarkan teks lain.",
    "2) Jangan menyalin atau mengulang langsung frasa lengkap dari langkah. Tidak lebih dari 30% kata yang sama.",
    "3) Perbaiki ejaan bila ada typo, gunakan bahasa profesional dan ringkas (~8–20 kata).",
    "4) Komentar harus actionable: jelaskan apa yang harus dicek/konfirmasi reviewer.",
    "5) Jangan sertakan numbering, 'Comment:', '— Alasan:' atau JSON.",
    "",
    `Langkah: ${step}`,
    "",
    "KELUARKAN HANYA satu kalimat komentar sesuai aturan."
  ].join("\n");
}

/** prompt to paraphrase & vary (strong guard) */
function buildParaphrasePrompt(item, previousComment) {
  const step = (item.sop_related || "").replace(/\n+/g, " ").trim().slice(0, 1200);
  return [
    "GAGASAN: Paraphrase komentar reviewer sehingga TIDAK mengulang lebih dari 25% kata dari langkah dan berbeda dari komentar sebelumnya.",
    "Wajib: satu kalimat, perbaiki ejaan, profesional, actionable, KELUARKAN HANYA 1 KALIMAT.",
    `Langkah: ${step}`,
    `Komentar sebelumnya (jangan ulangi): ${previousComment}`,
    "Buat variasi yang singkat dan berguna."
  ].join("\n");
}

/** fallback sensible generic comment when model cannot produce non-echo output */
function fallbackCommentForStep(step) {
  // be slightly tailored by step content
  if (!step || typeof step !== "string") {
    return "Periksa kelengkapan dokumen dan persetujuan atasan sebelum memproses.";
  }
  if (/tanda tangan|ttd|atasan/i.test(step)) {
    return "Pastikan tanda tangan atasan dan tanggal persetujuan tercantum.";
  }
  if (/input|inputkan|sistem payroll|payroll/i.test(step)) {
    return "Verifikasi jumlah jam dan kode proyek sebelum input ke payroll.";
  }
  if (/formulir|form/i.test(step)) {
    return "Periksa kelengkapan formulir dan lampiran sebelum pengajuan.";
  }
  return "Periksa kelengkapan dokumen dan persetujuan atasan sebelum memproses.";
}

/* ------------------- main handler ------------------- */
export async function POST(req) {
  try {
    if (!API_KEY) return NextResponse.json({ success:false, error:"Server missing GOOGLE_API_KEY" }, { status:500 });
    const body = await req.json().catch(()=>({}));
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items || items.length === 0) return NextResponse.json({ success:false, error:"Provide items: [{id, sop_related}]" }, { status:400 });

    // First attempt: try batch JSON (best-effort)
    const batchPrompt = "Buat sebuah JSON array [{\"id\":id, \"comment\":\"...\"}] untuk daftar langkah berikut. KELUARKAN HANYA JSON array.";
    const listStr = items.map(it => `- id:${it.id ?? "null"} | ${it.sop_related}`).join("\n");
    const batchRes = await callGemini(batchPrompt + "\n\n" + listStr);
    let parsedBatch = null;
    try {
      const gen = (batchRes.generated || batchRes.rawResponse || "");
      const f = gen.indexOf("[");
      const l = gen.lastIndexOf("]");
      if (f >= 0 && l > f) parsedBatch = JSON.parse(gen.slice(f, l+1));
    } catch(e){ parsedBatch = null; }

    const final = [];
    const seenComments = new Map(); // track duplicates -> regenerate

    if (Array.isArray(parsedBatch) && parsedBatch.length > 0) {
      // basic cleaning + echo check & possible paraphrase
      for (const p of parsedBatch) {
        const id = (typeof p.id === "number" ? p.id : (p.id==null?null:p.id));
        const step = p.sop_related || "";
        let comment = normalizeGeneratedText(p.comment || p.comment === 0 ? String(p.comment) : "");
        // if echo, set to empty so we force per-item generation below
        if (!comment || isEchoOfStep(comment, step, 0.35)) comment = "";
        final.push({ id, sop_related: step, comment });
        if (comment) seenComments.set(comment, (seenComments.get(comment) || 0) + 1);
      }
    }

    // For items without comment from batch, or all items if batch failed -> per-item generation with retries/paraphrase
    for (const it of items) {
      const step = it.sop_related || "";
      let existing = final.find(x => (x.sop_related||"") === (step||""));
      if (!existing) existing = { id: it.id ?? null, sop_related: step, comment: "" };

      if (!existing.comment) {
        // up to 3 attempts: initial strict prompt, paraphrase guard, then fallback
        let comment = "";
        for (let attempt = 0; attempt < 3 && !comment; attempt++) {
          if (attempt === 0) {
            const prompt = buildSinglePromptStrict(it);
            const r = await callGemini(prompt);
            const c = normalizeGeneratedText(r.generated || r.rawResponse || "");
            if (c && !isEchoOfStep(c, step, 0.35)) comment = c;
          } else {
            // paraphrase prompt referencing previous attempt if exists
            const prev = comment || "";
            const pPrompt = buildParaphrasePrompt(it, prev || "previous attempt");
            const r2 = await callGemini(pPrompt);
            const c2 = normalizeGeneratedText(r2.generated || r2.rawResponse || "");
            if (c2 && !isEchoOfStep(c2, step, 0.30)) comment = c2;
          }
        }
        if (!comment) comment = fallbackCommentForStep(step);
        existing.comment = comment;
        final.push(existing);
        seenComments.set(existing.comment, (seenComments.get(existing.comment) || 0) + 1);
      }
    }

    // If duplicates across items exist (same comment repeated), try to paraphrase duplicates (one extra attempt each)
    const duplicates = Array.from(seenComments.entries()).filter(([c, cnt]) => cnt > 1).map(([c])=>c);
    if (duplicates.length > 0) {
      for (const dup of duplicates) {
        // find all indices with this comment
        const indices = final.reduce((acc, f, i) => { if ((f.comment||"") === dup) acc.push(i); return acc; }, []);
        // keep first as-is, try paraphrase others
        for (let k = 1; k < indices.length; k++) {
          const idx = indices[k];
          const it = final[idx];
          const paraprompt = buildParaphrasePrompt(it, dup);
          const r = await callGemini(paraprompt);
          const c = normalizeGeneratedText(r.generated || r.rawResponse || "");
          if (c && !isEchoOfStep(c, it.sop_related, 0.30) && c !== dup) {
            // replace
            final[idx].comment = c;
          } else {
            // fallback small variation programmatically
            final[idx].comment = final[idx].comment + " (ulang)";
          }
        }
      }
    }

    // ensure unique and clip length
    const cleaned = final.map(f => {
      let cm = (f.comment || "").replace(/\s+/g, " ").trim();
      if (cm.length > 400) cm = cm.slice(0,400).trim();
      return { id: f.id ?? null, sop_related: f.sop_related, comment: cm };
    });

    return NextResponse.json({ success:true, comments: cleaned, diagnostic: { batchUsed: !!parsedBatch } }, { status:200 });

  } catch (err) {
    console.error("Preview error:", err);
    return NextResponse.json({ success:false, error:"Server error", details:String(err) }, { status:500 });
  }
}
