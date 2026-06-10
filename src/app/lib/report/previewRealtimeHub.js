/**
 * In-process pub/sub for HTML Preview WebSocket clients (single Node process).
 */

if (!global._previewRealtimeHub) {
  global._previewRealtimeHub = {
    /** @type {Map<number, Set<PreviewWsClient>>} */
    clients: new Map(),
    nextId: 1,
  };
}

if (!global._onlyOfficeSessionByYear) {
  /** @type {Map<number, { sessionId: string, editorPath: string, openedAt: number }>} */
  global._onlyOfficeSessionByYear = new Map();
}

const hub = global._previewRealtimeHub;
const onlyOfficeSessions = global._onlyOfficeSessionByYear;

const WS_OPEN = 1;
const ONLYOFFICE_OPEN_GRACE_MS = 120_000;

/**
 * @typedef {object} PreviewWsClient
 * @property {import('ws').WebSocket} ws
 * @property {number} year
 * @property {number} id
 * @property {string|null} tabClientId
 * @property {string} userId
 * @property {string} name
 * @property {string} email
 * @property {string} image
 * @property {'preview'|'onlyoffice'} location
 */

/**
 * @param {number} year
 * @param {import('ws').WebSocket | null | undefined} exceptWs
 * @param {object} event
 * @param {{ previewOnly?: boolean }} [options]
 */
export function relayToYearPeers(year, exceptWs, event, options = {}) {
  const y = Number(year) || 0;
  if (y <= 0) return;

  const payload = { ...event, year: y, ts: event.ts || Date.now() };
  const msg = JSON.stringify(payload);

  for (const client of hub.clients.get(y) || []) {
    if (exceptWs && client.ws === exceptWs) continue;
    if (options.previewOnly && client.location !== "preview") continue;
    if (options.onlyOfficeOnly && client.location !== "onlyoffice") continue;
    if (client.ws.readyState !== WS_OPEN) {
      hub.clients.get(y)?.delete(client);
      continue;
    }
    try {
      client.ws.send(msg);
    } catch {
      hub.clients.get(y)?.delete(client);
    }
  }
}

/**
 * @param {object} event
 */
export function broadcastPreviewRealtime(event) {
  const payload = { ...event, ts: event.ts || Date.now() };
  const msg = JSON.stringify(payload);
  const year =
    Number(payload.year) ||
    Number(payload.reportYear) ||
    0;

  const targets = new Set();
  for (const c of hub.clients.get(0) || []) targets.add(c);
  if (year > 0) {
    for (const c of hub.clients.get(year) || []) targets.add(c);
  }

  for (const client of targets) {
    if (client.ws.readyState !== WS_OPEN) {
      hub.clients.get(client.year)?.delete(client);
      continue;
    }
    try {
      client.ws.send(msg);
    } catch {
      hub.clients.get(client.year)?.delete(client);
    }
  }
}

/**
 * @param {number} year
 * @returns {object[]}
 */
export function getPresenceForYear(year) {
  return buildPresenceList(year);
}

/** @param {number} year */
export function hasOnlyOfficeParticipants(year) {
  return buildPresenceList(year).some((p) => p.location === "onlyoffice");
}

/**
 * @param {number} year
 * @param {{ sessionId?: string, editorPath?: string }} data
 */
export function markOnlyOfficeSessionOpen(year, data = {}) {
  const y = Number(year) || 0;
  if (y <= 0) return;
  const sessionId = data.sessionId ? String(data.sessionId) : `shared-report-${y}`;
  const editorPath =
    data.editorPath ||
    `/Page/report/editor?session=${encodeURIComponent(sessionId)}`;
  onlyOfficeSessions.set(y, {
    sessionId,
    editorPath,
    openedAt: Date.now(),
  });
}

/** @param {number} year */
export function getOnlyOfficeSessionForYear(year) {
  const y = Number(year) || 0;
  return onlyOfficeSessions.get(y) || null;
}

/** @param {number} year */
export function isOnlyOfficeSessionRecentlyOpened(year) {
  const entry = getOnlyOfficeSessionForYear(year);
  if (!entry) return false;
  return Date.now() - entry.openedAt < ONLYOFFICE_OPEN_GRACE_MS;
}

/** @param {number} year */
export function clearOnlyOfficeSessionIfEmpty(year) {
  const y = Number(year) || 0;
  if (y <= 0) return;
  if (!hasOnlyOfficeParticipants(y)) {
    onlyOfficeSessions.delete(y);
  }
}

/** @param {number} year */
export function clearOnlyOfficeSessionForYear(year) {
  const y = Number(year) || 0;
  if (y <= 0) return;
  onlyOfficeSessions.delete(y);
}

