export const runtime = "nodejs";

import { makeSopReviewRoutes } from "../../_shared/routes";

const routes = makeSopReviewRoutes({ slug: "merch", departmentName: "Merchandise" });
export const GET = routes.meta.GET;
export const POST = routes.meta.POST;


