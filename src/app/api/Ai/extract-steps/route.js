// app/api/ai/extract-steps/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyCt45GfaaJzw_r33Nc_PGIDn_KcmO4wVIU";
const MODEL = process.env.GOOGLE_AI_MODEL || "gemini-2.5-flash"; // NOTE: this is model id portion (no "models/" prefix here)
const BASE_URL = process.env.GOOGLE_AI_BASEURL || "https://generativelanguage.googleapis.com/v1beta";
const GOOGLE_URL = `${BASE_URL}/models/${MODEL}:generateContent`;

/**
 * Prompt builder (simple Indonesian instruction)
 */
function buildPromptUsingRawText(rawText, maxSteps = 300) {
  return (
    "Ambil hanya langkah-langkah bernomor pada bagian 'Prosedur' dan kalau nanti berbahasa i nggris, coba ambil prosedurenya juga seperti contoh 'SPECIFIC PROCEDURE' dari teks SOP berikut (bahasa Indonesia atau inggris).\n" +
    "Kembalikan TEPAT sebuah JSON array dengan format objek: {\"step\": <nomor>, \"text\": \"<isi langkah>\"} dan TIDAK ADA teks lain.\n" +
    "Jika tidak menemukan langkah, kembalikan array kosong []. Batasi maksimum items: " + String(maxSteps) + ".\n\n" +
    "TEKS SOP START\n" +
    rawText +
    "\nTEKS SOP END\n"
  );
}

/**
 * Call Gemini/AI Studio using the same request shape as your working Express example.
 * We send header 'X-goog-api-key' and body { contents: [ { parts: [ { text: prompt } ] } ] }
 */
async function callGemini(prompt) {
  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    // some models accept additional parameters; keep minimal to match your working example
  };

  try {
    const res = await fetch(GOOGLE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": API_KEY
      },
      body: JSON.stringify(body),
    });

    const text = await res.text().catch(() => "");
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (err) {
      // return raw text if not JSON
      return { ok: res.ok, status: res.status, rawText: text, data: null };
    }

    // Try to extract text using the shape you observed in Express example:
    // data.candidates[0].content.parts[0].text  OR data.candidates[0].content?.parts[0]?.text
    const candidateText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.content?.[0]?.parts?.[0]?.text || // tolerate small shape differences
      data?.candidates?.[0]?.content?.[0]?.text ||
      data?.candidates?.[0]?.text ||
      "";

    return { ok: res.ok, status: res.status, rawText: text, generatedText: candidateText, data };
  } catch (err) {
    return { ok: false, status: 500, rawText: "", data: null, error: String(err) };
  }
}

/**
 * Try parse JSON array from a string
 */
function tryParseJsonOnly(s) {
  if (!s || typeof s !== "string") return null;
  const first = s.indexOf("[");
  const last = s.lastIndexOf("]");
  if (first >= 0 && last > first) {
    const candidate = s.slice(first, last + 1);
    try {
      const p = JSON.parse(candidate);
      if (Array.isArray(p)) return p;
    } catch (e) {}
  }
  try {
    const p = JSON.parse(s);
    if (Array.isArray(p)) return p;
  } catch (e) {}
  return null;
}

function normalizeSteps(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((it, idx) => {
      const text = (it && (it.text || it.instruction)) || (typeof it === "string" ? it : "");
      const t = (text || "").toString().replace(/\s+/g, " ").trim();
      const step = it && it.step && Number.isFinite(+it.step) ? +it.step : idx + 1;
      return { step, text: t };
    })
    .filter((it) => it.text && it.text.length > 3);
}

/**
 * Route handler: accept { text: rawText } (preferred) or { data: base64 } (optional)
 */
