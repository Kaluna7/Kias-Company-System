"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";

const REPORT_DEPARTMENTS = [
  { key: "finance", label: "FINANCE", apiPath: "finance" },
  { key: "accounting", label: "ACCOUNTING", apiPath: "accounting" },
  { key: "hrd", label: "HRD", apiPath: "hrd" },
  { key: "ga", label: "GENERAL & AFFAIR", apiPath: "g&a" },
  { key: "sdp", label: "STORE DESIGN & PLANNER", apiPath: "sdp" },
  { key: "tax", label: "TAX", apiPath: "tax" },
  { key: "lp", label: "SECURITY", apiPath: "l&p" },
  { key: "mis", label: "MANAGEMENT INFORMATION SYS.", apiPath: "mis" },
  { key: "merch", label: "MERCHANDISE", apiPath: "merch" },
  { key: "ops", label: "OPERATIONAL", apiPath: "ops" },
  { key: "whs", label: "WAREHOUSE", apiPath: "whs" },
];

// Konfigurasi untuk \"Department completion date\".
// - monthIndex: bulan audit (1 = Jan, 2 = Feb, ...), dipakai untuk hitung tanggal selesai
//   berdasarkan tahun audit (year) dan akhir bulan tsb.
// - Urutan array menentukan urutan tampil; PAGE akan dihitung dinamis
//   dari halaman pertama modul department (misalnya 8).
const REPORT_DEPARTMENT_COMPLETION_ROWS = [
  { deptKey: "finance", name: "FINANCE", monthIndex: 1 },
  { deptKey: "hrd", name: "HUMAN RESOURCES", monthIndex: 2 },
  { deptKey: "ops", name: "OPERATIONAL", monthIndex: 4 },
  { deptKey: "merch", name: "MERCHANDISE", monthIndex: 5 },
  { deptKey: "whs", name: "WAREHOUSE", monthIndex: 7 },
  { deptKey: "lp", name: "SECURITY", monthIndex: 8 },
  { deptKey: "accounting", name: "ACCOUNTING", monthIndex: 8 },
  { deptKey: "mis", name: "MANAGEMENT INFORMATION SYS.", monthIndex: 11 },
  { deptKey: "ga", name: "GENERAL & AFFAIR", monthIndex: 11 },
];

const DEFAULT_APPENDICES = [
  {
    id: "appendix-a",
    type: "text",
    title: "Appendix A - Audit Timelines",
    content: "",
  },
  {
    id: "appendix-b",
    type: "text",
    title: "Appendix B - Samples Selection Methodology",
    content:
      "Overview of Sampling Methods:\n[Description of the random and judgmental sampling methods used.]\n\nPopulation Description:\n[Details of the total population from which samples were drawn (e.g., number of transactions, documents).]\n\nSample Size Calculation:\n[Explanation of how the sample size was determined, including confidence levels and margins of error.]\n\nSelection Criteria:\n[Specific criteria used for judgmental sampling, including definitions of high-risk areas.]",
  },
  {
    id: "appendix-c",
    type: "table",
    title: "Appendix C - Risk Assessments",
    content: "Risk Matrix",
    tableRows: Array.from({ length: 12 }, () => ({
      department: "",
      apNo: "",
      riskFactor: "",
      riskIndicator: "",
      riskLevel: "",
    })),
  },
];

