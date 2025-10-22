import prisma from "@/app/lib/prisma";
import { NextResponse } from "next/server";


function toIntSafe(v, fallback = 0) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isNaN(n) ? fallback : n;
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const page = Math.max(1, toIntSafe(url.searchParams.get("page"), 1));
    const pageSize = Math.max(1, toIntSafe(url.searchParams.get("pageSize"), 50));
    const skip = (page - 1) * pageSize;

    // Build prisma where for search (including nested aps)
    const where = q
      ? {
          OR: [
            { risk_id_no: { contains: q, mode: "insensitive" } },
            { risk_description: { contains: q, mode: "insensitive" } },
            { risk_details: { contains: q, mode: "insensitive" } },
            { owners: { contains: q, mode: "insensitive" } },
            { aps: { some: { ap_code: { contains: q, mode: "insensitive" } } } },
            { aps: { some: { substantive_test: { contains: q, mode: "insensitive" } } } },
            { aps: { some: { objective: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : undefined;

    // fetch parents with nested aps (paged on parent)
    const parents = await prisma.finance.findMany({
      where,
      include: { aps: true },
      orderBy: { risk_id: "desc" },
      skip,
      take: pageSize,
    });

    // total count of parents matching
    const total = await prisma.finance.count({ where });

    // flatten: 1 row per AP (frontend expects that)
    const flattened = parents.flatMap((p) =>
      p.aps && p.aps.length > 0
        ? p.aps.map((ap) => ({
            risk_id: p.risk_id,
            risk_id_no: p.risk_id_no ?? "",
            category: p.category ?? "",
            sub_department: p.sub_department ?? "",
            sop_related: p.sop_related ?? "",
            risk_description: p.risk_description ?? "",
            risk_details: p.risk_details ?? "",
            impact_description: p.impact_description ?? "",
            impact_level: p.impact_level ?? null,
            probability_level: p.probability_level ?? null,
            priority_level: p.priority_level ?? 0,
            mitigation_strategy: p.mitigation_strategy ?? "",
            owners: p.owners ?? "",
            root_cause_category: p.root_cause_category ?? "",
            onset_timeframe: p.onset_timeframe ?? "",
            status: p.status ?? "",

            ap_id: ap.ap_id,
            ap_code: ap.ap_code ?? "",
            substantive_test: ap.substantive_test ?? "",
            objective: ap.objective ?? "",
            procedures: ap.procedures ?? "",
            method: ap.method ?? "",
            description: ap.description ?? "",
            application: ap.application ?? "",
          }))
        : [{
            risk_id: p.risk_id,
            risk_id_no: p.risk_id_no ?? "",
            risk_description: p.risk_description ?? "",
            risk_details: p.risk_details ?? "",
            owners: p.owners ?? "",
            ap_id: null,
            ap_code: "",
            substantive_test: "",
            objective: "",
            procedures: "",
            method: "",
            description: "",
            application: "",
          }]
    );

    return NextResponse.json({ data: flattened, meta: { total, page, pageSize } });
  } catch (err) {
    console.error("GET /api/AuditProgram/finance error:", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const finance_risk_id = Number(body.finance_risk_id || 0);
    if (!finance_risk_id) {
      return NextResponse.json({ error: "finance_risk_id is required" }, { status: 400 });
    }

    // pastikan parent ada (hindari FK error)
    const parent = await prisma.finance.findUnique({ where: { risk_id: finance_risk_id } });
    if (!parent) {
      return NextResponse.json({ error: `Finance parent with risk_id=${finance_risk_id} not found` }, { status: 400 });
    }

    // create AP via Prisma (gunakan relasi)
    const created = await prisma.financeAp.create({
      data: {
        ap_code: body.ap_code ?? null,
        substantive_test: body.substantive_test ?? null,
        objective: body.objective ?? null,
        procedures: body.procedures ?? null,
        method: body.method ?? null,
        description: body.description ?? null,
        application: body.application ?? null,
        finance: { connect: { risk_id: finance_risk_id } },
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/AuditProgram/finance/ap error:", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}