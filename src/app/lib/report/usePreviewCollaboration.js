"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  announcePreviewPresence,
  getPreviewTabClientId,
  leavePreviewPresence,
  PREVIEW_WS_EVENTS,
  sendPreviewWebSocketMessage,
  subscribePreviewWebSocket,
  subscribePreviewWebSocketStatus,
} from "./previewWebSocketClient";

const HEARTBEAT_MS = 10000;

/**
 * WebSocket-only collaboration for HTML preview / OnlyOffice.
 */
export function usePreviewCollaboration(year, options = {}) {
  const { data: session, status } = useSession();
  const location = options.location === "onlyoffice" ? "onlyoffice" : "preview";
  const [participants, setParticipants] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
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

  useEffect(() => {
    if (!Number.isFinite(year) || status !== "authenticated") return undefined;

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
        setParticipants(data.participants);
        return;
      }

      if (data.type === PREVIEW_WS_EVENTS.STATE_PUSH && data.state) {
        if (data.senderClientId && data.senderClientId === myId) return;
        onStatePushRef.current?.(data.state, data);
        return;
      }

      if (data.type === PREVIEW_WS_EVENTS.ONLYOFFICE_REDIRECT && data.editorPath) {
        if (data.senderClientId && data.senderClientId === myId) return;
        onOnlyOfficeRedirectRef.current?.(data);
        return;
      }

      // Legacy server broadcast (OnlyOffice API)
      if (data.type === "onlyoffice-session-opened" && data.editorPath) {
        if (data.initiatorClientId && data.initiatorClientId === myId) return;
        onOnlyOfficeRedirectRef.current?.({
          editorPath: data.editorPath,
          sessionId: data.sessionId,
          senderClientId: data.initiatorClientId,
        });
      }
    });

    const unsubStatus = subscribePreviewWebSocketStatus(year, (nextStatus) => {
      setWsConnected(nextStatus === "connected");
      if (nextStatus === "connected") {
        announce();
      }
    });

    return () => {
      window.clearInterval(heartbeat);
      leavePreviewPresence(year);
      unsubWs();
      unsubStatus();
      setParticipants([]);
    };
  }, [year, status, location, options.sessionId, options.editorPath]);

  useEffect(() => {
    if (!Number.isFinite(year) || status !== "authenticated") return;
    sendPreviewWebSocketMessage(year, {
      type: "presence-heartbeat",
      clientId: clientIdRef.current,
      location,
      user: userPayloadRef.current,
      sessionId: options.sessionId || null,
      editorPath: options.editorPath || null,
    });
  }, [
    year,
    status,
    location,
    avatarUrl,
    session?.user?.email,
    options.sessionId,
    options.editorPath,
  ]);

  const previewParticipants = participants.filter((p) => p.location !== "onlyoffice");
  const onlyOfficeParticipants = participants.filter((p) => p.location === "onlyoffice");

  return {
    participants,
    previewParticipants,
    onlyOfficeParticipants,
    wsConnected,
    clientId: clientIdRef.current,
  };
}
