export const runtime = "nodejs";

import { makeSopReviewRoutes } from "../../_shared/routes";

const routes = makeSopReviewRoutes({ slug: "finance", departmentName: "Finance" });
export const POST = routes.generateCommentsPreview.POST;
