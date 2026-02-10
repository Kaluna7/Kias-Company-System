export const runtime = "nodejs";

import { makeSopReviewRoutes } from "../../_shared/routes";

const routes = makeSopReviewRoutes({ slug: "g_a", departmentName: "General Affair" });
export const GET = routes.period.GET;
export const POST = routes.period.POST;


