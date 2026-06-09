export const REPORT_AI_TASKS = {
  conclusion: {
    id: "conclusion",
    label: "Buat Conclusion",
    labelEn: "Write Conclusion",
    description: "Ringkas temuan & rekomendasi per departemen menjadi bagian Conclusion.",
    system: `You are an internal audit report writer for KIAS (Kaluna / WHSmith Indonesia).
Write professional audit report prose in English unless the user asks for Indonesian.
Use only facts from the provided JSON data — do not invent findings.
Format for Word: plain text with numbered sections (e.g. 6.1 Finance: ...).`,
    userPrefix: `Using ALL department data below, draft the full "Conclusion" section (section 6) of the consolidated internal audit report.
Include one subsection per department that has audit or conclusion data. Be concise but complete.`,
  },
  conclusion_dept: {
    id: "conclusion_dept",
    label: "Generate Conclusion (dept)",
    labelEn: "Generate Conclusion",
    description: "Buat conclusion satu departemen dari temuan audit & SOP review.",
    system: `You are an internal audit report writer for KIAS (Kaluna / WHSmith Indonesia).
Write professional audit report prose in English unless the user asks for Indonesian.
Use only facts from the provided JSON data — do not invent findings.
Output plain text only: no headings, no department number prefix, no markdown.`,
    userPrefix: `Using the single department data below (SOP Review + Audit Review findings), draft the Conclusion paragraph for this department only.
Summarize key SOP review outcomes and audit findings, note overall control environment, and close with forward-looking management actions where supported by the data.
Keep it concise (roughly 1–3 short paragraphs).`,
  },
  executive_summary: {
    id: "executive_summary",
    label: "Perbaiki Executive Summary",
    labelEn: "Improve Executive Summary",
    description: "Susun ulang executive summary dari data yang ada.",
    system: `You are an internal audit report writer for KIAS.
Write clear executive summary text in English unless asked otherwise.
Use only provided data.`,
    userPrefix: `Draft or improve the Executive Summary for the consolidated audit report year, based on the JSON data.`,
  },
  findings_narrative: {
    id: "findings_narrative",
    label: "Narasi temuan",
    labelEn: "Findings narrative",
    description: "Jelaskan temuan audit utama dalam bentuk narasi.",
    system: `You are an internal audit report writer for KIAS. Summarize key audit findings in professional English.`,
    userPrefix: `Write a narrative summary of the most important audit findings across all departments in the data.`,
  },
  custom: {
    id: "custom",
    label: "Instruksi bebas",
    labelEn: "Custom",
    description: "Tulis permintaan Anda sendiri.",
    system: `You are an AI writing assistant for KIAS consolidated audit report HTML Preview.
Help draft report narrative using the provided audit/SOP data. Output plain text ready to apply in preview.`,
    userPrefix: "",
  },
};

export function buildReportAiUserMessage(taskId, contextJson, customPrompt) {
  const task = REPORT_AI_TASKS[taskId] || REPORT_AI_TASKS.custom;
  const base = task.userPrefix ? `${task.userPrefix}\n\n` : "";
  const custom = String(customPrompt || "").trim();
  return `${base}${custom ? `User request:\n${custom}\n\n` : ""}Report data (JSON):\n${contextJson}`;
}
