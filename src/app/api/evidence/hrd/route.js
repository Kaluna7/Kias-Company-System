export { runtime, maxDuration } from "../_shared/routeConfig";

import { makeEvidenceHandlers } from "../_shared/handlers";

const { GET, POST, PUT, DELETE } = makeEvidenceHandlers("HRD");

export { GET, POST, PUT, DELETE };