export default function ReportPreviewPage() {
  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const [auditCoverage, setAuditCoverage] = useState(
    "FINANCIAL PROCESSES AND COMPLIANCE",
  );
  const [departmentCoverage, setDepartmentCoverage] = useState("ALL DEPARTMENT");
  const [area, setArea] = useState("BALI, JAKARTA, MEDAN AND BATAM");

  const [findingSections, setFindingSections] = useState([]);
  const [loadingFindings, setLoadingFindings] = useState(false);
  /** Chunk berdasarkan ukuran riil (ukur setelah render), seperti Word: isi halaman sampai penuh lalu next page. */
  const [measuredChunks, setMeasuredChunks] = useState(null);
  const measureContainerRef = useRef(null);
  /** Hanya untuk Conclusion: nilai textarea per department. */
  const [conclusionValues, setConclusionValues] = useState({});
  /** Hanya untuk Conclusion: chunk per halaman (dari pengukuran); null = pakai fallback. */
  const [conclusionChunks, setConclusionChunks] = useState(null);
  const conclusionMeasureRef = useRef(null);
  /** true = tampilkan form isi conclusion + Save; false = tampilkan Add Conclusion atau halaman hasil. */
  const [showConclusionForm, setShowConclusionForm] = useState(false);
  /** Finding & Recommendation: per department, array indeks finding yang dipilih (checkbox = multi). */
  const [selectedFindingByDept, setSelectedFindingByDept] = useState({});
  /** Modal pilih finding: deptKey yang dibuka (null = tertutup). */
  const [findingModalDeptKey, setFindingModalDeptKey] = useState(null);
  /** Checkbox di modal: array indeks yang dicentang. */
  const [modalCheckedIndices, setModalCheckedIndices] = useState([]);
  /** Audit team: nama + role, bisa diubah via popup.
   *  Default-nya kosong; baru muncul setelah user klik + Add Member.
   */
  const [auditTeam, setAuditTeam] = useState([]);
  const [isAuditTeamModalOpen, setIsAuditTeamModalOpen] = useState(false);
  const [newAuditName, setNewAuditName] = useState("");
  const [newAuditRole, setNewAuditRole] = useState("MEMBER");
  const [preparedBy, setPreparedBy] = useState([]);
  const [isPreparedByModalOpen, setIsPreparedByModalOpen] = useState(false);
  const [newPreparedName, setNewPreparedName] = useState("");
  const [newPreparedRole, setNewPreparedRole] = useState("MEMBER");
  const [newPreparedDate, setNewPreparedDate] = useState("");
  const [auditCommitteeName, setAuditCommitteeName] = useState("GN HIANG LIN");
  const [auditCommitteeDate, setAuditCommitteeDate] = useState("");
  const [presidentDirectorName, setPresidentDirectorName] = useState(
    "IR. WONG BUDI SETIAWAN",
  );
  const [presidentDirectorDate, setPresidentDirectorDate] = useState("");

  const formattedAuditCommitteeDate = auditCommitteeDate
    ? new Date(auditCommitteeDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const formattedPresidentDirectorDate = presidentDirectorDate
    ? new Date(presidentDirectorDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const [isExecutiveSummaryModalOpen, setIsExecutiveSummaryModalOpen] = useState(false);
  const [appendices, setAppendices] = useState(DEFAULT_APPENDICES);
  const [showAppendixEditor, setShowAppendixEditor] = useState(false);
  const [executiveSummaryHtml, setExecutiveSummaryHtml] = useState(() => {
    return `
      <p><strong>1.&nbsp;&nbsp;Executive Summary</strong></p>
      <p>
        This executive summary provides a high-level overview of the internal audit performed for the fiscal year ending ${year}. The objective of the audit was to evaluate the effectiveness of key internal controls, risk management practices, and compliance with applicable policies and regulations across the organization.
      </p>
      <p><strong>1.1&nbsp;&nbsp;Introduction</strong></p>
      <p>
        The purpose of this internal audit report is to present an independent assessment of the organization's internal control environment and its alignment with strategic objectives. The audit focused on identifying control gaps, areas of non-compliance, and opportunities to enhance process efficiency and governance.
      </p>
      <p>
        Our work was conducted in accordance with generally accepted internal auditing standards and the company's internal audit charter. The scope and approach were designed to provide reasonable assurance over key financial and operational processes.
      </p>
      <p><strong>1.2&nbsp;&nbsp;Scope of the Audit</strong></p>
      <p>
        The audit covered activities and processes across the following departments:
      </p>
      <ul>
        <li><strong>Finance:</strong> Cash management, budgeting, treasury, and financial reporting.</li>
        <li><strong>Accounting:</strong> General ledger, accounts payable, accounts receivable, and closing processes.</li>
        <li><strong>Human Resources (HRD):</strong> Recruitment, payroll, employee data management, and benefits administration.</li>
        <li><strong>General Affairs:</strong> Facility management and administration of general services.</li>
        <li><strong>Operational:</strong> Store operations, stock management, and customer-facing processes.</li>
        <li><strong>Warehouse:</strong> Inventory management, inbound and outbound logistics, and stock accuracy.</li>
        <li><strong>Security (L&amp;P):</strong> Loss prevention, store security, and safeguarding of company assets.</li>
        <li><strong>Merchandise:</strong> Vendor management, pricing, and assortment planning.</li>
        <li><strong>MIS:</strong> IT governance, application controls, user access management, and system support.</li>
        <li><strong>Tax:</strong> Compliance with tax regulations and timely submission of tax returns.</li>
      </ul>
      <p><strong>1.3&nbsp;&nbsp;Key Findings</strong></p>
      <p>
        Overall, the audit identified a combination of strengths and weaknesses across the audited areas. While several controls are operating effectively, there are also gaps that may expose the organization to operational, financial, and compliance risks.
      </p>
      <p><strong>1.4&nbsp;&nbsp;Conclusion</strong></p>
      <p>&nbsp;</p>
      <p><strong>1.5&nbsp;&nbsp;Summary of Key Recommendations</strong></p>
      <p>&nbsp;</p>
    `;
  });
  const executiveSummaryEditorRef = useRef(null);
  const appendicesStorageKey = `report-preview-appendices-${year}`;

  function normalizeAppendix(item, idx) {
    const isRiskAssessment =
      String(item?.title || "").toLowerCase().includes("risk assessments") ||
      item?.type === "table";

    if (isRiskAssessment) {
      return {
        id: item?.id || `appendix-${idx + 1}`,
        type: "table",
        title: item?.title || "Appendix C - Risk Assessments",
        content: item?.content || "Risk Matrix",
        tableRows:
          Array.isArray(item?.tableRows) && item.tableRows.length > 0
            ? item.tableRows.map((row) => ({
                department: row?.department || "",
                apNo: row?.apNo || "",
                riskFactor: row?.riskFactor || "",
                riskIndicator: row?.riskIndicator || "",
                riskLevel: row?.riskLevel || "",
              }))
            : Array.from({ length: 12 }, () => ({
                department: "",
                apNo: "",
                riskFactor: "",
                riskIndicator: "",
                riskLevel: "",
              })),
      };
    }

    return {
      id: item?.id || `appendix-${idx + 1}`,
      type: "text",
      title: item?.title || `Appendix ${idx + 1}`,
      content: item?.content || "",
    };
  }

  function mergeWithDefaultAppendices(savedItems) {
    const normalizedDefaults = DEFAULT_APPENDICES.map((item, idx) => normalizeAppendix(item, idx));
    const normalizedSaved = Array.isArray(savedItems)
      ? savedItems.map((item, idx) => normalizeAppendix(item, idx))
      : [];

    const savedById = new Map(normalizedSaved.map((item) => [item.id, item]));
    const defaultIds = new Set(normalizedDefaults.map((item) => item.id));

    const mergedDefaults = normalizedDefaults.map((defaultItem) => {
      const savedItem = savedById.get(defaultItem.id);
      if (!savedItem) return defaultItem;
      return {
        ...defaultItem,
        ...savedItem,
        tableRows:
          savedItem.type === "table"
            ? savedItem.tableRows || defaultItem.tableRows
            : defaultItem.tableRows,
      };
    });

    const extraAppendices = normalizedSaved.filter((item) => !defaultIds.has(item.id));
    return [...mergedDefaults, ...extraAppendices];
  }

  function updateAppendixTableCell(appendixId, rowIdx, field, value) {
    setAppendices((prev) =>
      prev.map((item) =>
        item.id === appendixId
          ? {
              ...item,
              tableRows: (item.tableRows || []).map((row, index) =>
                index === rowIdx ? { ...row, [field]: value } : row,
              ),
            }
          : item,
      ),
    );
  }

  function addAppendixTableRow(appendixId) {
    setAppendices((prev) =>
      prev.map((item) =>
        item.id === appendixId
          ? {
              ...item,
              tableRows: [
                ...(item.tableRows || []),
                {
                  department: "",
                  apNo: "",
                  riskFactor: "",
                  riskIndicator: "",
                  riskLevel: "",
                },
              ],
            }
          : item,
      ),
    );
  }

  function removeAppendixTableRow(appendixId, rowIdx) {
    setAppendices((prev) =>
      prev.map((item) =>
        item.id === appendixId
          ? {
              ...item,
              tableRows: (item.tableRows || []).filter((_, index) => index !== rowIdx),
            }
          : item,
      ),
    );
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(appendicesStorageKey);
      if (!raw) {
        setAppendices(DEFAULT_APPENDICES);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setAppendices(mergeWithDefaultAppendices(parsed));
      } else {
        setAppendices(DEFAULT_APPENDICES);
      }
    } catch {
      setAppendices(DEFAULT_APPENDICES);
    }
  }, [appendicesStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(appendicesStorageKey, JSON.stringify(appendices));
    } catch {
      // ignore localStorage failures
    }
  }, [appendices, appendicesStorageKey]);

  useEffect(() => {
    if (!findingModalDeptKey) return;
    const current = selectedFindingByDept[findingModalDeptKey];
    setModalCheckedIndices(Array.isArray(current) && current.length > 0 ? [...current].sort((a, b) => a - b) : []);
  }, [findingModalDeptKey, selectedFindingByDept]);


  useEffect(() => {
    let cancelled = false;

    async function loadFindings() {
      try {
        setLoadingFindings(true);
        const sections = [];

        for (const dept of REPORT_DEPARTMENTS) {
          const params = new URLSearchParams();
          // Gunakan shape yang sama dengan halaman SOP Review Report: all=1 & year
          params.set("all", "1");
          if (year) params.set("year", String(year));

          // Load SOP Review published data (steps) dari report SOP (bukan draft)
          let sopRows = [];
          try {
            const sopRes = await fetch(
              `/api/SopReview/${dept.apiPath}/published?${params.toString()}`,
            );
            if (sopRes.ok) {
              const sopJson = await sopRes.json().catch(() => ({}));
              const publishes = Array.isArray(sopJson.publishes) ? sopJson.publishes : [];

              publishes.forEach((pub) => {
                (pub.rows || []).forEach((row, idx) => {
                  const sopRelated = (row.sop_related || "").toString().trim();
                  if (!sopRelated) return;
                  sopRows.push({
                    no: row.no ?? idx + 1,
                    sopRelated,
                    status: (row.status || "").toString().toUpperCase(),
                    reviewComment: (row.comment || "").toString(),
                  });
                });
              });

              console.log("[REPORT-PREVIEW] SOP publishes", {
                dept: dept.label,
                apiPath: dept.apiPath,
                year,
                publishesCount: publishes.length,
                sopRowsCount: sopRows.length,
              });
            }
          } catch {
            // ignore SOP errors for consolidated report
          }

          // Load Audit Review findings. If no saved review rows yet, fallback to
          // completed audit-finding rows so preview matches what is visible in Audit Review.
          let auditRows = [];
          try {
            const reviewRes = await fetch(
              `/api/audit-review/${dept.apiPath}/findings?year=${encodeURIComponent(String(year))}`,
            );
            if (reviewRes.ok) {
              const reviewJson = await reviewRes.json().catch(() => ({}));
              const rows = Array.isArray(reviewJson.rows) ? reviewJson.rows : [];
              auditRows = rows.map((r, idx) => ({
                no: r.no ?? idx + 1,
                riskId: r.riskId ?? r.risk_id ?? "",
                risk: r.risk ?? "",
                riskDetails: r.riskDetails ?? r.risk_details ?? "",
                effectIfNotMitigate: r.effectIfNotMitigate ?? r.impact_description ?? "",
                apCode: r.apNo ?? r.apCode ?? r.ap_code ?? "",
                substantiveTest: r.substantiveTest ?? r.substantive_test ?? "",
                riskLevel: r.riskLevel ?? r.risk ?? "",
                methodology: r.method ?? r.methodology ?? "",
                findingResult: r.findingResult ?? r.finding_result ?? "",
                findingDescription: r.findingDescription ?? r.finding_description ?? "",
                recommendation: r.recommendation ?? "",
                auditeeComment: r.preparerRespo ?? r.auditeeComment ?? r.auditee ?? "",
                followUpDetail: r.timeline ?? r.followUpDetail ?? "",
              }));
            }

            if (auditRows.length === 0) {
              const afRes = await fetch(
                `/api/audit-finding/${dept.apiPath}?include_completed=1`,
              );
              if (afRes.ok) {
                const afJson = await afRes.json().catch(() => ({}));
                const rows = Array.isArray(afJson.data) ? afJson.data : [];

                const fallbackRows = rows.filter((row) => {
                  if (!year) return true;

                  const rowDate = row.completion_date
                    ? new Date(row.completion_date)
                    : row.updated_at
                      ? new Date(row.updated_at)
                      : null;

                  if (!rowDate || Number.isNaN(rowDate.getTime())) return false;
                  return rowDate.getFullYear() === year;
                });

                auditRows = fallbackRows.map((r, idx) => ({
                  no: idx + 1,
                  riskId: r.risk_id ?? "",
                  risk: r.risk_description ?? "",
                  riskDetails: r.risk_details ?? "",
                  effectIfNotMitigate: r.impact_description ?? "",
                  apCode: r.ap_code ?? "",
                  substantiveTest: r.substantive_test ?? "",
                  riskLevel: r.risk ?? "",
                  methodology: r.method ?? "",
                  findingResult: r.finding_result ?? "",
                  findingDescription: r.finding_description ?? "",
                  recommendation: r.recommendation ?? "",
                  auditeeComment: r.auditee ?? "",
                  followUpDetail: "",
                }));
              }
            }

            console.log("[REPORT-PREVIEW] Audit review data", {
              dept: dept.label,
              apiPath: dept.apiPath,
              year,
              totalBackendRows: auditRows.length,
              mappedRows: auditRows.length,
            });
          } catch {
            // ignore audit-review errors for consolidated report
          }

          // Area Audit dari worksheet report (per dept)
          let areaAudit = dept.label;
          try {
            const wsRes = await fetch(
              `/api/worksheet/${dept.apiPath}${year ? `?year=${encodeURIComponent(String(year))}` : ""}`,
            );
            if (wsRes.ok) {
              const wsJson = await wsRes.json().catch(() => ({}));
              const wsRows = Array.isArray(wsJson.rows) ? wsJson.rows : [];
              const first = wsRows[0];
              if (first && (first.audit_area || first.auditArea)) {
                areaAudit = first.audit_area || first.auditArea;
              }
            }
          } catch {
            // fallback ke department label
          }

          if (sopRows.length > 0 || auditRows.length > 0) {
            sections.push({
              deptKey: dept.key,
              deptLabel: dept.label,
              areaAudit,
              sopRows,
              auditRows,
            });
          }
        }

        if (!cancelled) {
          setFindingSections(sections);
        }
      } finally {
        if (!cancelled) {
          setLoadingFindings(false);
        }
      }
    }

    loadFindings();

    return () => {
      cancelled = true;
    };
  }, [year]);

  // Tinggi area konten per halaman A4 (px), untuk pengukuran otomatis seperti Word.
  // Dibuat lebih konservatif agar baris terakhir tidak menyentuh footer; jika tinggi konten
  // melebihi batas ini, sisa baris otomatis pindah ke halaman berikutnya.
  const FINDING_CONTENT_HEIGHT_PX = 670;

  /**
   * Ukur tinggi riil tabel dan bagi chunk agar tiap halaman terisi penuh (seperti Word).
   * Dipanggil setelah measurement block di-render.
   */
  useEffect(() => {
    if (!findingSections.length || !measureContainerRef.current) return;
    const container = measureContainerRef.current;
    const maxHeight = FINDING_CONTENT_HEIGHT_PX;
    let cancelled = false;
    const sopChunksByDept = {};
    const auditChunksByDept = {};

    const measureTableChunks = (tableEl, rows) => {
      if (!rows.length) return [];
      const tbody = tableEl?.querySelector("tbody");
      const trs = tbody?.querySelectorAll("tr");
      if (!trs?.length) return [rows];
      const heights = Array.from(trs).map((tr) => tr.getBoundingClientRect().height);
      const chunks = [];
      let chunk = [];
      let sum = 0;
      for (let i = 0; i < rows.length; i++) {
        const h = heights[i] ?? 40;
        if (sum + h > maxHeight && chunk.length > 0) {
          chunks.push(chunk);
          chunk = [];
          sum = 0;
        }
        chunk.push(rows[i]);
        sum += h;
      }
      if (chunk.length > 0) chunks.push(chunk);
      return chunks;
    };

    const runMeasure = () => {
      if (cancelled || !container.isConnected) return;
      findingSections.forEach((section) => {
        const sopTable = container.querySelector(`[data-measure-sop="${section.deptKey}"]`);
        if (sopTable && section.sopRows.length > 0) {
          sopChunksByDept[section.deptKey] = measureTableChunks(sopTable, section.sopRows);
        }
        const auditTable = container.querySelector(`[data-measure-audit="${section.deptKey}"]`);
        if (auditTable && section.auditRows.length > 0) {
          auditChunksByDept[section.deptKey] = measureTableChunks(auditTable, section.auditRows);
        }
      });
      if (!cancelled) setMeasuredChunks({ sop: sopChunksByDept, audit: auditChunksByDept });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(runMeasure);
    });
    return () => { cancelled = true; };
  }, [findingSections]);

  /** Hanya Conclusion: zona aman (px) di atas footer; isi halaman dulu baru next page. */
  const CONCLUSION_SAFE_ZONE_PX = 50;
  const CONCLUSION_PAGE_MAX_HEIGHT_PX = 780;
  const CONCLUSION_FIRST_PAGE_EXTRA_PX = 80;

  /**
   * Hanya Conclusion: ukur blok yang berisi data; chunk hanya department yang ada isinya.
   */
  useEffect(() => {
    if (!findingSections.length || !conclusionMeasureRef.current) return;
    const sectionsWithConclusion = findingSections.filter(
      (s) => (conclusionValues[s.deptKey] ?? "").trim().length > 0
    );
    if (sectionsWithConclusion.length === 0) {
      setConclusionChunks([]);
      return;
    }
    const container = conclusionMeasureRef.current;
    let cancelled = false;
    const runMeasure = () => {
      if (cancelled || !container.isConnected) return;
      const blocks = container.querySelectorAll("[data-conclusion-block]");
      if (!blocks.length || blocks.length !== sectionsWithConclusion.length) return;
      const heights = Array.from(blocks).map((el) => el.getBoundingClientRect().height);
      const chunks = [];
      let chunk = [];
      let sum = 0;
      const spacing = 24;
      const limitFirst = CONCLUSION_PAGE_MAX_HEIGHT_PX - CONCLUSION_FIRST_PAGE_EXTRA_PX;
      for (let i = 0; i < sectionsWithConclusion.length; i++) {
        const h = heights[i] ?? 80;
        const limit = chunks.length === 0 ? limitFirst : CONCLUSION_PAGE_MAX_HEIGHT_PX;
        if (sum + h + spacing > limit && chunk.length > 0) {
          chunks.push(chunk);
          chunk = [];
          sum = 0;
        }
        chunk.push(sectionsWithConclusion[i]);
        sum += h + spacing;
      }
      if (chunk.length > 0) chunks.push(chunk);
      if (!cancelled) setConclusionChunks(chunks);
    };
    requestAnimationFrame(() => requestAnimationFrame(runMeasure));
    const ro = new ResizeObserver(() => requestAnimationFrame(runMeasure));
    ro.observe(container);
    return () => { cancelled = true; ro.disconnect(); };
  }, [findingSections, conclusionValues]);

  const conclusionChunksLength = conclusionChunks?.length ?? 0;
  useEffect(() => {
    const run = () => {
      document.querySelectorAll("[data-conclusion-textarea]").forEach((ta) => {
        ta.style.height = "auto";
        ta.style.height = `${Math.max(80, ta.scrollHeight)}px`;
      });
    };
    run();
    const t = setTimeout(run, 0);
    return () => clearTimeout(t);
  }, [conclusionValues, conclusionChunksLength]);

  /** Save conclusion: hanya department yang berisi data; hitung pagination (page 1 penuh dulu) lalu tutup form. */
  const handleSaveConclusion = () => {
    requestAnimationFrame(() => {
      const sectionsWithConclusion = findingSections.filter(
        (s) => (conclusionValues[s.deptKey] ?? "").trim().length > 0
      );
      if (sectionsWithConclusion.length === 0) {
        setConclusionChunks([]);
        setShowConclusionForm(false);
        return;
      }
      const container = conclusionMeasureRef.current;
      if (!container?.isConnected) {
        setShowConclusionForm(false);
        return;
      }
      const blocks = container.querySelectorAll("[data-conclusion-block]");
      if (!blocks.length || blocks.length !== sectionsWithConclusion.length) {
        setConclusionChunks(sectionsWithConclusion.map((s) => [s]));
        setShowConclusionForm(false);
        return;
      }
      const heights = Array.from(blocks).map((el) => el.getBoundingClientRect().height);
      const chunks = [];
      let chunk = [];
      let sum = 0;
      const spacing = 24;
      const limitFirst = CONCLUSION_PAGE_MAX_HEIGHT_PX - CONCLUSION_FIRST_PAGE_EXTRA_PX;
      for (let i = 0; i < sectionsWithConclusion.length; i++) {
        const h = heights[i] ?? 80;
        const limit = chunks.length === 0 ? limitFirst : CONCLUSION_PAGE_MAX_HEIGHT_PX;
        if (sum + h + spacing > limit && chunk.length > 0) {
          chunks.push(chunk);
          chunk = [];
          sum = 0;
        }
        chunk.push(sectionsWithConclusion[i]);
        sum += h + spacing;
      }
      if (chunk.length > 0) chunks.push(chunk);
      setConclusionChunks(chunks);
      setShowConclusionForm(false);
    });
  };

  /**
   * Batas paginasi Findings: max baris per halaman + zona aman di atas footer.
   * Jika konten akan masuk zona aman (atau menyentuh footer), sisa data otomatis ke next page.
   * @param {Object} opts
   * @param {number} opts.maxRowsPerPage - Max data per halaman (default 15)
   * @param {number} opts.safeZoneRem - Jarak minimum konten dari footer, rem (default 15)
   */
  function getFindingPageLimits(opts = {}) {
    const maxRowsPerPage = opts.maxRowsPerPage ?? 15;
    const safeZoneRem = opts.safeZoneRem ?? 15;
    // Halaman A4 297mm; perkiraan: header+judul ~80px, footer ~40px, safe zone = 15rem.
    // Supaya tabel tidak terpotong: SOP saja max 15; Audit saja max 15; bila SOP+Audit satu halaman, SOP max 6.
    return {
      sopRowsPerPage: Math.min(maxRowsPerPage, 15),
      auditRowsPerPage: Math.min(maxRowsPerPage, 15),
      maxSopRowsWithAudit: 6, // bila SOP > 6 baris, Audit pindah next page agar tidak terpotong
      safeZoneRem,
    };
  }

  const {
    sopRowsPerPage: SOP_ROWS_PER_PAGE,
    auditRowsPerPage: AUDIT_ROWS_PER_PAGE,
    maxSopRowsWithAudit: MAX_SOP_ROWS_WITH_AUDIT,
    safeZoneRem: FINDING_SAFE_ZONE_REM,
  } = getFindingPageLimits({ maxRowsPerPage: 15, safeZoneRem: 6 });

  // Kapasitas halaman (unit): batas total "tinggi" per halaman. Baris panjang = unit besar.
  const SOP_PAGE_CAPACITY_UNITS = 18;
  const AUDIT_PAGE_CAPACITY_UNITS = 18;

  /** Weight untuk baris sangat panjang (teks > 300 char). */
  const WEIGHT_VERY_LONG = 4;

  /** Jika halaman sudah berisi baris sangat panjang, max baris di halaman itu (supaya tidak terpotong). */
  const MAX_ROWS_WHEN_PAGE_HAS_VERY_LONG = 6;

  /**
   * Perkiraan tinggi baris SOP berdasarkan panjang teks. Teks sangat panjang dapat muat di satu halaman
   * asal jumlah baris di halaman itu dibatasi (lihat chunkRowsByContent).
   */
  function getSopRowWeight(row) {
    const len = (row.sopRelated || "").length;
    if (len <= 100) return 1;
    if (len <= 220) return 2;
    if (len <= 300) return 3;
    return WEIGHT_VERY_LONG;
  }

  function getAuditRowWeight(row) {
    const len = (row.findingDescription || "").length + (row.riskDetails || "").length;
    if (len <= 80) return 1;
    if (len <= 200) return 2;
    if (len <= 300) return 3;
    return WEIGHT_VERY_LONG;
  }

  /**
   * Chunk baris per halaman: fit dan tidak terpotong.
   * - Total unit tidak boleh melebihi pageCapacityUnits.
   * - Max maxRowsPerPage baris; JIKA halaman sudah berisi baris sangat panjang (weight 4),
   *   max baris di halaman itu = MAX_ROWS_WHEN_PAGE_HAS_VERY_LONG agar baris panjang tidak terpotong
   *   dan tidak memakan banyak halaman kosong.
   */
  function chunkRowsByContent(rows, getWeight, maxRowsPerPage, pageCapacityUnits) {
    const chunks = [];
    let chunk = [];
    let totalUnits = 0;
    let hasVeryLongInChunk = false;
    for (const row of rows) {
      const w = getWeight(row);
      const isVeryLong = w >= WEIGHT_VERY_LONG;
      const wouldExceed = totalUnits + w > pageCapacityUnits;
      const atMaxRows = chunk.length >= maxRowsPerPage;
      const atMaxRowsWhenHasVeryLong = hasVeryLongInChunk && chunk.length >= MAX_ROWS_WHEN_PAGE_HAS_VERY_LONG;

      if ((wouldExceed || atMaxRows || atMaxRowsWhenHasVeryLong) && chunk.length > 0) {
        chunks.push(chunk);
        chunk = [];
        totalUnits = 0;
        hasVeryLongInChunk = false;
      }
      chunk.push(row);
      totalUnits += w;
      if (isVeryLong) hasVeryLongInChunk = true;
    }
    if (chunk.length > 0) chunks.push(chunk);
    return chunks;
  }

  // Map untuk nomor sub‑section 5.x per department (5.1 Finance, 5.2 Accounting, dst.)
  const deptIndexMap = {};
  findingSections.forEach((sec, i) => {
    deptIndexMap[sec.deptKey] = i + 1;
  });

  /**
   * Bagi data Findings & Recommendations per department menjadi beberapa halaman A4.
   * Max 15 baris per halaman; jika teks panjang sehingga konten akan menyentuh footer,
   * baris yang kelebihan (termasuk baris ke-15) dilanjutkan ke next page agar tidak terpotong.
   */
  const findingPages = (() => {
    const pages = [];
    findingSections.forEach((section) => {
      const sopChunks =
        measuredChunks?.sop?.[section.deptKey]?.length > 0
          ? measuredChunks.sop[section.deptKey]
          : chunkRowsByContent(
              section.sopRows,
              getSopRowWeight,
              SOP_ROWS_PER_PAGE,
              SOP_PAGE_CAPACITY_UNITS
            );
      const auditChunks =
        measuredChunks?.audit?.[section.deptKey]?.length > 0
          ? measuredChunks.audit[section.deptKey]
          : chunkRowsByContent(
              section.auditRows,
              getAuditRowWeight,
              AUDIT_ROWS_PER_PAGE,
              AUDIT_PAGE_CAPACITY_UNITS
            );

      if (sopChunks.length === 0 && auditChunks.length === 0) return;

      // Flag: header 5 / 5.x Department hanya di halaman pertama dept; judul SOP/Audit hanya di chunk pertama
      let isFirstPageForDept = true;
      let hasPushedSopChunk = false;
      let hasPushedAuditChunk = false;

      function markSopAndAuditFlags(sopRows, auditRows) {
        const isFirstSopChunk = sopRows.length > 0 && !hasPushedSopChunk;
        const isFirstAuditChunk = auditRows.length > 0 && !hasPushedAuditChunk;
        if (sopRows.length > 0) hasPushedSopChunk = true;
        if (auditRows.length > 0) hasPushedAuditChunk = true;
        return { isFirstSopChunk, isFirstAuditChunk };
      }

      // 1) Tampilkan semua halaman SOP Review terlebih dahulu.
      //    Pada chunk SOP TERAKHIR, jika masih ada data Audit dan jumlah baris SOP masih
      //    di bawah ambang batas (MAX_SOP_ROWS_WITH_AUDIT), maka chunk Audit pertama
      //    boleh ditempatkan DI BAWAH SOP di halaman yang sama. Kalau tidak, seluruh Audit
      //    pindah ke halaman berikutnya supaya tidak terpotong.
      if (sopChunks.length > 0) {
        sopChunks.forEach((chunk, index) => {
          const isLastSopChunk = index === sopChunks.length - 1;
          let auditRows = [];
          if (isLastSopChunk && auditChunks.length > 0 && chunk.length <= MAX_SOP_ROWS_WITH_AUDIT) {
            auditRows = auditChunks.shift() || [];
          }
          const { isFirstSopChunk, isFirstAuditChunk } = markSopAndAuditFlags(chunk, auditRows);

          pages.push({
            dept: section,
            sopRows: chunk,
            auditRows,
            isFirstPageForDept,
            isFirstSopChunk,
            isFirstAuditChunk,
          });
          isFirstPageForDept = false;
        });
      }

      // 2) Jika tidak ada SOP (hanya Audit), atau masih ada sisa Audit setelah SOP selesai,
      //    tampilkan sebagai halaman-halaman lanjut yang hanya berisi Audit Review.
      if (sopChunks.length === 0 && auditChunks.length > 0) {
        const firstAudit = auditChunks.shift() || [];
        const { isFirstSopChunk, isFirstAuditChunk } = markSopAndAuditFlags([], firstAudit);
        pages.push({
          dept: section,
          sopRows: [],
          auditRows: firstAudit,
          isFirstPageForDept,
          isFirstSopChunk,
          isFirstAuditChunk,
        });
        isFirstPageForDept = false;
      }

      auditChunks.forEach((chunk) => {
        const { isFirstSopChunk, isFirstAuditChunk } = markSopAndAuditFlags([], chunk);
        pages.push({
          dept: section,
          sopRows: [],
          auditRows: chunk,
          isFirstPageForDept,
          isFirstSopChunk,
          isFirstAuditChunk,
        });
        isFirstPageForDept = false;
      });
    });
    return pages;
  })();

  // Pemetaan range halaman Findings & Recommendations per department,
  // berdasarkan findingPages (PAGE di footer = 10 + index).
  const deptFindingPageRanges = (() => {
    const map = {};
    findingPages.forEach((page, index) => {
      const key = page.dept.deptKey;
      const pageNumber = 10 + index;
      if (!map[key]) {
        map[key] = { first: pageNumber, last: pageNumber };
      } else {
        map[key].last = pageNumber;
      }
    });
    return map;
  })();

  /**
   * Satu halaman per finding yang dipilih (checkbox multi). 1 select = 1 halaman, 2 select = 2 halaman.
   */
  const findingDetailPages = (() => {
    const list = [];
    findingSections.forEach((section) => {
      const indices = selectedFindingByDept[section.deptKey];
      if (!Array.isArray(indices) || indices.length === 0) return;
      indices.forEach((rowIndex, i) => {
        const finding = section.auditRows[rowIndex] ?? null;
        if (!finding) return;
        list.push({ section, finding, findingIndex: i + 1 });
      });
    });
    return list;
  })();

  /** Conclusion: pakai chunk dari Save (page 1 penuh dulu, sisanya next page); hanya ada setelah user klik Save. */
  const conclusionPages = (() => {
    if (!findingSections.length) return [];
    if (conclusionChunks && conclusionChunks.length > 0) return conclusionChunks;
    return [];
  })();

  const appendixPageBase =
    10 +
    findingPages.length +
    1 +
    findingDetailPages.length +
    (findingSections.length > 0 ? (conclusionPages.length > 0 ? conclusionPages.length : 1) : 0) +
    1;

  const handlePrint = () => {
    window.print();
  };

  const periodStart = `JANUARY ${year}`;
  const periodEnd = `DECEMBER ${year}`;
  // Tanggal issued mengikuti tanggal hari ini (format: Month DD, YYYY)
  const issuedDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-start p-4 print:bg-white print:p-0 gap-6">
      {/* Cover page - full A4: sama dengan cover.png (atas putih ~2/3, gelombang tengah, bawah biru gelap) */}
      <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden break-after-page relative">
        {/* 1. Atas: background putih, elemen geometris pojok kanan atas */}
        <div className="absolute top-0 right-0 h-[52%] w-[50%]">
          <img
            src="/images/upper_right.jpg"
            alt=""
            className="h-full w-full object-cover object-right object-top"
          />
        </div>
        {/* 2. Judul: kiri, sedikit di bawah sepertiga atas — INTERNAL / AUDIT (abu gelap), REPORT (biru-abu terang) */}
        <div className="absolute left-10 top-[28%] z-10">
          <div className="text-[3.5rem] font-bold text-gray-800 tracking-tight leading-tight">INTERNAL</div>
          <div className="text-[3.5rem] font-bold text-gray-800 tracking-tight leading-tight">AUDIT</div>
          <div className="text-[3.25rem] font-bold text-slate-400 tracking-tight leading-tight">REPORT</div>
        </div>
        {/* 3. Tengah: lapisan gelombang (turquoise + teal) dari middle.jpg */}
        <div className="absolute top-[50%] left-0 right-0 h-[20%]">
          <img
            src="/images/middle.jpg"
            alt=""
            className="w-full h-full object-cover object-center"
          />
        </div>
        {/* 4. Bawah: biru-abu gelap (bagian terbesar), tepi atas gelombang halus */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[30%] bg-[#2c3e50]"
          style={{
            // Satu gelombang lebar dengan kurva halus (bukan bergerigi)
            clipPath:
              "polygon(0% 40%, 10% 35%, 20% 32%, 30% 33%, 40% 37%, 50% 42%, 60% 47%, 70% 50%, 80% 48%, 90% 44%, 100% 40%, 100% 100%, 0% 100%)",
            WebkitClipPath:
              "polygon(0% 40%, 10% 35%, 20% 32%, 30% 33%, 40% 37%, 50% 42%, 60% 47%, 70% 50%, 80% 48%, 90% 44%, 100% 40%, 100% 100%, 0% 100%)",
          }}
        />
        {/* 5. Logo KIAS kiri bawah, tahun kanan bawah */}
        <div className="absolute bottom-0 left-0 right-0 h-[30%] flex items-end justify-between px-10 pb-10 z-10 pointer-events-none">
          <img
            src="/images/kias-logo.png"
            alt="KIAS - PT KPU Internal Audit System"
            className="h-32 w-auto object-contain pointer-events-auto"
          />
          <span className="text-white text-7xl font-bold tracking-wide">{year}</span>
        </div>
      </div>

      {/* Prepared by modal (hanya layar) */}
      {isPreparedByModalOpen && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-5">
            <h2 className="text-sm font-semibold mb-3">Add Prepared By Member</h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-semibold">Name</label>
                <input
                  type="text"
                  value={newPreparedName}
                  onChange={(e) => setNewPreparedName(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Role</label>
                <select
                  value={newPreparedRole}
                  onChange={(e) => setNewPreparedRole(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-xs"
                >
                  <option value="ENGAGEMENT LEAD">ENGAGEMENT LEAD</option>
                  <option value="TEAM LEAD">TEAM LEAD</option>
                  <option value="MEMBER">MEMBER</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 font-semibold">Date</label>
                <input
                  type="date"
                  value={newPreparedDate}
                  onChange={(e) => setNewPreparedDate(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-xs"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsPreparedByModalOpen(false)}
                className="px-3 py-1 rounded border"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = newPreparedName.trim();
                  const role = newPreparedRole.trim();
                  const date = newPreparedDate.trim();
                  if (!name || !role) return;
                  setPreparedBy((prev) => [...prev, { name, role, date }]);
                  setIsPreparedByModalOpen(false);
                }}
                className="px-3 py-1 rounded bg-blue-600 text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info page - full A4 */}
      <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col p-12 break-after-page">
        {/* Header logo dan nama perusahaan */}
        <div className="flex items-center justify-center gap-4 mb-20">
          <img
            src="/images/logo_KPU.png"
            alt="KPU Logo"
            className="w-20 h-20"
          />
          <div className="text-xl sm:text-2xl font-semibold text-gray-800 tracking-wide">
            PT Karya Prima Unggulan
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-10">
          <div className="text-2xl font-extrabold tracking-[0.25em] text-gray-900">
            INTERNAL AUDIT REPORT
          </div>
        </div>

        {/* Detail table - label lebar tetap agar tanda : sejajar vertikal */}
        <div className="max-w-[650px] mx-auto text-[11px] text-gray-900 space-y-3">
          {/* PERIOD */}
          <div className="flex flex-row items-center gap-3 flex-wrap">
            <div className="font-semibold tracking-wide w-[230px] shrink-0 whitespace-nowrap text-gray-700">
              PERIOD <span>:</span>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="px-3 py-1 bg-gray-100 rounded font-semibold inline-block min-w-[120px] text-center">
                {periodStart}
              </span>
              <span className="font-semibold">-</span>
              <span className="px-3 py-1 bg-gray-100 rounded font-semibold inline-block min-w-[120px] text-center">
                {periodEnd}
              </span>
            </div>
          </div>

          {/* AUDIT COVERAGE */}
          <div className="flex flex-row items-start gap-3 flex-wrap">
            <div className="font-semibold tracking-wide w-[230px] shrink-0 pt-1 whitespace-nowrap text-gray-700">
              AUDIT COVERAGE <span>:</span>
            </div>
            <textarea
              value={auditCoverage}
              onChange={(e) => setAuditCoverage(e.target.value)}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              rows={1}
              className="flex-1 min-w-[200px] font-semibold leading-snug bg-transparent border-none resize-none focus:outline-none p-0 overflow-hidden"
            />
          </div>

          {/* DEPARTMENT COVERAGE */}
          <div className="flex flex-row items-start gap-3 flex-wrap">
            <div className="font-semibold tracking-wide w-[230px] shrink-0 pt-1 whitespace-nowrap text-gray-700">
              DEPARTMENT COVERAGE <span>:</span>
            </div>
            <textarea
              value={departmentCoverage}
              onChange={(e) => setDepartmentCoverage(e.target.value)}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              rows={1}
              className="flex-1 min-w-[200px] font-semibold leading-snug bg-transparent border-none resize-none focus:outline-none p-0 overflow-hidden"
            />
          </div>

          {/* AREA */}
          <div className="flex flex-row items-start gap-3 flex-wrap">
            <div className="font-semibold tracking-wide w-[230px] shrink-0 pt-1 whitespace-nowrap text-gray-700">
              AREA <span>:</span>
            </div>
            <textarea
              value={area}
              onChange={(e) => setArea(e.target.value)}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              rows={1}
              className="flex-1 min-w-[200px] font-semibold leading-snug bg-transparent border-none resize-none focus:outline-none p-0 overflow-hidden"
            />
          </div>
        </div>

        {/* Spacer to push footer to bottom */}
        <div className="flex-1" />

        {/* Footer */}
        <div className="text-[10px] text-gray-700 text-center border-t border-gray-200 pt-4 mt-4">
          <span className="font-semibold">Head Office :</span>{" "}
          Menara Sudirman 20th Floor. Jl. Jend. Sudirman Kav.60, Jakarta 12190
          - Indonesia
        </div>
      </div>

      {/* Audit team, department completion date, and footer (satu halaman) */}
      <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-20 pt-24 pb-16 break-after-page">
        {/* Audit Team */}
        <div className="mb-20 text-[10px]">
          <div className="text-center font-bold tracking-wide mb-2">
            AUDIT TEAM <span>:</span>
          </div>
          {/* Tombol tambah di bawah judul; hanya tampil di layar, tidak tercetak */}
          <div className="flex justify-center mb-3 print:hidden">
            <button
              type="button"
              onClick={() => {
                setNewAuditName("");
                setNewAuditRole("MEMBER");
                setIsAuditTeamModalOpen(true);
              }}
              className="inline-flex items-center px-2 py-[2px] text-[10px] rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              + Add Member
            </button>
          </div>
          <div className="flex justify-center gap-12">
            {/* Kolom nama, dibuat rata tengah */}
            <div className="space-y-1 w-48 text-center">
              {auditTeam.map((member, idx) => (
                <div
                  key={`${member.name}-${member.role}-${idx}`}
                  className="px-2 py-[2px] bg-gray-100 font-semibold flex items-center justify-center gap-1"
                >
                  <span className="truncate flex-1">{member.name}</span>
                  {/* Tombol delete hanya tampil di layar, tidak tercetak */}
                  <button
                    type="button"
                    onClick={() =>
                      setAuditTeam((prev) =>
                        prev.filter((_, i) => i !== idx),
                      )
                    }
                    className="print:hidden ml-1 text-[7px] text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            {/* Kolom role, rata tengah */}
            <div className="space-y-1 w-48 text-center">
              {auditTeam.map((member, idx) => (
                <div
                  key={`${member.name}-${member.role}-role-${idx}`}
                  className="px-2 py-[2px] bg-gray-100 font-semibold"
                >
                  {member.role}
                </div>
              ))}
            </div>
          </div>

          {/* Popup add audit team member (hanya layar) */}
          {isAuditTeamModalOpen && (
            <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-5">
                <h2 className="text-sm font-semibold mb-4">Add Audit Team Member</h2>
                <div className="space-y-3 text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold">Name</label>
                    <input
                      type="text"
                      value={newAuditName}
                      onChange={(e) => setNewAuditName(e.target.value)}
                      className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Input name"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold">Role</label>
                    <select
                      value={newAuditRole}
                      onChange={(e) => setNewAuditRole(e.target.value)}
                      className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="ENGAGEMENT LEAD">ENGAGEMENT LEAD</option>
                      <option value="TEAM LEAD">TEAM LEAD</option>
                      <option value="MEMBER">MEMBER</option>
                    </select>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsAuditTeamModalOpen(false)}
                    className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const trimmedName = newAuditName.trim();
                      if (!trimmedName) return;
                      setAuditTeam((prev) => [...prev, { name: trimmedName, role: newAuditRole }]);
                      setIsAuditTeamModalOpen(false);
                      setNewAuditName("");
                      setNewAuditRole("MEMBER");
                    }}
                    className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Department completion date */}
        <div className="text-[10px]">
          <div className="text-center font-bold tracking-wide mb-2 text-[12px]">
            DEPARTMENT COMPLETION DATE <span>:</span>
          </div>
          <div className="flex justify-center">
            <div className="grid grid-cols-[170px_190px_70px] gap-y-1">
              <div className="font-bold">
                DEPARTMENT <span>:</span>
              </div>
              <div />
              <div className="font-bold text-right">PAGE</div>

              {REPORT_DEPARTMENT_COMPLETION_ROWS
                .filter((row) =>
                  findingSections.some((section) => section.deptKey === row.deptKey),
                )
                // Urutkan berdasarkan first page (PAGE) dari Findings & Recommendations,
                // bukan berdasarkan nama atau bulan.
                .sort((a, b) => {
                  const ra = deptFindingPageRanges[a.deptKey];
                  const rb = deptFindingPageRanges[b.deptKey];
                  const pa = ra?.first ?? Number.POSITIVE_INFINITY;
                  const pb = rb?.first ?? Number.POSITIVE_INFINITY;
                  return pa - pb;
                })
                .map((row) => {
                // Tanggal completion mengikuti tahun audit (year) dan akhir bulan
                // audit period start per department (monthIndex).
                const month = row.monthIndex ?? 1;
                const lastDayDate = new Date(year, month, 0);
                const completionDate = lastDayDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                });

                // PAGE mengikuti range halaman Findings & Recommendations untuk department tsb.
                const range = deptFindingPageRanges[row.deptKey];
                const pageRange =
                  range && range.first && range.last
                    ? `${range.first} - ${range.last}`
                    : "—";

                return (
                  <div key={row.deptKey} className="contents">
                    <div className="px-2 py-[2px] bg-gray-100">{row.name}</div>
                    <div className="px-2 py-[2px] bg-gray-100 font-semibold">
                      {completionDate}
                    </div>
                    <div className="px-2 py-[2px] bg-gray-100 text-right">
                      {pageRange}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Spacer to dorong footer ke bawah */}
        <div className="flex-1" />

        {/* Date of issued */}
        <div className="mb-10">
          <div className="flex items-center justify-center gap-2 text-[10px] font-semibold tracking-wide">
            <span>DATE OF ISSUED</span>
            <span>:</span>
            <span className="px-3 py-[2px] bg-gray-100 font-semibold">{issuedDate}</span>
          </div>
        </div>

        {/* Center logo (lebih kecil) */}
        <div className="flex items-center justify-center mb-6">
          <img
            src="/images/kias_black_logo.png"
            alt="KIAS Logo"
            className="w-24 h-auto object-contain"
          />
        </div>

        {/* Footer with support text, title, and page info */}
        <div className="w-full mt-auto">
          <div className="border-t border-gray-300 mb-2" />
          <div className="flex items-center text-[6px] text-gray-700">
            <div className="flex-1 text-left">
              SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
            </div>
            <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
            <div className="flex-1 text-right">
              PAGE <span className="mx-1">2</span> of <span className="ml-1">40</span>
            </div>
          </div>
        </div>
      </div>

      {/* Prepared by & management approval page (next page, tanpa logo tengah dan DATE OF ISSUED) */}
      <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-20 py-16 break-after-page">
        {/* Konten utama, header di bagian atas */}
        <div className="flex-1 flex flex-col">
          {/* Header logo dan nama perusahaan */}
          <div className="flex items-center justify-center gap-4 mb-16">
            <img
              src="/images/logo_KPU.png"
              alt="KPU Logo"
              className="w-16 h-16"
            />
            <div className="text-lg sm:text-2xl font-semibold text-gray-700 tracking-wide">
              PT Karya Prima Unggulan
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-36">
            <div className="text-2xl font-bold tracking-wide">
              INTERNAL AUDIT REPORT
            </div>
            <div className="text-lg font-bold tracking-wide mt-2">
              AUDIT PERIOD {year}
            </div>
          </div>

          {/* Prepared by */}
          <div className="mb-16 text-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold tracking-wide">PREPARED BY :</div>
              {/* Tombol tambah member - hanya tampil di layar, tidak tercetak */}
              <button
                type="button"
                onClick={() => {
                  setNewPreparedName("");
                  setNewPreparedRole("MEMBER");
                  setNewPreparedDate("");
                  setIsPreparedByModalOpen(true);
                }}
                className="print:hidden inline-flex items-center px-3 py-1 text-[10px] rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                + Add Member
              </button>
            </div>

            <div className="space-y-4">
              {preparedBy.map((p, idx) => (
                <div key={`${p.name}-${p.role}-${idx}`} className="flex items-end gap-4">
                  <div className="px-3 py-1 bg-gray-100 font-semibold min-w-[180px]">
                    {p.name}
                  </div>
                  <div className="px-3 py-1 bg-gray-100 font-semibold min-w-[180px]">
                    {p.role}
                  </div>
                  <div className="flex-1 border-b border-gray-400" />
                  <div className="text-[10px] font-semibold mr-1 pb-[2px]">DATE</div>
                  <div className="px-3 py-1 bg-gray-100 min-w-[90px] text-[10px] font-semibold text-center">
                    {p.date || ""}
                  </div>
                  {/* Tombol delete hanya di layar */}
                  <button
                    type="button"
                    onClick={() =>
                      setPreparedBy((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="print:hidden ml-1 text-[9px] text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Management approval */}
          <div className="text-[10px] mb-24">
            <div className="font-bold tracking-wide mb-6 text-center">MANAGEMENT APPROVAL,</div>
            <div className="flex items-start justify-center gap-24 text-center">
              <div className="flex flex-col items-center">
                <div className="flex items-baseline gap-3 mb-3">
                  <div className="whitespace-nowrap">AUDIT COMMITTEE,</div>
                  <div className="text-[10px]">
                    <input
                      type="date"
                      value={auditCommitteeDate}
                      onChange={(e) => setAuditCommitteeDate(e.target.value)}
                      className="print:hidden bg-transparent border border-gray-300 rounded px-1 py-[1px] text-[10px] align-middle leading-none"
                    />
                    <span className="hidden print:inline text-[10px] align-middle leading-none">
                      {formattedAuditCommitteeDate}
                    </span>
                  </div>
                </div>
                <div className="border-t border-gray-400 w-40 mt-4" />
                <div className="mt-1 text-[10px] font-semibold text-center">
                  <input
                    type="text"
                    value={auditCommitteeName}
                    onChange={(e) => setAuditCommitteeName(e.target.value)}
                    className="bg-transparent border-none p-0 m-0 w-full focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-baseline gap-3 mb-3">
                  <div className="whitespace-nowrap">PRESIDENT DIRECTOR,</div>
                  <div className="text-[10px]">
                    <input
                      type="date"
                      value={presidentDirectorDate}
                      onChange={(e) => setPresidentDirectorDate(e.target.value)}
                      className="print:hidden bg-transparent border border-gray-300 rounded px-1 py-[1px] text-[10px] align-middle leading-none"
                    />
                    <span className="hidden print:inline text-[10px] align-middle leading-none">
                      {formattedPresidentDirectorDate}
                    </span>
                  </div>
                </div>
                <div className="border-t border-gray-400 w-40 mt-4" />
                <div className="mt-1 text-[10px] font-semibold text-center">
                  <input
                    type="text"
                    value={presidentDirectorName}
                    onChange={(e) => setPresidentDirectorName(e.target.value)}
                    className="bg-transparent border-none p-0 m-0 w-full focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer (tanpa logo dan tanpa DATE OF ISSUED di halaman ini) */}
        <div className="w-full mt-auto">
          <div className="border-t border-gray-300 mb-2" />
          <div className="flex items-center text-[6px] text-gray-700">
            <div className="flex-1 text-left">
              SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
            </div>
            <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
            <div className="flex-1 text-right">
              PAGE <span className="mx-1">3</span> of <span className="ml-1">40</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table of Contents page */}
      <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-20 pt-20 pb-16 break-after-page">
        {/* Title */}
        <div className="text-center mb-16">
          <div className="text-2xl font-bold tracking-wide">Table of Contents</div>
        </div>

        {/* Header row for page column */}
        <div className="flex justify-end text-xs font-semibold mb-2">
          <span>Page</span>
        </div>

        {/* Contents list */}
        <div className="text-xs space-y-3">
          {[
            { title: "Executive Summary", page: "5 - 6" },
            { title: "Objective & Scope", page: "7" },
            { title: "Audit Approach & Methodology", page: "8" },
            // Dinamis: table of contents untuk Findings & Recommendations per department
            ...REPORT_DEPARTMENT_COMPLETION_ROWS
              .filter((row) =>
                findingSections.some((section) => section.deptKey === row.deptKey),
              )
              .sort((a, b) => {
                const ra = deptFindingPageRanges[a.deptKey];
                const rb = deptFindingPageRanges[b.deptKey];
                const pa = ra?.first ?? Number.POSITIVE_INFINITY;
                const pb = rb?.first ?? Number.POSITIVE_INFINITY;
                return pa - pb;
              })
              .map((row) => {
                const range = deptFindingPageRanges[row.deptKey];
                const page =
                  range && range.first && range.last
                    ? range.first === range.last
                      ? String(range.first)
                      : `${range.first} - ${range.last}`
                    : "—";
                const title = `Department ${
                  row.name === "SECURITY"
                    ? "Security (L&P)"
                    : row.name === "GENERAL & AFFAIR"
                    ? "General Affairs"
                    : row.name === "MANAGEMENT INFORMATION SYS."
                    ? "Management Information System (MIS)"
                    : row.name === "HRD"
                    ? "Human Resources Department"
                    : row.name.charAt(0) + row.name.slice(1).toLowerCase()
                } - Finding & Recommendation`;
                return { title, page };
              }),
          ].map((item) => (
            <div key={item.title} className="flex items-baseline gap-2 py-1">
              <div className="flex-1 flex items-center">
                <span className="font-semibold">{item.title}</span>
                <div className="flex-1 border-b border-dotted border-gray-400 mx-2" />
              </div>
              <div className="w-10 text-right font-semibold">{item.page}</div>
            </div>
          ))}
        </div>

        {/* Spacer to push footer to bottom */}
        <div className="flex-1" />

        {/* Footer (sama seperti halaman lain) */}
        <div className="w-full mt-auto">
          <div className="border-t border-gray-300 mb-2" />
          <div className="flex items-center text-[6px] text-gray-700">
            <div className="flex-1 text-left">
              SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
            </div>
            <div className="flex-1 text-center font-semibold">
              INTERNAL AUDIT REPORT
            </div>
            <div className="flex-1 text-right">
              PAGE <span className="mx-1">4</span> of <span className="ml-1">40</span>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary page */}
      <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] flex flex-col px-24 pt-20 pb-16 break-after-page">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Executive Summary</h1>
        </div>

        {/* Button to open Rich Text Editor (screen only) */}
        <div className="print:hidden mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setIsExecutiveSummaryModalOpen(true)}
            className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium"
          >
            Edit Executive Summary
          </button>
        </div>

        {/* Display content (read-only) */}
        <div
          className="text-[11px] leading-relaxed space-y-3"
          dangerouslySetInnerHTML={{ __html: executiveSummaryHtml }}
        />

        {/* Spacer & footer */}
        <div className="flex-1" />
        <div className="w-full mt-auto">
          <div className="border-t border-gray-300 mb-2" />
          <div className="flex items-center text-[6px] text-gray-700">
            <div className="flex-1 text-left">
              SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
            </div>
            <div className="flex-1 text-center font-semibold">
              INTERNAL AUDIT REPORT
            </div>
            <div className="flex-1 text-right">
              PAGE <span className="mx-1">5</span> of <span className="ml-1">40</span>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary Rich Text Editor Modal (Lexical-based wrapper) */}
      {isExecutiveSummaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 print:hidden">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">Edit Executive Summary</h2>
              <button
                type="button"
                onClick={() => setIsExecutiveSummaryModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Toolbar */}
            {/* Custom contentEditable editor (stabil dan ringan) */}
            <div className="flex-1 overflow-auto px-4 py-3 text-[11px] leading-relaxed">
              {/* Toolbar */}
              <div className="pb-2 flex flex-wrap gap-2 text-xs border-b border-gray-200 mb-2">
                {(() => {
                  const apply = (cmd) => {
                    if (!executiveSummaryEditorRef.current) return;
                    executiveSummaryEditorRef.current.focus();
                    document.execCommand(cmd);
                  };
                  return (
                    <>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          apply("bold");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100 font-semibold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          apply("italic");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100 italic"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          apply("underline");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100 underline"
                      >
                        U
                      </button>
                      <span className="h-5 w-px bg-gray-300 mx-1" />
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          apply("justifyLeft");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100"
                      >
                        L
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          apply("justifyCenter");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100"
                      >
                        C
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          apply("justifyRight");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100"
                      >
                        R
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          apply("justifyFull");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100"
                      >
                        J
                      </button>
                      <span className="h-5 w-px bg-gray-300 mx-1" />
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          apply("insertUnorderedList");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100"
                      >
                        •
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          apply("insertOrderedList");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100"
                      >
                        1.
                      </button>
                    </>
                  );
                })()}
              </div>

              {/* Editable area */}
              <div
                ref={executiveSummaryEditorRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-[220px] max-h-[360px] overflow-auto p-3 text-[11px] leading-relaxed outline-none border border-gray-200 rounded"
                onInput={(e) => setExecutiveSummaryHtml(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: executiveSummaryHtml }}
              />
            </div>

            <div className="px-4 py-3 border-t flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsExecutiveSummaryModalOpen(false)}
                className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Objectives & Scope page (page 7) */}
      <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-24 pt-24 pb-16 break-after-page">
        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold">Audit Objectives and Scope</h1>
        </div>

        <div className="text-[11px] leading-relaxed space-y-4">
          {/* 2. Audit Objectives and Scope */}
          <div>
            <p className="font-bold">2.&nbsp;&nbsp;Audit Objectives and Scope</p>
          </div>

          {/* 2.1 Objectives */}
          <div className="space-y-1.5">
            <p className="font-bold">2.1&nbsp;&nbsp;Objectives</p>
            <p>The overarching objectives of this audit were:</p>
            <ul className="list-disc ml-8 space-y-0.5">
              <li>To evaluate the adequacy and effectiveness of internal controls across multiple departments.</li>
              <li>To assess compliance with organizational policies, external regulations, and industry best practices.</li>
              <li>To identify opportunities for process improvements and operational efficiency.</li>
              <li>To assess the risk management practices in place within each department.</li>
            </ul>
          </div>

          {/* 2.2 Scope */}
          <div className="space-y-1.5">
            <p className="font-bold">2.2&nbsp;&nbsp;Scope</p>
            <p>The audit covered the following departments:</p>
            <ul className="list-disc ml-8 space-y-0.5">
              <li>
                <span className="font-semibold">Finance:</span> Focused on cash management, budgeting, and financial reporting.
              </li>
              <li>
                <span className="font-semibold">Accounting:</span> Reviewed general ledger, accounts payable, accounts receivable, and financial closing procedures.
              </li>
              <li>
                <span className="font-semibold">Human Resources (HRD):</span> Examined employee recruitment, onboarding, payroll, and compliance with labor laws.
              </li>
              <li>
                <span className="font-semibold">General Affairs:</span> Reviewed procurement, office services, and facilities management.
              </li>
              <li>
                <span className="font-semibold">Store Design &amp; Planning:</span> Assessed project management processes and resource allocation for new store developments.
              </li>
              <li>
                <span className="font-semibold">Tax:</span> Focused on tax reporting, filing, and reconciliation.
              </li>
              <li>
                <span className="font-semibold">Security:</span> Reviewed physical security measures, access controls, and incident response processes.
              </li>
              <li>
                <span className="font-semibold">Management Information Systems (MIS):</span> Assessed data security, access controls, and disaster recovery planning.
              </li>
              <li>
                <span className="font-semibold">Merchandise:</span> Focused on inventory management, vendor relationships, and pricing strategies.
              </li>
              <li>
                <span className="font-semibold">Operational:</span> Examined the effectiveness of day-to-day operational processes.
              </li>
              <li>
                <span className="font-semibold">Warehouse:</span> Reviewed inventory control, stock management, and logistics efficiency.
              </li>
            </ul>
          </div>
        </div>

        {/* Spacer & footer */}
        <div className="flex-1" />
        <div className="w-full mt-auto">
          <div className="border-t border-gray-300 mb-2" />
          <div className="flex items-center text-[6px] text-gray-700">
            <div className="flex-1 text-left">
              SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
            </div>
            <div className="flex-1 text-center font-semibold">
              INTERNAL AUDIT REPORT
            </div>
            <div className="flex-1 text-right">
              PAGE <span className="mx-1">7</span> of <span className="ml-1">40</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Approach and Methodology page (page 8) */}
      <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-20 pt-16 pb-12 break-after-page">
        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold">Audit Approach and Methodology</h1>
        </div>

        <div className="text-[11px] leading-relaxed space-y-3">
          {/* 3. Audit Approach and Methodology */}
          <div>
            <p className="font-bold">3.&nbsp;&nbsp;Audit Approach and Methodology</p>
          </div>

          {/* 3.1 Audit Approach */}
          <div className="space-y-1.5">
            <p className="font-bold">3.1&nbsp;&nbsp;Audit Approach</p>
            <p>
              The audit followed a risk-based approach, focusing on areas with higher potential
              for non-compliance, operational inefficiencies, and financial risks. The methods
              used included:
            </p>
            <p>
              <span className="font-semibold">Document Review:</span> Reviewed policies,
              procedures, financial statements, trial balances, HR records, security logs, and
              project management documentation.
            </p>
            <p>
              <span className="font-semibold">Interviews:</span> Conducted discussions with
              department heads and key personnel to understand current processes, controls, and
              challenges.
            </p>
            <p>
              <span className="font-semibold">Data Analysis:</span> Analyzed financial data, tax
              filings, inventory reports, and payroll records to identify discrepancies and
              unusual trends.
            </p>
            <p>
              <span className="font-semibold">Process Walkthroughs:</span> Observed key processes
              in operation, such as cash handling, inventory management, and onboarding
              procedures.
            </p>
            <p>
              <span className="font-semibold">Sampling:</span> Selected representative
              transactions, employee files, and inventory records for detailed testing.
            </p>
          </div>

          {/* 3.2 Standards Followed */}
          <div className="space-y-1.5">
            <p className="font-bold">3.2&nbsp;&nbsp;Standards Followed</p>
            <p>
              The audit was conducted in accordance with the{" "}
              <span className="font-semibold">
                International Standards for the Professional Practice of Internal Auditing (IIA
                Standards)
              </span>{" "}
              and complied with the company&apos;s internal audit charter, internal policies, and
              applicable regulatory requirements.
            </p>
          </div>

          {/* 3.3 Sampling Methodology */}
          <div className="space-y-1.5">
            <p className="font-bold">3.3&nbsp;&nbsp;Sampling Methodology</p>
            <p>
              The sampling methodology for this internal audit employed two primary approaches:
              <span className="font-semibold"> random sampling</span> and{" "}
              <span className="font-semibold">judgmental sampling</span>. Each method was tailored
              to enhance the effectiveness of the audit while ensuring comprehensive coverage of
              high-risk areas.
            </p>

            {/* 1. Random Sampling Method */}
            <div className="space-y-1">
              <p className="font-semibold">1. Random Sampling Method</p>
              <p>
                <span className="font-semibold">Definition:</span> Selecting a subset of
                transactions or records from the entire population so that each item has an equal
                chance of being included.
              </p>
              <p>
                <span className="font-semibold">Purpose:</span> Provide an unbiased representation
                of the population, reducing selection bias and ensuring that findings reflect the
                overall situation.
              </p>
              <p className="font-semibold">Implementation:</p>
              <ul className="list-disc ml-8 space-y-0.5">
                <li>
                  <span className="font-semibold">Population Identification:</span> Define the
                  entire population from which samples will be drawn.
                </li>
                <li>
                  <span className="font-semibold">Sample Size Determination:</span> Calculate an
                  appropriate sample size based on the population size, desired confidence level,
                  and margin of error.
                </li>
                <li>
                  <span className="font-semibold">Random Selection Process:</span> Use random
                  number generators or statistical tools to select items, ensuring each has an
                  equal chance of inclusion.
                </li>
              </ul>
              <p className="font-semibold">Advantages:</p>
              <ul className="list-disc ml-8 space-y-0.5">
                <li>Minimizes selection bias.</li>
                <li>Provides a broader and more objective view of the population.</li>
              </ul>
              <p className="font-semibold">Limitations:</p>
              <ul className="list-disc ml-8 space-y-0.5">
                <li>May not focus sufficiently on high-risk areas.</li>
                <li>Important or unusual transactions may be excluded by chance.</li>
              </ul>
            </div>

            {/* 2. Judgmental Sampling Method (moved to next page) */}
          </div>
        </div>

        {/* Spacer & footer */}
        <div className="flex-1" />
        <div className="w-full mt-auto">
          <div className="border-t border-gray-300 mb-2" />
          <div className="flex items-center text-[6px] text-gray-700">
            <div className="flex-1 text-left">
              SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
            </div>
            <div className="flex-1 text-center font-semibold">
              INTERNAL AUDIT REPORT
            </div>
            <div className="flex-1 text-right">
              PAGE <span className="mx-1">8</span> of <span className="ml-1">40</span>
            </div>
          </div>
        </div>
      </div>

      {/* Methodology page (page 9) */}
      <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-20 pt-16 pb-16 break-after-page">
        <div className="text-[11px] leading-relaxed space-y-4">
          {/* 2. Judgmental Sampling Method (lanjutan dari halaman sebelumnya) */}
          <div className="space-y-1">
            <p className="font-semibold">2. Judgmental Sampling Method (continued)</p>
            <p>
              <span className="font-semibold">Definition:</span> Selecting specific transactions
              or records based on predefined criteria and the auditor&apos;s professional
              judgment.
            </p>
            <p>
              <span className="font-semibold">Purpose:</span> Target high-risk areas or
              transactions that are more likely to reveal issues, ensuring a focused audit
              approach.
            </p>
            <p className="font-semibold">Implementation:</p>
            <ul className="list-disc ml-8 space-y-0.5">
              <li>
                <span className="font-semibold">Risk Assessment:</span> Identify high-risk areas,
                unusual transactions, or areas with significant judgment.
              </li>
              <li>
                <span className="font-semibold">Criteria Development:</span> Establish selection
                criteria such as transaction value, frequency, or recent changes in procedures.
              </li>
              <li>
                <span className="font-semibold">Selection Process:</span> Choose transactions
                based on the established criteria, documenting the rationale for each selection.
              </li>
            </ul>
            <p className="font-semibold">Advantages:</p>
            <ul className="list-disc ml-8 space-y-0.5">
              <li>Focuses on high-risk areas, increasing the likelihood of identifying issues.</li>
              <li>Allows flexibility and professional judgment in targeting critical areas.</li>
            </ul>
            <p className="font-semibold">Limitations:</p>
            <ul className="list-disc ml-8 space-y-0.5">
              <li>Results may be influenced by auditor judgment and may not be fully representative.</li>
              <li>Requires clear documentation to support the basis for selection.</li>
            </ul>
          </div>

          {/* 4. Methodology */}
          <div className="space-y-1.5">
            <p className="font-bold">4.&nbsp;&nbsp;Methodology</p>
            <p>
              The following points outline the audit methodology used during the internal audit,
              structured into several key phases:
            </p>
          </div>

          {/* 4.1 Planning Phase */}
          <div className="space-y-1">
            <p className="font-semibold">4.1&nbsp;&nbsp;Planning Phase</p>
            <ul className="list-disc ml-8 space-y-0.5">
              <li>Define audit objectives and scope.</li>
              <li>Identify key risks and areas of concern through preliminary assessments.</li>
              <li>Develop an audit plan outlining the timeline, resources needed, and specific areas to be tested.</li>
            </ul>
          </div>

          {/* 4.2 Fieldwork Phase */}
          <div className="space-y-1">
            <p className="font-semibold">4.2&nbsp;&nbsp;Fieldwork Phase</p>
            <ul className="list-disc ml-8 space-y-0.5">
              <li>
                <span className="font-semibold">Data Collection:</span> Gather relevant documents,
                records, and transaction data from various departments.
              </li>
              <li>
                <span className="font-semibold">Interviews:</span> Conduct interviews with key
                personnel to understand processes, controls, and any issues faced.
              </li>
              <li>
                <span className="font-semibold">Observations:</span> Observe operational processes
                in real time to assess compliance with established procedures.
              </li>
            </ul>
          </div>

          {/* 4.3 Testing Phase */}
          <div className="space-y-1">
            <p className="font-semibold">4.3&nbsp;&nbsp;Testing Phase</p>
            <ul className="list-disc ml-8 space-y-0.5">
              <li>
                <span className="font-semibold">Substantive Testing:</span> Perform detailed
                testing of selected transactions to verify accuracy and compliance with policies.
              </li>
              <li>
                <span className="font-semibold">Control Testing:</span> Evaluate the effectiveness
                of internal controls by testing their design and operational effectiveness.
              </li>
              <li>
                <span className="font-semibold">Analytical Procedures:</span> Use analytical
                techniques to identify trends, anomalies, or unexpected variances in financial
                and operational data.
              </li>
            </ul>
          </div>

          {/* 4.4 Documentation Phase */}
          <div className="space-y-1">
            <p className="font-semibold">4.4&nbsp;&nbsp;Documentation Phase</p>
            <ul className="list-disc ml-8 space-y-0.5">
              <li>Maintain detailed documentation of all findings, evidence collected, and testing performed.</li>
              <li>Document sampling decisions and any deviations from the original audit plan.</li>
            </ul>
          </div>

          {/* 4.5 Reporting Phase */}
          <div className="space-y-1">
            <p className="font-semibold">4.5&nbsp;&nbsp;Reporting Phase</p>
            <ul className="list-disc ml-8 space-y-0.5">
              <li>Compile findings into a comprehensive audit report, summarizing key issues identified and risk ratings.</li>
              <li>Present the report to management, highlighting critical areas that require immediate attention.</li>
            </ul>
          </div>

          {/* 4.6 Follow-Up Phase */}
          <div className="space-y-1">
            <p className="font-semibold">4.6&nbsp;&nbsp;Follow-Up Phase</p>
            <ul className="list-disc ml-8 space-y-0.5">
              <li>Establish a follow-up plan to monitor the implementation of agreed recommendations.</li>
              <li>Schedule follow-up audits as necessary to ensure that corrective actions have been taken and are effective.</li>
            </ul>
          </div>

          <div>
            <p>
              By employing a structured audit methodology, supported by both random and
              judgmental sampling methods, this internal audit provides a thorough assessment of
              the company&apos;s controls and processes, ensuring a comprehensive evaluation of
              risks and compliance.
            </p>
          </div>
        </div>

        {/* Spacer & footer */}
        <div className="flex-1" />
        <div className="w-full mt-auto">
          <div className="border-t border-gray-300 mb-2" />
          <div className="flex items-center text-[6px] text-gray-700">
            <div className="flex-1 text-left">
              SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
            </div>
            <div className="flex-1 text-center font-semibold">
              INTERNAL AUDIT REPORT
            </div>
            <div className="flex-1 text-right">
              PAGE <span className="mx-1">9</span> of <span className="ml-1">40</span>
            </div>
          </div>
        </div>
      </div>

      {/* Findings & Recommendations pages per department (mulai halaman 10) */}
      {findingPages.map((page, idx) => (
        <div
          key={`${page.dept.deptKey}-page-${idx}`}
          className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page"
        >
          {/* Title: hanya di halaman pertama departemen; halaman lanjutan (data berlanjut) tidak menampilkan judul ini */}
          {page.isFirstPageForDept && (
            <div className="text-center mb-10 flex-shrink-0">
              <h1 className="text-2xl font-bold">Findings &amp; Recommendations</h1>
            </div>
          )}

          {/* Content area: batasi tinggi; zona aman di atas footer; kelebihan → next page; no scroll */}
          <div
            className={`flex-1 min-h-0 min-w-0 overflow-hidden text-[11px] leading-relaxed space-y-6 ${!page.isFirstPageForDept ? "pt-4" : ""}`}
            style={{ paddingBottom: `${FINDING_SAFE_ZONE_REM}rem` }}
          >
            {/* Section header hanya di halaman pertama departemen; halaman lanjutan (lanjutan tabel) tanpa header ini */}
            {page.isFirstPageForDept && (
              <div>
                <p className="font-bold">
                  5&nbsp;&nbsp;&nbsp;Finding &amp; Recommendation
                </p>
                <p>
                  5.{deptIndexMap[page.dept.deptKey] || 1}&nbsp;&nbsp;Department&nbsp;&nbsp;
                  <span className="font-semibold">{page.dept.deptLabel}</span>
                </p>
              </div>
            )}

            {/* SOP Review table: subjudul hanya saat chunk pertama; halaman lanjutan (data berlanjut) tanpa subjudul */}
            {page.sopRows.length > 0 && (
              <div>
                {page.isFirstSopChunk && (
                  <p className="font-semibold mb-2">
                    Standard Operating Procedure Related (SOP Review)
                  </p>
                )}
                <div className="px-2 min-w-0 w-full overflow-hidden">
                  <table className="w-full border-collapse text-[9px] table-fixed" style={{ tableLayout: "fixed", width: "100%" }}>
                    <colgroup>
                      <col style={{ width: "4%" }} />
                      <col style={{ width: "42%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "18%" }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-1.5 py-1 text-left">
                          No
                        </th>
                        <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">
                          Standard Operating Procedure Related
                        </th>
                        <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">
                          Review
                        </th>
                        <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">
                          Auditee Comment
                        </th>
                        <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">
                          Follow-Up Detail
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.sopRows.map((row, rIdx) => (
                        <tr key={`sop-${page.dept.deptKey}-${idx}-${rIdx}`} className={rIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="border border-gray-300 px-1.5 py-0.5 text-center align-top">
                            {row.no}
                          </td>
                          <td className="border border-gray-300 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">
                            {row.sopRelated}
                          </td>
                          <td className="border border-gray-300 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">
                            {row.reviewComment || "-"}
                          </td>
                          <td className="border border-gray-300 px-1.5 py-0.5 align-top">
                            <textarea
                              className="w-full border border-gray-200 rounded-sm px-1 py-0.5 text-[9px] resize-none leading-snug"
                              rows={2}
                              placeholder="Auditee comment"
                            />
                          </td>
                          <td className="border border-gray-300 px-1.5 py-0.5 align-top">
                            <textarea
                              className="w-full border border-gray-200 rounded-sm px-1 py-0.5 text-[9px] resize-none leading-snug"
                              rows={2}
                              placeholder="Follow-up detail"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Audit Review / Audit Finding table */}
            {/* Audit Review table: subjudul hanya saat chunk pertama; halaman lanjutan tanpa subjudul */}
            {page.auditRows.length > 0 && (
              <div>
                {page.isFirstAuditChunk && (
                  <p className="font-semibold mb-1 text-[10px]">
                    Audit Review — Findings Detail
                  </p>
                )}
                <div className="px-2 min-w-0 w-full overflow-hidden">
                  <table className="w-full border-collapse text-[9px] leading-tight table-fixed" style={{ tableLayout: "fixed", width: "100%" }}>
                    <colgroup>
                      <col style={{ width: "4%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "6%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "12%" }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-blue-900 text-white">
                        <th className="border border-blue-800 px-1.5 py-0.5 text-center min-w-0">No</th>
                        <th className="border border-blue-800 px-1.5 py-0.5 text-left min-w-0">Risk ID</th>
                        <th className="border border-blue-800 px-1.5 py-0.5 text-left min-w-0">Risk Details</th>
                        <th className="border border-blue-800 px-1.5 py-0.5 text-left min-w-0">Audit Program Code</th>
                        <th className="border border-blue-800 px-1.5 py-0.5 text-left min-w-0">Substantive Test</th>
                        <th className="border border-blue-800 px-1.5 py-0.5 text-left min-w-0">Risk Level</th>
                        <th className="border border-blue-800 px-1.5 py-0.5 text-left min-w-0">Methodology</th>
                        <th className="border border-blue-800 px-1.5 py-0.5 text-left min-w-0">Finding Result</th>
                        <th className="border border-blue-800 px-1.5 py-0.5 text-left min-w-0">Finding Description</th>
                        <th className="border border-blue-800 px-1.5 py-0.5 text-left min-w-0">Auditee Comment</th>
                        <th className="border border-blue-800 px-1.5 py-0.5 text-left min-w-0">Follow-Up Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.auditRows.map((row, aIdx) => (
                        <tr
                          key={`audit-${page.dept.deptKey}-${idx}-${aIdx}`}
                          className={aIdx % 2 === 0 ? "bg-white" : "bg-blue-50"}
                        >
                          <td className="border border-blue-800 px-1.5 py-0.5 text-center align-top">
                            {row.no}
                          </td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0 overflow-hidden">{row.riskId || "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">{row.riskDetails || "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0 overflow-hidden">{row.apCode || "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">{row.substantiveTest || "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top text-center min-w-0 overflow-hidden">{row.riskLevel ?? "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">{row.methodology || "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">{row.findingResult || "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">{row.findingDescription || "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">
                            {row.auditeeComment || "-"}
                          </td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">
                            {row.followUpDetail || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {page.sopRows.length === 0 && page.auditRows.length === 0 && (
              <p className="text-sm text-gray-500">
                No findings &amp; recommendations data available for this department.
              </p>
            )}
          </div>

          {/* Footer tetap di bawah halaman; konten panjang sudah di-paginate ke halaman berikutnya */}
          <div className="w-full flex-shrink-0 mt-auto pt-4">
            <div className="border-t border-gray-300 mb-2" />
            <div className="flex items-center text-[6px] text-gray-700">
              <div className="flex-1 text-left">
                SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
              </div>
              <div className="flex-1 text-center font-semibold">
                INTERNAL AUDIT REPORT
              </div>
              <div className="flex-1 text-right">
                PAGE <span className="mx-1">{10 + idx}</span> of <span className="ml-1">40</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Satu blok per department: 5.x Department, 5.x.1 Finding : -, Select Finding — hanya untuk layar, tidak ikut print */}
      {findingSections.length > 0 && (
        <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] min-h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page print:hidden">
          <div className="text-center mb-6 flex-shrink-0">
            <h1 className="text-2xl font-bold">Findings &amp; Recommendations</h1>
          </div>
          <div className="flex-1 text-[11px] leading-relaxed space-y-8">
            <p className="font-bold">5&nbsp;&nbsp;&nbsp;Finding &amp; Recommendation</p>
            {findingSections.map((section) => {
              const deptNum = deptIndexMap[section.deptKey] ?? 1;
              const selectedCount = (selectedFindingByDept[section.deptKey] ?? []).length;
              return (
                <div
                  key={section.deptKey}
                  className={`space-y-2 ${selectedCount === 0 ? "print:hidden" : ""}`}
                >
                  <p>5.{deptNum}&nbsp;&nbsp;Department&nbsp;&nbsp;<span className="font-semibold">{section.deptLabel}</span></p>
                  <p className="mt-2 flex items-center gap-2 flex-wrap">
                    <span>5.{deptNum}.1&nbsp;&nbsp;Finding :&nbsp;&nbsp;</span>
                    {selectedCount > 0 ? (
                      <span className="text-gray-600">{selectedCount} finding(s) dipilih</span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setFindingModalDeptKey(section.deptKey)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 print:hidden"
                    >
                      Select Finding
                    </button>
                  </p>
                  <p className="text-gray-500 text-sm print:hidden">Pilih finding dari Audit Review (tombol Select Finding di atas).</p>
                </div>
              );
            })}
          </div>
          <div className="w-full flex-shrink-0 mt-auto pt-4">
            <div className="border-t border-gray-300 mb-2" />
            <div className="flex items-center text-[9px] text-gray-700">
              <div className="flex-1 text-left">SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM</div>
              <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
              <div className="flex-1 text-right">PAGE <span className="mx-1">{10 + findingPages.length + 1}</span> of <span className="ml-1">40</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Modal pilih finding (checkbox, multi) — hanya finding dari audit review yang masuk report */}
      {findingModalDeptKey != null && (() => {
        const section = findingSections.find((s) => s.deptKey === findingModalDeptKey);
        const rows = section?.auditRows ?? [];
        const handleConfirm = () => {
          setSelectedFindingByDept((prev) => ({ ...prev, [findingModalDeptKey]: [...modalCheckedIndices].sort((a, b) => a - b) }));
          setFindingModalDeptKey(null);
        };
        const toggle = (idx) => {
          setModalCheckedIndices((prev) => prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b));
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
              <div className="p-4 border-b">
                <h2 className="text-lg font-bold">
                  Select Finding(s) — {section?.deptLabel ?? findingModalDeptKey}
                </h2>
                <p className="text-sm text-gray-600 mt-1">Pilih satu atau lebih finding dari Audit Review. Satu finding = satu halaman detail.</p>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                <div className="space-y-2">
                  {rows.map((row, idx) => (
                    <label
                      key={idx}
                      className={`flex items-start gap-3 p-3 border rounded cursor-pointer ${modalCheckedIndices.includes(idx) ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
                    >
                      <input
                        type="checkbox"
                        checked={modalCheckedIndices.includes(idx)}
                        onChange={() => toggle(idx)}
                        className="mt-1"
                      />
                      <div className="text-sm flex-1 min-w-0">
                        <p><span className="font-semibold">Risk :</span> {(row.risk || "-").toString().slice(0, 80)}{(row.risk || "").length > 80 ? "…" : ""}</p>
                        <p><span className="font-semibold">Risk Description :</span> {(row.riskDetails || "-").toString().slice(0, 120)}{(row.riskDetails || "").length > 120 ? "…" : ""}</p>
                        <p><span className="font-semibold">Audit Program Code :</span> {row.apCode || "-"}</p>
                        <p><span className="font-semibold">Finding :</span> {(row.findingDescription || row.findingResult || "-").toString().slice(0, 80)}{((row.findingDescription || row.findingResult) || "").length > 80 ? "…" : ""}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFindingModalDeptKey(null)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Finding & Recommendation — satu halaman per finding yang dipilih (multi checkbox) */}
      {findingDetailPages.map(({ section, finding, findingIndex }, idx) => {
        const deptNum = (deptIndexMap[section.deptKey] ?? 1);
        const riskRatingLabel = finding?.riskLevel != null
          ? (Number(finding.riskLevel) === 1 ? "Low" : Number(finding.riskLevel) === 2 ? "Moderate" : Number(finding.riskLevel) === 3 ? "High" : String(finding.riskLevel))
          : "";
        return (
          <div
            key={`finding-detail-${section.deptKey}-${findingIndex}-${idx}`}
            className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page"
          >
            <div className="text-center mb-6 flex-shrink-0">
              <h1 className="text-2xl font-bold">Findings &amp; Recommendations</h1>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden text-[11px] leading-relaxed space-y-4">
              <div>
                <p className="font-bold">5&nbsp;&nbsp;&nbsp;Finding &amp; Recommendation</p>
                <p>
                  5.{deptNum}&nbsp;&nbsp;Department&nbsp;&nbsp;
                  <span className="font-semibold">{section.deptLabel}</span>
                </p>
                <p className="mt-2">
                  <span>5.{deptNum}.{findingIndex}&nbsp;&nbsp;Finding :&nbsp;&nbsp;</span>
                  <span className="font-medium">{finding.findingDescription || finding.findingResult || "-"}</span>
                </p>
              </div>
              <div className="space-y-1.5 border border-gray-200 rounded p-3 bg-gray-50/50">
                <p><span className="font-semibold">Area Audit :</span> {section.areaAudit ?? section.deptLabel}</p>
                <p><span className="font-semibold">Audit Program Code :</span> {finding.apCode || "-"}</p>
                <p><span className="font-semibold">Risk :</span> {finding.risk || "-"}</p>
                <p><span className="font-semibold">Risk Description :</span> {finding.riskDetails || "-"}</p>
                <p><span className="font-semibold">Effect if not mitigate :</span> {finding.effectIfNotMitigate || "-"}</p>
                <p><span className="font-semibold">Risk Rating :</span> {riskRatingLabel ? `[${riskRatingLabel}]` : "[Low, Moderate, High]"}</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Recommendation</p>
                <textarea
                  className="w-full border border-gray-300 rounded p-2 text-[11px] min-h-[60px] resize-y"
                  placeholder="Recommendation"
                  defaultValue={finding.recommendation || ""}
                />
              </div>
              <div>
                <p className="font-semibold mb-1">Audit Response</p>
                <p className="text-gray-700">Auditee agrees to <input type="text" className="border-b border-gray-400 mx-1 px-2 py-0.5 inline-block min-w-[120px]" placeholder="..." /> by <input type="text" className="border-b border-gray-400 mx-1 px-2 py-0.5 inline-block min-w-[100px]" placeholder="date" />.</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Management Response</p>
                <p className="text-gray-700">Management agrees to <input type="text" className="border-b border-gray-400 mx-1 px-2 py-0.5 inline-block min-w-[120px]" placeholder="..." /> by <input type="text" className="border-b border-gray-400 mx-1 px-2 py-0.5 inline-block min-w-[100px]" placeholder="date" />.</p>
              </div>
            </div>
            <div className="w-full flex-shrink-0 mt-auto pt-4">
              <div className="border-t border-gray-300 mb-2" />
              <div className="flex items-center text-[9px] text-gray-700">
                <div className="flex-1 text-left">SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM</div>
                <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                <div className="flex-1 text-right">PAGE <span className="mx-1">{10 + findingPages.length + 1 + idx}</span> of <span className="ml-1">40</span></div>
              </div>
            </div>
          </div>
        );
      })}

      {/* 6 Conclusion — hanya tampil jika ada data SOP/Audit. Add Conclusion → isi form → Save → system hitung (page 1 penuh dulu, sisanya next page). */}
      {findingSections.length > 0 && (
        <>
          {showConclusionForm ? (
            /* Form: title + input per department + Save */
            <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] min-h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page">
              <div className="text-center mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold">Conclusion</h1>
              </div>
              <div className="mb-4">
                <p className="font-bold">6&nbsp;&nbsp;&nbsp;Conclusion</p>
              </div>
              <div className="flex-1 text-[11px] leading-relaxed space-y-6">
                {findingSections.map((section, i) => (
                  <div key={section.deptKey} className="space-y-2">
                    <p className="font-semibold">
                      6.{i + 1}&nbsp;&nbsp;Department&nbsp;&nbsp;{section.deptLabel}
                    </p>
                    <textarea
                      data-conclusion-textarea
                      className="w-full border border-gray-300 rounded p-3 text-[11px] min-h-[80px] resize-y overflow-y-auto bg-gray-50 placeholder:text-gray-400"
                      placeholder="Conclusion for this department..."
                      value={conclusionValues[section.deptKey] ?? ""}
                      onChange={(e) => setConclusionValues((prev) => ({ ...prev, [section.deptKey]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end print:hidden">
                <button
                  type="button"
                  onClick={handleSaveConclusion}
                  className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
              <div className="w-full flex-shrink-0 mt-auto pt-4">
                <div className="border-t border-gray-300 mb-2" />
                <div className="flex items-center text-[9px] text-gray-700">
                  <div className="flex-1 text-left">SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM</div>
                  <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                  <div className="flex-1 text-right">PAGE <span className="mx-1">—</span> of <span className="ml-1">40</span></div>
                </div>
              </div>
            </div>
          ) : conclusionPages.length > 0 ? (
            /* Hasil: halaman ter-paginate (page 1 penuh dulu) */
            conclusionPages.map((pageSections, pageIdx) => (
              <div
                key={`conclusion-${pageIdx}`}
                className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page"
              >
                {pageIdx === 0 && (
                  <div className="text-center mb-6 flex-shrink-0 flex flex-col items-center gap-2">
                    <h1 className="text-2xl font-bold">Conclusion</h1>
                    <button
                      type="button"
                      onClick={() => setShowConclusionForm(true)}
                      className="text-sm text-blue-600 hover:underline print:hidden"
                    >
                      Edit Conclusion
                    </button>
                  </div>
                )}
                <div
                  className="flex-1 min-h-0 min-w-0 overflow-hidden text-[11px] leading-relaxed space-y-6"
                  style={{ paddingBottom: `${CONCLUSION_SAFE_ZONE_PX}px` }}
                >
                  {pageIdx === 0 && (
                    <div>
                      <p className="font-bold">6&nbsp;&nbsp;&nbsp;Conclusion</p>
                    </div>
                  )}
                  {pageSections.map((section, i) => {
                    const globalIndex = conclusionPages.reduce((acc, p, idx) => (idx < pageIdx ? acc + p.length : acc), 0) + i;
                    const text = (conclusionValues[section.deptKey] ?? "").trim();
                    if (!text) return null;
                    return (
                      <div key={section.deptKey} className="space-y-2 break-inside-avoid">
                        <p className="font-semibold">
                          6.{globalIndex + 1}&nbsp;&nbsp;Department&nbsp;&nbsp;{section.deptLabel}
                        </p>
                        <div className="w-full border border-gray-300 rounded p-3 text-[11px] bg-gray-50 whitespace-pre-wrap break-words">
                          {text}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="w-full flex-shrink-0 mt-auto pt-4">
                  <div className="border-t border-gray-300 mb-2" />
                  <div className="flex items-center text-[9px] text-gray-700">
                    <div className="flex-1 text-left">SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM</div>
                    <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                    <div className="flex-1 text-right">PAGE <span className="mx-1">{10 + findingPages.length + 1 + findingDetailPages.length + pageIdx + 1}</span> of <span className="ml-1">40</span></div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            /* Awal: hanya title + button Add Conclusion (di bawah title, ada data SOP/Audit) */
            <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page">
              <div className="text-center mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold">Conclusion</h1>
              </div>
              <div className="mb-6">
                <p className="font-bold">6&nbsp;&nbsp;&nbsp;Conclusion</p>
              </div>
              <div className="flex-1 flex flex-col items-center justify-start pt-8">
                <button
                  type="button"
                  onClick={() => setShowConclusionForm(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 print:hidden"
                >
                  Add Conclusion
                </button>
                <p className="mt-4 text-sm text-gray-500 print:hidden">Klik untuk mengisi conclusion per department (yang ada data SOP/Audit Review).</p>
              </div>
              <div className="w-full flex-shrink-0 mt-auto pt-4">
                <div className="border-t border-gray-300 mb-2" />
                <div className="flex items-center text-[9px] text-gray-700">
                  <div className="flex-1 text-left">SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM</div>
                  <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                  <div className="flex-1 text-right">PAGE <span className="mx-1">{10 + findingPages.length + 1 + findingDetailPages.length + 1}</span> of <span className="ml-1">40</span></div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Hanya Conclusion: pengukuran hanya untuk department yang berisi data (untuk Save). */}
      {findingSections.length > 0 && (
        <div
          ref={conclusionMeasureRef}
          className="absolute left-[-9999px] top-0 w-[210mm] overflow-visible"
          style={{ visibility: "hidden", pointerEvents: "none" }}
          aria-hidden="true"
        >
          <div className="px-16 text-[11px] leading-relaxed space-y-6">
            {findingSections
              .filter((s) => (conclusionValues[s.deptKey] ?? "").trim().length > 0)
              .map((section, i) => (
                <div key={section.deptKey} data-conclusion-block className="space-y-2">
                  <p className="font-semibold">6.{i + 1}&nbsp;&nbsp;Department&nbsp;&nbsp;{section.deptLabel}</p>
                  <div className="w-full border border-gray-300 rounded p-3 text-[11px] min-h-0 bg-gray-50 whitespace-pre-wrap break-words">
                    {(conclusionValues[section.deptKey] ?? "").trim()}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Pengukuran tinggi riil (seperti Word): isi halaman sampai penuh lalu next page. Tabel tersembunyi, sama lebar & style dengan report. */}
      {findingSections.length > 0 && (
        <div
          ref={measureContainerRef}
          className="absolute left-[-9999px] top-0 w-[210mm] overflow-visible"
          style={{ visibility: "hidden", pointerEvents: "none" }}
          aria-hidden="true"
        >
          <div className="px-16 text-[11px]">
            {findingSections.map((section) => (
              <div key={section.deptKey}>
                {section.sopRows.length > 0 && (
                  <div className="mb-8">
                    <div className="px-2">
                      <table
                        data-measure-sop={section.deptKey}
                        className="w-full max-w-full border-collapse text-[9px] table-fixed"
                        style={{ tableLayout: "fixed" }}
                      >
                        <colgroup>
                          <col style={{ width: "4%" }} />
                          <col style={{ width: "42%" }} />
                          <col style={{ width: "18%" }} />
                          <col style={{ width: "18%" }} />
                          <col style={{ width: "18%" }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-1.5 py-1 text-left">No</th>
                            <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">SOP</th>
                            <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">Review</th>
                            <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">A</th>
                            <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">B</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.sopRows.map((row, rIdx) => (
                            <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="border border-gray-300 px-1.5 py-0.5 text-center align-top">{row.no}</td>
                              <td className="border border-gray-300 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words">{row.sopRelated}</td>
                              <td className="border border-gray-300 px-1.5 py-0.5 align-top">{row.reviewComment || "-"}</td>
                              <td className="border border-gray-300 px-1.5 py-0.5 align-top h-8" />
                              <td className="border border-gray-300 px-1.5 py-0.5 align-top h-8" />
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {section.auditRows.length > 0 && (
                  <div className="px-2">
                    <table
                      data-measure-audit={section.deptKey}
                      className="w-full max-w-full border-collapse text-[9px] leading-tight table-fixed"
                      style={{ tableLayout: "fixed" }}
                    >
                      <colgroup>
                        <col style={{ width: "4%" }} />
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "14%" }} />
                        <col style={{ width: "10%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "6%" }} />
                        <col style={{ width: "10%" }} />
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "14%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "12%" }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-blue-900 text-white">
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">No</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">RID</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">Risk</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">Code</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">Test</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">L</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">Method</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">Result</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">Desc</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">A</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">B</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.auditRows.map((row, aIdx) => (
                          <tr key={aIdx} className={aIdx % 2 === 0 ? "bg-white" : "bg-blue-50"}>
                            <td className="border border-blue-800 px-1.5 py-0.5 text-center align-top">{row.no}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top">{row.riskId || "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words">{row.riskDetails || "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top">{row.apCode || "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words">{row.substantiveTest || "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top">{row.riskLevel ?? "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words">{row.methodology || "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words">{row.findingResult || "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words">{row.findingDescription || "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words">
                              {row.auditeeComment || "-"}
                            </td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words">
                              {row.followUpDetail || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7 Appendices — editable manual section at end of report */}
      <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] min-h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page">
        <div className="text-center mb-8 flex-shrink-0 flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold">Appendices</h1>
          <div className="print:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAppendixEditor((prev) => !prev)}
              className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 text-sm"
            >
              {showAppendixEditor ? "Close Editor" : "Edit Appendices"}
            </button>
            {!showAppendixEditor && (
              <button
                type="button"
                onClick={() =>
                  setAppendices((prev) => [
                    ...prev,
                    {
                      id: `appendix-${Date.now()}`,
                      type: "text",
                      title: `Appendix ${String.fromCharCode(65 + prev.length)} - New Section`,
                      content: "",
                    },
                  ])
                }
                className="px-4 py-2 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 text-sm"
              >
                + Add Appendix
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 text-[11px] leading-relaxed space-y-8">
          {appendices.map((appendix, idx) => (
            <div key={appendix.id} className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-bold">
                    7.{idx + 1}&nbsp;&nbsp;{showAppendixEditor ? (
                      <input
                        type="text"
                        value={appendix.title}
                        onChange={(e) =>
                          setAppendices((prev) =>
                            prev.map((item) =>
                              item.id === appendix.id ? { ...item, title: e.target.value } : item,
                            ),
                          )
                        }
                        className="border border-gray-300 rounded px-2 py-1 text-[11px] w-full max-w-[420px] print:border-none print:p-0 print:bg-transparent"
                      />
                    ) : (
                      <span>{appendix.title}</span>
                    )}
                  </p>
                </div>
                {showAppendixEditor && (
                  <button
                    type="button"
                    onClick={() =>
                      setAppendices((prev) => prev.filter((item) => item.id !== appendix.id))
                    }
                    className="print:hidden text-xs text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                )}
              </div>

              {appendix.type === "table" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{appendix.content || "Risk Matrix"}</div>
                    {showAppendixEditor && (
                      <button
                        type="button"
                        onClick={() => addAppendixTableRow(appendix.id)}
                        className="print:hidden px-3 py-1 rounded bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700"
                      >
                        Add Row
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse table-fixed text-[10px]">
                      <colgroup>
                        <col className={showAppendixEditor ? "w-[12%]" : "w-[13%]"} />
                        <col className={showAppendixEditor ? "w-[10%]" : "w-[12%]"} />
                        <col className={showAppendixEditor ? "w-[39%]" : "w-[50%]"} />
                        <col className="w-[13%]" />
                        <col className={showAppendixEditor ? "w-[11%]" : "w-[12%]"} />
                        {showAppendixEditor && <col className="w-[15%]" />}
                      </colgroup>
                      <thead>
                        <tr className="bg-[#8f8f8f] text-white">
                          <th className="border border-black px-2 py-1 text-center font-semibold">Department</th>
                          <th className="border border-black px-2 py-1 text-center font-semibold">AP No</th>
                          <th className="border border-black px-2 py-1 text-center font-semibold">Risk Factor</th>
                          <th className="border border-black px-2 py-1 text-center font-semibold">Risk Indicator</th>
                          <th className="border border-black px-2 py-1 text-center font-semibold">Risk Level</th>
                          {showAppendixEditor && (
                            <th className="border border-black px-2 py-1 text-center font-semibold print:hidden">
                              Action
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {(appendix.tableRows || []).map((row, rowIdx) => (
                          <tr key={`${appendix.id}-row-${rowIdx}`} className="bg-white">
                            {showAppendixEditor ? (
                              <>
                                <td className="border border-black p-0 align-top h-8">
                                  <input
                                    type="text"
                                    value={row.department || ""}
                                    onChange={(e) =>
                                      updateAppendixTableCell(
                                        appendix.id,
                                        rowIdx,
                                        "department",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full h-full min-h-8 px-2 py-1 bg-transparent border-none focus:outline-none"
                                  />
                                </td>
                                <td className="border border-black p-0 align-top h-8">
                                  <input
                                    type="text"
                                    value={row.apNo || ""}
                                    onChange={(e) =>
                                      updateAppendixTableCell(
                                        appendix.id,
                                        rowIdx,
                                        "apNo",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full h-full min-h-8 px-2 py-1 bg-transparent border-none focus:outline-none"
                                  />
                                </td>
                                <td className="border border-black p-0 align-top h-8">
                                  <input
                                    type="text"
                                    value={row.riskFactor || ""}
                                    onChange={(e) =>
                                      updateAppendixTableCell(
                                        appendix.id,
                                        rowIdx,
                                        "riskFactor",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full h-full min-h-8 px-2 py-1 bg-transparent border-none focus:outline-none"
                                  />
                                </td>
                                <td className="border border-black p-0 align-top h-8">
                                  <input
                                    type="text"
                                    value={row.riskIndicator || ""}
                                    onChange={(e) =>
                                      updateAppendixTableCell(
                                        appendix.id,
                                        rowIdx,
                                        "riskIndicator",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full h-full min-h-8 px-2 py-1 bg-transparent border-none focus:outline-none"
                                  />
                                </td>
                                <td className="border border-black p-0 align-top h-8">
                                  <input
                                    type="text"
                                    value={row.riskLevel || ""}
                                    onChange={(e) =>
                                      updateAppendixTableCell(
                                        appendix.id,
                                        rowIdx,
                                        "riskLevel",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full h-full min-h-8 px-2 py-1 bg-transparent border-none focus:outline-none"
                                  />
                                </td>
                                <td className="border border-black px-1 py-1 text-center print:hidden">
                                  <button
                                    type="button"
                                    onClick={() => removeAppendixTableRow(appendix.id, rowIdx)}
                                    className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-semibold hover:bg-red-700"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="border border-black px-2 py-1 align-top h-8">{row.department || ""}</td>
                                <td className="border border-black px-2 py-1 align-top h-8">{row.apNo || ""}</td>
                                <td className="border border-black px-2 py-1 align-top h-8">{row.riskFactor || ""}</td>
                                <td className="border border-black px-2 py-1 align-top h-8">{row.riskIndicator || ""}</td>
                                <td className="border border-black px-2 py-1 align-top h-8">{row.riskLevel || ""}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : showAppendixEditor ? (
                <textarea
                  value={appendix.content}
                  onChange={(e) =>
                    setAppendices((prev) =>
                      prev.map((item) =>
                        item.id === appendix.id ? { ...item, content: e.target.value } : item,
                      ),
                    )
                  }
                  className="w-full border border-gray-300 rounded p-3 text-[11px] min-h-[140px] resize-y bg-gray-50"
                  placeholder="Input appendix content here..."
                />
              ) : (
                <div className="border border-gray-300 rounded p-3 bg-gray-50 whitespace-pre-wrap break-words min-h-[60px]">
                  {appendix.content || "[No appendix content yet]"}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="w-full flex-shrink-0 mt-auto pt-4">
          <div className="border-t border-gray-300 mb-2" />
          <div className="flex items-center text-[9px] text-gray-700">
            <div className="flex-1 text-left">SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM</div>
            <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
            <div className="flex-1 text-right">PAGE <span className="mx-1">{appendixPageBase}</span> of <span className="ml-1">40</span></div>
          </div>
        </div>
      </div>

      {/* Tombol print (tidak ikut tercetak) */}
      <div className="mt-4 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-gradient-to-r from-[#141D38] to-[#2D3A5A] text-white text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg hover:from-[#141D38]/90 hover:to-[#2D3A5A]/90 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
        >
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}


