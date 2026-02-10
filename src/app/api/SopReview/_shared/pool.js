import pkg from "pg";

const { Pool } = pkg;

// Reuse global pool to avoid too many clients in dev/serverless
if (!globalThis._pgPool) {
  globalThis._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

export const pool = globalThis._pgPool;


