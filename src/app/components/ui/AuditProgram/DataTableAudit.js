import React from "react";
import { Pencil } from "lucide-react";

export default function DataTableAudit({ data = [], isPlanningMode = false }) {
  return (
    <div className="p-4">
      <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-200 bg-white">
        <table className="min-w-full border-collapse text-sm text-gray-700">
          <thead>
            <tr className="bg-gray-50 text-gray-700 font-semibold">
              <th rowSpan="2" className="px-3 py-2 border border-gray-200 text-center">No</th>
              <th rowSpan="2" className="px-3 py-2 border border-gray-200 text-center">Risk ID No.</th>
              <th rowSpan="2" className="px-3 py-2 border border-gray-200 text-center">Risk Description</th>
              <th rowSpan="2" className="px-3 py-2 border border-gray-200 text-center">Risk Details</th>
              <th rowSpan="2" className="px-3 py-2 border border-gray-200 text-center">Owner</th>
              <th colSpan="4" className="px-3 py-2 border border-gray-200 text-center">Audit Program</th>
              <th colSpan="3" className="px-3 py-2 border border-gray-200 text-center">Sampling</th>
              {isPlanningMode && (
                <th rowSpan="2" className="px-3 py-2 border border-gray-200 text-center">Action</th>
              )}
            </tr>

            <tr className="bg-gray-50 text-gray-700 font-semibold">
              <th className="px-3 py-2 border border-gray-200 text-center">AP Code</th>
              <th className="px-3 py-2 border border-gray-200 text-center">Substantive Test</th>
              <th className="px-3 py-2 border border-gray-200 text-center">Objective</th>
              <th className="px-3 py-2 border border-gray-200 text-center">Procedures</th>
              <th className="px-3 py-2 border border-gray-200 text-center">Method</th>
              <th className="px-3 py-2 border border-gray-200 text-center">Description</th>
              <th className="px-3 py-2 border border-gray-200 text-center">Application</th>
            </tr>
          </thead>

          <tbody>
            {Array.isArray(data) && data.length > 0 ? (
              data.map((item, index) => (
                <tr
                  key={item.risk_id ?? index}
                  className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition`}
                >
                  <td className="px-3 py-2 border border-gray-200 text-center">{index + 1}</td>
                  <td className="px-3 py-2 border border-gray-200 text-center">{item.risk_id_no}</td>
                  <td className="px-3 py-2 border border-gray-200">{item.risk_description}</td>
                  <td className="px-3 py-2 border border-gray-200">{item.risk_details}</td>
                  <td className="px-3 py-2 border border-gray-200">{item.owners}</td>

                  {/* AUDIT PROGRAM */}
                  <td className="px-3 py-2 border border-gray-200">{item.ap_code}</td>
                  <td className="px-3 py-2 border border-gray-200">{item.substantive_test}</td>
                  <td className="px-3 py-2 border border-gray-200">{item.objective}</td>
                  <td className="px-3 py-2 border border-gray-200">{item.procedures}</td>

                  {/* SAMPLING */}
                  <td className="px-3 py-2 border border-gray-200">{item.method}</td>
                  <td className="px-3 py-2 border border-gray-200">{item.description ?? item.sampling_description}</td>
                  <td className="px-3 py-2 border border-gray-200">{item.application}</td>

                  {/* ACTION */}
                  {isPlanningMode && (
                    <td className="px-3 py-2 border border-gray-200 text-center">
                      <button
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("open-modal", { detail: { name: "add-ap", row: item } })
                          )
                        }
                        className="inline-flex items-center justify-center w-9 h-9 rounded hover:bg-gray-100 transition text-blue-600"
                        title={`Add AP for ${item.risk_id_no}`}
                        aria-label={`Add AP for ${item.risk_id_no}`}
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isPlanningMode ? 14 : 13} className="text-center py-6 text-gray-500 border border-gray-200">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
