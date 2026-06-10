"use client";

/** @typedef {'connecting' | 'connected' | 'disconnected'} PreviewWsStatus */

export const PREVIEW_WS_EVENTS = {
  STATE_PUSH: "preview-state-push",
  ONLYOFFICE_CREATING: "onlyoffice-creating",
  ONLYOFFICE_REDIRECT: "onlyoffice-redirect",
  ONLYOFFICE_DOCX_REFRESH: "onlyoffice-docx-refresh",
  PRESENCE: "presence-update",
  REPORT_STATE: "report-state-changed",
};

const pools = new Map();

/** @type {Map<number, { token: string, fetchedAt: number }>} */
const ticketCache = new Map();

async function fetchPreviewWsTicket(year) {
  const y = Number(year);
  const cached = ticketCache.get(y);
  if (cached && Date.now() - cached.fetchedAt < 4 * 60 * 1000) {
    return cached.token;
  }

  const res = await fetch("/api/report/preview-ws-token", {
    credentials: "include",
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.token) {
    ticketCache.delete(y);
    return null;
  }
  ticketCache.set(y, { token: json.token, fetchedAt: Date.now() });
  return json.token;
}

class PreviewWsPool {
  /** @param {number} year */
  constructor(year) {
    this.year = year;
    /** @type {Set<(data: object) => void>} */
    this.listeners = new Set();
    /** @type {Set<(status: PreviewWsStatus) => void>} */
    this.statusListeners = new Set();
    /** @type {WebSocket | null} */
    this.ws = null;
    /** @type {PreviewWsStatus} */
    this.status = "disconnected";
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.reconnectTimer = null;
    this.intentionalClose = false;
    /** @type {object | null} */
    this.lastPresenceMessage = null;
    this.connectInFlight = false;
    /** @type {object[]} */
    this.pendingMessages = [];
  }

  setStatus(next) {
    if (this.status === next) return;
    this.status = next;
    for (const fn of this.statusListeners) {
      try {
        fn(next);
      } catch {
        /* ignore */
      }
    }
  }

  flushPending() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const queue = this.pendingMessages.splice(0);
    for (const data of queue) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch {
        this.pendingMessages.unshift(data);
        break;
      }
    }
  }

  async connect() {
    if (typeof window === "undefined") return;
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING ||
      this.connectInFlight
    ) {
      return;
    }

    this.connectInFlight = true;
    this.setStatus("connecting");

    try {
      const ticket = await fetchPreviewWsTicket(this.year);
      if (!ticket) {
        this.setStatus("disconnected");
        this.scheduleReconnect();
        return;
      }

      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url =
        `${proto}//${window.location.host}/api/report/preview-ws` +
        `?year=${encodeURIComponent(String(this.year))}` +
        `&token=${encodeURIComponent(ticket)}`;

      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectDelay = 1000;
        this.setStatus("connected");
        if (this.lastPresenceMessage) {
          this.send(this.lastPresenceMessage);
        }
        this.flushPending();
      };

      ws.onmessage = (ev) => {
        if (!ev?.data) return;
        try {
          const data = JSON.parse(String(ev.data));
          if (data.type === "connected") return;
          for (const fn of this.listeners) {
            try {
              fn(data);
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = (ev) => {
        this.ws = null;
        this.setStatus("disconnected");
        ticketCache.delete(this.year);
        if (process.env.NODE_ENV === "development") {
          console.warn("[preview-ws] closed", ev.code, ev.reason || "");
        }
        if (!this.intentionalClose) this.scheduleReconnect();
      };

      ws.onerror = () => {
        ticketCache.delete(this.year);
      };
    } finally {
      this.connectInFlight = false;
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.intentionalClose) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(
        Math.round(this.reconnectDelay * 1.5),
        this.maxReconnectDelay,
      );
      void this.connect();
    }, this.reconnectDelay);
  }

  disposeIfIdle() {
    if (this.listeners.size > 0 || this.statusListeners.size > 0) return;
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    pools.delete(this.year);
  }

  /** @param {(data: object) => void} fn */
  subscribe(fn) {
    this.listeners.add(fn);
    this.intentionalClose = false;
    void this.connect();
    return () => {
      this.listeners.delete(fn);
      this.disposeIfIdle();
    };
  }

  /** @param {(status: PreviewWsStatus) => void} fn */
  onStatus(fn) {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => {
      this.statusListeners.delete(fn);
      this.disposeIfIdle();
    };
  }

  /** @param {object} data */
  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
        return true;
      } catch {
        /* fall through to queue */
      }
    }
    this.pendingMessages.push(data);
    void this.connect();
    return false;
  }
}

