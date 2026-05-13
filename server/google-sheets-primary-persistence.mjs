import { createHash, randomUUID } from "node:crypto";

const defaultWebAppUrl = "https://script.google.com/macros/s/AKfycbzSnSEociIsfEUnuvysPzrjBsiB8pRQwKMBt2I5yHfx7afBGBWDFH3jfCE1OYD0DbQI/exec";
const runtimeCollectionKeys = [
  "team",
  "students",
  "products",
  "coupons",
  "orders",
  "payment_records",
  "due_promises",
  "refunds",
  "links",
  "webinars",
  "webinarSessions",
  "webinarAttendance",
  "bootcamps",
  "instructors",
  "marketing_spend",
  "settings",
  "attendanceTimeline",
];

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function nowIso() {
  return new Date().toISOString();
}

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildChecksum(payloadText) {
  return createHash("sha256").update(payloadText).digest("hex");
}

function buildSignature(payload) {
  return buildChecksum(JSON.stringify(payload));
}

const collectionIdentitySpecs = {
  team: [["id"], ["email"]],
  students: [["id"], ["email"], ["phone"]],
  products: [["id"], ["slug"], ["name"]],
  coupons: [["id"], ["code"]],
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
  attendanceTimeline: [["minute"]],
  settings: [["id"]],
};

