/**
 * SOP procedure text helpers — generic (semua jenis dokumen).
 */

const SECTION_END_HEADERS = [
  "Catatan",
  "Dokumen Pendukung",
  "Revisi",
  "Persetujuan",
  "Lampiran",
  "Penutup",
  "Tanda Tangan",
  "Daftar Referensi",
  "Referensi",
  "Appendix",
  "Attachment",
];

/** Baris header tabel umum (bukan isi langkah) */
const TABLE_HEADER_LINE =
  /^(NO\.?|NO\s+PROSEDUR|PROSEDUR\s+KERJA|ALUR\s+(?:KERJA|PROSEDUR)|PROSEDUR|PROCEDURE|KETERANGAN|PIC|STATUS|Kolom)$/i;

/** Awalan yang mengindikasikan potongan di tengah kalimat */
const MID_SENTENCE_START =
  /^(oleh|dan|atau|media|maupun|untuk|dari|yang|di|ke|pada|dengan|serta|adalah)\s+/i;

function normalizeFullText(fullText) {
  return (fullText || "")
    .replace(/\u00A0/g, " ")
    .replace(/\t/g, " ")
    .replace(/\u200b/g, "")
    .replace(/\r/g, "\n");
}

function findProcedureSectionEnd(procText) {
  const headerPattern = SECTION_END_HEADERS.map((k) =>
    k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  ).join("|");
  const re = new RegExp(`(?:^|\\n)\\s*(?:${headerPattern})\\s*(?:\\n|$|:)`, "i");
  const m = re.exec(procText);
  return m ? m.index : -1;
}

export function extractProcedureSection(fullText) {
  if (!fullText || typeof fullText !== "string") return "";

  let text = normalizeFullText(fullText);
  text = text
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n");

  let start = -1;
  const markers = [
    /\b\d+\s*\.\s*Prosedur\b/i,
    /\bProsedur\s+Kerja\b/i,
    /\bALUR\s+(?:KERJA|PROSEDUR)\b/i,
    /\bNO\s+PROSEDUR\b/i,
    /\bProsedur\b/i,
    /\bProcedure\b/i,
  ];

  for (const re of markers) {
    const m = text.match(re);
    if (m) {
      start = text.indexOf(m[0]);
      break;
    }
  }

  if (start < 0) {
    const m1 = text.search(/(?:^|\n)\s*1\s+[\.\)\-:]?\s*\S/);
    start = m1 >= 0 ? m1 : 0;
  }

  let procText = text.slice(start).replace(/^[\s\:\-–—\.]+/, "").trim();
  const endIdx = findProcedureSectionEnd(procText);
  if (endIdx > 0) procText = procText.slice(0, endIdx).trim();

  return procText || text;
}

