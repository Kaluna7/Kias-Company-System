export const runtime = "nodejs";
export const maxDuration = 18000;

import { makeEvidenceHandlers } from "../_shared/handlers";

const { GET, POST, PUT, DELETE } = makeEvidenceHandlers("L&P");

export { GET, POST, PUT, DELETE };


