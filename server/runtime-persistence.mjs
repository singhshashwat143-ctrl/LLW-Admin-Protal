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

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const collectionIdentitySpecs = {
  team: [["id"], ["email"]],
  students: [["id"], ["email"], ["phone"]],
  products: [["id"], ["slug"], ["name"]],
  orders: [["id"], ["order_number"]],
  payment_records: [["id"], ["transaction_id"], ["reference_code"], ["order_id", "amount_inr", "paid_at"], ["order_id", "amount_inr", "created_at"]],
  due_promises: [["id"], ["order_id"]],
  refunds: [["id"], ["order_id", "amount_inr", "created_at"]],
  links: [["id"], ["slug"], ["short_url"]],
  webinars: [["id"], ["slug"], ["livekit_room_name"]],
  bootcamps: [["id"], ["slug"], ["title"]],
  instructors: [["id"], ["slug"], ["name"]],
  webinarSessions: [["id"], ["room_name"], ["webinar_id", "title", "start_time"]],
  webinarAttendance: [["id"], ["session_id", "role", "email", "phone", "name", "join_time"]],
  marketing_spend: [["id"]],
};

function normalizeIdentityPart(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

function buildRecordIdentity(collectionName, record) {
  if (!isPlainObject(record)) {
    return JSON.stringify(record);
  }

  const specs = collectionIdentitySpecs[collectionName] || [["id"]];
  for (const spec of specs) {
    const parts = spec.map((field) => normalizeIdentityPart(record[field]));
    if (parts.every(Boolean)) {
      return `${collectionName}:${spec.join("+")}:${parts.join("|")}`;
    }
  }

  return record.id ? `${collectionName}:id:${normalizeIdentityPart(record.id)}` : JSON.stringify(record);
}

function getRecordTimestamp(record) {
  if (!isPlainObject(record)) return Number.NaN;
  const candidateKeys = [
    "updated_at",
    "updatedAt",
    "paid_at",
    "paidAt",
    "approved_at",
    "approvedAt",
    "join_time",
    "joinTime",
    "created_at",
    "createdAt",
  ];

  for (const key of candidateKeys) {
    const value = record[key];
    if (!value) continue;
    const timestamp = new Date(value).getTime();
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }

  return Number.NaN;
}

function choosePreferredRecord(existingRecord, incomingRecord) {
  const existingTimestamp = getRecordTimestamp(existingRecord);
  const incomingTimestamp = getRecordTimestamp(incomingRecord);

  if (Number.isFinite(existingTimestamp) && Number.isFinite(incomingTimestamp)) {
    return incomingTimestamp > existingTimestamp ? incomingRecord : existingRecord;
  }

  if (Number.isFinite(incomingTimestamp) && !Number.isFinite(existingTimestamp)) {
    return incomingRecord;
  }

  return existingRecord;
}

function mergeArrayCollection(collectionName, existingValue, incomingValue) {
  const existing = Array.isArray(existingValue) ? existingValue : [];
  const incoming = Array.isArray(incomingValue) ? incomingValue : [];
  const merged = [];
  const indexByIdentity = new Map();

  const addRecord = (record) => {
    const identity = buildRecordIdentity(collectionName, record);
    const existingIndex = indexByIdentity.get(identity);
    if (existingIndex === undefined) {
      indexByIdentity.set(identity, merged.length);
      merged.push(record);
      return;
    }

    merged[existingIndex] = choosePreferredRecord(merged[existingIndex], record);
  };

  existing.forEach(addRecord);
  incoming.forEach(addRecord);

  return merged;
}

function mergeSnapshots(existingPayload, incomingPayload) {
  const existing = isPlainObject(existingPayload) ? existingPayload : {};
  const incoming = isPlainObject(incomingPayload) ? incomingPayload : {};
  const merged = { ...existing };

  for (const [key, incomingValue] of Object.entries(incoming)) {
    const existingValue = merged[key];

    if (Array.isArray(existingValue) || Array.isArray(incomingValue)) {
      merged[key] = mergeArrayCollection(key, existingValue, incomingValue);
      continue;
    }

    if (isPlainObject(existingValue) && isPlainObject(incomingValue)) {
      merged[key] = {
        ...existingValue,
        ...incomingValue,
      };
      continue;
    }

    if (existingValue === undefined) {
      merged[key] = incomingValue;
    }
  }

  return merged;
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
    if (requireDatabasePersistence) {
      throw new Error("REQUIRE_DATABASE_PERSISTENCE is enabled, but DATABASE_URL is not configured.");
    }
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
    const mergedPayload = mergeSnapshots(row.payload, fallbackData);
    const mergedChecksum = buildChecksum(JSON.stringify(mergedPayload));

    if (mergedChecksum !== lastChecksum) {
      await persistNow(clonePayload(mergedPayload), "merge-json-fallback");
    }

    return mergedPayload;
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
