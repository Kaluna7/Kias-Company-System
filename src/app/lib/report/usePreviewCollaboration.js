"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { startCollabPresenceLoop } from "./collabPresenceClient";
import {
  clearOnlyOfficeAutoJoinDismissed,
  isOnlyOfficeAutoJoinDismissed,
} from "./onlyOfficeAutoJoinDismiss";
import {
  announcePreviewPresence,
  ensurePreviewWebSocketConnected,
  getPreviewTabClientId,
  leavePreviewPresence,
  PREVIEW_WS_EVENTS,
  sendPreviewWebSocketMessage,
  subscribePreviewWebSocket,
  subscribePreviewWebSocketStatus,
} from "./previewWebSocketClient";

const HEARTBEAT_MS = 10000;

/**
 * Collaboration: PostgreSQL presence (HTTP) + WebSocket for instant redirect/state.
 */
export function usePreviewCollaboration(year, options = {}) {
  const { data: session, status } = useSession();
  const location =
    options.location === "onlyoffice"
      ? "onlyoffice"
      : options.location === "report"
        ? "report"
        : "preview";
  const [participants, setParticipants] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const participantsSigRef = useRef("");
  const liveLatchRef = useRef(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const clientIdRef = useRef(getPreviewTabClientId());
  const onStatePushRef = useRef(options.onPreviewStatePush);
  const onOnlyOfficeRedirectRef = useRef(options.onOnlyOfficeRedirect);
  onStatePushRef.current = options.onPreviewStatePush;
  onOnlyOfficeRedirectRef.current = options.onOnlyOfficeRedirect;

  useEffect(() => {
    clientIdRef.current = getPreviewTabClientId();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile", { credentials: "include", cache: "no-store" })
      .then((res) => res.json().catch(() => ({})))
      .then((json) => {
        if (cancelled || !json?.success) return;
        const url = json.user?.avatarUrl || "";
        if (url) setAvatarUrl(String(url));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.user?.email]);

  const buildUserPayload = useCallback(() => {
    const u = session?.user;
    if (!u) return null;
    return {
      id: String(u.id || u.email || ""),
      name: String(u.name || u.email || "User"),
      email: String(u.email || ""),
      image: String(avatarUrl || u.image || ""),
    };
  }, [session?.user, avatarUrl]);

  const userPayloadRef = useRef({
    id: "user",
    name: "User",
    email: "",
    image: "",
  });
  userPayloadRef.current =
    buildUserPayload() || {
      id: "user",
      name: "User",
      email: "",
      image: "",
    };

  const applyParticipants = useCallback((list) => {
    const next = Array.isArray(list) ? list : [];
    const sig = JSON.stringify(
      next.map((p) => ({
        id: p.userId || p.email || p.clientId,
        loc: p.location,
        name: p.name,
      })),
    );
    if (sig === participantsSigRef.current) return;
    participantsSigRef.current = sig;
    setParticipants(next);
  }, []);

  const markLive = useCallback(() => {
    if (liveLatchRef.current) return;
    liveLatchRef.current = true;
    setIsLive(true);
  }, []);

  useEffect(() => {
    if (!Number.isFinite(year) || status !== "authenticated") return undefined;

    const stopHttp = startCollabPresenceLoop(year, {
      location,
      getUser: () => userPayloadRef.current,
      sessionId: options.sessionId || null,
      editorPath: options.editorPath || null,
      onConnected: markLive,
      onParticipants: applyParticipants,
      onOnlyOfficeLive: ({ onlyOfficeTeammateLive, editorPath }) => {
        if (location === "onlyoffice" || !onlyOfficeTeammateLive || !editorPath) return;
        if (isOnlyOfficeAutoJoinDismissed(year)) return;
        onOnlyOfficeRedirectRef.current?.({ editorPath });
      },
    });

    ensurePreviewWebSocketConnected(year);

    const announce = () => {
      clientIdRef.current = announcePreviewPresence(year, {
        location,
        user: userPayloadRef.current,
        sessionId: options.sessionId || null,
        editorPath: options.editorPath || null,
      });
    };

    announce();

    const heartbeat = window.setInterval(() => {
      sendPreviewWebSocketMessage(year, {
        type: "presence-heartbeat",
        clientId: clientIdRef.current,
        location,
        user: userPayloadRef.current,
        sessionId: options.sessionId || null,
        editorPath: options.editorPath || null,
      });
    }, HEARTBEAT_MS);

    const unsubWs = subscribePreviewWebSocket(year, (data) => {
      const myId = clientIdRef.current;

      if (data.type === PREVIEW_WS_EVENTS.PRESENCE && Array.isArray(data.participants)) {
        applyParticipants(data.participants);
        markLive();
        return;
      }

      if (data.type === PREVIEW_WS_EVENTS.STATE_PUSH && data.state) {
        if (data.senderClientId && data.senderClientId === myId) return;
        onStatePushRef.current?.(data.state, data);
        return;
      }

      if (data.type === PREVIEW_WS_EVENTS.ONLYOFFICE_REDIRECT && data.editorPath) {
        const sender = data.senderClientId || data.clientId;
        if (sender && sender === myId) return;
        clearOnlyOfficeAutoJoinDismissed(year);
        onOnlyOfficeRedirectRef.current?.(data);
        return;
      }

      if (data.type === "onlyoffice-session-opened" && data.editorPath) {
        const sender = data.initiatorClientId || data.senderClientId || data.clientId;
        if (sender && sender === myId) return;
        clearOnlyOfficeAutoJoinDismissed(year);
        onOnlyOfficeRedirectRef.current?.({
          editorPath: data.editorPath,
          sessionId: data.sessionId,
          senderClientId: data.initiatorClientId,
        });
      }
    });

    const unsubStatus = subscribePreviewWebSocketStatus(year, (nextStatus) => {
      if (nextStatus === "connected") {
        markLive();
        announce();
      }
    });

    return () => {
      window.clearInterval(heartbeat);
      stopHttp();
      leavePreviewPresence(year);
      unsubWs();
      unsubStatus();
      participantsSigRef.current = "";
      liveLatchRef.current = false;
      setParticipants([]);
      setIsLive(false);
    };
  }, [year, status, location, options.sessionId, options.editorPath, applyParticipants, markLive]);

  const previewParticipants = participants.filter((p) => p.location !== "onlyoffice");
  const onlyOfficeParticipants = participants.filter((p) => p.location === "onlyoffice");

  return {
    participants,
    previewParticipants,
    onlyOfficeParticipants,
    wsConnected: isLive,
    clientId: clientIdRef.current,
  };
}
