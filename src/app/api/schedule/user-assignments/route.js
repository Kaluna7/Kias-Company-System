export const runtime = "nodejs";

import { NextResponse } from "next/server";
import schedulePool from "@/app/lib/db";

const DEPT_KEY_BY_SCHEDULE_ID = {
  "A1.1": "finance",
  "A1.2": "accounting",
  "A1.3": "hrd",
  "A1.4": "g&a",
  "A1.5": "sdp",
  "A1.6": "tax",
  "A1.7": "l&p",
  "A1.8": "mis",
  "A1.9": "merch",
  "A1.10": "ops",
  "A1.11": "whs",
};

// Map deptKey to department name as shown in SOP Review page (matching buttonSopReview config)
// Note: Config has "Finnance" (typo), but we need to match it
const DEPT_NAME_BY_KEY = {
  "finance": "Finnance", // Match typo in config
  "accounting": "Accounting",
  "hrd": "HRD",
  "g&a": "General Affair",
  "sdp": "Store D & P",
  "tax": "Tax",
  "l&p": "L & P",
  "mis": "MIS",
  "merch": "Merchandise",
  "ops": "Operational",
  "whs": "Warehouse",
};

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const userName = (url.searchParams.get("userName") || "").trim();
    const moduleKey = (url.searchParams.get("module") || "sop-review").trim();

    if (!userName) {
      return NextResponse.json({ success: false, error: "Missing userName parameter" }, { status: 400 });
    }

    // Check if schedule table exists
    const check = await schedulePool.query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema='public' AND table_name='schedule_module_feedback'
       ) AS exists`
    );
    if (!check?.rows?.[0]?.exists) {
      return NextResponse.json({ success: true, allowedDepartments: [] }, { status: 200 });
    }

    // user_name di schedule bisa berisi beberapa orang (dipisah koma). Equality SQL pada
    // seluruh string gagal jika session = "A" tapi kolom = "A, B". Sama seperti dashboard progress.
    const r = await schedulePool.query(
      `SELECT department_id, department_name, user_name
       FROM public.schedule_module_feedback
       WHERE module_key = $1 AND is_configured = true`,
      [moduleKey]
    );

    const target = String(userName || "").trim().toLowerCase();
    const seenDeptIds = new Set();
    const allowedDepartments = [];

    for (const row of r.rows || []) {
      const rawName = String(row.user_name || "").trim();
      if (!rawName) continue;

      const names = rawName
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => n.toLowerCase());

      if (!names.includes(target)) continue;

      const deptId = String(row.department_id || "").trim();
      if (seenDeptIds.has(deptId)) continue;
      const deptKey = DEPT_KEY_BY_SCHEDULE_ID[deptId];
      if (!deptKey) continue;

      seenDeptIds.add(deptId);
      const deptName = row.department_name || DEPT_NAME_BY_KEY[deptKey] || deptKey;
      allowedDepartments.push({
        key: deptKey,
        name: deptName,
        department_id: deptId,
      });
    }

    console.log(
      `[user-assignments] User: "${userName}", module: "${moduleKey}", matched ${allowedDepartments.length} dept(s)`
    );

    return NextResponse.json({ success: true, allowedDepartments }, { status: 200 });
  } catch (err) {
    console.error("GET /api/schedule/user-assignments error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

