// lib/db.js
import pkg from "pg";
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Please set DATABASE_URL in .env");

const globalWithPool = global;
const createPool = () => new Pool({ connectionString });

// reuse pool in dev to avoid too many connections
const pool = globalWithPool.__pgPool || createPool();
if (process.env.NODE_ENV === "development") globalWithPool.__pgPool = pool;

export default pool;
