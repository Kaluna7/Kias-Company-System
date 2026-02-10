export const runtime = "nodejs";

import { makeSopReviewRoutes } from "../../_shared/routes";

const routes = makeSopReviewRoutes({ slug: "sdp", departmentName: "Store Design Planner" });
export const GET = routes.meta.GET;
export const POST = routes.meta.POST;


