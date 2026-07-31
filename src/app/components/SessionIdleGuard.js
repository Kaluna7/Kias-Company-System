"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

/** Idle / offline for this long → force re-login (all roles). */
export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000; // 2 hours
const STORAGE_KEY = "kias:lastActiveAt";
const ACTIVITY_THROTTLE_MS = 30 * 1000;

function readLastActive() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeLastActive(ts = Date.now()) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(ts));
  } catch {
    // ignore quota / private mode
  }
}

function clearLastActive() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function isAuthPage(pathname) {
  if (!pathname) return false;
  if (pathname === "/" || pathname === "") return true;
  return pathname.startsWith("/Page/auth");
}

/**
 * Forces re-login after 2 hours of no activity / offline for every signed-in role.
 * Tracks last activity in localStorage so closed tabs / sleep still count.
 */
export default function SessionIdleGuard() {
  const { status } = useSession();
  const pathname = usePathname();
  const signingOutRef = useRef(false);
  const lastWriteRef = useRef(0);

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") clearLastActive();
      return undefined;
    }
    if (typeof window === "undefined") return undefined;
    if (isAuthPage(pathname)) return undefined;

    const markActive = (force = false) => {
      const now = Date.now();
      if (!force && now - lastWriteRef.current < ACTIVITY_THROTTLE_MS) return;
      lastWriteRef.current = now;
      writeLastActive(now);
    };

    const forceLogout = async () => {
      if (signingOutRef.current) return;
      signingOutRef.current = true;
      clearLastActive();
      try {
        await signOut({ callbackUrl: "/?reason=session_expired" });
      } catch {
        window.location.href = "/?reason=session_expired";
      }
    };

    const checkIdle = () => {
      const last = readLastActive();
      if (last == null) {
        markActive(true);
        return;
      }
      if (Date.now() - last >= SESSION_IDLE_MS) {
        void forceLogout();
      }
    };

    // First paint: seed or expire
    checkIdle();
    markActive(true);

    const onActivity = () => {
      checkIdle();
      if (!signingOutRef.current) markActive(false);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        checkIdle();
        if (!signingOutRef.current) markActive(true);
      } else {
        // Leaving tab / minimizing: freeze last activity time (already stored)
        markActive(true);
      }
    };

    const onOnline = () => {
      checkIdle();
      if (!signingOutRef.current) markActive(true);
    };

    const events = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"];
    for (const ev of events) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onActivity);
    window.addEventListener("online", onOnline);

    const intervalId = window.setInterval(checkIdle, 60 * 1000);

    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onActivity);
      window.removeEventListener("online", onOnline);
      window.clearInterval(intervalId);
    };
  }, [status, pathname]);

  return null;
}
