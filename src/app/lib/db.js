// lib/db.js
import pkg from "pg";
const { Pool } = pkg;

const globalWithPool = globalThis;
const createPool = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Please set DATABASE_URL in .env");
  }
  return new Pool({ connectionString });
};

// reuse pool in dev to avoid too many connections
function getPool() {
  if (globalWithPool.__pgPool) return globalWithPool.__pgPool;
  const pool = createPool();
  // Keep behavior: cache only in development.
  if (process.env.NODE_ENV === "development") globalWithPool.__pgPool = pool;
  return pool;
}

const poolFacade = {
  query(...args) {
    return getPool().query(...args);
  },
  connect(...args) {
    return getPool().connect(...args);
  },
  end(...args) {
    return getPool().end(...args);
  },
};

export { getPool };
export default poolFacade;


