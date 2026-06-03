import { getInternalFetchBaseUrl } from "@/lib/getInternalFetchBaseUrl";
import { loadFindingSectionsFromModules } from "./loadFindingSectionsFromModules";

/**
 * Server-side module load for HTML preview (forwards session cookie to internal APIs).
 * @param {number} year
 * @param {string} [cookieHeader]
 */
export async function loadFindingSectionsForPreviewServer(year, cookieHeader = "") {
  const base = getInternalFetchBaseUrl();
  const headers = {
    cache: "no-store",
    ...(cookieHeader ? { cookie: cookieHeader } : {}),
  };

  const fetchViaApp = (url, init = {}) => {
    const absolute = url.startsWith("http")
      ? url
      : `${base}${url.startsWith("/") ? url : `/${url}`}`;
    return fetch(absolute, {
      ...init,
      headers: { ...headers, ...(init.headers || {}) },
      cache: "no-store",
    });
  };

  return loadFindingSectionsFromModules(year, {}, fetchViaApp);
}
