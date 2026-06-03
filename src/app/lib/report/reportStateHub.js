/**
 * In-process pub/sub: OnlyOffice save → HTML preview DB updated → all preview tabs reload.
 */

const CHANNEL = "report-state-changed";

if (!global._reportStateHub) {
  global._reportStateHub = {
    /** @type {Map<number, Set<{send: (chunk: string) => void, id: number}>>} */
    streams: new Map(),
    nextId: 1,
  };
}

const hub = global._reportStateHub;

/**
 * @param {{ year: number, revision?: number, sessionId?: string, source?: string }} payload
 */
export function broadcastReportStateChange(payload) {
  const event = {
    type: CHANNEL,
    year: Number(payload.year) || new Date().getFullYear(),
    revision: Number(payload.revision) || 0,
    sessionId: payload.sessionId ? String(payload.sessionId) : null,
    source: payload.source ? String(payload.source) : "onlyoffice",
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
}

/** @param {number} year @param {(chunk: string) => void} send */
export function subscribeReportStateStream(year, send) {
  const y = Number(year) || 0;
  if (!hub.streams.has(y)) hub.streams.set(y, new Set());
  const sub = { send, id: hub.nextId++ };
  hub.streams.get(y).add(sub);
  return () => hub.streams.get(y)?.delete(sub);
}
