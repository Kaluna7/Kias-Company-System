"use client";

import { useEffect, useState } from "react";

function mapSignInError(code) {
  if (!code) return "";
  const normalized = String(code).trim();
  if (normalized === "CredentialsSignin") return "Email or password is wrong.";
  if (normalized === "MissingCSRF" || /csrf/i.test(normalized)) {
    return "Session expired. Refresh the page (F5) and sign in again.";
  }
  return normalized;
}

export default function AuthErrorBanner() {
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (!err && !params.has("callbackUrl")) return;
    if (err) setErrorMsg(mapSignInError(err));
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  if (!errorMsg) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {errorMsg}
    </div>
  );
}
