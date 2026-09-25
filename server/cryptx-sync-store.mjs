// CryptX client sync — a dedicated store for the client roster pushed from the
// CryptX product box (cryptx.wealthx.tech). CryptX runs a read-only exporter on
// a cron that maps its users/accounts/invoices and POSTs them to this app's
// /api/cryptx-sync/ingest; we upsert them here, keyed by email, so the funnel
// can join a lead to their CryptX deposit/profit/payment state.
//
// Kept in its own Postgres table (not the app-data JSONB blob), same as the
// reminder store. Falls back to an in-memory map when no DATABASE_URL.

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const databaseSsl = /^(1|true|yes)$/i.test(String(process.env.DATABASE_SSL || ""))
  ? { rejectUnauthorized: false }
  : undefined;

function normalizeClient(row = {}) {
  const email = String(row.email || "").trim().toLowerCase();
  if (!email) return null;
  const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
  return {
    email,
    name: row.name ? String(row.name) : null,
    cryptx_uid: row.cryptx_uid ?? null,
    balance_usd: num(row.balance_usd),
    payment_status: String(row.payment_status || "none"),
    paid_until: row.paid_until || null,
    activation_paid: Boolean(row.activation_paid),
    total_profit_usd: num(row.total_profit_usd) || 0,
    total_paid_inr: num(row.total_paid_inr) || 0,
    open_inr: num(row.open_inr) || 0,
    n_accounts: Number(row.n_accounts || 0),
    n_invoices: Number(row.n_invoices || 0),
    is_client: Boolean(row.is_client),
    signed_up: row.signed_up || null,
  };
}

function createMemoryStore() {
  const rows = new Map();
  let lastSyncAt = null;
  return {
    mode: "memory",
    async init() { return this; },
    async upsertMany(clients = []) {
      let n = 0;
      for (const raw of clients) {
        const c = normalizeClient(raw);
        if (!c) continue;
        rows.set(c.email, { ...c, synced_at: new Date().toISOString() });
        n += 1;
      }
      lastSyncAt = new Date().toISOString();
      return { upserted: n };
    },
    async list() { return [...rows.values()]; },
    async getByEmail(email) { return rows.get(String(email || "").toLowerCase()) || null; },
    async status() {
      const all = [...rows.values()];
      return {
        mode: "memory",
        total: all.length,
        clients: all.filter((r) => r.is_client).length,
        paid: all.filter((r) => r.payment_status === "paid").length,
        total_balance_usd: all.reduce((s, r) => s + (r.balance_usd || 0), 0),
        total_profit_usd: all.reduce((s, r) => s + (r.total_profit_usd || 0), 0),
        last_sync_at: lastSyncAt,
      };
    },
    async close() {},
  };
}

async function createPostgresStore() {
  let Pool;
  try {
    const pg = await import("pg");
    Pool = (pg.default && pg.default.Pool) || pg.Pool;
  } catch (error) {
    console.error("[cryptx-sync] pg unavailable, using in-memory:", error?.message || error);
    return createMemoryStore();
  }
  if (!Pool) return createMemoryStore();
  const pool = new Pool({ connectionString: databaseUrl, ssl: databaseSsl, max: 3 });

  return {
    mode: "postgres",
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cryptx_clients (
          email            TEXT PRIMARY KEY,
          name             TEXT,
          cryptx_uid       INTEGER,
          balance_usd      DOUBLE PRECISION,
          payment_status   TEXT DEFAULT 'none',
          paid_until       TEXT,
          activation_paid  BOOLEAN DEFAULT false,
          total_profit_usd DOUBLE PRECISION DEFAULT 0,
          total_paid_inr   DOUBLE PRECISION DEFAULT 0,
          open_inr         DOUBLE PRECISION DEFAULT 0,
          n_accounts       INTEGER DEFAULT 0,
          n_invoices       INTEGER DEFAULT 0,
          is_client        BOOLEAN DEFAULT false,
          signed_up        TEXT,
          synced_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`ALTER TABLE cryptx_clients ADD COLUMN IF NOT EXISTS name TEXT;`);
      await pool.query(`CREATE INDEX IF NOT EXISTS cryptx_clients_is_client_idx ON cryptx_clients (is_client);`);
      return this;
    },

    async upsertMany(clients = []) {
      const normalized = clients.map(normalizeClient).filter(Boolean);
      let upserted = 0;
      for (const c of normalized) {
        await pool.query(
          `INSERT INTO cryptx_clients
             (email, name, cryptx_uid, balance_usd, payment_status, paid_until, activation_paid,
              total_profit_usd, total_paid_inr, open_inr, n_accounts, n_invoices, is_client, signed_up, synced_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
           ON CONFLICT (email) DO UPDATE SET
             name=EXCLUDED.name, cryptx_uid=EXCLUDED.cryptx_uid, balance_usd=EXCLUDED.balance_usd,
             payment_status=EXCLUDED.payment_status, paid_until=EXCLUDED.paid_until,
             activation_paid=EXCLUDED.activation_paid, total_profit_usd=EXCLUDED.total_profit_usd,
             total_paid_inr=EXCLUDED.total_paid_inr, open_inr=EXCLUDED.open_inr,
             n_accounts=EXCLUDED.n_accounts, n_invoices=EXCLUDED.n_invoices,
             is_client=EXCLUDED.is_client, signed_up=EXCLUDED.signed_up, synced_at=now()`,
          [c.email, c.name, c.cryptx_uid, c.balance_usd, c.payment_status, c.paid_until, c.activation_paid,
           c.total_profit_usd, c.total_paid_inr, c.open_inr, c.n_accounts, c.n_invoices, c.is_client, c.signed_up],
        );
        upserted += 1;
      }
      return { upserted };
    },

    async list() {
      const r = await pool.query(`SELECT * FROM cryptx_clients ORDER BY is_client DESC, total_profit_usd DESC`);
      return r.rows;
    },
    async getByEmail(email) {
      const r = await pool.query(`SELECT * FROM cryptx_clients WHERE email=$1`, [String(email || "").toLowerCase()]);
      return r.rows[0] || null;
    },
    async status() {
      const r = await pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE is_client)::int AS clients,
               COUNT(*) FILTER (WHERE payment_status='paid')::int AS paid,
               COALESCE(SUM(balance_usd),0) AS total_balance_usd,
               COALESCE(SUM(total_profit_usd),0) AS total_profit_usd,
               MAX(synced_at) AS last_sync_at
        FROM cryptx_clients`);
      return { mode: "postgres", ...r.rows[0] };
    },
    async close() { await pool.end().catch(() => {}); },
  };
}

export async function createCryptxSyncStore() {
  if (!databaseUrl) {
    console.warn("[cryptx-sync] DATABASE_URL not set — CryptX client sync is in-memory only (dev).");
    return createMemoryStore().init();
  }
  try {
    return await (await createPostgresStore()).init();
  } catch (error) {
    console.error("[cryptx-sync] Postgres init failed, in-memory fallback:", error?.message || error);
    return createMemoryStore().init();
  }
}
