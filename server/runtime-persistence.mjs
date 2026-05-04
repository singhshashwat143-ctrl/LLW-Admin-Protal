import { createHash } from "node:crypto";
import { Pool } from "pg";

const runtimeStateTable = "app_runtime_state";
const runtimeStateKey = "primary";
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const requireDatabasePersistence = /^(1|true|yes)$/i.test(String(process.env.REQUIRE_DATABASE_PERSISTENCE || ""));
const databaseSsl =
  /^(1|true|yes)$/i.test(String(process.env.DATABASE_SSL || ""))
    ? { rejectUnauthorized: false }
    : undefined;

function buildChecksum(payloadText) {
  return createHash("sha256").update(payloadText).digest("hex");
}

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

function createDisabledPersistence() {
  return {
    enabled: false,
    async load(fallbackData) {
      return fallbackData;
    },
    save() {
      return Promise.resolve();
    },
    flush() {
      return Promise.resolve();
    },
    async close() {},
    getStatus() {
      return {
        enabled: false,
        mode: "json-file",
        revision: 0,
        updated_at: null,
        last_error: null,
      };
    },
  };
}

export async function createRuntimePersistence() {
  if (!databaseUrl) {
    return createDisabledPersistence();
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseSsl,
    max: 5,
  });

  let writeQueue = Promise.resolve();
  let lastChecksum = "";
  let revision = 0;
  let updatedAt = null;
  let lastError = null;

  async function bootstrap() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${runtimeStateTable} (
        store_key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        checksum TEXT NOT NULL,
        revision BIGINT NOT NULL DEFAULT 1,
        source TEXT NOT NULL DEFAULT 'server',
        last_reason TEXT NOT NULL DEFAULT 'persist',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  }

  async function persistNow(snapshot, reason = "persist") {
    const payloadText = JSON.stringify(snapshot);
    const checksum = buildChecksum(payloadText);

    if (checksum === lastChecksum) {
      return;
    }

    const result = await pool.query(
      `
        INSERT INTO ${runtimeStateTable} (store_key, payload, checksum, revision, source, last_reason)
        VALUES ($1, $2::jsonb, $3, 1, 'server', $4)
        ON CONFLICT (store_key) DO UPDATE
        SET payload = EXCLUDED.payload,
            checksum = EXCLUDED.checksum,
            revision = ${runtimeStateTable}.revision + 1,
            source = EXCLUDED.source,
            last_reason = EXCLUDED.last_reason,
            updated_at = now()
        RETURNING revision, updated_at;
      `,
      [runtimeStateKey, payloadText, checksum, reason],
    );

    lastChecksum = checksum;
    revision = Number(result.rows[0]?.revision || revision || 1);
    updatedAt = result.rows[0]?.updated_at || updatedAt;
    lastError = null;
  }

  async function load(fallbackData) {
    await bootstrap();

    const result = await pool.query(
      `SELECT payload, checksum, revision, updated_at FROM ${runtimeStateTable} WHERE store_key = $1 LIMIT 1`,
      [runtimeStateKey],
    );

    if (!result.rowCount) {
      await persistNow(clonePayload(fallbackData), "bootstrap-from-json");
      return fallbackData;
    }

    const row = result.rows[0];
    lastChecksum = String(row.checksum || "");
    revision = Number(row.revision || 0);
    updatedAt = row.updated_at || null;
    lastError = null;
    return row.payload;
  }

  function save(snapshot, reason = "persist") {
    const cloned = clonePayload(snapshot);
    writeQueue = writeQueue
      .then(() => persistNow(cloned, reason))
      .catch((error) => {
        lastError = error;
        if (requireDatabasePersistence) {
          throw error;
        }
        console.error("[runtime-persistence] PostgreSQL write failed, continuing on local snapshot:", error);
      });
    return writeQueue;
  }

  async function flush() {
    return writeQueue;
  }

  async function close() {
    try {
      await flush();
    } finally {
      await pool.end();
    }
  }

  return {
    enabled: true,
    load,
    save,
    flush,
    close,
    getStatus() {
      return {
        enabled: true,
        mode: "postgres",
        revision,
        updated_at: updatedAt,
        last_error: lastError ? String(lastError.message || lastError) : null,
      };
    },
  };
}
