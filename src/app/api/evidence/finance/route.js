export const runtime = "nodejs";

import { makeEvidenceHandlers } from "../_shared/handlers";

const { GET, POST, PUT, DELETE } = makeEvidenceHandlers("FINANCE");

export { GET, POST, PUT, DELETE };

