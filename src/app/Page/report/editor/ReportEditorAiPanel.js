"use client";

import { useState } from "react";
import { REPORT_AI_TASKS } from "@/app/lib/report/ai/reportAiPrompts";
import { insertTextIntoOnlyOfficeEditor } from "@/app/lib/report/onlyoffice/insertEditorText";

const QUICK_TASKS = ["conclusion", "executive_summary", "findings_narrative"];

export default function ReportEditorAiPanel({
  sessionId,
  docEditorRef,
  onRefreshDocument,
  onStatus,
}) {
  const [open, setOpen] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [task, setTask] = useState("conclusion");
  const [loading, setLoading] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const runAi = async (taskId, customPrompt) => {
    if (!sessionId) return;
    setLoading(true);
    setError("");
    onStatus?.("AI sedang menulis…");

    try {
      const res = await fetch("/api/report/ai/assist", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          task: taskId,
          prompt: customPrompt || "",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `AI failed (${res.status})`);
      }
      setResult(json.text || "");
      onStatus?.("AI selesai. Klik Sisipkan ke dokumen atau Salin.");
    } catch (e) {
      setError(e?.message || "AI gagal");
      onStatus?.("");
    } finally {
      setLoading(false);
    }
  };

  const insertIntoDocument = async () => {
    if (!result.trim()) return;
    setInserting(true);
    setError("");
    onStatus?.("Menyisipkan ke dokumen…");

    try {
      const res = await fetch("/api/report/ai/insert", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, text: result }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Insert failed");
      }

      if (typeof onRefreshDocument === "function") {
        await onRefreshDocument();
      }

      onStatus?.(
        json.message ||
          "Teks ditambahkan. Scroll ke akhir dokumen; pindahkan ke Conclusion jika perlu.",
      );
    } catch (e) {
      const fallback = await insertTextIntoOnlyOfficeEditor(docEditorRef?.current, result);
      if (fallback.ok && fallback.method === "clipboard") {
        onStatus?.(fallback.message);
      } else if (fallback.ok && fallback.method === "connector") {
        onStatus?.("Teks disisipkan di posisi kursor.");
      } else {
        setError(e?.message || fallback.error || "Gagal menyisipkan");
        onStatus?.("");
      }
    } finally {
      setInserting(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      onStatus?.("Disalin. Tempel di dokumen (Ctrl+V).");
    } catch {
      setError("Gagal menyalin");
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-50 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm shadow-lg hover:bg-indigo-700"
      >
        AI Assistant
      </button>
    );
  }

  return (
    <aside className="w-[min(100%,22rem)] shrink-0 flex flex-col border-l border-slate-200 bg-slate-50 h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white">
        <div>
          <p className="text-sm font-semibold text-slate-900">AI Report Assistant</p>
          <p className="text-[10px] text-slate-500">OpenAI · data dari laporan Anda</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-slate-400 hover:text-slate-600 text-lg leading-none"
          aria-label="Tutup panel"
        >
          ×
        </button>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-0">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-600">Tugas cepat</p>
          <div className="flex flex-col gap-1">
            {QUICK_TASKS.map((id) => {
              const t = REPORT_AI_TASKS[id];
              return (
                <button
                  key={id}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setTask(id);
                    runAi(id, "");
                  }}
                  className="text-left px-2 py-1.5 rounded border border-slate-200 bg-white hover:bg-indigo-50 text-xs text-slate-800 disabled:opacity-50"
                >
                  <span className="font-medium">{t.label}</span>
                  <span className="block text-[10px] text-slate-500">{t.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-600 mb-1">Instruksi bebas</p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder='Contoh: "Tambahkan conclusion dari semua data audit review dan SOP"'
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 resize-y min-h-[4rem]"
          />
          <button
            type="button"
            disabled={loading || !prompt.trim()}
            onClick={() => {
              setTask("custom");
              runAi("custom", prompt);
            }}
            className="mt-1 w-full py-1.5 rounded bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Menulis…" : "Jalankan AI"}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1">
            {error}
          </p>
        )}

        {result && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Hasil AI</p>
            <textarea
              readOnly
              value={result}
              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white min-h-[8rem] max-h-[14rem]"
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={inserting}
                onClick={insertIntoDocument}
                className="w-full py-1.5 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {inserting ? "Menyisipkan…" : "Sisipkan ke dokumen"}
              </button>
              <button
                type="button"
                onClick={copyResult}
                className="w-full py-1.5 rounded border border-slate-300 bg-white text-xs hover:bg-slate-100"
              >
                Salin (tempel manual)
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              Sisipkan menambah teks di akhir file Word lalu memuat ulang editor. Pindahkan ke
              bagian Conclusion jika perlu.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
