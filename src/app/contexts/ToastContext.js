"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' | 'info' }

  const show = useCallback((message, type = "info") => {
    setToast({ message: String(message), type });
  }, []);

  const hide = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__showToast = show;
      return () => {
        delete window.__showToast;
      };
    }
  }, [show]);

  return (
    <ToastContext.Provider value={{ show, hide }}>
      {children}
      {toast && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="toast-title"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={hide}
          />
          <div
            className="relative z-10 w-full max-w-md rounded-xl shadow-2xl border overflow-hidden bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`px-5 py-4 flex items-start gap-4 ${
                toast.type === "error"
                  ? "bg-red-50 border-b border-red-100"
                  : toast.type === "success"
                    ? "bg-green-50 border-b border-green-100"
                    : "bg-slate-50 border-b border-slate-200"
              }`}
            >
              <span
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                  toast.type === "error"
                    ? "bg-red-100 text-red-600"
                    : toast.type === "success"
                      ? "bg-green-100 text-green-600"
                      : "bg-slate-200 text-slate-600"
                }`}
              >
                {toast.type === "error"
                  ? "⚠"
                  : toast.type === "success"
                    ? "✓"
                    : "ℹ"}
              </span>
              <p
                id="toast-title"
                className="flex-1 text-slate-800 font-medium pt-1.5 break-words"
              >
                {toast.message}
              </p>
            </div>
            <div className="px-5 py-3 flex justify-end bg-white">
              <button
                type="button"
                onClick={hide}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show: (msg) => console.warn("Toast not available, message:", msg),
      hide: () => {},
    };
  }
  return ctx;
}
