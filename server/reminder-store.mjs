// Dedicated store for webinar registrations + Web Push subscriptions.
//
// This is intentionally SEPARATE from the main runtime store (the single
// JSONB app-data blob). Push subscriptions are infrastructure, not domain
// data: they are written at registration time, pruned when the browser's
// push endpoint expires (404/410), and never need to round-trip to Google
// Sheets. Keeping them in their own Postgres tables avoids bloating the
// app-data blob (which is rewritten wholesale on every save) and gives us
// proper per-subscription rows.
//
// When no DATABASE_URL is configured (local dev) it degrades to an in-memory
// store with the same interface so the feature still works for testing.

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const databaseSsl = /^(1|true|yes)$/i.test(String(process.env.DATABASE_SSL || ""))
  ? { rejectUnauthorized: false }
  : undefined;

const REMINDER_OFFSETS = [15, 10, 5]; // minutes before start_time

function randomId() {
  // Crypto-random, matches the uuid-ish ids used elsewhere in the app.
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `rem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function normalizeSubscription(subscription) {
  if (!subscription || typeof subscription !== "object") return null;
  const endpoint = String(subscription.endpoint || "").trim();
  if (!endpoint) return null;
  return subscription;
}

// ---------------------------------------------------------------------------
// In-memory fallback (no database configured)
// ---------------------------------------------------------------------------
function createMemoryReminderStore() {
  const rows = new Map(); // key: `${webinarId}::${endpoint || id}` -> row
  const sentLog = new Set(); // `${webinarId}::${offset}`

  return {
    mode: "memory",
    async init() {
      return this;
    },
    async register({ webinarId, roomName, name, email, phone, subscription }) {
      const sub = normalizeSubscription(subscription);
      const endpoint = sub ? sub.endpoint : "";
      const key = `${webinarId}::${endpoint || randomId()}`;
      const existing = rows.get(key);
      const row = {
        id: existing?.id || randomId(),
        webinar_id: webinarId,
        room_name: roomName,
        name: name || existing?.name || "",
        email: email || existing?.email || "",
        phone: phone || existing?.phone || "",
        endpoint: endpoint || null,
        subscription: sub || existing?.subscription || null,
        created_at: existing?.created_at || new Date().toISOString(),
      };
      rows.set(key, row);
      return { ok: true, subscribed: Boolean(sub) };
    },
    async listSubscriptions(webinarId) {
      const out = [];
      for (const row of rows.values()) {
        if (row.webinar_id === webinarId && row.subscription) {
          out.push({ id: row.id, endpoint: row.endpoint, subscription: row.subscription });
        }
      }
      return out;
    },
    async claimOffset(webinarId, offset) {
      const key = `${webinarId}::${offset}`;
      if (sentLog.has(key)) return false;
      sentLog.add(key);
      return true;
    },
    async removeById(id) {
      for (const [key, row] of rows.entries()) {
        if (row.id === id) rows.delete(key);
      }
    },
    async countForWebinar(webinarId) {
      let total = 0;
      let subscribed = 0;
      for (const row of rows.values()) {
        if (row.webinar_id === webinarId) {
          total += 1;
          if (row.subscription) subscribed += 1;
        }
      }
      return { total, subscribed };
    },
    async close() {},
  };
}

// ---------------------------------------------------------------------------
// Postgres-backed store
// ---------------------------------------------------------------------------
async function createPostgresReminderStore() {
  let Pool;
  try {
    const pg = await import("pg");
    Pool = (pg.default && pg.default.Pool) || pg.Pool;
  } catch (error) {
    console.error("[reminder-store] pg driver unavailable, using in-memory store:", error?.message || error);
    return createMemoryReminderStore();
  }
  if (!Pool) {
    return createMemoryReminderStore();
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: databaseSsl, max: 3 });

  const store = {
    mode: "postgres",
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS webinar_reminders (
          id TEXT PRIMARY KEY,
          webinar_id TEXT NOT NULL,
          room_name TEXT,
          name TEXT,
          email TEXT,
          phone TEXT,
          endpoint TEXT,
          subscription JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      // One subscription endpoint per webinar (re-registering updates in place).
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS webinar_reminders_webinar_endpoint_idx
          ON webinar_reminders (webinar_id, endpoint)
          WHERE endpoint IS NOT NULL;
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS webinar_reminders_webinar_idx
          ON webinar_reminders (webinar_id);
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS webinar_reminder_log (
          webinar_id TEXT NOT NULL,
          offset_minutes INT NOT NULL,
          sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (webinar_id, offset_minutes)
        );
      `);
      return this;
    },

    async register({ webinarId, roomName, name, email, phone, subscription }) {
      const sub = normalizeSubscription(subscription);
      if (sub) {
        // Upsert keyed by (webinar_id, endpoint).
        await pool.query(
          `
          INSERT INTO webinar_reminders (id, webinar_id, room_name, name, email, phone, endpoint, subscription)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (webinar_id, endpoint) WHERE endpoint IS NOT NULL
          DO UPDATE SET
            room_name = EXCLUDED.room_name,
            name = COALESCE(NULLIF(EXCLUDED.name, ''), webinar_reminders.name),
            email = COALESCE(NULLIF(EXCLUDED.email, ''), webinar_reminders.email),
            phone = COALESCE(NULLIF(EXCLUDED.phone, ''), webinar_reminders.phone),
            subscription = EXCLUDED.subscription,
            updated_at = now()
          `,
          [randomId(), webinarId, roomName || null, name || "", email || "", phone || "", sub.endpoint, JSON.stringify(sub)],
        );
        return { ok: true, subscribed: true };
      }
      // Lead capture without push permission (endpoint null row).
      await pool.query(
        `INSERT INTO webinar_reminders (id, webinar_id, room_name, name, email, phone, endpoint, subscription)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL)`,
        [randomId(), webinarId, roomName || null, name || "", email || "", phone || ""],
      );
      return { ok: true, subscribed: false };
    },

    async listSubscriptions(webinarId) {
      const result = await pool.query(
        `SELECT id, endpoint, subscription FROM webinar_reminders
         WHERE webinar_id = $1 AND subscription IS NOT NULL`,
        [webinarId],
      );
      return result.rows.map((row) => ({
        id: row.id,
        endpoint: row.endpoint,
        subscription: typeof row.subscription === "string" ? JSON.parse(row.subscription) : row.subscription,
      }));
    },

    // Atomically claim a (webinar, offset) reminder slot. Returns true only to
    // the ONE caller that inserted the row — restart-safe, no double-sends even
    // across multiple scheduler ticks or a process restart.
    async claimOffset(webinarId, offset) {
      const result = await pool.query(
        `INSERT INTO webinar_reminder_log (webinar_id, offset_minutes)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [webinarId, offset],
      );
      return result.rowCount === 1;
    },

    async removeById(id) {
      await pool.query(`DELETE FROM webinar_reminders WHERE id = $1`, [id]);
    },

    async countForWebinar(webinarId) {
      const result = await pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(subscription)::int AS subscribed
         FROM webinar_reminders WHERE webinar_id = $1`,
        [webinarId],
      );
      return result.rows[0] || { total: 0, subscribed: 0 };
    },

    async close() {
      await pool.end().catch(() => {});
    },
  };

  return store;
}

export const REMINDER_OFFSET_MINUTES = REMINDER_OFFSETS;

export async function createReminderStore() {
  if (!databaseUrl) {
    console.warn("[reminder-store] DATABASE_URL not set — registrations/push subscriptions are in-memory only (dev mode).");
    return createMemoryReminderStore().init();
  }
  try {
    const store = await createPostgresReminderStore();
    return await store.init();
  } catch (error) {
    console.error("[reminder-store] Postgres init failed, falling back to in-memory:", error?.message || error);
    return createMemoryReminderStore().init();
  }
}
