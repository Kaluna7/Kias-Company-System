export const runtime = "nodejs";

import { makeSopReviewRoutes } from "../_shared/routes";

const routes = makeSopReviewRoutes({ slug: "ops", departmentName: "Operational" });
export const GET = routes.steps.GET;
export const POST = routes.steps.POST;


