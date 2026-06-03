import { sortByRiskId } from "@/app/utils/sortByRiskId";
import {
  buildDeptExecutiveSummaryFromRow,
  executiveSummaryRowHasContent,
} from "@/app/utils/parseStoredJsonList";
import { REPORT_DEPARTMENTS } from "./reportDepartments";

async function fetchAuditReviewPublishState(apiPath, reportYear, doFetch) {
  try {
    const yearQ = Number.isFinite(reportYear)
      ? `?year=${encodeURIComponent(String(reportYear))}`
      : "";
    const res = await doFetch(
      `/api/audit-review/${apiPath}/publish-status${yearQ}${yearQ ? "&" : "?"}_=${Date.now()}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      return { isLocked: false, row: null, auditYear: reportYear ?? null };
    }
    const json = await res.json().catch(() => ({}));
    const isLocked = json.isPublished === true || json.isLocked === true;
    return {
      isLocked,
      row: isLocked ? json.row ?? null : null,
      auditYear: json.auditYear ?? reportYear ?? null,
    };
  } catch {
    return { isLocked: false, row: null, auditYear: reportYear ?? null };
  }
}

function deriveAuditYearFromReviewRows(rows) {
  const years = (rows || [])
    .map((row) => row?.completion_date || row?.updated_at || null)
    .filter(Boolean)
    .map((value) => {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed.getFullYear();
    })
    .filter((y) => y != null);
  return years.length > 0 ? Math.max(...years) : null;
}

function filterPublishesForYear(publishes, year) {
  if (!year || !Number.isFinite(year)) return publishes;
  const yearFiltered = publishes.filter((pub) => {
    const meta = pub.meta || {};
    const aps = meta.audit_fieldwork_start_date;
    const pubAt = meta.published_at;
    if (aps) {
      const d = new Date(aps);
      if (!Number.isNaN(d.getTime()) && d.getFullYear() === year) return true;
    }
    if (pubAt) {
      const d = new Date(pubAt);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
    }
    return false;
  });
  return yearFiltered.length > 0 ? yearFiltered : publishes;
}

/**
 * Pull latest SOP Review + Audit Review + worksheet data for consolidated report preview.
 * @param {number} year Report year (?year=)
 * @param {{ pendingPublishByDept?: Record<string, boolean> }} [options]
 */
export async function loadFindingSectionsFromModules(year, options = {}, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const sections = [];
  const lockedByDept = {};
  const pendingPublishByDept = options.pendingPublishByDept || {};

  for (const dept of REPORT_DEPARTMENTS) {
    lockedByDept[dept.key] = false;
    let sopRows = [];
    try {
      const yearQ = Number.isFinite(year) ? `&year=${encodeURIComponent(String(year))}` : "";
      const sopRes = await doFetch(
        `/api/SopReview/${dept.apiPath}/published?all=1${yearQ}&_=${Date.now()}`,
        { cache: "no-store" },
      );
      if (sopRes.ok) {
        const sopJson = await sopRes.json().catch(() => ({}));
        let publishes = Array.isArray(sopJson.publishes) ? sopJson.publishes : [];
        publishes = filterPublishesForYear(publishes, year);

        publishes.forEach((pub) => {
          (pub.rows || []).forEach((row, idx) => {
            const sopRelated = (row.sop_related || "").toString().trim();
            if (!sopRelated) return;
            sopRows.push({
              sourceIndex: sopRows.length,
              no: row.no ?? idx + 1,
              sopRelated,
              status: (row.status || "").toString().toUpperCase(),
              reviewComment: (row.comment || "").toString(),
              auditeeComment: (row.auditee_comment || "").toString(),
              followUpDetail: (row.follow_up_detail || "").toString(),
            });
          });
        });
      }
    } catch (err) {
      console.warn("[report-modules] SOP load failed", dept.apiPath, err);
    }

    let auditRows = [];
    let executiveSummary = null;
    let isDeptLockedForReport = false;
    try {
      const pendingLock = pendingPublishByDept[dept.key];
      let publishState = await fetchAuditReviewPublishState(dept.apiPath, year, doFetch);
      if (pendingLock === true && !publishState.isLocked) {
        await new Promise((r) => setTimeout(r, 350));
        publishState = await fetchAuditReviewPublishState(dept.apiPath, year, doFetch);
      }
      if (pendingLock === true) {
        isDeptLockedForReport = true;
      } else if (pendingLock === false) {
        isDeptLockedForReport = false;
      } else {
        isDeptLockedForReport = publishState.isLocked === true;
      }
      lockedByDept[dept.key] = isDeptLockedForReport;
      executiveSummary = isDeptLockedForReport ? publishState.row : null;
      const findingsAuditYear = publishState.auditYear ?? year;

      const loadAuditReviewRows = async (auditYear, forReport) => {
        if (!Number.isFinite(auditYear)) return [];
        const reviewUrl = `/api/audit-review/${dept.apiPath}/findings?year=${encodeURIComponent(String(auditYear))}${forReport ? "&forReport=1" : ""}&_=${Date.now()}`;
        const reviewRes = await doFetch(reviewUrl, { cache: "no-store" });
        if (!reviewRes.ok) return [];
        const reviewJson = await reviewRes.json().catch(() => ({}));
        return Array.isArray(reviewJson.rows) ? reviewJson.rows : [];
      };

      let rows = [];
      if (isDeptLockedForReport) {
        rows = await loadAuditReviewRows(findingsAuditYear, true);
        if (rows.length === 0 && pendingLock === true) {
          rows = await loadAuditReviewRows(findingsAuditYear, false);
        }
        if (!executiveSummary && pendingLock === true) {
          const execRes = await doFetch(
            `/api/audit-review/${dept.apiPath}/executive-summary?year=${encodeURIComponent(String(findingsAuditYear))}&_=${Date.now()}`,
            { cache: "no-store" },
          );
          if (execRes.ok) {
            const execJson = await execRes.json().catch(() => ({}));
            executiveSummary = execJson.data ?? null;
          }
        }
      }

      deriveAuditYearFromReviewRows(rows);

      if (isDeptLockedForReport && rows.length > 0) {
        auditRows = sortByRiskId(rows).map((r, idx) => ({
          sourceIndex: idx,
          no: idx + 1,
          riskId: r.riskId ?? r.risk_id ?? "",
          risk: r.risk ?? "",
          riskDetails: r.riskDetails ?? r.risk_details ?? "",
          effectIfNotMitigate: r.effectIfNotMitigate ?? r.impact_description ?? "",
          riskLevel: r.riskLevel ?? r.risk ?? "",
          apCode: r.apNo ?? r.apCode ?? r.ap_code ?? "",
          substantiveTest: r.substantiveTest ?? r.substantive_test ?? "",
          methodology: r.method ?? "",
          findingResult: r.findingResult ?? r.finding_result ?? "",
          findingDescription: r.findingDescription ?? r.finding_description ?? "",
          recommendation: r.recommendation ?? "",
          auditeeComment: r.auditeeComment ?? r.auditee_comment ?? "",
          followUpDetail: r.followUpDetail ?? r.follow_up_detail ?? "",
        }));
      }
    } catch {
      /* ignore audit-review errors */
    }

    let areaAudit = dept.label;
    try {
      const wsRes = await doFetch(
        `/api/worksheet/${dept.apiPath}${year ? `?year=${encodeURIComponent(String(year))}&_=${Date.now()}` : `?_=${Date.now()}`}`,
        { cache: "no-store" },
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
      /* fallback label */
    }

    const visibleAuditRows = isDeptLockedForReport && auditRows.length > 0 ? auditRows : [];
    const deptExecutiveSummary = isDeptLockedForReport
      ? buildDeptExecutiveSummaryFromRow(executiveSummary)
      : null;
    const hasExecForReport =
      isDeptLockedForReport && executiveSummaryRowHasContent(deptExecutiveSummary);

    if (sopRows.length > 0 || visibleAuditRows.length > 0 || hasExecForReport) {
      const normalizedSopRows = sopRows.map((row, idx) => ({
        ...row,
        no: idx + 1,
      }));
      sections.push({
        deptKey: dept.key,
        deptLabel: dept.label,
        areaAudit,
        isPublishedToReport: isDeptLockedForReport,
        executiveSummary: deptExecutiveSummary,
        sopRows: normalizedSopRows,
        auditRows: visibleAuditRows,
      });
    }
  }

  return { sections, lockedByDept };
}
