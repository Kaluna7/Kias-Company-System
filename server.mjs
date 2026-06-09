import { config as loadEnv } from "dotenv";
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer } from "ws";
import { getToken } from "next-auth/jwt";
import {
  registerPreviewWsClient,
  handlePreviewWsMessage,
} from "./src/app/lib/report/previewRealtimeHub.js";
import { verifyPreviewWsTicket } from "./src/app/lib/report/previewWsAuth.js";

loadEnv();

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port, turbopack: dev });
const handle = app.getRequestHandler();

await app.prepare();
const upgradeHandler = app.getUpgradeHandler();

const server = createServer((req, res) => {
  const parsedUrl = parse(req.url || "/", true);
  handle(req, res, parsedUrl);
});

const wss = new WebSocketServer({ noServer: true });

async function resolvePreviewWsUser(req, query) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  const ticket = String(query.token || "").trim();
  if (ticket) {
    const decoded = verifyPreviewWsTicket(ticket, secret);
    if (decoded) {
      return {
        id: decoded.id || decoded.sub,
        sub: decoded.sub || decoded.id,
        email: decoded.email,
        name: decoded.name,
      };
    }
  }

  try {
    const fromCookie = await getToken({
      req,
      secret,
      secureCookie: process.env.NODE_ENV === "production",
    });
    if (fromCookie) return fromCookie;
  } catch (err) {
    if (dev) console.warn("[preview-ws] getToken failed:", err?.message || err);
  }

  return null;
}

server.on("upgrade", async (req, socket, head) => {
  const { pathname, query } = parse(req.url || "/", true);

  // Next.js dev HMR uses /_next/webpack-hmr — must not be destroyed here.
  if (pathname !== "/api/report/preview-ws") {
    try {
      await upgradeHandler(req, socket, head);
    } catch (err) {
      console.error("[server] upgrade handler:", err);
      socket.destroy();
    }
    return;
  }

  const token = await resolvePreviewWsUser(req, query);

  if (!token) {
    if (dev) {
      console.warn(
        "[preview-ws] Unauthorized — fetch /api/report/preview-ws-token while logged in, then connect with ?token=",
      );
    }
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const year = parseInt(String(query.year || ""), 10);
  const reportYear = Number.isFinite(year) ? year : new Date().getFullYear();

  req._previewAuthToken = token;

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req, reportYear);
  });
});

wss.on("connection", (ws, req, reportYear) => {
  const token = req?._previewAuthToken || {};
  const { unregister, client } = registerPreviewWsClient(reportYear, ws, {
    id: token.id || token.sub,
    name: token.name,
    email: token.email,
    picture: token.picture,
  });

  if (dev) {
    console.log(
      `[preview-ws] connected year=${reportYear} user=${token.email || token.name || token.sub}`,
    );
  }

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(String(raw));
      handlePreviewWsMessage(reportYear, client, data);
    } catch {
      /* ignore malformed */
    }
  });
  ws.on("close", () => unregister());
  ws.on("error", () => unregister());
});

server.listen(port, hostname, () => {
  console.log(
    `> Ready on http://${hostname}:${port} (WebSocket: /api/report/preview-ws)`,
  );
});
