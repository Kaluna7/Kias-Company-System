// app/components/layout/Sop-Review/Sidebar-Sop.js
"use client";

import React, { useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

/**
 * Sidebar SOP (full)
 *
 * Props:
 * - department, sopStatus, preparerStatus, reviewerStatus
 * - onPreparerStatusChange, onReviewerStatusChange
 * - onSopParsed(parsedArray)  // parsedArray = [{ no, sop_related, status, comment, reviewer }, ...]
 *
 * Requirements:
 * - public/pdf.worker.min.js present OR allow CDN fallback
 * - server route /api/ai/extract-steps exists and GOOGLE_API_KEY set there
 * - server route /api/SopReview/finance exists for DB insert
 */

async function ensureWorkerAvailable() {
  try {
    const res = await fetch("/pdf.worker.min.js", { method: "HEAD" });
    if (res.ok) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
      pdfjsLib.GlobalWorkerOptions.disableWorker = false;
      return true;
    }
  } catch (e) {}
  try {
    const cdn = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
    pdfjsLib.GlobalWorkerOptions.workerSrc = cdn;
    pdfjsLib.GlobalWorkerOptions.disableWorker = false;
    return true;
  } catch (e) {
    pdfjsLib.GlobalWorkerOptions.disableWorker = true;
    return false;
  }
}

