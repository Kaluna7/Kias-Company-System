/**
 * In-process pub/sub: SOP Review publish/edit → report HTML preview (SSE).
 */

import { broadcastPreviewRealtime } from "@/app/lib/report/previewRealtimeHub";

const CHANNEL = "sop-review-data";

if (!global._sopReviewDataHub) {
  global._sopReviewDataHub = {
    streams: new Map(),
    nextId: 1,
  };
}

const hub = global._sopReviewDataHub;

/**
 * @param {{ year?: number, deptKey?: string, apiPath?: string, action?: string }} payload
 */
export function broadcastSopReviewDataChange(payload) {
  const event = {
    type: CHANNEL,
    year: Number(payload.year) || null,
    deptKey: payload.deptKey ? String(payload.deptKey) : "",
    apiPath: payload.apiPath ? String(payload.apiPath) : null,
    action: payload.action ? String(payload.action) : "update",
    ts: Date.now(),
  };

  const line = `data: ${JSON.stringify(event)}\n\n`;
  const y = event.year || 0;
  const globalSet = hub.streams.get(0) || new Set();
  const yearSet = hub.streams.get(y) || new Set();

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

export function subscribeSopReviewDataStream(year, send) {
  const y = Number(year) || 0;
  if (!hub.streams.has(y)) hub.streams.set(y, new Set());
  const sub = { send, id: hub.nextId++ };
  hub.streams.get(y).add(sub);
  return () => hub.streams.get(y)?.delete(sub);
}
