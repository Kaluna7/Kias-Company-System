export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { subscribeReportStateStream } from "@/app/lib/report/reportStateHub";

/** SSE: report state updated (OnlyOffice save → preview DB). */
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

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

      send(`: connected report-state year=${reportYear}\n\n`);
      send(
        `data: ${JSON.stringify({ type: "connected", year: reportYear, ts: Date.now() })}\n\n`,
      );

      unsubscribe = subscribeReportStateStream(reportYear, send);

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
