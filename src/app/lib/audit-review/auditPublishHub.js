/**
 * In-process pub/sub for audit-review lock/unlock → report preview (SSE subscribers).
 * Works with a single Node process (pnpm dev / next start in Docker).
 */

import { broadcastPreviewRealtime } from "@/app/lib/report/previewRealtimeHub";

const CHANNEL = "audit-review-publish";

if (!global._auditPublishHub) {
  global._auditPublishHub = {
    /** @type {Map<number, Set<{send: (chunk: string) => void, id: number}>>} */
    streams: new Map(),
    nextId: 1,
  };
}

const hub = global._auditPublishHub;

/**
 * @param {object} payload
 * @param {number} payload.year
 * @param {string} payload.deptKey
 * @param {string} [payload.apiPath]
 * @param {boolean} payload.isLocked
 */
export function broadcastAuditPublishChange(payload) {
  const event = {
    type: CHANNEL,
    year: Number(payload.year) || new Date().getFullYear(),
    reportYear: Number(payload.reportYear) || Number(payload.year) || null,
    auditYear: Number(payload.auditYear) || null,
    deptKey: String(payload.deptKey || ""),
    apiPath: payload.apiPath ? String(payload.apiPath) : null,
    isLocked: payload.isLocked === true,
    ts: Date.now(),
  };

  const line = `data: ${JSON.stringify(event)}\n\n`;
  const year = event.year;
  const globalSet = hub.streams.get(0) || new Set();
  const yearSet = hub.streams.get(year) || new Set();

  for (const sub of [...globalSet, ...yearSet]) {
    try {
      sub.send(line);
    } catch {
      globalSet.delete(sub);
      yearSet.delete(sub);
    }
  }

  broadcastPreviewRealtime(event);
}

/**
 * Subscribe to publish events for a report year (0 = all years).
 * @param {number} year
 * @param {(chunk: string) => void} send
 */
export function subscribeAuditPublishStream(year, send) {
  const y = Number(year) || 0;
  if (!hub.streams.has(y)) hub.streams.set(y, new Set());
  const sub = { send, id: hub.nextId++ };
  hub.streams.get(y).add(sub);

  return () => {
    hub.streams.get(y)?.delete(sub);
  };
}
