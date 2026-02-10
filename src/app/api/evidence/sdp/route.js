export const runtime = "nodejs";

import { makeEvidenceHandlers } from "../_shared/handlers";

const { GET, POST, PUT } = makeEvidenceHandlers("SDP");

export { GET, POST, PUT };


