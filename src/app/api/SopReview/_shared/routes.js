export const runtime = "nodejs";

import { makeAuditPeriodHandlers, makeMetaHandlers, makeSopReviewTables, makeStepsHandlers } from "./db";
import { makeGenerateCommentsHandler } from "./generate-comments";
import { POST as previewPost } from "./generate-comments-preview";

export function makeSopReviewRoutes({ slug, departmentName }) {
  const { stepsTable, metaTable, auditPeriodTable } = makeSopReviewTables({ slug, departmentName });
  const steps = makeStepsHandlers({ stepsTable });
  const meta = makeMetaHandlers({ metaTable, departmentName });
  const period = makeAuditPeriodHandlers({ auditPeriodTable, departmentName });
  const genCommentsPost = makeGenerateCommentsHandler({ stepsTable });

  return {
    steps,
    meta,
    period,
    generateComments: { POST: genCommentsPost },
    generateCommentsPreview: { POST: previewPost },
  };
}


