export const runtime = "nodejs";

import { makeEvidenceHandlers } from "../_shared/handlers";

const { GET, POST, PUT } = makeEvidenceHandlers("G&A");

export { GET, POST, PUT };


