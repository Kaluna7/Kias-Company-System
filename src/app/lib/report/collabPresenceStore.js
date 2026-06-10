import pkg from "pg";

const { Pool } = pkg;

if (!global._pgPool) {
  global._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

const pool = global._pgPool;
const PRESENCE_TABLE = "report_live_presence";
const ONLYOFFICE_TABLE = "report_onlyoffice_live";
const STALE_MS = 30_000;
const ONLYOFFICE_SIGNAL_MS = 180_000;

async function ensureTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${PRESENCE_TABLE} (
      tab_id TEXT NOT NULL,
      report_year INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT 'User',
      image TEXT,
      location TEXT NOT NULL DEFAULT 'preview',
      session_id TEXT,
      editor_path TEXT,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tab_id, report_year)
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_report_live_presence_year_seen
      ON ${PRESENCE_TABLE} (report_year, last_seen_at DESC);
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${ONLYOFFICE_TABLE} (
      report_year INTEGER PRIMARY KEY,
      session_id TEXT NOT NULL,
      editor_path TEXT NOT NULL,
      opened_by TEXT,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function mapPresenceRow(row) {
  return {
    clientId: row.tab_id,
    userId: row.user_id || "",
    name: row.name || "User",
    email: row.email || "",
    image: row.image || "",
    location: row.location === "onlyoffice" ? "onlyoffice" : row.location === "report" ? "report" : "preview",
    sessionId: row.session_id || null,
    editorPath: row.editor_path || null,
  };
}

/**
 * @param {number} year
 */
export async function listLivePresence(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return [];

  const client = await pool.connect();
  try {
    await ensureTables(client);
    await client.query(
      `DELETE FROM ${PRESENCE_TABLE}
       WHERE report_year = $1 AND last_seen_at < NOW() - ($2::int * INTERVAL '1 millisecond')`,
      [y, STALE_MS],
    );
    const result = await client.query(
      `SELECT tab_id, user_id, email, name, image, location, session_id, editor_path, last_seen_at
       FROM ${PRESENCE_TABLE}
       WHERE report_year = $1
         AND last_seen_at >= NOW() - ($2::int * INTERVAL '1 millisecond')
       ORDER BY last_seen_at DESC`,
      [y, STALE_MS],
    );

    /** @type {Map<string, object>} */
    const byUser = new Map();
    for (const row of result.rows) {
      const entry = mapPresenceRow(row);
      const userKey =
        String(entry.email || "").trim().toLowerCase() ||
        String(entry.userId || "").trim() ||
        String(entry.clientId || "").trim();
      const existing = byUser.get(userKey);
      if (!existing) {
        byUser.set(userKey, entry);
        continue;
      }
      if (entry.location === "onlyoffice" && existing.location !== "onlyoffice") {
        byUser.set(userKey, entry);
      }
    }
    return Array.from(byUser.values());
  } finally {
    client.release();
  }
}

/**
 * @param {object} payload
 */
export async function upsertLivePresence(payload) {
  const year = Number(payload.year);
  const tabId = String(payload.tabId || "").trim();
  if (!Number.isFinite(year) || !tabId) return false;

  const user = payload.user && typeof payload.user === "object" ? payload.user : {};
  const client = await pool.connect();
  try {
    await ensureTables(client);
    await client.query(
      `INSERT INTO ${PRESENCE_TABLE}
        (tab_id, report_year, user_id, email, name, image, location, session_id, editor_path, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (tab_id, report_year) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         email = EXCLUDED.email,
         name = EXCLUDED.name,
         image = EXCLUDED.image,
         location = EXCLUDED.location,
         session_id = EXCLUDED.session_id,
         editor_path = EXCLUDED.editor_path,
         last_seen_at = NOW()`,
      [
        tabId,
        year,
        String(user.id || user.userId || user.email || tabId),
        String(user.email || ""),
        String(user.name || user.email || "User"),
        String(user.image || ""),
        String(payload.location || "preview"),
        payload.sessionId ? String(payload.sessionId) : null,
        payload.editorPath ? String(payload.editorPath) : null,
      ],
    );
    return true;
  } finally {
    client.release();
  }
}

/**
 * @param {number} year
 * @param {string} tabId
 */
export async function removeLivePresence(year, tabId) {
  const y = Number(year);
  const id = String(tabId || "").trim();
  if (!Number.isFinite(y) || !id) return;

  const client = await pool.connect();
  try {
    await ensureTables(client);
    await client.query(
      `DELETE FROM ${PRESENCE_TABLE} WHERE report_year = $1 AND tab_id = $2`,
      [y, id],
    );
  } finally {
    client.release();
  }
}

/**
 * @param {number} year
 * @param {{ sessionId: string, editorPath: string, openedBy?: string }} data
 */
export async function markOnlyOfficeLiveSession(year, data) {
  const y = Number(year);
  if (!Number.isFinite(y) || !data?.sessionId || !data?.editorPath) return;

  const client = await pool.connect();
  try {
    await ensureTables(client);
    await client.query(
      `INSERT INTO ${ONLYOFFICE_TABLE} (report_year, session_id, editor_path, opened_by, opened_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (report_year) DO UPDATE SET
         session_id = EXCLUDED.session_id,
         editor_path = EXCLUDED.editor_path,
         opened_by = EXCLUDED.opened_by,
         opened_at = NOW()`,
      [
        y,
        String(data.sessionId),
        String(data.editorPath),
        data.openedBy ? String(data.openedBy) : null,
      ],
    );
  } finally {
    client.release();
  }
}

/**
 * @param {number} year
 */
export async function clearOnlyOfficeLiveSession(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return;

  const client = await pool.connect();
  try {
    await ensureTables(client);
    await client.query(`DELETE FROM ${ONLYOFFICE_TABLE} WHERE report_year = $1`, [y]);
  } finally {
    client.release();
  }
}

/** Remove stale OnlyOffice signal when nobody is in the editor anymore. */
export async function clearOnlyOfficeLiveSessionIfNoEditors(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return;

  const participants = await listLivePresence(y);
  const hasEditors = participants.some((p) => p.location === "onlyoffice");
  if (!hasEditors) {
    await clearOnlyOfficeLiveSession(y);
  }
}

export async function getOnlyOfficeLiveSession(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;

  const client = await pool.connect();
  try {
    await ensureTables(client);
    const result = await client.query(
      `SELECT report_year, session_id, editor_path, opened_by, opened_at
       FROM ${ONLYOFFICE_TABLE}
       WHERE report_year = $1
         AND opened_at >= NOW() - ($2::int * INTERVAL '1 millisecond')`,
      [y, ONLYOFFICE_SIGNAL_MS],
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}