/** Open Report joins OnlyOffice only when someone is live in the editor right now. */
export function isOnlyOfficeActiveForOpenReport(year) {
  return hasOnlyOfficeParticipants(year);
}

/**
 * @param {number} year
 * @param {object} payload
 */
/**
 * Tell open OnlyOffice tabs to refreshFile after server-side DOCX regen (same document.key).
 * @param {number} year
 * @param {string} sessionId
 */
export function broadcastOnlyOfficeDocxRefresh(year, sessionId) {
  const y = Number(year) || 0;
  if (y <= 0 || !sessionId) return;
  relayToYearPeers(
    y,
    null,
    {
      type: "onlyoffice-docx-refresh",
      sessionId: String(sessionId),
    },
    { onlyOfficeOnly: true },
  );
}

/**
 * Push HTML preview state to all tabs for a report year (server → WebSocket clients).
 * @param {number} year
 * @param {object} state
 * @param {{ senderClientId?: string, previewSyncRevision?: number }} [meta]
 */
export function broadcastPreviewStatePush(year, state, meta = {}) {
  const y = Number(year) || 0;
  if (y <= 0 || !state || typeof state !== "object") return;

  relayToYearPeers(y, null, {
    type: "preview-state-push",
    state,
    senderClientId: meta.senderClientId || "server",
    previewSyncRevision: Number(meta.previewSyncRevision) || Number(state.previewSyncRevision) || 0,
    ts: Date.now(),
  });
}

export function broadcastOnlyOfficeSessionOpened(year, payload = {}) {
  const y = Number(year) || 0;
  if (y <= 0) return;

  const sessionId = payload.sessionId
    ? String(payload.sessionId)
    : `shared-report-${y}`;
  const editorPath =
    payload.editorPath ||
    `/Page/report/editor?session=${encodeURIComponent(sessionId)}`;

  markOnlyOfficeSessionOpen(y, { sessionId, editorPath });

  const redirectEvent = {
    type: "onlyoffice-redirect",
    sessionId,
    editorPath,
    senderClientId: payload.initiatorClientId || null,
  };
  relayToYearPeers(y, null, redirectEvent);
  relayToYearPeers(y, null, {
    type: "onlyoffice-session-opened",
    sessionId,
    editorPath,
    initiatorClientId: payload.initiatorClientId || null,
  });

  broadcastPresenceForYear(y);
}

/** @param {number} year */
function pruneDeadClients(year) {
  const y = Number(year) || 0;
  const set = hub.clients.get(y);
  if (!set) return;
  for (const client of set) {
    if (client.ws.readyState !== WS_OPEN) {
      set.delete(client);
    }
  }
}

/**
 * One browser tab may reconnect — drop older sockets for the same tab id.
 * @param {number} year
 * @param {string} tabClientId
 * @param {import('ws').WebSocket} keepWs
 */
