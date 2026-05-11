/**
 * Risk assessment codes: A.2.{dept}.{n}; n fills gaps per status.
 * Order matches dashboard (`riskAssessmentConfig` → Finance … Warehouse).
 */
export const RISK_GAP_CONFIG = {
  finance: { prismaKey: "finance", prefix: "A.2.1." },
  accounting: { prismaKey: "accounting", prefix: "A.2.2." },
  hrd: { prismaKey: "hrd", prefix: "A.2.3." },
  "g&a": { prismaKey: "general_affair", prefix: "A.2.4." },
  sdp: { prismaKey: "sdp", prefix: "A.2.5." },
  tax: { prismaKey: "tax", prefix: "A.2.6." },
  "l&p": { prismaKey: "lp", prefix: "A.2.7." },
  mis: { prismaKey: "mis", prefix: "A.2.8." },
  merch: { prismaKey: "merchandise", prefix: "A.2.9." },
  ops: { prismaKey: "operational", prefix: "A.2.10." },
  whs: { prismaKey: "warehouse", prefix: "A.2.11." },
};

export const RISK_ID_PREFIX_BY_API_PATH = Object.fromEntries(
  Object.entries(RISK_GAP_CONFIG).map(([apiPath, { prefix }]) => [apiPath, prefix])
);

export const FINANCE_RISK_PREFIX = RISK_GAP_CONFIG.finance.prefix;
