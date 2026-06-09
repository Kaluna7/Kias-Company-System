import crypto from "crypto";

/**
 * Lock/unlock Audit Review: API `lockedByDept` adalah sumber kebenaran.
 * `auditVisibleByDept[deptKey] === false` hanya boleh menyembunyikan (override hide).
 */

export function buildEffectivePublishMap(
  apiPublishByDept = {},
  auditVisibleByDept = {},
  findingSections = [],
) {
  const keys = new Set([
    ...Object.keys(apiPublishByDept || {}),
    ...Object.keys(auditVisibleByDept || {}),
    ...(Array.isArray(findingSections) ? findingSections.map((s) => s.deptKey) : []),
  ]);
  const sectionByDept = new Map(
    (Array.isArray(findingSections) ? findingSections : []).map((s) => [s.deptKey, s]),
  );
  const out = {};
  for (const deptKey of keys) {
    if (auditVisibleByDept[deptKey] === false) {
      out[deptKey] = false;
      continue;
    }
    /** Hub lock/unlock (auditVisibleByDept) — jangan tunggu batch API yang bisa stale setelah re-lock. */
    if (auditVisibleByDept[deptKey] === true) {
      out[deptKey] = true;
      continue;
    }
    if (apiPublishByDept[deptKey] === true) {
      out[deptKey] = true;
      continue;
    }
    if (sectionByDept.get(deptKey)?.isPublishedToReport === true) {
      out[deptKey] = true;
      continue;
    }
    out[deptKey] = false;
  }
  return out;
}

/**
 * Sinkronkan visibility hub dari status lock API (live module).
 * Lock API = true → selalu tampilkan (re-lock setelah unlock harus pulih).
 * Lock API = false → sembunyikan.
 */
export function syncAuditVisibleFromLockedByDept(lockedByDept = {}, existingVisible = {}) {
  const next = { ...(existingVisible || {}) };
  for (const [deptKey, isLocked] of Object.entries(lockedByDept || {})) {
    next[deptKey] = isLocked === true;
  }
  return next;
}

/**
 * HANYA untuk render (HTML preview / filter tampilan) — jangan simpan hasil ini ke DB.
 * Data modul tetap utuh di `findingSections`; visibility lewat `auditVisibleByDept`.
 */
export function applyAuditVisibilityToSections(sections, effectivePublishByDept = {}) {
  if (!Array.isArray(sections)) return [];
  return sections.map((section) => {
    const visible = effectivePublishByDept[section.deptKey] === true;
    if (visible) return { ...section, isPublishedToReport: true };
    const { _preservedAuditRows, executiveSummary, auditRows, ...rest } = section;
    return {
      ...rest,
      isPublishedToReport: false,
      executiveSummary: null,
      auditRows: [],
      ...(Array.isArray(_preservedAuditRows) && _preservedAuditRows.length > 0
        ? { _preservedAuditRows }
        : {}),
    };
  });
}

/**
 * Saat persist: jangan timpa data audit modul dengan array kosong dari UI unlock.
 * Module API / DB existing = source of truth untuk auditRows & executiveSummary.
 */
function pickNonEmptyRows(primary, fallback) {
  if (Array.isArray(primary) && primary.length > 0) return primary;
  if (Array.isArray(fallback) && fallback.length > 0) return fallback;
  return Array.isArray(primary) ? primary : [];
}

/**
 * Module API = source of truth untuk baris tabel.
 * Jangan timpa data modul dengan shell kosong dari client/visibility strip.
 */
