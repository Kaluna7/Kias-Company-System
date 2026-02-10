export const runtime = "nodejs";

import { makeSopReviewRoutes } from "../../_shared/routes";

const routes = makeSopReviewRoutes({ slug: "accounting", departmentName: "Accounting" });
export const POST = routes.generateCommentsPreview.POST;