function normalizeIdentityPart(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

function buildRecordIdentity(collectionName, record, index = 0) {
  if (!isPlainObject(record)) {
    return `${collectionName}:scalar:${index}:${JSON.stringify(record)}`;
  }

  const specs = collectionIdentitySpecs[collectionName] || [["id"]];
  for (const spec of specs) {
    const parts = spec.map((field) => normalizeIdentityPart(record[field]));
    if (parts.every(Boolean)) {
      return `${collectionName}:${spec.join("+")}:${parts.join("|")}`;
    }
  }

  if (collectionName === "settings") return "settings:singleton";
  return record.id ? `${collectionName}:id:${normalizeIdentityPart(record.id)}` : `${collectionName}:index:${index}`;
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
    if (Number.isFinite(timestamp)) return timestamp;
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

  const addRecord = (record, index) => {
    const identity = buildRecordIdentity(collectionName, record, index);
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

function buildProductBatchCollection(products) {
  return products.flatMap((product) => (
    Array.isArray(product.batches)
      ? product.batches.map((batch) => ({
          product_id: product.id || "",
          product_name: product.name || "",
          product_slug: product.slug || "",
          product_mode: product.mode || "",
          product_category: product.category || "",
          batch_key: batch.key || "",
          batch_label: batch.label || "",
          batch_is_active: Boolean(batch.is_active),
          product_is_active: Boolean(product.is_active),
          price: Number(product.price || 0),
          discounted_price: Number(product.discounted_price || 0),
          updated_at: product.updated_at || batch.updated_at || "",
        }))
      : []
  ));
}

function buildProductSessionCollection(products) {
  return products.flatMap((product) => (
    Array.isArray(product.session_dates)
      ? product.session_dates.map((session, index) => ({
          product_id: product.id || "",
          product_name: product.name || "",
          product_slug: product.slug || "",
          session_key: session.key || `session_${index + 1}`,
          session_label: session.label || "",
          session_date: session.session_date || session.date || "",
          updated_at: product.updated_at || "",
        }))
      : []
  ));
}

function buildRuntimeCollections(snapshot) {
  const collections = {};

  for (const key of runtimeCollectionKeys) {
    const value = snapshot[key];
    if (Array.isArray(value)) {
      collections[key] = clonePayload(value);
    } else if (isPlainObject(value)) {
      collections[key] = [clonePayload(value)];
    } else if (value !== undefined) {
      collections[key] = [{ value }];
    } else {
      collections[key] = [];
    }
  }

  const products = Array.isArray(snapshot.products) ? snapshot.products : [];
  collections.product_batches = buildProductBatchCollection(products);
  collections.product_session_dates = buildProductSessionCollection(products);

  return collections;
}

function buildEventRecordId(sheet, record, index = 0) {
  return buildRecordIdentity(sheet, record, index);
}

function indexRecordsByIdentity(sheet, records) {
  const index = new Map();
  records.forEach((record, position) => {
    index.set(buildEventRecordId(sheet, record, position), record);
  });
  return index;
}

function buildDiffEvents(previousCollections, nextCollections, meta) {
  const events = [];
  const sheetNames = new Set([
    ...Object.keys(previousCollections || {}),
    ...Object.keys(nextCollections || {}),
  ]);

  for (const sheet of sheetNames) {
    const previousIndex = indexRecordsByIdentity(sheet, previousCollections?.[sheet] || []);
    const nextIndex = indexRecordsByIdentity(sheet, nextCollections?.[sheet] || []);
    const recordIds = new Set([...previousIndex.keys(), ...nextIndex.keys()]);

    for (const recordId of recordIds) {
      const previousRecord = previousIndex.get(recordId);
      const nextRecord = nextIndex.get(recordId);

      if (!previousRecord && nextRecord) {
        events.push(buildEventRow(sheet, "created", recordId, nextRecord, meta));
        continue;
      }

      if (previousRecord && !nextRecord) {
        events.push(buildEventRow(sheet, "deleted", recordId, previousRecord, meta));
        continue;
      }

      if (buildSignature(previousRecord) !== buildSignature(nextRecord)) {
        events.push(buildEventRow(sheet, "updated", recordId, nextRecord, meta));
      }
    }
  }

  return events;
}

function buildEventRow(sheet, eventType, recordId, record, meta) {
  return {
    __sheet: sheet,
    __mode: "event",
    __event_type: eventType,
    __record_id: recordId,
    __synced_at: meta.syncedAt,
    __sync_run_id: meta.syncRunId,
    __source: meta.source,
    __app_url: meta.appUrl,
    __payload_json: JSON.stringify(record),
  };
}

async function parseResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

export async function createGoogleSheetsPrimaryPersistence() {
  const webAppUrl = String(process.env.GOOGLE_SHEETS_WEB_APP_URL || defaultWebAppUrl).trim();
  if (!webAppUrl) {
    throw new Error("GOOGLE_SHEETS_WEB_APP_URL is required when GOOGLE_SHEETS_AS_PRIMARY_DB is enabled.");
  }

  const requestTimeoutMs = Math.max(Number(process.env.GOOGLE_SHEETS_SYNC_TIMEOUT_MS || 20000) || 20000, 1000);
  const source = String(process.env.GOOGLE_SHEETS_SYNC_SOURCE || "llw-webinare").trim() || "llw-webinare";
  const appUrl = String(process.env.PUBLIC_APP_URL || "").trim();

  let writeQueue = Promise.resolve();
  let lastChecksum = "";
  let revision = 0;
  let updatedAt = null;
  let lastError = null;
  let lastSnapshot = null;

  async function postPayload(payload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    let response;
    try {
      response = await fetch(webAppUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Google Sheets primary persistence timed out after ${requestTimeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const body = await parseResponse(response);
    if (!response.ok) {
      throw new Error(`Google Sheets primary persistence failed with ${response.status}${body?.message ? `: ${body.message}` : ""}`);
    }
    if (body && body.ok === false) {
      throw new Error(body.message || "Google Sheets primary persistence returned ok=false");
    }
    return body;
  }

  async function load(fallbackData) {
    const response = await postPayload({
      action: "read_runtime_snapshot",
      source,
    });

    const remoteSnapshot = response?.snapshot ? clonePayload(response.snapshot) : null;
    if (!remoteSnapshot) {
      const clonedFallback = clonePayload(fallbackData);
      await persistNow(clonedFallback, "bootstrap-from-fallback", { force: true });
      return clonedFallback;
    }

    const merged = mergeSnapshots(remoteSnapshot, fallbackData);
    lastSnapshot = clonePayload(merged);
    lastChecksum = buildChecksum(JSON.stringify(merged));
    revision = Number(response?.revision || 0);
    updatedAt = response?.updatedAt || null;
    lastError = null;
    return merged;
  }

  async function persistNow(snapshot, reason = "persist", { force = false } = {}) {
    const cloned = clonePayload(snapshot);
    const checksum = buildChecksum(JSON.stringify(cloned));

    if (!force && checksum === lastChecksum) {
      return;
    }

    const previousCollections = buildRuntimeCollections(lastSnapshot || {});
    const nextCollections = buildRuntimeCollections(cloned);
    const nextRevision = revision + 1;
    const syncedAt = nowIso();
    const syncRunId = randomUUID();
    const events = buildDiffEvents(previousCollections, nextCollections, {
      source,
      appUrl,
      syncedAt,
      syncRunId,
    });

    await postPayload({
      type: "runtime_snapshot",
      source,
      app_url: appUrl,
      generated_at: syncedAt,
      sync_run_id: syncRunId,
      reason,
      revision: nextRevision,
      checksum,
      snapshot: cloned,
      collections: nextCollections,
      events,
    });

    lastSnapshot = cloned;
    lastChecksum = checksum;
    revision = nextRevision;
    updatedAt = syncedAt;
    lastError = null;
  }

  function save(snapshot, reason = "persist") {
    const cloned = clonePayload(snapshot);
    writeQueue = writeQueue
      .then(() => persistNow(cloned, reason))
      .catch((error) => {
        lastError = error;
        throw error;
      });
    return writeQueue;
  }

  async function flush() {
    return writeQueue;
  }

  async function close() {
    await flush();
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
        mode: "google-sheets-primary",
        revision,
        updated_at: updatedAt,
        last_error: lastError ? String(lastError.message || lastError) : null,
        web_app_url: webAppUrl,
      };
    },
  };
}
