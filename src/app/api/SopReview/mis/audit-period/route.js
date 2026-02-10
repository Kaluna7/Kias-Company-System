export const runtime = "nodejs";

import { makeSopReviewRoutes } from "../../_shared/routes";

const routes = makeSopReviewRoutes({ slug: "mis", departmentName: "MIS" });
export const GET = routes.period.GET;
export const POST = routes.period.POST;