function evictDuplicateTabClients(year, tabClientId, keepWs) {
  const tabId = String(tabClientId || "").trim();
  if (!tabId) return;
  const y = Number(year) || 0;
  const set = hub.clients.get(y);
  if (!set) return;

  for (const client of set) {
    if (client.tabClientId === tabId && client.ws !== keepWs) {
      set.delete(client);
      try {
        client.ws.close();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * @param {number} year
 * @returns {object[]}
 */
function buildPresenceList(year) {
  const y = Number(year) || 0;
  pruneDeadClients(y);

  /** @type {Map<string, object>} */
  const byUser = new Map();

  for (const client of hub.clients.get(y) || []) {
    const emailKey = String(client.email || "").trim().toLowerCase();
    const userKey =
      emailKey ||
      String(client.userId || "").trim() ||
      String(client.tabClientId || "").trim() ||
      `conn-${client.id}`;

    const entry = {
      clientId: client.tabClientId || `srv-${client.id}`,
      userId: client.userId || "",
      name: client.name || "User",
      email: client.email || "",
      image: client.image || "",
      location:
        client.location === "onlyoffice"
          ? "onlyoffice"
          : client.location === "report"
            ? "report"
            : "preview",
    };

    const existing = byUser.get(userKey);
    if (!existing) {
      byUser.set(userKey, entry);
      continue;
    }
    if (entry.location === "onlyoffice" && existing.location !== "onlyoffice") {
      byUser.set(userKey, entry);
    }
  }

  return Array.from(byUser.values());
}

/** @param {number} year */
export function broadcastPresenceForYear(year) {
  const y = Number(year) || 0;
  if (y <= 0) return;
  broadcastPreviewRealtime({
    type: "presence-update",
    year: y,
    participants: buildPresenceList(y),
  });
}

/**
 * @param {number} year
 * @param {PreviewWsClient} client
 * @param {object} data
 */
export function handlePreviewWsMessage(year, client, data) {
  if (!client || !data || typeof data !== "object") return;

  if (data.type === "presence-leave") {
    const tabId = String(data.clientId || client.tabClientId || "").trim();
    if (tabId) {
      for (const peer of hub.clients.get(year) || []) {
        if (peer.tabClientId === tabId) {
          hub.clients.get(year)?.delete(peer);
          try {
            if (peer.ws !== client.ws) peer.ws.close();
          } catch {
            /* ignore */
          }
        }
      }
    } else {
      hub.clients.get(year)?.delete(client);
    }
    clearOnlyOfficeSessionIfEmpty(year);
    broadcastPresenceForYear(year);
    return;
  }

  if (
    data.type === "presence-join" ||
    data.type === "presence-update" ||
    data.type === "presence-heartbeat"
  ) {
    if (data.clientId) {
      client.tabClientId = String(data.clientId);
      evictDuplicateTabClients(year, client.tabClientId, client.ws);
    }
    const loc = String(data.location || "preview");
    client.location =
      loc === "onlyoffice" ? "onlyoffice" : loc === "report" ? "report" : "preview";
    if (data.user && typeof data.user === "object") {
      if (data.user.id) client.userId = String(data.user.id);
      if (data.user.name) client.name = String(data.user.name);
      if (data.user.email) client.email = String(data.user.email);
      if (data.user.image) client.image = String(data.user.image);
    }
    if (client.location === "onlyoffice") {
      markOnlyOfficeSessionOpen(year, {
        sessionId: data.sessionId || `shared-report-${year}`,
        editorPath: data.editorPath || undefined,
      });
    }
    broadcastPresenceForYear(year);
    return;
  }

  if (data.type === "preview-state-push" && data.state) {
    if (data.clientId) client.tabClientId = String(data.clientId);
    relayToYearPeers(year, client.ws, {
      type: "preview-state-push",
      state: data.state,
      senderClientId: data.clientId || client.tabClientId,
      previewSyncRevision:
        Number(data.previewSyncRevision) ||
        Number(data.state?.previewSyncRevision) ||
        0,
    });
    return;
  }

  if (data.type === "onlyoffice-creating") {
    if (data.clientId) client.tabClientId = String(data.clientId);
    relayToYearPeers(
      year,
      client.ws,
      {
        type: "onlyoffice-creating",
        senderClientId: data.clientId || client.tabClientId,
        openedByName: data.openedByName || client.name || "A teammate",
      },
      { previewOnly: true },
    );
    return;
  }

  if (data.type === "onlyoffice-redirect" && data.editorPath) {
    if (data.clientId) client.tabClientId = String(data.clientId);
    client.location = "onlyoffice";
    markOnlyOfficeSessionOpen(year, {
      sessionId: data.sessionId,
      editorPath: data.editorPath,
    });
    relayToYearPeers(year, client.ws, {
      type: "onlyoffice-redirect",
      sessionId: data.sessionId,
      editorPath: data.editorPath,
      senderClientId: data.clientId || client.tabClientId,
    });
    broadcastPresenceForYear(year);
  }
}

/**
 * @param {number} year
 * @param {import('ws').WebSocket} ws
 * @param {object} [tokenUser]
 */
export function registerPreviewWsClient(year, ws, tokenUser = {}) {
  const y = Number(year) || 0;
  if (!hub.clients.has(y)) hub.clients.set(y, new Set());

  /** @type {PreviewWsClient} */
  const client = {
    ws,
    year: y,
    id: hub.nextId++,
    tabClientId: null,
    userId: String(tokenUser.id || tokenUser.sub || tokenUser.email || ""),
    name: String(tokenUser.name || tokenUser.email || "User"),
    email: String(tokenUser.email || ""),
    image: String(tokenUser.picture || tokenUser.image || ""),
    location: "preview",
  };

  hub.clients.get(y).add(client);

  try {
    ws.send(JSON.stringify({ type: "connected", year: y, ts: Date.now() }));
    ws.send(
      JSON.stringify({
        type: "presence-update",
        year: y,
        participants: buildPresenceList(y),
        ts: Date.now(),
      }),
    );
  } catch {
    /* ignore */
  }

  broadcastPresenceForYear(y);

  const unregister = () => {
    hub.clients.get(y)?.delete(client);
    clearOnlyOfficeSessionIfEmpty(y);
    broadcastPresenceForYear(y);
  };

  return { unregister, client };
}