export function mergeModuleSectionsForHub(existingSections = [], moduleSections = []) {
  const existingByDept = new Map(
    (Array.isArray(existingSections) ? existingSections : []).map((s) => [s.deptKey, s]),
  );
  const moduleByDept = new Map(
    (Array.isArray(moduleSections) ? moduleSections : []).map((s) => [s.deptKey, s]),
  );
  const deptKeys = new Set([...existingByDept.keys(), ...moduleByDept.keys()]);
  const out = [];

  for (const deptKey of deptKeys) {
    const mod = moduleByDept.get(deptKey);
    const prev = existingByDept.get(deptKey);
    if (mod) {
      out.push({
        ...mod,
        auditRows: pickNonEmptyRows(mod.auditRows, prev?.auditRows),
        sopRows: pickNonEmptyRows(mod.sopRows, prev?.sopRows),
        executiveSummary: mod.executiveSummary || prev?.executiveSummary || null,
        areaAudit:
          String(prev?.areaAudit || "").trim() && prev.areaAudit !== mod.areaAudit
            ? prev.areaAudit
            : mod.areaAudit,
      });
      continue;
    }
    if (prev && ((prev.auditRows?.length || 0) > 0 || (prev.sopRows?.length || 0) > 0)) {
      out.push(prev);
    }
  }
  return out.length > 0 ? out : moduleSections;
}

export function mergeFindingSectionsPreserveModuleData(existingSections = [], incomingSections = []) {
  return mergeModuleSectionsForHub(existingSections, incomingSections);
}

/** Dept locked/published tetapi tidak punya baris sama sekali — data korup di hub. */
export function findingSectionsLookCorrupted(sections = [], lockedByDept = {}) {
  if (!Array.isArray(sections)) return true;
  return sections.some((s) => {
    const locked =
      lockedByDept[s.deptKey] === true || s.isPublishedToReport === true;
    if (!locked) return false;
    const hasRows =
      (s.auditRows?.length || 0) > 0 ||
      (s.sopRows?.length || 0) > 0 ||
      Boolean(s.executiveSummary);
    return !hasRows;
  });
}

function sopRowsDigest(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  return rows
    .map(
      (r) =>
        `${r.no}|${r.sopRelated}|${r.reviewComment}|${r.auditeeComment}|${r.followUpDetail}|${r.status}`,
    )
    .join(";");
}

function htmlDigest(html) {
  return crypto
    .createHash("sha256")
    .update(String(html || "").trim())
    .digest("hex")
    .slice(0, 8);
}

/** Hash cover block (audit team, signatures, appendices) — detect stale OnlyOffice after reset. */
export function computeCoverSnapshotHash(cover = {}) {
  const payload = {
    auditTeam: (cover.auditTeam || []).map((m) => ({
      n: String(m?.name ?? "").trim(),
      r: String(m?.role ?? "").trim(),
    })),
    preparedBy: (cover.preparedBy || []).map((m) => ({
      n: String(m?.name ?? "").trim(),
      r: String(m?.role ?? "").trim(),
      d: String(m?.date ?? "").trim(),
    })),
    auditCommitteeName: String(cover.auditCommitteeName ?? "").trim(),
    auditCommitteeDate: String(cover.auditCommitteeDate ?? "").trim(),
    presidentDirectorName: String(cover.presidentDirectorName ?? "").trim(),
    presidentDirectorDate: String(cover.presidentDirectorDate ?? "").trim(),
    appendices: (cover.appendices || []).map((a) => ({
      t: String(a?.title ?? "").trim(),
      b: htmlDigest(a?.bodyHtml || a?.content || ""),
    })),
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

/** Hash of preview content — regenerate OnlyOffice DOCX when module, narrative, or cover changes. */
export function computePreviewSnapshotHash(
  auditVisibleByDept = {},
  findingSections = [],
  narrative = {},
) {
  const payload = {
    visibility: auditVisibleByDept,
    cover: computeCoverSnapshotHash(narrative),
    exec: htmlDigest(narrative.executiveSummaryHtml),
    objectives: htmlDigest(narrative.auditObjectivesScopeHtml),
    approach: htmlDigest(narrative.auditApproachMethodologyHtml),
    conclusions: narrative.conclusionValues || {},
    depts: (findingSections || []).map((s) => ({
      k: s.deptKey,
      sopN: (s.sopRows || []).length,
      sopD: sopRowsDigest(s.sopRows),
      audit: (s.auditRows || []).length,
      exec: s.executiveSummary ? 1 : 0,
    })),
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}