export default function SOPSidebar({
  department = "Finance",
  sopStatus = "AVAILABLE",
  preparerStatus,
  reviewerStatus,
  onPreparerStatusChange,
  onReviewerStatusChange,
  onSopParsed,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parsedPreview, setParsedPreview] = useState([]);
  const [fullTextPreview, setFullTextPreview] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [aiInProgress, setAiInProgress] = useState(false);

  const statusOptions = ["DRAFT", "IN REVIEW", "APPROVED", "REJECTED"];

  // Reconstruct text using PDF text item positions (x,y) to re-create lines
  const handleFileChange = async (e) => {
    setParseError("");
    setParsedPreview([]);
    setFullTextPreview("");
    setShowRaw(false);

    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Hanya file PDF yang diperbolehkan.");
      return;
    }

    setSelectedFile(file);
    setParsing(true);

    try {
      await ensureWorkerAvailable();

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      // Reconstruct text page-by-page using transform y coordinate grouping
      const pageTexts = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const items = content.items || [];

        // items -> { str, x, y }
        const posItems = items.map(it => {
          const tr = it.transform || it.transformMatrix || [];
          const x = tr[4] ?? 0;
          const y = tr[5] ?? 0;
          return { str: it.str || "", x, y };
        });

        // group by rounded y coordinate
        const linesMap = new Map();
        for (const it of posItems) {
          // round to 1 decimal; increase factor if text y jitter is high
          const key = Math.round(it.y * 10) / 10;
          if (!linesMap.has(key)) linesMap.set(key, []);
          linesMap.get(key).push(it);
        }

        const sortedYs = Array.from(linesMap.keys()).sort((a, b) => b - a); // top -> bottom
        const lines = sortedYs.map(yKey => {
          const row = linesMap.get(yKey) || [];
          row.sort((a, b) => (a.x || 0) - (b.x || 0));
          return row.map(i => i.str).join(" ").replace(/\s+/g, " ").trim();
        }).filter(Boolean);

        // try merge hyphenated or broken lines heuristics
        const mergedLines = [];
        for (let i = 0; i < lines.length; i++) {
          let cur = lines[i];
          if (!cur) continue;
          // join if ends with hyphen
          if (/[-–—]$/.test(cur) && i + 1 < lines.length) {
            lines[i+1] = (cur.replace(/[-–—]$/, "") + lines[i+1]).replace(/\s+/g, " ").trim();
          } else if (i + 1 < lines.length && /^[a-z0-9]/.test(lines[i+1]) && /[a-z0-9]$/.test(cur) && !/[.!?]$/.test(cur)) {
            // continuation: next line starts with lowercase/number and current lacks punctuation
            lines[i+1] = (cur + " " + lines[i+1]).replace(/\s+/g, " ").trim();
          } else {
            mergedLines.push(cur);
          }
        }

        const finalLines = mergedLines.length ? mergedLines : lines;
        pageTexts.push(finalLines.join("\n"));
      }

      const fullText = pageTexts.join("\n\n---PAGE---\n\n");
      setFullTextPreview(fullText);

      // Local parser fallback (quick check)
      const localParsed = localParseProcedureSteps(fullText);
      setParsedPreview(localParsed || []);

      // if local didn't find anything, set parseError and prompt user to use AI
      if (!localParsed || localParsed.length === 0) {
        setParseError("Parser tidak menemukan langkah SOP dari area yang dipilih. Gunakan tombol 'AI Extract' untuk mencoba ekstraksi dengan AI atau tekan 'Show raw text' untuk debug.");
      } else {
        setParseError("");
      }

      try { if (typeof pdf.destroy === "function") pdf.destroy(); else if (typeof loadingTask.destroy === "function") loadingTask.destroy(); } catch (err) {}

    } catch (err) {
      console.error("Error parsing PDF:", err);
      setParseError("Gagal membaca PDF — " + (err?.message || "unknown error"));
    } finally {
      setParsing(false);
    }
  };

  // Local parser: simple heuristics using "Prosedur" and numbered items.
  function localParseProcedureSteps(fullText) {
    if (!fullText || typeof fullText !== "string") return [];

    // normalize but keep newlines
    let text = fullText.replace(/\u00A0/g, " ").replace(/\t/g, " ").replace(/\u200b/g, "").replace(/\r/g, "\n");
    text = text.split("\n").map(l => l.replace(/\s+/g, " ").trim()).join("\n");

    // find start after 'Prosedur' (prefer '5. Prosedur')
    let start = -1;
    const m5 = text.match(/\b5\s*\.\s*Prosedur\b/i);
    if (m5) start = text.indexOf(m5[0]) + m5[0].length;
    else {
      const m = text.match(/\bProsedur\b/i);
      if (m) start = text.indexOf(m[0]) + m[0].length;
    }
    if (start < 0) {
      const m1 = text.search(/\n?\s*\b1\s*[\.\)\-:]\s*/);
      start = m1 >= 0 ? m1 : 0;
    }

    let procText = text.slice(start).replace(/^[\s\:\-–—\.]+/, "").trim();
    const lines = procText.split("\n").map(l => l.trim()).filter(Boolean);

    const stepSegments = [];
    for (const ln of lines) {
      if (/^\d{1,3}\s*[\.\)\-:]/.test(ln)) stepSegments.push(ln);
      else {
        if (stepSegments.length === 0) stepSegments.push(ln);
        else stepSegments[stepSegments.length - 1] += " " + ln;
      }
    }

    let raw = stepSegments.map(s => s.replace(/^\d{1,3}\s*[\.\)\-:]\s*/, "").replace(/\s+/g, " ").trim()).filter(Boolean);

    // aggressive split if only one item
    if (raw.length === 1) {
      const single = raw[0];
      if (single.length > 60) {
        const parts = single.split(/\.\s+(?=[A-Z0-9]|\b(Formulir|Atasan|HRD|Karyawan|Setelah|Kemudian|Slip))/g);
        const cleaned = parts.map(p => p.replace(/^[\.\s]+|[\.\s]+$/g, "").trim()).filter(Boolean);
        if (cleaned.length > 1) raw = cleaned;
      }
    }

    // cleanup & map to objects
    const final = [];
    const seen = new Set();
    for (const s of raw) {
      const t = s.replace(/\)\s*\.\s*/g, "). ").replace(/\s+/g, " ").trim();
      if (!t) continue;
      if (t.split(/\s+/).length < 3) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      final.push(t);
    }
    return final.map((t, i) => ({ no: i + 1, sop_related: t, status: "", comment: "", reviewer: "" }));
  }

  // Call AI server route to extract steps. Server handles calling Google AI Studio.
  async function sendToAiAndGetSteps(procText) {
    setAiInProgress(true);
    try {
      const res = await fetch("/api/Ai/extract-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: procText, maxSteps: 200 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        console.error("AI extract error:", json);
        return { success: false, steps: [] , raw: json };
      }
      // json.steps expected: [{ step, text }, ...]
      const steps = (json.steps || []).map((s, idx) => ({
        no: (s.step && Number.isFinite(+s.step)) ? +s.step : idx + 1,
        sop_related: (s.text || s || "").toString().trim(),
        status: "DRAFT",
        comment: "",
        reviewer: ""
      }));
      return { success: true, steps, raw: json.raw || null };
    } catch (err) {
      console.error("Network AI error:", err);
      return { success: false, steps: [] };
    } finally {
      setAiInProgress(false);
    }
  }

  // Append parsed: will call AI if needed, update parent, and POST to DB
  const appendToParent = async () => {
    // if we already have parsedPreview and it's non-empty prefer that as quick path
    if (parsedPreview && parsedPreview.length > 0) {
      // update parent
      onSopParsed?.(parsedPreview);
      // try save to DB
      await postToDb(parsedPreview);
      alert(`${parsedPreview.length} item ditambahkan ke daftar dan dicoba disimpan.`);
      return;
    }

    // else try AI extraction using proc area (fullTextPreview contains entire doc; slice around Prosedur)
    if (!fullTextPreview || fullTextPreview.trim().length < 20) {
      alert("Tidak ada teks untuk diekstrak. Upload file dan coba lagi.");
      return;
    }

    // find proc area in fullTextPreview
    let procStart = -1;
    const t = fullTextPreview;
    const m5 = t.match(/\b5\s*\.\s*Prosedur\b/i);
    if (m5) procStart = t.indexOf(m5[0]) + m5[0].length;
    else {
      const m = t.match(/\bProsedur\b/i);
      if (m) procStart = t.indexOf(m[0]) + m[0].length;
    }
    if (procStart < 0) {
      const m1 = t.search(/\b1\s*[\.\)\-:]\s*/);
      procStart = m1 >= 0 ? m1 : 0;
    }
    // take a window around procStart to limit tokens
    const windowText = t.slice(procStart, procStart + 40_000); // first 40k chars of procedure area

    // call AI
    const aiRes = await sendToAiAndGetSteps(windowText);
    if (!aiRes.success || !aiRes.steps || aiRes.steps.length === 0) {
      // fallback to local parser
      const local = localParseProcedureSteps(windowText);
      if (local && local.length > 0) {
        setParsedPreview(local);
        onSopParsed?.(local);
        await postToDb(local);
        alert(`${local.length} item ditambahkan (dengan fallback lokal).`);
      } else {
        alert("AI dan parser lokal gagal mengekstrak langkah. Tekan 'Show raw text' dan copy area 'Prosedur' ke chat agar saya bantu tune.");
      }
      return;
    }

    // got steps from AI: update preview, parent, and save to DB
    setParsedPreview(aiRes.steps);
    onSopParsed?.(aiRes.steps);

    const dbRes = await postToDb(aiRes.steps);
    if (dbRes && dbRes.success) {
      alert(`Berhasil menyimpan ${aiRes.steps.length} langkah ke server.`);
    } else {
      alert(`AI berhasil ekstrak ${aiRes.steps.length} langkah, tapi penyimpanan ke server gagal.`);
    }
  };

  // POST to DB endpoint /api/SopReview/finance
  async function postToDb(items) {
    try {
      // ensure reindex 1..N
      const payload = items.map((it, idx) => ({
        no: idx + 1,
        sop_related: (it.sop_related || it.name || "").trim(),
        status: it.status || "DRAFT",
        comment: it.comment || null,
        reviewer: it.reviewer || null
      }));
      const res = await fetch("/api/SopReview/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(()=>({}));
      if (!res.ok) {
        console.error("DB save error:", json);
        return { success: false, raw: json };
      }
      return { success: true, inserted: json.inserted || [] };
    } catch (err) {
      console.error("Network error saving to DB:", err);
      return { success: false };
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "APPROVED": return "bg-green-100 text-green-800 border-green-200";
      case "REJECTED": return "bg-red-100 text-red-800 border-red-200";
      case "IN REVIEW": return "bg-blue-100 text-blue-800 border-blue-200";
      default: return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  return (
    <aside className="bg-white w-96 p-6 rounded-xl shadow-lg border border-gray-200 space-y-6 text-sm">
      <div className="space-y-4">
        <div>
          <div className="font-semibold text-gray-700 mb-1">DEPARTMENT</div>
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-2 font-bold rounded-lg shadow-sm">{department}</div>
        </div>

        <div>
          <div className="font-semibold text-gray-700 mb-1">SOP Status</div>
          <div className={`px-3 py-2 font-bold rounded-lg border-2 ${getStatusColor(sopStatus)}`}>{sopStatus}</div>
        </div>
      </div>

      <div>
        <div className="font-semibold text-gray-700 mb-2">SOP DOCUMENT</div>
        <div className="border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 p-4 rounded-xl flex flex-col items-center justify-center space-y-3">
          <label htmlFor="pdfUpload" className="cursor-pointer flex flex-col items-center text-center space-y-2 w-full">
            <div className="text-blue-500 text-5xl">{parsing ? "⏳" : "📄"}</div>
            <div className="text-sm text-gray-600 mt-1">
              {selectedFile ? <span className="font-medium text-blue-600">{selectedFile.name}</span> : <div><div className="font-medium">{parsing ? "Reading PDF..." : "Choose PDF file"}</div><div className="text-xs text-gray-500 mt-1">Max. 20MB</div></div>}
            </div>
            <input id="pdfUpload" type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
          </label>

          {parsing && <div className="text-xs text-gray-500">Parsing PDF... please wait</div>}
          {parseError && <div className="text-xs text-red-600">{parseError}</div>}

          <div className="flex gap-2 mt-2">
            <button onClick={() => setShowRaw(s => !s)} className="px-2 py-1 bg-gray-100 rounded text-xs">Show raw text</button>
            <button onClick={appendToParent} disabled={parsing || aiInProgress} className={`px-2 py-1 rounded text-xs ${parsing || aiInProgress ? "bg-gray-200 text-gray-500" : "bg-green-600 text-white"}`}>{aiInProgress ? "AI..." : "Append parsed →"}</button>
            <button onClick={async () => {
              // quick AI test without saving: call AI on procedure window and set preview
              if (!fullTextPreview) { alert("Upload file dulu."); return; }
              let procStart = -1;
              const t = fullTextPreview;
              const m5 = t.match(/\b5\s*\.\s*Prosedur\b/i);
              if (m5) procStart = t.indexOf(m5[0]) + m5[0].length;
              else {
                const m = t.match(/\bProsedur\b/i);
                if (m) procStart = t.indexOf(m[0]) + m[0].length;
              }
              if (procStart < 0) {
                const m1 = t.search(/\b1\s*[\.\)\-:]\s*/);
                procStart = m1 >= 0 ? m1 : 0;
              }
              const windowText = t.slice(procStart, procStart + 40000);
              setAiInProgress(true);
              const aiRes = await sendToAiAndGetSteps(windowText);
              setAiInProgress(false);
              if (aiRes.success) {
                setParsedPreview(aiRes.steps);
                alert(`AI mengekstrak ${aiRes.steps.length} langkah (preview diperbarui).`);
              } else {
                alert("AI gagal mengekstrak langkah. Cek console untuk detail.");
                console.error(aiRes);
              }
            }} className="px-2 py-1 rounded text-xs bg-indigo-600 text-white">AI Extract (Preview)</button>
          </div>

          <div className="w-full mt-3">
            <div className="text-xs font-semibold text-gray-700 mb-1">Parsed preview ({parsedPreview.length})</div>
            {parsedPreview.length === 0 ? <div className="text-xs text-gray-500">No parsed items yet.</div> :
              <ol className="list-decimal list-inside max-h-40 overflow-auto text-xs space-y-1">
                {parsedPreview.map((p, i) => <li key={i} className="text-gray-800">{p.sop_related || p.text}</li>)}
              </ol>
            }
          </div>

          {showRaw && (
            <div className="w-full mt-3">
              <div className="text-xs font-semibold text-gray-700 mb-1">Raw extracted text (first 300000 chars)</div>
              <textarea readOnly value={fullTextPreview.slice(0, 300000)} className="w-full h-48 p-2 text-xs border rounded" />
              <div className="text-xs text-gray-500 mt-1">Jika parser gagal, copy ~600–1200 karakter yang berisi kata 'Prosedur' dan beberapa baris setelahnya lalu paste ke chat agar saya tune lebih lanjut.</div>
            </div>
          )}
        </div>
      </div>

      {/* Preparer */}
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-gray-800 to-black text-white px-3 py-2 font-semibold rounded-lg">Preparer</div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
          <select className="w-full border border-gray-300 bg-white px-3 py-2 rounded-lg text-sm" value={preparerStatus} onChange={(e) => onPreparerStatusChange?.(e.target.value)}>
            {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div className="text-xs">
          <div className="text-gray-700">Preparer:</div>
          <div className="bg-gray-100 h-8 rounded-lg flex items-center px-3 text-gray-600">Nama Preparer</div>
          <div className="text-gray-700 mt-2">Date:</div>
          <div className="bg-gray-100 h-8 rounded-lg flex items-center px-3 text-gray-600">DD/MM/YYYY</div>
        </div>
      </div>

      {/* Reviewer */}
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-gray-800 to-black text-white px-3 py-2 font-semibold rounded-lg">Reviewer</div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Comment :</label>
          <textarea className="w-full h-24 border border-gray-300 rounded-lg p-3 text-sm" placeholder="Enter reviewer comment..." />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">SOP Review Status</label>
          <select className="w-full border border-gray-300 bg-white px-3 py-2 rounded-lg text-sm" value={reviewerStatus} onChange={(e) => onReviewerStatusChange?.(e.target.value)}>
            {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div className="text-xs">
          <div className="text-gray-700">Reviewer:</div>
          <div className="bg-gray-100 h-8 rounded-lg flex items-center px-3 text-gray-600">Nama Reviewer</div>
          <div className="text-gray-700 mt-2">Date:</div>
          <div className="bg-gray-100 h-8 rounded-lg flex items-center px-3 text-gray-600">DD/MM/YYYY</div>
        </div>
      </div>
    </aside>
  );
}
