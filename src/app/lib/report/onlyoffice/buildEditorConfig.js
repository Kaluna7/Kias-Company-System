import { signOnlyOfficeToken, getReportDocumentHostUrl } from "./jwt";
import { createDocumentAccessToken } from "./accessToken";
import { DOCUMENT_ACCESS_TTL_SECONDS } from "./serveDocument";
import { getDocumentKey } from "../documentStore";

function initialsFromName(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "KU";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

function buildUserAvatarDataUrl(name) {
  const initials = initialsFromName(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#2B4F82"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#FFFFFF">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function buildDocumentAccessToken(sessionId) {
  return createDocumentAccessToken(sessionId, DOCUMENT_ACCESS_TTL_SECONDS);
}

/**
 * Local dev: static DOCX via kias-doc-proxy /reports/ (avoids OnlyOffice nginx 403 on API proxy).
 * Production: authenticated Next.js API route.
 */
export function buildDocumentFileUrl(sessionId) {
  const host = getReportDocumentHostUrl();
  const useStatic =
    String(process.env.REPORT_DOCUMENT_STATIC_FILES ?? "true").toLowerCase() !== "false" &&
    (process.env.NODE_ENV === "development" || host.includes("kias-doc-proxy"));

  if (useStatic) {
    return `${host}/reports/${encodeURIComponent(sessionId)}.docx`;
  }

  const token = buildDocumentAccessToken(sessionId);
  return `${host}/api/report/documents/${encodeURIComponent(sessionId)}/file?token=${encodeURIComponent(token)}`;
}

export function buildDocumentFileHeaders(sessionId) {
  const url = buildDocumentFileUrl(sessionId);
  if (url.includes("/reports/")) {
    return {};
  }
  return {
    "X-Kias-Document-Token": buildDocumentAccessToken(sessionId),
  };
}

export function buildCallbackUrl(sessionId) {
  const host = getReportDocumentHostUrl();
  return `${host}/api/report/onlyoffice/callback?sessionId=${encodeURIComponent(sessionId)}`;
}

/**
 * OnlyOffice DocsAPI editor config (signed when JWT enabled on Document Server).
 */
export function buildOnlyOfficeEditorConfig({ sessionId, meta, user, mode = "edit" }) {
  const title = meta?.title || `KIAS-Consolidated-Report-${meta?.year || ""}.docx`;
  const fileUrl = buildDocumentFileUrl(sessionId);
  const fileHeaders = buildDocumentFileHeaders(sessionId);
  const callbackUrl = buildCallbackUrl(sessionId);

  const resolvedUserId = String(user?.id || user?.email || "").trim();
  if (!resolvedUserId) {
    throw new Error("User id or email required for OnlyOffice collaboration");
  }
  const resolvedUserName = String(
    user?.name || user?.email || "KIAS User",
  );
  const resolvedUserAvatar = buildUserAvatarDataUrl(resolvedUserName);

  // Only sign standard OnlyOffice fields (width/height go on DocEditor client, not in JWT).
  const config = {
    documentType: "word",
    document: {
      fileType: "docx",
      key: getDocumentKey(sessionId, meta),
      title,
      url: fileUrl,
      headers: fileHeaders,
      permissions: {
        edit: mode === "edit",
        download: true,
        print: true,
        review: true,
      },
    },
    editorConfig: {
      mode: mode === "view" ? "view" : "edit",
      lang: "en",
      callbackUrl,
      coEditing: {
        mode: "fast",
        change: true,
      },
      customization: {
        autosave: true,
        forcesave: true,
        chat: true,
        comments: true,
      },
      user: {
        id: resolvedUserId,
        name: resolvedUserName,
        image: resolvedUserAvatar,
      },
    },
  };

  const secret = process.env.ONLYOFFICE_JWT_SECRET;
  const signEditorJwt =
    secret && String(process.env.ONLYOFFICE_JWT_ENABLED ?? "true").toLowerCase() !== "false";

  if (signEditorJwt) {
    return { ...config, token: signOnlyOfficeToken(config, secret) };
  }

  return config;
}
