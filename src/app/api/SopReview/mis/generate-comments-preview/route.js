export const runtime = "nodejs";

import { makeSopReviewRoutes } from "../../_shared/routes";

const routes = makeSopReviewRoutes({ slug: "mis", departmentName: "MIS" });
export const POST = routes.generateCommentsPreview.POST;