function getPool(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;
  if (!pools.has(y)) pools.set(y, new PreviewWsPool(y));
  return pools.get(y);
}

/**
 * Unique per browser tab. Do not use sessionStorage — it is shared across tabs
 * on the same origin and caused duplicate tab eviction / missing collaborators.
 */
export function getPreviewTabClientId() {
  if (typeof window === "undefined") return "server";
  if (!window.__kiasPreviewTabId) {
    window.__kiasPreviewTabId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return window.__kiasPreviewTabId;
}

/** @param {number} year @param {(data: object) => void} onEvent */
export function subscribePreviewWebSocket(year, onEvent) {
  const pool = getPool(year);
  if (!pool) return () => {};
  return pool.subscribe(onEvent);
}

/** @param {number} year @param {(status: PreviewWsStatus) => void} onStatus */
export function subscribePreviewWebSocketStatus(year, onStatus) {
  const pool = getPool(year);
  if (!pool) return () => {};
  return pool.onStatus(onStatus);
}

/** @param {number} year @param {object} data */
export function sendPreviewWebSocketMessage(year, data) {
  const pool = getPool(year);
  if (!pool) return false;
  return pool.send(data);
}

/**
 * Push preview state to peers via WebSocket (server relays, no HTTP).
 * @param {number} year
 * @param {{ clientId?: string, state: object }} payload
 */
export function pushPreviewStateToPeers(year, payload) {
  return sendPreviewWebSocketMessage(year, {
    type: PREVIEW_WS_EVENTS.STATE_PUSH,
    clientId: payload.clientId || getPreviewTabClientId(),
    state: payload.state,
  });
}

/**
 * Tell preview peers that Word creation from HTML Preview has started.
 * @param {number} year
 * @param {{ clientId?: string, openedByName?: string }} payload
 */
export function pushOnlyOfficeCreatingToPeers(year, payload) {
  return sendPreviewWebSocketMessage(year, {
    type: PREVIEW_WS_EVENTS.ONLYOFFICE_CREATING,
    clientId: payload.clientId || getPreviewTabClientId(),
    openedByName: payload.openedByName || null,
  });
}

/**
 * Tell all HTML preview tabs to open OnlyOffice.
 * @param {number} year
 * @param {{ clientId?: string, editorPath: string, sessionId?: string }} payload
 */
export function pushOnlyOfficeRedirectToPeers(year, payload) {
  return sendPreviewWebSocketMessage(year, {
    type: PREVIEW_WS_EVENTS.ONLYOFFICE_REDIRECT,
    clientId: payload.clientId || getPreviewTabClientId(),
    editorPath: payload.editorPath,
    sessionId: payload.sessionId || null,
  });
}

/**
 * @param {number} year
 * @param {{ location?: 'preview'|'onlyoffice', user?: object, sessionId?: string, editorPath?: string }} payload
 */
export function announcePreviewPresence(year, payload = {}) {
  const pool = getPool(year);
  if (!pool) return "";

  const clientId = getPreviewTabClientId();
  const loc = String(payload.location || "preview");
  const message = {
    type: "presence-join",
    clientId,
    location:
      loc === "onlyoffice" ? "onlyoffice" : loc === "report" ? "report" : "preview",
    user: payload.user || {},
    sessionId: payload.sessionId || null,
    editorPath: payload.editorPath || null,
  };

  pool.lastPresenceMessage = message;
  pool.send(message);

  if (pool.status !== "connected") {
    const unsub = pool.onStatus((status) => {
      if (status === "connected") {
        pool.send(message);
        unsub();
      }
    });
    void pool.connect();
  }

  return clientId;
}

/** @param {number} year */
export function ensurePreviewWebSocketConnected(year) {
  const pool = getPool(year);
  if (!pool) return;
  void pool.connect();
}

/** Tell server this tab left preview/OnlyOffice and close the WS connection. */
export function leavePreviewPresence(year) {
  const pool = getPool(year);
  if (!pool) return;

  pool.send({
    type: "presence-leave",
    clientId: getPreviewTabClientId(),
  });
  pool.lastPresenceMessage = null;

  if (pool.listeners.size > 0 || pool.statusListeners.size > 0) {
    return;
  }

  pool.intentionalClose = true;

  if (pool.reconnectTimer) {
    clearTimeout(pool.reconnectTimer);
    pool.reconnectTimer = null;
  }

  try {
    pool.ws?.close();
  } catch {
    /* ignore */
  }
  pool.ws = null;
  pool.setStatus("disconnected");
  pool.disposeIfIdle();
}
