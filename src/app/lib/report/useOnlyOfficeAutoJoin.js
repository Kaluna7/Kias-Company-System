"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { fetchCollabPresence } from "./collabPresenceClient";
import { waitForReportDocxReady } from "./exportReportClient";
import {
  clearOnlyOfficeAutoJoinDismissed,
  isOnlyOfficeAutoJoinDismissed,
} from "./onlyOfficeAutoJoinDismiss";
import {
  ensurePreviewWebSocketConnected,
  getPreviewTabClientId,
  PREVIEW_WS_EVENTS,
  subscribePreviewWebSocket,
} from "./previewWebSocketClient";

const POLL_MS = 2000;

function isOnEditorPage() {
  return (
    typeof window !== "undefined" &&
    window.location.pathname.includes("/Page/report/editor")
  );
}

/**
 * Auto-navigate to shared OnlyOffice when a teammate opens it (HTTP poll + WS).
 */
export function useOnlyOfficeAutoJoin(year, options = {}) {
  const router = useRouter();
  const { status } = useSession();
  const enabled = options.enabled !== false;
  const subscribeWs = options.ws !== false;
  const wsLocation = options.wsLocation === "report" ? "report" : "preview";
  const onJoinRef = useRef(options.onJoin);
  onJoinRef.current = options.onJoin;
  const joinedRef = useRef(false);
  const myTabIdRef = useRef(getPreviewTabClientId());

  const joinEditor = useCallback(
    async (editorPath) => {
      if (
        !editorPath ||
        joinedRef.current ||
        isOnEditorPage() ||
        isOnlyOfficeAutoJoinDismissed(year)
      ) {
        return;
      }
      joinedRef.current = true;

      const sessionMatch = /[?&]session=([^&]+)/.exec(editorPath);
      const sessionId = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null;
      if (sessionId) {
        await waitForReportDocxReady(sessionId);
      }

      if (typeof onJoinRef.current === "function") {
        onJoinRef.current(editorPath, { skipDocxWait: true });
        window.setTimeout(() => {
          if (!isOnEditorPage()) joinedRef.current = false;
        }, 2500);
        return;
      }
      router.replace(editorPath);
      window.setTimeout(() => {
        if (!window.location.pathname.includes("/Page/report/editor")) {
          window.location.replace(editorPath);
        } else {
          joinedRef.current = true;
        }
        if (!isOnEditorPage()) joinedRef.current = false;
      }, 600);
    },
    [router, year],
  );

  useEffect(() => {
    joinedRef.current = false;
    myTabIdRef.current = getPreviewTabClientId();
  }, [year]);

  useEffect(() => {
    if (!subscribeWs || !enabled || !Number.isFinite(year) || status !== "authenticated") {
      return undefined;
    }

    ensurePreviewWebSocketConnected(year);
    const clientId = getPreviewTabClientId();

    const unsub = subscribePreviewWebSocket(year, (data) => {
      if (data.type === PREVIEW_WS_EVENTS.ONLYOFFICE_REDIRECT && data.editorPath) {
        const sender = data.senderClientId || data.clientId;
        if (sender && sender === clientId) return;
        clearOnlyOfficeAutoJoinDismissed(year);
        joinEditor(data.editorPath);
        return;
      }
      if (data.type === "onlyoffice-session-opened" && data.editorPath) {
        const sender = data.initiatorClientId || data.senderClientId || data.clientId;
        if (sender && sender === clientId) return;
        clearOnlyOfficeAutoJoinDismissed(year);
        joinEditor(data.editorPath);
      }
    });

    return unsub;
  }, [year, status, enabled, subscribeWs, joinEditor]);

  useEffect(() => {
    if (!enabled || !Number.isFinite(year) || status !== "authenticated") return undefined;

    let cancelled = false;

    const poll = async () => {
      if (cancelled || joinedRef.current || isOnEditorPage()) return;
      try {
        const collab = await fetchCollabPresence(year);
        if (cancelled || joinedRef.current) return;
        if (collab.ok && collab.onlyOfficeTeammateLive && collab.editorPath) {
          void joinEditor(collab.editorPath);
        }
      } catch {
        /* ignore */
      }
    };

    void poll();
    const id = window.setInterval(poll, POLL_MS);

    const onPageShow = (ev) => {
      if (ev.persisted) void poll();
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [year, status, enabled, joinEditor]);

  return { joinEditor };
}
