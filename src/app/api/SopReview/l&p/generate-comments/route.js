export const runtime = "nodejs";

import { makeSopReviewRoutes } from "../../_shared/routes";

const routes = makeSopReviewRoutes({ slug: "l_p", departmentName: "L & P" });
export const POST = routes.generateComments.POST;


