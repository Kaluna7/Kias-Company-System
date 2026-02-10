export const runtime = "nodejs";

import { makeSopReviewRoutes } from "../../_shared/routes";

const routes = makeSopReviewRoutes({ slug: "sdp", departmentName: "Store Design Planner" });
export const POST = routes.generateCommentsPreview.POST;


