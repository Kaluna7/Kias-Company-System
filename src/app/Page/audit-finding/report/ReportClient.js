"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { exportToStyledExcel } from "@/app/utils/exportExcel";
import { canEditPublishedReport } from "@/lib/roles";
import { useToast } from "@/app/contexts/ToastContext";

const DEPT_NAME_TO_API = {
  FINANCE: "finance",
  ACCOUNTING: "accounting",
  HRD: "hrd",
  "G&A": "g&a",
  "DESIGN STORE PLANNER": "sdp",
  TAX: "tax",
  "SECURITY L&P": "l&p",
  MIS: "mis",
  MERCHANDISE: "merch",
  OPERATIONAL: "ops",
  WAREHOUSE: "whs",
};

const EMPTY_ADD_FORM = {
  riskId: "",
  riskDescription: "",
  riskDetails: "",
  owners: "",
  apCode: "",
  substantiveTest: "",
  objective: "",
  procedures: "",
  method: "",
  description: "",
  application: "",
  risk: "",
  checkYN: "",
  preparer: "",
  findingResult: "",
  findingDescription: "",
  recommendation: "",
  auditee: "",
  completionDate: "",
};

function toYmd(value) {
  if (!value) return "";
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayYmd() {
  return toYmd(new Date());
}

export default function ReportClient({ initialData = [], selectedYear = null }) {
  const { data: session } = useSession();
  const router = useRouter();
  const toast = useToast();
  const canEdit = canEditPublishedReport(session?.user?.role);

  const [rows, setRows] = useState(() => (Array.isArray(initialData) ? initialData : []));
  const [selectedGroup, setSelectedGroup] = useState(null); // { deptName, periodKey } | null
  const [editingDeptName, setEditingDeptName] = useState(null);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [addFormDept, setAddFormDept] = useState(null);
  const [addFormPeriodKey, setAddFormPeriodKey] = useState(null);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [saving, setSaving] = useState(false);
  const dateFormatCache = useMemo(() => new Map(), []);

  useEffect(() => {
    setRows(Array.isArray(initialData) ? initialData : []);
  }, [initialData]);

  const formatDate = useCallback(
    (dateStr) => {
      if (!dateStr) return "-";
      if (dateFormatCache.has(dateStr)) return dateFormatCache.get(dateStr);
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "-";
        const formatted = date.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "2-digit",
        });
        dateFormatCache.set(dateStr, formatted);
        return formatted;
      } catch {
        return "-";
      }
    },
    [dateFormatCache],
  );

  const reportColumns = useMemo(
    () => [
      {
        key: "audit_fieldwork_start",
        header: "Audit fieldwork — Start",
        accessor: (row) => formatDate(row.audit_fieldwork_start ?? row.fieldwork_start),
        align: "text-center",
        className: "whitespace-nowrap",
      },
      {
        key: "audit_fieldwork_end",
        header: "Audit fieldwork — End",
        accessor: (row) => {
          const v = formatDate(row.audit_fieldwork_end ?? row.fieldwork_end);
          if (row.exceeds_audit_period && v !== "-") return `${v} ⚠`;
          return v;
        },
        align: "text-center",
        className: "whitespace-nowrap",
      },
      {
        key: "audit_period_start",
        header: "Audit period — Start",
        accessor: (row) => formatDate(row.audit_period_start ?? row.period_start),
        align: "text-center",
        className: "whitespace-nowrap",
      },
      {
        key: "audit_period_end",
        header: "Audit period — End",
        accessor: (row) => formatDate(row.audit_period_end ?? row.period_end),
        align: "text-center",
        className: "whitespace-nowrap",
      },
      {
        key: "department",
        header: "Department",
        accessor: (row) => row.department || "-",
        align: "text-left",
        className: "whitespace-nowrap",
      },
      {
        key: "risk_id",
        header: "Risk ID",
        accessor: (row) => row.risk_id || "-",
        align: "text-center",
        className: "whitespace-nowrap",
      },
      {
        key: "risk_description",
        header: "Risk Description",
        accessor: (row) => row.risk_description || "-",
        align: "text-left",
        wrap: true,
      },
      {
        key: "risk_details",
        header: "Risk Details",
        accessor: (row) => row.risk_details || "-",
        align: "text-left",
        wrap: true,
      },
      {
        key: "owners",
        header: "Owner",
        accessor: (row) => row.owners || "-",
        align: "text-left",
        wrap: true,
      },
      {
        key: "ap_code",
        header: "AP Code",
        accessor: (row) => row.ap_code || "-",
        align: "text-center",
        className: "whitespace-nowrap",
      },
      {
        key: "substantive_test",
        header: "Substantive Test",
        accessor: (row) => row.substantive_test || "-",
        align: "text-left",
        wrap: true,
      },
      {
        key: "objective",
        header: "Objective",
        accessor: (row) => row.objective || "-",
        align: "text-left",
        wrap: true,
      },
      {
        key: "procedures",
        header: "Procedures",
        accessor: (row) => row.procedures || "-",
        align: "text-left",
        wrap: true,
      },
      {
        key: "method",
        header: "Method",
        accessor: (row) => row.method || "-",
        align: "text-left",
        wrap: true,
      },
      {
        key: "description",
        header: "Description",
        accessor: (row) => row.description || "-",
        align: "text-left",
        wrap: true,
      },
      {
        key: "application",
        header: "Application",
        accessor: (row) => row.application || "-",
        align: "text-left",
        wrap: true,
      },
      {
        key: "risk",
        header: "Risk",
        accessor: (row) =>
          row.risk !== undefined && row.risk !== null && row.risk !== "" ? String(row.risk) : "-",
        align: "text-center",
      },
      {
        key: "check_yn",
        header: "Check (Y/N)",
        accessor: (row) => row.check_yn || "-",
        align: "text-center",
        className: "whitespace-nowrap",
      },
      {
        key: "preparer",
        header: "Preparer",
        accessor: (row) => row.preparer || "-",
        align: "text-left",
        wrap: true,
      },
      {
        key: "finding_result",
        header: "Finding Result",
        accessor: (row) => row.finding_result || "-",
        align: "text-left",
        wrap: true,
      },
      {
        key: "finding_description",
        header: "Finding Description",
        accessor: (row) => row.finding_description || "-",
        align: "text-left",
        wrap: true,
      },
      {
        key: "recommendation",
        header: "Recommendation",
        accessor: (row) => row.recommendation || "-",
        align: "text-left",
        wrap: true,
      },
      {
        key: "auditee",
        header: "Auditee",
        accessor: (row) => row.auditee || "-",
        align: "text-left",
        wrap: true,
      },
      {
        key: "completion_status",
        header: "Completion Status",
        accessor: (row) => row.completion_status || "-",
        align: "text-left",
        className: "whitespace-nowrap",
      },
      {
        key: "completion_date",
        header: "Completion Date",
        accessor: (row) => formatDate(row.completion_date),
        align: "text-center",
        className: "whitespace-nowrap",
      },
    ],
    [formatDate],
  );

  const groupedByDepartment = useMemo(() => {
    const groups = {};

    rows.forEach((row) => {
      const dept = row.department || "Unknown";
      const ps = row.audit_period_start ?? row.period_start;
      const pe = row.audit_period_end ?? row.period_end;
      const periodKey = `${ps || "no-start"}_${pe || "no-end"}`;

      if (!groups[dept]) {
        groups[dept] = {
          department: dept,
          periods: {},
          total: 0,
        };
      }

      if (!groups[dept].periods[periodKey]) {
        groups[dept].periods[periodKey] = {
          audit_period_start: ps,
          audit_period_end: pe,
          audit_fieldwork_start: row.audit_fieldwork_start ?? row.fieldwork_start ?? ps,
          audit_fieldwork_end: row.audit_fieldwork_end ?? row.fieldwork_end,
          exceeds_audit_period: row.exceeds_audit_period,
          period_start: ps,
          period_end: pe,
          data: [],
        };
      }

      groups[dept].periods[periodKey].data.push(row);
      groups[dept].total += 1;
    });

    return groups;
  }, [rows]);

  const departmentEntries = useMemo(
    () => Object.entries(groupedByDepartment),
    [groupedByDepartment],
  );

  const selectedPeriodGroup = useMemo(() => {
    if (!selectedGroup) return null;
    const { deptName, periodKey } = selectedGroup;
    const deptGroup = groupedByDepartment[deptName];
    if (!deptGroup) return null;
    const periodGroup = deptGroup?.periods?.[periodKey];
    if (!periodGroup) return null;
    return { deptName, deptGroup, periodGroup, periodKey };
  }, [groupedByDepartment, selectedGroup]);

  const modalTableRows = useMemo(() => {
    const selectedRows = selectedPeriodGroup?.periodGroup?.data || [];
    return selectedRows.map((row, idx) => (
      <tr
        key={`${row.department}-${row.id || idx}`}
        className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}
      >
        {reportColumns.map((column) => (
          <td
            key={column.key}
            className={`px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 align-top ${column.align || "text-left"} ${column.className || ""}`}
            style={
              column.wrap
                ? { overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }
                : undefined
            }
            title={column.wrap ? column.accessor(row) : undefined}
          >
            {column.accessor(row)}
          </td>
        ))}
      </tr>
    ));
  }, [selectedPeriodGroup, reportColumns]);

  const openModal = (deptName, periodKey) => {
    setSelectedGroup({ deptName, periodKey });
  };

  const closeModal = () => {
    setSelectedGroup(null);
  };

  const startEditDept = (deptName) => {
    if (!canEdit) return;
    setEditingDeptName(deptName);
  };

  const stopEditDept = () => {
    setEditingDeptName(null);
    setAddFormOpen(false);
  };

  const openAddForm = (deptName, periodKey) => {
    if (!canEdit) return;
    const deptGroup = groupedByDepartment[deptName];
    const periodKeys = Object.keys(deptGroup?.periods || {});
    const targetPeriodKey = periodKey || periodKeys[0] || null;
    if (!targetPeriodKey) {
      toast.show("No audit period available for this department.", "error");
      return;
    }
    setEditingDeptName(deptName);
    setAddFormDept(deptName);
    setAddFormPeriodKey(targetPeriodKey);
    setAddForm({ ...EMPTY_ADD_FORM, completionDate: todayYmd() });
    setAddFormOpen(true);
  };

  const closeAddForm = () => {
    setAddFormOpen(false);
    setAddFormDept(null);
    setAddFormPeriodKey(null);
    setAddForm(EMPTY_ADD_FORM);
  };

  const handleAddFormChange = (field, value) => {
    setAddForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveNewFinding = async () => {
    if (!canEdit || !addFormDept || !addFormPeriodKey) return;
    const apiPath = DEPT_NAME_TO_API[addFormDept];
    if (!apiPath) {
      toast.show("Unknown department.", "error");
      return;
    }
    const periodGroup = groupedByDepartment[addFormDept]?.periods?.[addFormPeriodKey];
    if (!periodGroup) {
      toast.show("Audit period not found.", "error");
      return;
    }
    if (!String(addForm.riskId || "").trim() && !String(addForm.findingDescription || "").trim()) {
      toast.show("Fill at least Risk ID or Finding Description.", "error");
      return;
    }

    try {
      setSaving(true);
      const yearQ =
        selectedYear != null && !Number.isNaN(selectedYear)
          ? `?year=${encodeURIComponent(String(selectedYear))}`
          : "";
      const periodStart = toYmd(periodGroup.audit_period_start ?? periodGroup.period_start);
      const periodEnd = toYmd(periodGroup.audit_period_end ?? periodGroup.period_end);
      const fieldworkStart = toYmd(
        periodGroup.audit_fieldwork_start ?? periodGroup.period_start ?? periodStart,
      );
      const fieldworkEnd = toYmd(periodGroup.audit_fieldwork_end ?? periodGroup.period_end);

      const res = await fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}${yearQ}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromReport: true,
          riskId: addForm.riskId,
          riskDescription: addForm.riskDescription,
          riskDetails: addForm.riskDetails,
          owners: addForm.owners,
          apCode: addForm.apCode,
          substantiveTest: addForm.substantiveTest,
          objective: addForm.objective,
          procedures: addForm.procedures,
          method: addForm.method,
          description: addForm.description,
          application: addForm.application,
          risk: addForm.risk,
          checkYN: addForm.checkYN,
          preparer: addForm.preparer,
          findingResult: addForm.findingResult,
          findingDescription: addForm.findingDescription,
          recommendation: addForm.recommendation,
          auditee: addForm.auditee,
          completionStatus: "COMPLETED",
          completionDate: addForm.completionDate || todayYmd(),
          reportAuditPeriodStart: periodStart || null,
          reportAuditPeriodEnd: periodEnd || null,
          reportAuditFieldworkStart: fieldworkStart || null,
          reportAuditFieldworkEnd: fieldworkEnd || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to add finding");
      }

      const created = json?.data || {};
      const optimisticRow = {
        ...created,
        id: created.id,
        department: addFormDept,
        risk_id: created.risk_id ?? addForm.riskId,
        risk_description: created.risk_description ?? addForm.riskDescription,
        risk_details: created.risk_details ?? addForm.riskDetails,
        owners: created.owners ?? addForm.owners,
        ap_code: created.ap_code ?? addForm.apCode,
        substantive_test: created.substantive_test ?? addForm.substantiveTest,
        objective: created.objective ?? addForm.objective,
        procedures: created.procedures ?? addForm.procedures,
        method: created.method ?? addForm.method,
        description: created.description ?? addForm.description,
        application: created.application ?? addForm.application,
        risk: created.risk ?? (addForm.risk === "" ? null : Number(addForm.risk)),
        check_yn: created.check_yn ?? addForm.checkYN,
        preparer: created.preparer ?? addForm.preparer,
        finding_result: created.finding_result ?? addForm.findingResult,
        finding_description: created.finding_description ?? addForm.findingDescription,
        recommendation: created.recommendation ?? addForm.recommendation,
        auditee: created.auditee ?? addForm.auditee,
        completion_status: "COMPLETED",
        completion_date: created.completion_date ?? (addForm.completionDate || todayYmd()),
        audit_period_start: periodStart || null,
        audit_period_end: periodEnd || null,
        period_start: periodStart || null,
        period_end: periodEnd || null,
        audit_fieldwork_start: fieldworkStart || null,
        audit_fieldwork_end: fieldworkEnd || null,
        fieldwork_start: fieldworkStart || null,
        fieldwork_end: fieldworkEnd || null,
        exceeds_audit_period: periodGroup.exceeds_audit_period,
      };

      setRows((prev) => [...prev, optimisticRow]);
      setSelectedGroup({ deptName: addFormDept, periodKey: addFormPeriodKey });
      closeAddForm();
      toast.show("Finding added to report.", "success");
      router.refresh();
    } catch (err) {
      toast.show(err?.message || "Failed to add finding", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "/Page/audit-finding";
  }, []);

  const exportRowsToExcel = (exportRows, filenameSuffix = "All", periodStart = null, periodEnd = null) => {
    const headers = reportColumns.map((column) => column.header);
    const excelRows = exportRows.map((row) =>
      reportColumns.reduce((acc, column) => {
        acc[column.header] = column.accessor(row);
        return acc;
      }, {}),
    );
    exportToStyledExcel(
      excelRows,
      headers,
      "Published",
      `Audit Finding - ${filenameSuffix}`,
      new Date(),
      periodStart,
      periodEnd,
    );
  };

  const exportRowsToPdf = (exportRows, title = "Audit Finding Report") => {
    if (!exportRows || exportRows.length === 0) return;
    const popup = window.open("", "_blank", "width=1200,height=800");
    if (!popup) return;

    const style = `
      <style>
        body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 16px; }
        h1 { font-size: 18px; margin-bottom: 12px; }
        table { border-collapse: collapse; width: 100%; font-size: 10px; }
        th, td { border: 1px solid #ddd; padding: 4px 6px; vertical-align: top; }
        th { background: #f3f4f6; }
      </style>
    `;
    const headerHtml = `
      <tr>
        ${reportColumns.map((column) => `<th>${column.header}</th>`).join("")}
      </tr>
    `;
    const bodyHtml = exportRows
      .map(
        (row) => `
          <tr>
            ${reportColumns.map((column) => `<td>${column.accessor(row)}</td>`).join("")}
          </tr>
        `,
      )
      .join("");

    popup.document.write(`
      <html>
        <head>
          <title>${title}</title>
          ${style}
        </head>
        <body>
          <h1>${title}</h1>
          <table>
            <thead>${headerHtml}</thead>
            <tbody>${bodyHtml}</tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  const addFormFields = [
    { key: "riskId", label: "Risk ID" },
    { key: "apCode", label: "AP Code" },
    { key: "risk", label: "Risk", type: "number" },
    { key: "checkYN", label: "Check (Y/N)" },
    { key: "preparer", label: "Preparer" },
    { key: "auditee", label: "Auditee" },
    { key: "owners", label: "Owner" },
    { key: "completionDate", label: "Completion Date", type: "date" },
    { key: "riskDescription", label: "Risk Description", wide: true },
    { key: "riskDetails", label: "Risk Details", wide: true, textarea: true },
    { key: "substantiveTest", label: "Substantive Test", wide: true, textarea: true },
    { key: "objective", label: "Objective", wide: true, textarea: true },
    { key: "procedures", label: "Procedures", wide: true, textarea: true },
    { key: "method", label: "Method", wide: true },
    { key: "description", label: "Description", wide: true, textarea: true },
    { key: "application", label: "Application", wide: true, textarea: true },
    { key: "findingResult", label: "Finding Result", wide: true },
    { key: "findingDescription", label: "Finding Description", wide: true, textarea: true },
    { key: "recommendation", label: "Recommendation", wide: true, textarea: true },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-full mx-auto">
        <div className="mb-4">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-semibold">Back</span>
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AUDIT FINDING REPORT</h1>
              <p className="text-gray-600 mt-1">
                Published findings with audit period and fieldwork columns. Dates come from the snapshot saved at publish,
                or from schedule history (each time you save Audit Finding dates in Schedule). The current schedule alone
                is not used for old rows — so changing dates later does not rewrite past publishes.
                {selectedYear != null && !Number.isNaN(selectedYear) ? (
                  <span className="font-medium text-gray-800"> Year: {selectedYear}.</span>
                ) : null}
              </p>
              {canEdit ? (
                <p className="text-xs text-slate-500 mt-2">
                  Reviewer / Super Admin: use <span className="font-semibold">Edit</span> on a department to add findings
                  directly to this report.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {Object.keys(groupedByDepartment).length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
            <div className="flex flex-col items-center justify-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-lg font-semibold text-gray-600">No Data</p>
              <p className="text-sm text-gray-400 mt-1">No audit finding data available</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {departmentEntries.map(([deptName, group]) => {
              const periodEntries = Object.entries(group.periods);
              const isEditing = canEdit && editingDeptName === deptName;
              return (
                <div key={deptName} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">Department: {deptName}</h3>
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full border border-emerald-200">
                            {group.total} findings
                          </span>
                          {isEditing ? (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full border border-amber-200">
                              Editing
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-gray-600">
                          Published findings for <span className="font-semibold">{deptName}</span>, grouped by the audit
                          period snapshot. Open a group to see the table (period/fieldwork columns are in the grid, not
                          repeated here).
                        </p>
                      </div>
                      {canEdit ? (
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openAddForm(deptName, selectedGroup?.deptName === deptName ? selectedGroup.periodKey : null)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                              >
                                + Add new data
                              </button>
                              <button
                                type="button"
                                onClick={stopEditDept}
                                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Done
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditDept(deptName)}
                              className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-2">
                    {periodEntries.map(([periodKey, period]) => {
                      const ps = period.audit_period_start ?? period.period_start;
                      const pe = period.audit_period_end ?? period.period_end;
                      const rangeLabel =
                        ps && pe ? `${formatDate(ps)} – ${formatDate(pe)}` : "Period (see table)";
                      return (
                        <div key={periodKey} className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => openModal(deptName, periodKey)}
                            className="flex flex-col items-start gap-0.5 px-3 py-1.5 bg-white hover:bg-blue-50 text-xs text-gray-800 rounded-lg border border-gray-200 shadow-sm transition-colors text-left"
                          >
                            <span className="font-semibold text-blue-700">
                              View {period.data.length} finding(s)
                            </span>
                            <span className="text-[10px] text-gray-500">{rangeLabel}</span>
                          </button>
                          {isEditing ? (
                            <button
                              type="button"
                              onClick={() => openAddForm(deptName, periodKey)}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              + Add to period
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedPeriodGroup && (() => {
          const { deptName, periodGroup, periodKey } = selectedPeriodGroup;
          const isEditingSelected = canEdit && editingDeptName === deptName;
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-sm"
              onClick={closeModal}
            >
              <div
                className="bg-white/95 rounded-2xl shadow-2xl max-w-[95vw] max-h-[90vh] w-full overflow-hidden flex flex-col border border-slate-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 p-4 flex items-center justify-between shadow-md gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-white">Audit Finding Details</h2>
                    <p className="text-sm text-blue-100 mt-1 truncate">{deptName}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {canEdit ? (
                      isEditingSelected ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddForm(deptName, periodKey);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-blue-700 shadow-sm hover:bg-blue-50"
                        >
                          + Add new data
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditDept(deptName);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/15 text-white border border-white/30 hover:bg-white/25"
                        >
                          Edit
                        </button>
                      )
                    ) : null}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        exportRowsToExcel(
                          periodGroup.data,
                          `${deptName}`,
                          periodGroup.audit_period_start ?? periodGroup.period_start,
                          periodGroup.audit_period_end ?? periodGroup.period_end,
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-400/90 hover:bg-emerald-300 text-white shadow-sm"
                    >
                      Export Excel
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        exportRowsToPdf(periodGroup.data, `Audit Finding Report - ${deptName}`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-400/90 hover:bg-red-300 text-white shadow-sm"
                    >
                      Export PDF
                    </button>
                    <button
                      onClick={closeModal}
                      className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white/10 rounded-lg"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4 bg-slate-50">
                  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                    <table className="min-w-[2200px] w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-100">
                          {reportColumns.map((column) => (
                            <th
                              key={column.key}
                              className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200"
                            >
                              {column.header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>{modalTableRows}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {addFormOpen && addFormDept && addFormPeriodKey && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm"
            onClick={closeAddForm}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900">Add new finding</h3>
                <p className="text-sm text-slate-600 mt-1">
                  {addFormDept}
                  {" · "}
                  {(() => {
                    const period = groupedByDepartment[addFormDept]?.periods?.[addFormPeriodKey];
                    const ps = period?.audit_period_start ?? period?.period_start;
                    const pe = period?.audit_period_end ?? period?.period_end;
                    return ps && pe ? `${formatDate(ps)} – ${formatDate(pe)}` : "Selected period";
                  })()}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {addFormFields.map((field) => (
                    <label
                      key={field.key}
                      className={`block text-xs font-semibold text-slate-700 ${field.wide ? "sm:col-span-2" : ""}`}
                    >
                      {field.label}
                      {field.textarea ? (
                        <textarea
                          rows={3}
                          value={addForm[field.key] || ""}
                          onChange={(e) => handleAddFormChange(field.key, e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <input
                          type={field.type || "text"}
                          value={addForm[field.key] || ""}
                          onChange={(e) => handleAddFormChange(field.key, e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div className="px-5 py-4 border-t border-slate-200 bg-white flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeAddForm}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveNewFinding}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save to report"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
