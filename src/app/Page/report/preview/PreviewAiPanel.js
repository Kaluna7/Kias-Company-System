"use client";

import { useState } from "react";
import { REPORT_AI_TASKS } from "@/app/lib/report/ai/reportAiPrompts";
import { buildPreviewPatchFromAiResult } from "@/app/lib/report/ai/applyAiResult";

const QUICK_TASKS = ["conclusion", "executive_summary", "findings_narrative"];

export default function PreviewAiPanel({ year, conclusionDeptKeys = [], onApply, onStatus }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [task, setTask] = useState("conclusion");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const runAi = async (taskId, customPrompt) => {
    if (!Number.isFinite(year)) return;
    setLoading(true);
    setError("");
    onStatus?.("AI is writing…");

    try {
      const res = await fetch("/api/report/ai/assist", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          task: taskId,
          prompt: customPrompt || "",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `AI failed (${res.status})`);
      }
      setTask(taskId);
      setResult(json.text || "");
      onStatus?.("AI complete. Apply to preview or copy.");
    } catch (e) {
      setError(e?.message || "AI failed");
      onStatus?.("");
    } finally {
      setLoading(false);
    }
  };

  const applyResult = (targetTask) => {
    if (!result.trim()) return;
    const patch = buildPreviewPatchFromAiResult(targetTask || task, result, {
      conclusionDeptKeys,
    });
    if (!patch || Object.keys(patch).length === 0) {
      setError("Nothing to apply.");
      return;
    }
    onApply?.(patch, { task: targetTask || task });
    onStatus?.("Applied to HTML Preview. Changes sync to collaborators.");
    setError("");
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      onStatus?.("Copied to clipboard.");
    } catch {
      setError("Failed to copy");
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => setOpen(true)}
        className="pointer-events-auto fixed right-4 bottom-4 z-[92] px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold shadow-lg hover:bg-indigo-700 print:hidden"
      >
        AI Assistant
      </button>
    );
  }

  return (
    <aside
      suppressHydrationWarning
      className="pointer-events-auto fixed right-0 top-14 bottom-0 z-[92] w-[min(100%,22rem)] flex flex-col border-l border-slate-200 bg-slate-50 shadow-xl print:hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white">
        <div>
          <p className="text-sm font-semibold text-slate-900">AI Report Assistant</p>
          <p className="text-[10px] text-slate-500">OpenAI · applies to HTML Preview</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-slate-400 hover:text-slate-600 text-lg leading-none"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-0">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-600">Quick tasks</p>
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
                  <span className="font-medium">{t.labelEn || t.label}</span>
                  <span className="block text-[10px] text-slate-500">{t.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-600 mb-1">Custom instruction</p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder='e.g. "Summarize key findings across all departments"'
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
            {loading ? "Writing…" : "Run AI"}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1">
            {error}
          </p>
        )}

        {result && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">AI result</p>
            <textarea
              readOnly
              value={result}
              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white min-h-[8rem] max-h-[14rem]"
            />
            <div className="flex flex-col gap-1">
              {(task === "conclusion" || task === "custom") && (
                <button
                  type="button"
                  onClick={() => applyResult("conclusion")}
                  className="w-full py-1.5 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                >
                  Apply to Conclusion
                </button>
              )}
              {(task === "executive_summary" ||
                task === "findings_narrative" ||
                task === "custom") && (
                <button
                  type="button"
                  onClick={() => applyResult("executive_summary")}
                  className="w-full py-1.5 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                >
                  Apply to Executive Summary
                </button>
              )}
              <button
                type="button"
                onClick={copyResult}
                className="w-full py-1.5 rounded border border-slate-300 bg-white text-xs hover:bg-slate-100"
              >
                Copy
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              Applied text is saved to HTML Preview and synced to other users. Regenerate Word from
              preview when ready.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
