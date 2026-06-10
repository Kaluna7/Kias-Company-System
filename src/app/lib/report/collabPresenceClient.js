"use client";

import { getPreviewTabClientId } from "./previewWebSocketClient";

import { participantsEqual } from "./collabPresenceUtils";

const HEARTBEAT_MS = 8000;
const POLL_MS = 12000;

/**
 * @param {number} year
 * @param {object} payload
 */
export async function sendCollabHeartbeat(year, payload = {}) {
  const tabId = payload.tabId || getPreviewTabClientId();
  const res = await fetch("/api/report/collaboration/heartbeat", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      year: Number(year),
      tabId,
      location: payload.location || "preview",
      user: payload.user || undefined,
      sessionId: payload.sessionId || null,
      editorPath: payload.editorPath || null,
      leave: payload.leave === true,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    return { ok: false, participants: [] };
  }
  return {
    ok: true,
    participants: Array.isArray(json.participants) ? json.participants : [],
  };
}

/**
 * @param {number} year
 */
export async function fetchCollabPresence(year) {
  const res = await fetch(
    `/api/report/collaboration/presence?year=${encodeURIComponent(String(year))}`,
    { credentials: "include", cache: "no-store" },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    return { ok: false, participants: [], onlyOfficeOpen: false, editorPath: null };
  }
  return {
    ok: true,
    participants: Array.isArray(json.participants) ? json.participants : [],
    onlyOfficeOpen: json.onlyOfficeOpen === true,
    onlyOfficeLive: json.onlyOfficeLive === true,
    onlyOfficeTeammateLive: json.onlyOfficeTeammateLive === true,
    editorPath: json.editorPath || null,
  };
}

/**
 * HTTP presence loop — works even when in-memory WS hub is unavailable.
 * @param {number} year
 * @param {object} options
 */
export function startCollabPresenceLoop(year, options = {}) {
  if (!Number.isFinite(year)) return () => {};

  const tabId = getPreviewTabClientId();
  let stopped = false;
  let lastParticipants = [];

  const resolveUser = () => {
    if (typeof options.getUser === "function") return options.getUser();
    return options.user;
  };

  const sendHeartbeat = async (extra = {}) => {
    if (stopped) return;
    try {
      const result = await sendCollabHeartbeat(year, {
        tabId,
        location: options.location || "preview",
        user: resolveUser(),
        sessionId: options.sessionId || null,
        editorPath: options.editorPath || null,
        ...extra,
      });
      if (result.ok) {
        options.onConnected?.();
        if (
          typeof options.onParticipants === "function" &&
          !participantsEqual(lastParticipants, result.participants)
        ) {
          lastParticipants = result.participants;
          options.onParticipants(result.participants);
        }
      }
    } catch {
      /* ignore */
    }
  };

  const pollPresence = async () => {
    if (stopped) return;
    try {
      const result = await fetchCollabPresence(year);
      if (!result.ok) return;
      options.onConnected?.();
      if (
        typeof options.onParticipants === "function" &&
        !participantsEqual(lastParticipants, result.participants)
      ) {
        lastParticipants = result.participants;
        options.onParticipants(result.participants);
      }
      if (typeof options.onOnlyOfficeLive === "function") {
        options.onOnlyOfficeLive({
          onlyOfficeLive: result.onlyOfficeLive,
          onlyOfficeTeammateLive: result.onlyOfficeTeammateLive,
          editorPath: result.editorPath,
        });
      }
    } catch {
      /* ignore */
    }
  };

  void sendHeartbeat();
  void pollPresence();

  const heartbeatTimer = window.setInterval(() => {
    void sendHeartbeat();
  }, HEARTBEAT_MS);

  const pollTimer = window.setInterval(() => {
    void pollPresence();
  }, POLL_MS);

  const onPageHide = () => {
    void sendCollabHeartbeat(year, { tabId, location: options.location, leave: true });
  };
  window.addEventListener("pagehide", onPageHide);

  return () => {
    stopped = true;
    window.clearInterval(heartbeatTimer);
    window.clearInterval(pollTimer);
    window.removeEventListener("pagehide", onPageHide);
    void sendCollabHeartbeat(year, { tabId, location: options.location, leave: true });
  };
}
