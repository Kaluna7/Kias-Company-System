export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { subscribeAuditPublishStream } from "@/app/lib/audit-review/auditPublishHub";

/**
 * Server-Sent Events stream (realtime push, WebSocket-like for lock/unlock).
 * GET /api/audit-review/publish-stream?year=2025
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url || "", "http://localhost");
  const year = parseInt(String(searchParams.get("year") || ""), 10);
  const reportYear = Number.isFinite(year) ? year : new Date().getFullYear();

  let heartbeat;
  let unsubscribe = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (chunk) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* closed */
        }
      };

      send(`: connected year=${reportYear}\n\n`);
      send(
        `data: ${JSON.stringify({ type: "connected", year: reportYear, ts: Date.now() })}\n\n`,
      );

      unsubscribe = subscribeAuditPublishStream(reportYear, send);

      heartbeat = setInterval(() => {
        try {
          send(`: ping ${Date.now()}\n\n`);
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);
    },
    cancel() {
      clearInterval(heartbeat);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
