import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

export async function GET() {
  const finance = await prisma.finance.findMany();
  return Response.json(finance);
}

export async function POST(req) {
  const body = await req.json();
  const {
    risk_id,
    category,
    sub_department,
    risk_description,
    sop_related,
    risk_details,
    impact_description,
    impact_level,
    probability_level,
    priority_level,
    mitigation_strategy,
    owners,
    root_cause_category,
    onset_timeframe,
  } = body;
  const newFinance = await prisma.finance.create({
    data: {
      risk_id,
      category,
      sub_department,
      risk_description,
      sop_related,
      risk_details,
      impact_description,
      impact_level,
      probability_level,
      priority_level,
      mitigation_strategy,
      owners,
      root_cause_category,
      onset_timeframe,
    },
  });
  return Response.json(newFinance);
}
