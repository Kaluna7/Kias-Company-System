/**
 * System block = data modul (patch/hapus/sisip saat SOP atau lock/unlock).
 * User block = narasi OnlyOffice (tidak dihapus saat modul berubah).
 *
 * Registry lengkap: `reportSections.js`
 *
 * SYSTEM (findings_module_tables):
 * - `sys:finding:{dept}:sop`          → SOP Review (selalu)
 * - `sys:finding:{dept}:audit`        → Audit findings (lock)
 * - `sys:finding:{dept}:exec-summary` → Executive summary dept (lock)
 *
 * USER: `user:narrative:*`, `user:conclusion:*`, `user:appendix:*`, `user:note:*`
 */

import crypto from "crypto";
import { buildEffectivePublishMap } from "./previewAuditVisibility";

export const BLOCK_KIND = {
  SYSTEM: "system",
  USER: "user",
};

const USER_NARRATIVE = {
  FRONT_MATTER: "user:front-matter:pages",
  EXECUTIVE_SUMMARY: "user:narrative:executive-summary",
  AUDIT_OBJECTIVES: "user:narrative:audit-objectives",
  AUDIT_APPROACH: "user:narrative:audit-approach",
};

export function systemFindingExecBlockId(deptKey) {
  return `sys:finding:${deptKey}:exec-summary`;
}

export function systemFindingSopBlockId(deptKey) {
  return `sys:finding:${deptKey}:sop`;
}

export function systemFindingAuditBlockId(deptKey) {
  return `sys:finding:${deptKey}:audit`;
}

export function userConclusionBlockId(deptKey) {
  return `user:conclusion:${deptKey}`;
}

export function userAppendixBlockId(appendixId) {
  return `user:appendix:${appendixId}`;
}

export function userNoteBlockId(noteId) {
  return `user:note:${noteId}`;
}

/** Word bookmark name (no colons). */
export function toBookmarkName(blockId) {
  return `kias_${String(blockId).replace(/[^a-zA-Z0-9]+/g, "_")}`;
}

export function fromBookmarkName(name) {
  const raw = String(name || "").replace(/^kias_/, "");
  return raw.replace(/_finding_/g, ":finding:").replace(/_/g, ":");
}

function contentHash(data) {
  return crypto.createHash("sha256").update(JSON.stringify(data ?? "")).digest("hex").slice(0, 16);
}

/** User narrative blocks from hub state (tidak dihapus saat modul berubah). */
export function buildUserBlocksFromState(state = {}) {
  const blocks = [];

  if (String(state.executiveSummaryHtml || "").trim()) {
    blocks.push({
      id: USER_NARRATIVE.EXECUTIVE_SUMMARY,
      kind: BLOCK_KIND.USER,
      type: "narrative",
      html: state.executiveSummaryHtml,
    });
  }
  if (String(state.auditObjectivesScopeHtml || "").trim()) {
    blocks.push({
      id: USER_NARRATIVE.AUDIT_OBJECTIVES,
      kind: BLOCK_KIND.USER,
      type: "narrative",
      html: state.auditObjectivesScopeHtml,
    });
  }
  if (String(state.auditApproachMethodologyHtml || "").trim()) {
    blocks.push({
      id: USER_NARRATIVE.AUDIT_APPROACH,
      kind: BLOCK_KIND.USER,
      type: "narrative",
      html: state.auditApproachMethodologyHtml,
    });
  }

  const conclusions = state.conclusionValues && typeof state.conclusionValues === "object"
    ? state.conclusionValues
    : {};
  for (const [deptKey, text] of Object.entries(conclusions)) {
    if (!String(text ?? "").trim()) continue;
    blocks.push({
      id: userConclusionBlockId(deptKey),
      kind: BLOCK_KIND.USER,
      type: "conclusion",
      deptKey,
      html: String(text),
    });
  }

  const appendices = Array.isArray(state.appendices) ? state.appendices : [];
  for (const ap of appendices) {
    if (!ap?.id) continue;
    blocks.push({
      id: userAppendixBlockId(ap.id),
      kind: BLOCK_KIND.USER,
      type: "appendix",
      appendixId: ap.id,
      data: ap,
    });
  }

  const notes = Array.isArray(state.userNotes) ? state.userNotes : [];
  for (const note of notes) {
    if (!note?.id) continue;
    blocks.push({
      id: userNoteBlockId(note.id),
      kind: BLOCK_KIND.USER,
      type: "note",
      afterBlockId: note.afterBlockId || null,
      html: note.html || "",
    });
  }

  return blocks;
}

