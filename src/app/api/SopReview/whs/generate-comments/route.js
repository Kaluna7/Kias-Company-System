export const runtime = "nodejs";

import { makeSopReviewRoutes } from "../../_shared/routes";

const routes = makeSopReviewRoutes({ slug: "whs", departmentName: "Warehouse" });
export const POST = routes.generateComments.POST;