export async function POST(req) {
  try {
    if (!API_KEY) {
      console.error("Missing GOOGLE_API_KEY");
      return NextResponse.json({ success: false, error: "Server missing GOOGLE_API_KEY" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    let rawText = "";

    // Accept raw text (client extraction) OR base64 PDF (server extraction)
    if (body?.text && typeof body.text === "string" && body.text.length > 0) {
      rawText = body.text;
    } else if (body?.data && typeof body.data === "string") {
      // server-side PDF extraction using pdfjs-serverless
      try {
        const pdfBuffer = Buffer.from(body.data, "base64");
        const { resolvePDFJS } = await import("pdfjs-serverless");
        const { getDocument } = await resolvePDFJS();
        const loadingTask = getDocument({ data: new Uint8Array(pdfBuffer), useSystemFonts: true });
        const doc = await loadingTask.promise;
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          const content = await page.getTextContent();
          const pageText = (content.items || []).map((it) => it.str || "").join(" ");
          rawText += pageText + "\n\n---PAGE---\n\n";
          if (page && typeof page.cleanup === "function") page.cleanup();
        }
        rawText = rawText.trim();
        try { if (typeof doc.destroy === "function") doc.destroy(); if (typeof loadingTask.destroy === "function") loadingTask.destroy(); } catch(e){}
      } catch (err) {
        console.error("pdf reading error:", err);
        return NextResponse.json({ success:false, error:"Failed to read PDF on server", details:String(err) }, { status:500 });
      }
    } else {
      return NextResponse.json({ success:false, error:"Missing input. Send { text: <fullText> } or { data: <base64> }." }, { status:400 });
    }

    if (!rawText) {
      return NextResponse.json({ success:false, error:"PDF/text extraction returned empty." }, { status:400 });
    }

    // Build prompt (we use rawText as prompt content as you requested)
    const prompt = buildPromptUsingRawText(rawText, 400);

    // Call Gemini / AI Studio using working format
    const g = await callGemini(prompt);

    // If call returned a parsed candidateText, try parse JSON from that first
    const generated = (g.generatedText || "") + (g.rawText || "");
    let parsed = tryParseJsonOnly(g.generatedText || g.rawText || "");

    if (parsed && parsed.length > 0) {
      const steps = normalizeSteps(parsed);
      return NextResponse.json({ success:true, steps, diagnostic:{ googleStatus:g.status, generatedPreview:(g.generatedText||"").slice(0,2000), rawTextPreview: rawText.slice(0,2000), rawResponse: (g.rawText||"").slice(0,2000) } }, { status:200 });
    }

    // fallback: try numbered lines from generated candidateText
    const numberedFromGen = (g.generatedText || g.rawText || "").match(/\d{1,3}\s*[\.\)\-:]\s*[^(\r\n)]+/g) || [];
    if (numberedFromGen.length > 0) {
      const steps = numberedFromGen.map((s,i) => ({ step: i+1, text: s.replace(/^\s*\d{1,3}\s*[\.\)\-:]\s*/,"").trim() }));
      return NextResponse.json({ success:true, steps, diagnostic:{ googleStatus:g.status, generatedPreview:(g.generatedText||"").slice(0,2000), rawTextPreview: rawText.slice(0,2000), rawResponse:(g.rawText||"").slice(0,2000) } }, { status:200 });
    }

    // fallback: parse rawText for numbered items (guarantee)
    const numberedRaw = (rawText.match(/\d{1,3}\s*[\.\)\-:]\s*[^(\r\n)]+/g) || []);
    if (numberedRaw.length > 0) {
      const steps = numberedRaw.map((s,i) => ({ step: i+1, text: s.replace(/^\s*\d{1,3}\s*[\.\)\-:]\s*/,"").trim() }));
      return NextResponse.json({ success:true, steps, diagnostic:{ googleStatus:g.status, generatedPreview:(g.generatedText||"").slice(0,2000), rawTextPreview: rawText.slice(0,2000), rawResponse:(g.rawText||"").slice(0,2000) } }, { status:200 });
    }

    // nothing found
    return NextResponse.json({ success:false, error:"AI tidak mengembalikan langkah terstruktur.", diagnostic:{ googleStatus:g.status, generatedPreview:(g.generatedText||"").slice(0,5000), rawTextPreview: rawText.slice(0,5000), rawResponse:(g.rawText||"").slice(0,5000) } }, { status:200 });

  } catch (err) {
    console.error("Critical server error:", err);
    return NextResponse.json({ success:false, error:"Server error", details:String(err) }, { status:500 });
  }
}

