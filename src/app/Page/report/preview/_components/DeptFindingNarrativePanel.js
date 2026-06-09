"use client";

/**
 * Finding & Recommendation narasi per department — disimpan ke report_findings (DB).
 */
export default function DeptFindingNarrativePanel({
  sections = [],
  narrativesByDept = {},
  onChange,
}) {
  if (!sections.length) return null;

  return (
    <div className="mx-auto bg-white shadow-md print:hidden w-[210mm] min-h-0 overflow-hidden flex flex-col px-16 py-10 break-after-page">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold">Finding &amp; Recommendation (Narrative)</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-lg mx-auto">
          Edits here are saved to the database. OnlyOffice is for review and formatting only — not
          for storing business findings.
        </p>
      </div>
      <div className="space-y-8 text-[11px]">
        {sections.map((section, index) => {
          const row = narrativesByDept[section.deptKey] || {
            findingHtml: "",
            recommendationHtml: "",
          };
          return (
            <div key={section.deptKey} className="border border-slate-200 rounded-lg p-4 space-y-3">
              <p className="font-semibold text-sm">
                5.{index + 1} Department — {section.deptLabel}
              </p>
              <div>
                <label className="block font-medium mb-1">Finding</label>
                <textarea
                  className="w-full border border-gray-300 rounded p-3 min-h-[100px] resize-y bg-gray-50 text-[11px]"
                  placeholder="Finding narrative for this department..."
                  value={row.findingHtml || ""}
                  onChange={(e) =>
                    onChange(section.deptKey, { ...row, findingHtml: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Recommendation</label>
                <textarea
                  className="w-full border border-gray-300 rounded p-3 min-h-[100px] resize-y bg-gray-50 text-[11px]"
                  placeholder="Recommendation narrative for this department..."
                  value={row.recommendationHtml || ""}
                  onChange={(e) =>
                    onChange(section.deptKey, { ...row, recommendationHtml: e.target.value })
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
