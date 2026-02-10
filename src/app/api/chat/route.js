export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import schedulePool from "@/app/lib/db";

// Simple chat table:
// public.schedule_chat_messages (
//   id SERIAL PK,
//   sender_name VARCHAR,
//   sender_role VARCHAR,
//   message TEXT,
//   recipient_mode VARCHAR(16) -- 'all' | 'selected'
//   recipients TEXT[] NULL,    -- array of user names (for now)
//   created_at TIMESTAMPTZ
// )

async function ensureChatTable() {
  const client = await schedulePool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schedule_chat_messages (
        id SERIAL PRIMARY KEY,
        sender_name VARCHAR(255),
        sender_role VARCHAR(64),
        message TEXT NOT NULL,
        recipient_mode VARCHAR(16) NOT NULL DEFAULT 'all',
        recipients TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    const currentName = (session?.user?.name || "").trim();
    const currentRole = (session?.user?.role || "").toLowerCase();

    await ensureChatTable();

    const url = new URL(req.url);
    const sinceIdRaw = url.searchParams.get("sinceId");
    const sinceId = sinceIdRaw ? Number(sinceIdRaw) : null;

    const client = await schedulePool.connect();
    try {
      const params = [];
      let whereClause = "";

      if (sinceId && Number.isFinite(sinceId)) {
        params.push(sinceId);
        whereClause = `WHERE id > $${params.length}`;
      }

      // For now: everyone can see messages where:
      // - recipient_mode = 'all'
      // - OR recipient_mode = 'selected' and current user in recipients
      // - OR sender is current user
      // We enforce this filter in JS after query to keep SQL simple.
      const q = `
        SELECT id, sender_name, sender_role, message, recipient_mode, recipients, created_at
        FROM public.schedule_chat_messages
        ${whereClause}
        ORDER BY id ASC
        LIMIT 200
      `;
      const r = await client.query(q, params);

      const rows = (r.rows || []).filter((row) => {
        const sender = String(row.sender_name || "").trim();
        const mode = String(row.recipient_mode || "all").toLowerCase();
        const recips = Array.isArray(row.recipients)
          ? row.recipients.map((n) => String(n || "").trim().toLowerCase())
          : [];
        const me = currentName.toLowerCase();

        if (!currentName) {
          // unauthenticated: only show broadcasts
          return mode === "all";
        }
        if (sender.toLowerCase() === me) return true;
        if (mode === "all") return true;
        if (mode === "selected" && recips.includes(me)) return true;
        return false;
      });

      return NextResponse.json({ success: true, messages: rows }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("GET /api/chat error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawMessage = String(body?.message || "").trim();
    const recipientMode = String(body?.recipientMode || "all").toLowerCase();
    const recipients = Array.isArray(body?.recipients)
      ? body.recipients.map((n) => String(n || "").trim())
      : [];

    if (!rawMessage) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }
    if (recipientMode !== "all" && recipientMode !== "selected") {
      return NextResponse.json(
        { success: false, error: "Invalid recipientMode" },
        { status: 400 }
      );
    }
    if (recipientMode === "selected" && recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: "Recipients required for selected mode" },
        { status: 400 }
      );
    }

    await ensureChatTable();

    const senderName = (session.user.name || "").trim();
    const senderRole = (session.user.role || "").trim();

    const client = await schedulePool.connect();
    try {
      const q = `
        INSERT INTO public.schedule_chat_messages
          (sender_name, sender_role, message, recipient_mode, recipients, created_at)
        VALUES
          ($1,$2,$3,$4,$5,NOW())
        RETURNING id, sender_name, sender_role, message, recipient_mode, recipients, created_at
      `;
      const params = [
        senderName || null,
        senderRole || null,
        rawMessage,
        recipientMode,
        recipientMode === "all" ? null : recipients,
      ];
      const r = await client.query(q, params);
      const row = r.rows?.[0] || null;

      return NextResponse.json({ success: true, message: row }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("POST /api/chat error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}