/**
 * System blocks Findings & Recommendations.
 * SOP: selalu ikut modul. Audit + exec summary: hanya saat dept locked/published.
 */
export function buildSystemBlocksFromSections(findingSections = [], auditVisibleByDept = {}) {
  const lockedByDept = {};
  for (const section of findingSections) {
    lockedByDept[section.deptKey] = section.isPublishedToReport === true;
  }
  const effective = buildEffectivePublishMap(
    lockedByDept,
    auditVisibleByDept,
    findingSections,
  );
  const blocks = [];

  for (const section of findingSections) {
    const deptKey = section.deptKey;
    const isPublished = effective[deptKey] === true;

    const sopRows = section.sopRows || [];
    if (sopRows.length > 0) {
      blocks.push({
        id: systemFindingSopBlockId(deptKey),
        kind: BLOCK_KIND.SYSTEM,
        type: "sop",
        deptKey,
        hash: contentHash(sopRows),
        rowCount: sopRows.length,
      });
    }

    if (!isPublished) continue;

    if (section.executiveSummary) {
      blocks.push({
        id: systemFindingExecBlockId(deptKey),
        kind: BLOCK_KIND.SYSTEM,
        type: "exec-summary",
        deptKey,
        hash: contentHash(section.executiveSummary),
      });
    }

    const auditRows = section.auditRows || [];
    if (auditRows.length > 0) {
      blocks.push({
        id: systemFindingAuditBlockId(deptKey),
        kind: BLOCK_KIND.SYSTEM,
        type: "audit",
        deptKey,
        hash: contentHash(auditRows),
        rowCount: auditRows.length,
      });
    }
  }

  return blocks;
}

/**
 * Gabungkan manifest: user blocks tetap, system blocks update/delete per modul.
 * @returns {{ reportBlocks: object, userNotes: array, deletedSystemIds: string[], updatedSystemIds: string[] }}
 */
export function syncSystemBlocksInHub(existingState = {}, findingSections = [], auditVisibleByDept = {}) {
  const prev = existingState.reportBlocks || { manifest: [], blocks: {} };
  const userNotes = Array.isArray(existingState.userNotes) ? [...existingState.userNotes] : [];

  const nextSystem = buildSystemBlocksFromSections(findingSections, auditVisibleByDept);
  const prevSystemIds = new Set(
    (prev.manifest || []).filter((id) => isSystemModuleTableBlockId(id)),
  );
  const nextSystemIds = new Set(nextSystem.map((b) => b.id));

  const deletedSystemIds = [...prevSystemIds].filter((id) => !nextSystemIds.has(id));
  const addedSystemIds = [...nextSystemIds].filter((id) => !prevSystemIds.has(id));
  const updatedSystemIds = nextSystem
    .filter((b) => {
      const old = prev.blocks?.[b.id];
      return old && old.hash !== b.hash;
    })
    .map((b) => b.id);

  const manifest = [...nextSystemIds];

  const blocks = {};
  for (const b of nextSystem) blocks[b.id] = b;

  return {
    reportBlocks: { manifest, blocks },
    userNotes,
    deletedSystemIds,
    addedSystemIds,
    updatedSystemIds,
    changedSystemIds: [...new Set([...deletedSystemIds, ...addedSystemIds, ...updatedSystemIds])],
  };
}

/** Block system di section Findings & Recommendations (data modul). */
export function isSystemModuleTableBlockId(blockId) {
  const id = String(blockId);
  return id.endsWith(":sop") || id.endsWith(":audit") || id.endsWith(":exec-summary");
}

/** @deprecated gunakan isSystemModuleTableBlockId */
export function isSystemBlockId(blockId) {
  return isSystemModuleTableBlockId(blockId);
}

/** Props untuk HTML preview wrapper. */
export function reportBlockHtmlProps(blockId, kind = null) {
  return {
    "data-report-block-id": blockId,
    "data-report-block-kind": kind || (isSystemBlockId(blockId) ? BLOCK_KIND.SYSTEM : BLOCK_KIND.USER),
  };
}

export { USER_NARRATIVE };
