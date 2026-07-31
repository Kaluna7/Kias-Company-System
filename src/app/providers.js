"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "./contexts/ToastContext";
import SessionIdleGuard from "./components/SessionIdleGuard";

export default function Providers({ children }) {
  return (
    <SessionProvider
      refetchOnWindowFocus
      // Refresh JWT while the app is open so active users stay signed in;
      // idle/offline 2h is enforced by SessionIdleGuard + session maxAge.
      refetchInterval={5 * 60}
    >
      <ToastProvider>
        <SessionIdleGuard />
        {children}
      </ToastProvider>
    </SessionProvider>
  );
}
