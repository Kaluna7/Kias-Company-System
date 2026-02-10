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

    // Get user assignments for the specified module
    // Use case-insensitive matching for user_name to handle variations
    const r = await schedulePool.query(
      `SELECT department_id, department_name, user_name
       FROM public.schedule_module_feedback
       WHERE LOWER(TRIM(user_name)) = LOWER(TRIM($1)) AND module_key = $2 AND is_configured = true`,
      [userName, moduleKey]
    );
    
    console.log(`[user-assignments] Query result: Found ${r.rows?.length || 0} rows for user "${userName}" and module "${moduleKey}"`);
    if (r.rows?.length > 0) {
      console.log(`[user-assignments] Sample rows:`, r.rows.slice(0, 3).map(row => ({
        department_id: row.department_id,
        department_name: row.department_name,
        user_name: row.user_name,
      })));
    }

    const allowedDepartments = [];
    for (const row of r.rows || []) {
      const deptId = String(row.department_id || "").trim();
      const deptKey = DEPT_KEY_BY_SCHEDULE_ID[deptId];
      if (deptKey) {
        // Use department_name from database if available, otherwise use mapping
        // This ensures consistency with what was saved in schedule
        const deptName = row.department_name || DEPT_NAME_BY_KEY[deptKey] || deptKey;
        allowedDepartments.push({
          key: deptKey,
          name: deptName,
          department_id: deptId,
        });
      }
    }

    console.log(`[user-assignments] User: ${userName}, Module: ${moduleKey}, Found ${allowedDepartments.length} assignments:`, allowedDepartments);

    return NextResponse.json({ success: true, allowedDepartments }, { status: 200 });
  } catch (err) {
    console.error("GET /api/schedule/user-assignments error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

