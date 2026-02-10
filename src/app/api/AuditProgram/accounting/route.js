import prisma from "@/app/lib/prisma";
import { NextResponse } from "next/server";

function parseApSequence(apCode = "", base = "") {
  const code = String(apCode ?? "").trim();
  if (!code) return 0;

  // case-insensitive check to support stored codes with different casing
  const baseStr = String(base ?? "").trim();
  if (baseStr) {
    const lowerCode = code.toLowerCase();
    const lowerBase = baseStr.toLowerCase();
    if (lowerCode.startsWith(`${lowerBase}.`)) {
      const part = code.slice(baseStr.length + 1);
      const num = parseInt(part, 10);
      return Number.isFinite(num) ? num : 0;
    }
  }

  const match = code.match(/(\d+)(?!.*\d)/);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  return Number.isFinite(num) ? num : 0;
}

function normalizeBaseCode(v) {
  // Ensure we don't generate weird "A2.1.2..1" when base ends with "."
  return String(v ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/^\.+/, "")
    .replace(/\.+$/, "");
}

async function buildNextApCode(accounting_risk_id, baseCode) {
  const siblings = await prisma.accountingAp.findMany({
    where: { accounting_risk_id },
    select: { ap_code: true },
  });

  const base = normalizeBaseCode(baseCode);
  const maxSeq =
    siblings.reduce(
      (max, s) => Math.max(max, parseApSequence(s.ap_code, base)),
      0
    ) || 0;

  return `${base}.${maxSeq + 1}`;
}

function toIntSafe(v, fallback = 0) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isNaN(n) ? fallback : n;
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const status = (url.searchParams.get("status") ?? "").trim();
    const page = Math.max(1, toIntSafe(url.searchParams.get("page"), 1));
    const pageSize = Math.max(1, toIntSafe(url.searchParams.get("pageSize"), 50));
    const skip = (page - 1) * pageSize;

    const where = {
      ...(status ? { status } : {}),
      ...(q
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
        : {}),
    };

    const parents = await prisma.accounting.findMany({
      where,
      include: { aps: true },
      orderBy: { risk_id: "desc" },
      skip,
      take: pageSize,
    });

    const total = await prisma.accounting.count({ where });

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
    console.error("GET /api/AuditProgram/accounting error:", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const accounting_risk_id = Number(body.accounting_risk_id || 0);
    if (!accounting_risk_id) {
      return NextResponse.json({ error: "accounting_risk_id is required" }, { status: 400 });
    }

    const parent = await prisma.accounting.findUnique({ where: { risk_id: accounting_risk_id } });
    if (!parent) {
      return NextResponse.json({ error: `Accounting parent with risk_id=${accounting_risk_id} not found` }, { status: 400 });
    }

    const baseCodeRaw = parent.risk_id_no || `ACC-${parent.risk_id}`;
    const baseCode = normalizeBaseCode(baseCodeRaw);
    const autoApCode = await buildNextApCode(accounting_risk_id, baseCode);
    const requestedApCode = typeof body.ap_code === "string" ? body.ap_code.trim() : "";
    const ap_code = requestedApCode || autoApCode;

    const created = await prisma.accountingAp.create({
      data: {
        ap_code,
        substantive_test: body.substantive_test ?? null,
        objective: body.objective ?? null,
        procedures: body.procedures ?? null,
        method: body.method ?? null,
        description: body.description ?? null,
        application: body.application ?? null,
        accounting: { connect: { risk_id: accounting_risk_id } },
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/AuditProgram/accounting error:", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

