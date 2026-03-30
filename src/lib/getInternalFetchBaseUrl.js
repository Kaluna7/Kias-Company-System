/**
 * Base URL for server-side fetch() to this app's own API routes.
 *
 * Do not use the incoming request Host + https in production: behind nginx/Caddy/Docker,
 * that often resolves to the public IP; connecting from the Node process to :443 on that
 * IP fails (ECONNREFUSED) while the app only listens on HTTP inside the container.
 *
 * Override with INTERNAL_APP_URL or INTERNAL_BASE_URL if the app is not reachable at 127.0.0.1:PORT
 * from the same process (unusual).
 */
export function getInternalFetchBaseUrl() {
  const explicit = process.env.INTERNAL_APP_URL || process.env.INTERNAL_BASE_URL;
  if (explicit && String(explicit).trim()) {
    return String(explicit).replace(/\/+$/, "");
  }
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}`;
}
