"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "./contexts/ToastContext";

export default function Providers({ children }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
