export const runtime = "nodejs";

import { makeSopReviewRoutes } from "../../_shared/routes";

const routes = makeSopReviewRoutes({ slug: "tax", departmentName: "Tax" });
export const GET = routes.meta.GET;
export const POST = routes.meta.POST;