function stripTableHeaderNoise(text) {
  return (text || "")
    .replace(
      /\b(?:NO\.?\s*PROSEDUR|PROSEDUR\s+KERJA|ALUR\s+(?:KERJA|PROSEDUR))\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function formatStepTextForDisplay(s) {
  if (!s || typeof s !== "string") return "";

  let t = s
    .split(/Comment\s*:/i)[0]
    .replace(/[\{\}]/g, " ")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

  const listMatch = t.match(/^(.*?antara lain\s*:)\s*(.+)$/i);
  if (listMatch) {
    const head = listMatch[1].trim();
    const tail = listMatch[2];
    const items = tail
      .split(/(?:\s*[,;]\s*|\s+-\s+|\s+•\s+)/)
      .map((x) => x.replace(/^[-•\d.)\s]+/, "").trim())
      .filter((x) => x.length > 2);
    if (items.length >= 2) {
      return `${head} ${items.map((it) => `• ${it}`).join(" ")}`.replace(/\s+/g, " ").trim();
    }
  }

  return t;
}

export function sanitizeStepText(s) {
  return formatStepTextForDisplay(s);
}

/**
 * Satu nomor baris (1, 2, 3 …) = satu langkah — dari teks satu baris.
 */
function parseNumberedStepsFromLines(procText) {
  const lines = procText.split("\n").map((l) => l.trim()).filter(Boolean);
  const steps = [];
  let buf = [];
  let currentNo = null;

  const flush = () => {
    const joined = buf.join(" ").replace(/\s+/g, " ").trim();
    if (joined && joined.split(/\s+/).length >= 3) {
      steps.push(formatStepTextForDisplay(joined));
    }
    buf = [];
    currentNo = null;
  };

  for (const ln of lines) {
    if (TABLE_HEADER_LINE.test(ln) && buf.length === 0) continue;

    const numOnly = ln.match(/^(\d{1,3})\s*$/);
    if (numOnly) {
      flush();
      currentNo = numOnly[1];
      continue;
    }

    const numLead = ln.match(/^(\d{1,3})\s+(.+)$/);
    if (numLead) {
      flush();
      currentNo = numLead[1];
      buf.push(numLead[2]);
      continue;
    }

    if (currentNo != null) {
      buf.push(ln);
    }
  }
  flush();

  return steps;
}

/**
 * Satu nomor baris dari teks datar (PDF kadang tanpa newline antar baris).
 */
function parseNumberedStepsFromFlat(procText) {
  const flat = stripTableHeaderNoise(
    procText.includes("\n") ? procText.replace(/\n+/g, " ") : procText
  );
  if (!flat || flat.length < 30) return [];

  const hits = [];
  const re = /(?:^|\s)(\d{1,3})\s+([A-Za-zÀ-ÿ0-9(])/g;
  let m;
  while ((m = re.exec(flat)) !== null) {
    const digitAt = m[0].search(/\d/);
    hits.push({
      n: parseInt(m[1], 10),
      index: m.index + (digitAt >= 0 ? digitAt : 0),
    });
  }

  if (hits.length < 2) return [];

  hits.sort((a, b) => a.index - b.index);

  const steps = [];
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].index;
    const end = i + 1 < hits.length ? hits[i + 1].index : flat.length;
    let chunk = flat.slice(start, end).trim();
    chunk = chunk.replace(/^\d{1,3}\s+/, "").trim();
    if (chunk && chunk.split(/\s+/).length >= 3) {
      steps.push(formatStepTextForDisplay(chunk));
    }
  }

  return steps;
}

export function stepsLookBroken(stepTexts) {
  const texts = (stepTexts || []).map((s) => String(s || "").trim());
  if (texts.length === 0) return true;

  if (MID_SENTENCE_START.test(texts[0])) return true;

  const shortFragments = texts.filter((t) => t.length < 50);
  if (shortFragments.length >= Math.ceil(texts.length * 0.4)) return true;

  const titleOnly = texts.filter((t) => /^\([^)]{5,120}\)$/.test(t)).length;
  if (titleOnly >= 1 && texts.length <= 3) return true;

  return false;
}

export function localParseProcedureSteps(fullText) {
  if (!fullText || typeof fullText !== "string") return [];

  const procText = extractProcedureSection(fullText);
  let steps = parseNumberedStepsFromLines(procText);

  if (steps.length < 2) {
    steps = parseNumberedStepsFromFlat(procText);
  }

  if (steps.length < 2) {
    const stepRegex =
      /(?:^|\n|\b)(\d{1,3})\s*[\.\)\-:]\s*([\s\S]*?)(?=(?:\n|\b)\d{1,3}\s*[\.\)\-:]|$)/g;
    for (const m of procText.matchAll(stepRegex)) {
      const content = (m[2] || "").replace(/\s+/g, " ").trim();
      if (content && content.split(/\s+/).length >= 3) {
        steps.push(formatStepTextForDisplay(content));
      }
    }
  }

  const out = [];
  const seen = new Set();
  for (const s of steps) {
    const t = formatStepTextForDisplay(s);
    if (!t || t.split(/\s+/).length < 3) continue;
    if (TABLE_HEADER_LINE.test(t)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }

  return out.map((textVal, idx) => ({
    no: idx + 1,
    sop_related: textVal,
    status: "IN REVIEW",
    comment: "",
    reviewer: "",
  }));
}

export function normalizeExtractedSteps(aiSteps, mergedFullText = "") {
  const local = mergedFullText ? localParseProcedureSteps(mergedFullText) : [];
  const localTexts = local.map((r) => r.sop_related);

  const aiTexts = (aiSteps || [])
    .map((item) => formatStepTextForDisplay(item?.text || item?.instruction || ""))
    .filter((t) => t.length >= 3);

  const useLocal =
    localTexts.length >= 2 &&
    (stepsLookBroken(aiTexts) || localTexts.length > aiTexts.length);

  const chosen = useLocal ? localTexts : aiTexts;

  const out = [];
  const seen = new Set();
  for (const t of chosen) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }

  return out.map((text, idx) => ({
    step: idx + 1,
    text,
    instruction: text,
  }));
}
