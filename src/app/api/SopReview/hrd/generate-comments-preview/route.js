export const runtime = "nodejs";

import { makeSopReviewRoutes } from "../../_shared/routes";

const routes = makeSopReviewRoutes({ slug: "hrd", departmentName: "HRD" });
export const POST = routes.generateCommentsPreview.POST;


