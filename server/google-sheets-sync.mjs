import { createHash, randomUUID } from "node:crypto";

const defaultWebAppUrl = "https://script.google.com/macros/s/AKfycbzSnSEociIsfEUnuvysPzrjBsiB8pRQwKMBt2I5yHfx7afBGBWDFH3jfCE1OYD0DbQI/exec";
const monitoredCollections = [
  "team",
  "students",
  "products",
  "coupons",
  "refunds",
  "webinars",
  "bootcamps",
  "instructors",
  "links",
  "marketing_spend",
];

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function nowIso() {
  return new Date().toISOString();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeScalar(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function flattenRecord(value, prefix = "", target = {}) {
  if (Array.isArray(value)) {
    if (prefix) {
      target[prefix] = JSON.stringify(value);
    }
    return target;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (!entries.length && prefix) {
      target[prefix] = "";
      return target;
    }

    for (const [key, child] of entries) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenRecord(child, nextPrefix, target);
    }
    return target;
  }

  if (prefix) {
    target[prefix] = normalizeScalar(value);
  }
  return target;
}

function buildSignature(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function getRecordId(sheet, record) {
  const directCandidates = [
    record?.id,
    record?.payment_id,
    record?.order_id,
    record?.refund_id,
    record?.transaction_id,
    record?.slug,
  ];

  for (const candidate of directCandidates) {
    if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }

  if (record?.email) return `${sheet}:${String(record.email).trim().toLowerCase()}`;
  if (record?.code) return `${sheet}:${String(record.code).trim().toUpperCase()}`;
  if (record?.reference_code) return `${sheet}:${String(record.reference_code).trim()}`;

  return `${sheet}:${buildSignature(record).slice(0, 24)}`;
}

function buildPaymentCollection(store, enrichedOrders) {
  const orderById = new Map(enrichedOrders.map((order) => [order.id, order]));
  const paymentRecords = Array.isArray(store.data?.payment_records) ? store.data.payment_records : [];

  return paymentRecords.map((payment) => {
    const order = orderById.get(payment.order_id) || null;
    return {
      ...payment,
      order_number: order?.order_number || "",
      order_status: order?.status || "",
      payment_state: order?.payment_state || "",
      customer_name: order?.student?.name || "",
      customer_phone: order?.student?.phone || "",
      customer_email: order?.student?.email || "",
      product_id: order?.product?.id || "",
      product_name: order?.offer_title || order?.product?.name || "",
      batch_month_key: order?.batch_month_key || "",
      batch_month_label: order?.batch_month_label || "",
      bda_id: order?.bda?.id || "",
      bda_name: order?.bda?.name || "",
      manager_name: order?.manager_name || "",
      source_type: order?.source_type || "",
      source_label: order?.source_label || "",
    };
  });
}

function buildRefundCollection(store, enrichedOrders) {
  const refunds = Array.isArray(store.data?.refunds) ? store.data.refunds : [];
  const orderById = new Map(enrichedOrders.map((order) => [order.id, order]));

  return refunds.map((refund) => {
    const order = orderById.get(refund.order_id) || null;
    return {
      ...refund,
      order_number: order?.order_number || "",
      customer_name: refund.student_name || order?.student?.name || "",
      customer_phone: refund.phone || order?.student?.phone || "",
      product_id: order?.product?.id || "",
      product_name: order?.offer_title || order?.product?.name || refund.course_name || "",
      batch_month_key: order?.batch_month_key || "",
      batch_month_label: order?.batch_month_label || "",
      bda_id: order?.bda?.id || "",
      bda_name: order?.bda?.name || "",
      manager_name: order?.manager_name || "",
      source_type: order?.source_type || "",
      source_label: order?.source_label || "",
    };
  });
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

function buildSubscriptionTrackingCollection(store, enrichedOrders) {
  const paymentRecords = Array.isArray(store.data?.payment_records) ? store.data.payment_records : [];
  const paymentsByOrderId = new Map();

  paymentRecords.forEach((payment) => {
    const list = paymentsByOrderId.get(payment.order_id) || [];
    list.push(payment);
    paymentsByOrderId.set(payment.order_id, list);
  });

  return enrichedOrders
    .filter((order) => String(order?.billing_model || "").toUpperCase() === "SUBSCRIPTION")
    .map((order) => {
      const subscriptionPayments = (paymentsByOrderId.get(order.id) || [])
        .filter((payment) => (
          String(payment.subscription_plan_id || "").trim()
          || String(payment.razorpay_subscription_id || "").trim()
          || String(payment.payment_link || "").includes("/subscription/")
        ))
        .sort((left, right) => new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime());
      const payment = subscriptionPayments[0] || null;
      const mandateStatus = String(order.subscription_status || payment?.subscription_status || "created").toLowerCase();
      const activeMandate = mandateStatus === "authenticated" || mandateStatus === "active";
      const stoppedMandate = ["cancelled", "completed"].includes(mandateStatus);
      const failedMandate = ["halted", "expired", "failed"].includes(mandateStatus);
      const monthlyAmountInr = Number(order.subscription_amount_inr || order.product_value_inr || 0);

      return {
        id: order.id,
        order_id: order.id,
        payment_id: payment?.id || "",
        order_number: order.order_number || "",
        customer_name: order.student?.name || "",
        customer_phone: order.student?.phone || "",
        customer_email: order.student?.email || "",
        product_id: order.product?.id || order.product_id || "",
        product_name: order.offer_title || order.product?.name || "",
        billing_model: "SUBSCRIPTION",
        mandate_status: mandateStatus,
        mandate_state: activeMandate ? "ACTIVE" : stoppedMandate ? "STOPPED" : failedMandate ? "FAILED" : "PENDING",
        subscription_id: order.subscription_id || payment?.razorpay_subscription_id || "",
        subscription_plan_id: order.subscription_plan_id || payment?.subscription_plan_id || "",
        subscription_interval: order.subscription_interval || "MONTHLY",
        subscription_amount_inr: monthlyAmountInr,
        amount_paid_inr: Number(order.amount_paid_inr || 0),
        net_cash_in_hand_inr: Number(order.net_cash_in_hand_inr || 0),
        payment_state: order.payment_state || "",
        order_status: order.status || "",
        current_cycle_start: order.subscription_current_start || payment?.subscription_current_start || "",
        current_cycle_end: order.subscription_current_end || payment?.subscription_current_end || "",
        next_charge_at: order.subscription_charge_at || payment?.subscription_charge_at || "",
        mandate_authorized_at: payment?.subscription_authorized_at || "",
        latest_transaction_id: order.latest_transaction_id || payment?.transaction_id || "",
        latest_payment_status: order.latest_payment_status || payment?.status || "",
        latest_payment_method: order.latest_payment_method || payment?.method || "",
        payment_link: order.payment_link || payment?.payment_link || "",
        subscription_short_url: payment?.subscription_short_url || "",
        bda_id: order.bda?.id || order.bda_id || "",
        bda_name: order.bda?.name || "",
        manager_name: order.manager_name || "",
        source_type: order.source_type || "",
        source_label: order.source_label || "",
        created_at: order.created_at || "",
        updated_at: payment?.updated_at || order.updated_at || order.created_at || "",
      };
    });
}

function collectCollections(store) {
  const enrichedOrders = typeof store.getOrders === "function"
    ? cloneValue(store.getOrders())
    : cloneValue(store.data?.orders || []);
  const products = cloneValue(store.data?.products || []);

  const collections = {
    products,
    product_batches: buildProductBatchCollection(products),
    product_session_dates: buildProductSessionCollection(products),
    orders: enrichedOrders,
    payment_records: buildPaymentCollection(store, enrichedOrders),
    subscription_tracking: buildSubscriptionTrackingCollection(store, enrichedOrders),
    refunds: buildRefundCollection(store, enrichedOrders),
  };

  for (const key of monitoredCollections) {
    if (key === "products" || key === "refunds") continue;
    collections[key] = cloneValue(store.data?.[key] || []);
  }

  return collections;
}

function buildSheetRow(sheet, record, meta) {
  return {
    __sheet: sheet,
    __mode: meta.mode,
    __event_type: meta.eventType,
    __record_id: meta.recordId,
    __synced_at: meta.syncedAt,
    __sync_run_id: meta.syncRunId,
    __source: meta.source,
    __app_url: meta.appUrl,
    __payload_json: JSON.stringify(record),
    ...flattenRecord(record),
  };
}

function buildFullSyncPayload(collections, meta) {
  const sheets = {};

  for (const [sheet, records] of Object.entries(collections)) {
    sheets[sheet] = records.map((record) => buildSheetRow(sheet, record, {
      ...meta,
      mode: "full_sync",
      eventType: "snapshot",
      recordId: getRecordId(sheet, record),
    }));
  }

  return {
    type: "full_sync",
    source: meta.source,
    app_url: meta.appUrl,
    generated_at: meta.syncedAt,
    sync_run_id: meta.syncRunId,
    sheets,
  };
}

function indexRecordsById(sheet, records) {
  const index = new Map();

  for (const record of records) {
    index.set(getRecordId(sheet, record), record);
  }

  return index;
}

function buildDiffEvents(previousCollections, nextCollections, meta) {
  const events = [];
  const sheetNames = new Set([
    ...Object.keys(previousCollections || {}),
    ...Object.keys(nextCollections || {}),
  ]);

  for (const sheet of sheetNames) {
    const previousIndex = indexRecordsById(sheet, previousCollections?.[sheet] || []);
    const nextIndex = indexRecordsById(sheet, nextCollections?.[sheet] || []);
    const recordIds = new Set([...previousIndex.keys(), ...nextIndex.keys()]);

    for (const recordId of recordIds) {
      const previousRecord = previousIndex.get(recordId);
      const nextRecord = nextIndex.get(recordId);

      if (!previousRecord && nextRecord) {
        events.push(buildSheetRow(sheet, nextRecord, {
          ...meta,
          mode: "event",
          eventType: "created",
          recordId,
        }));
        continue;
      }

      if (previousRecord && !nextRecord) {
        events.push(buildSheetRow(sheet, previousRecord, {
          ...meta,
          mode: "event",
          eventType: "deleted",
          recordId,
        }));
        continue;
      }

      if (buildSignature(previousRecord) !== buildSignature(nextRecord)) {
        events.push(buildSheetRow(sheet, nextRecord, {
          ...meta,
          mode: "event",
          eventType: "updated",
          recordId,
        }));
      }
    }
  }

  return events;
}

async function parseResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

export function createGoogleSheetsMirror({ appUrl = "" } = {}) {
  const configuredUrl = String(process.env.GOOGLE_SHEETS_WEB_APP_URL || defaultWebAppUrl).trim();
  const normalizedAppUrl = String(appUrl || "").trim();
  const isLocalApp = !normalizedAppUrl || /localhost|127\.0\.0\.1/i.test(normalizedAppUrl);
  const primaryDatabaseMode = parseBoolean(process.env.GOOGLE_SHEETS_AS_PRIMARY_DB, false);
  const enabled = !primaryDatabaseMode && Boolean(configuredUrl) && (parseBoolean(process.env.GOOGLE_SHEETS_SYNC_ENABLED, false) || !isLocalApp);
  const autoFullSyncOnStartup = parseBoolean(process.env.GOOGLE_SHEETS_SYNC_ON_STARTUP, true);
  const source = String(process.env.GOOGLE_SHEETS_SYNC_SOURCE || "llw-webinare").trim() || "llw-webinare";
  const requestTimeoutMs = Math.max(Number(process.env.GOOGLE_SHEETS_SYNC_TIMEOUT_MS || 20000) || 20000, 1000);

  let snapshot = null;
  let syncQueue = Promise.resolve();
  let lastError = null;
  let lastSyncedAt = null;
  let lastSyncMode = null;
  let lastSyncCounts = {};

  async function postPayload(payload) {
    if (!enabled) {
      return { ok: false, skipped: true, reason: "disabled" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    let response;
    try {
      response = await fetch(configuredUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Google Sheets sync timed out after ${requestTimeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const body = await parseResponse(response);
    if (!response.ok) {
      throw new Error(`Google Sheets sync failed with ${response.status}${body?.message ? `: ${body.message}` : ""}`);
    }

    return body;
  }

  async function persistFullSyncSignature(store, signature, syncedAt) {
    if (typeof store.updateSystemSettings === "function") {
      store.updateSystemSettings({
        google_sheets_last_full_sync_signature: signature,
        google_sheets_last_full_sync_at: syncedAt,
      });
      await store.flush();
    }
  }

  function getStoredFullSyncSignature(store) {
    if (typeof store.getSystemSettings !== "function") return "";
    const settings = store.getSystemSettings() || {};
    return String(settings.google_sheets_last_full_sync_signature || "");
  }

  async function enqueue(task) {
    syncQueue = syncQueue.then(task, task);
    return syncQueue;
  }

  async function initialize(store) {
    snapshot = collectCollections(store);

    if (!enabled || !autoFullSyncOnStartup) {
      return {
        ok: true,
        enabled,
        startupSyncSkipped: true,
      };
    }

    const signature = buildSignature(snapshot);
    if (getStoredFullSyncSignature(store) === signature) {
      return {
        ok: true,
        enabled,
        startupSyncSkipped: true,
        reason: "already-synced",
      };
    }

    return syncFull(store, { reason: "startup-bootstrap", force: true });
  }

  async function syncFull(store, { reason = "manual-full-sync", force = false } = {}) {
    return enqueue(async () => {
      const collections = collectCollections(store);
      const signature = buildSignature(collections);

      if (!force && getStoredFullSyncSignature(store) === signature) {
        snapshot = collections;
        return {
          ok: true,
          skipped: true,
          reason: "already-synced",
          signature,
        };
      }

      const syncedAt = nowIso();
      const syncRunId = randomUUID();
      const payload = buildFullSyncPayload(collections, {
        appUrl: normalizedAppUrl,
        source,
        syncedAt,
        syncRunId,
      });

      try {
        const response = await postPayload(payload);
        snapshot = collections;
        lastError = null;
        lastSyncedAt = syncedAt;
        lastSyncMode = "full_sync";
        lastSyncCounts = Object.fromEntries(Object.entries(collections).map(([sheet, rows]) => [sheet, rows.length]));
        await persistFullSyncSignature(store, signature, syncedAt);
        return {
          ok: true,
          response,
          sync_run_id: syncRunId,
          counts: lastSyncCounts,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown Google Sheets sync error";
        throw error;
      }
    });
  }

  async function syncDiff(store, { reason = "flush" } = {}) {
    return enqueue(async () => {
      const previousCollections = snapshot || collectCollections(store);
      const nextCollections = collectCollections(store);
      const syncedAt = nowIso();
      const syncRunId = randomUUID();
      const events = buildDiffEvents(previousCollections, nextCollections, {
        appUrl: normalizedAppUrl,
        source,
        syncedAt,
        syncRunId,
      });

      if (!enabled) {
        snapshot = nextCollections;
        return { ok: true, skipped: true, reason: "disabled", event_count: 0 };
      }

      if (!events.length) {
        snapshot = nextCollections;
        return { ok: true, skipped: true, reason: "no-changes", event_count: 0 };
      }

      try {
        const response = await postPayload({
          type: "event_batch",
          source,
          app_url: normalizedAppUrl,
          generated_at: syncedAt,
          sync_run_id: syncRunId,
          reason,
          events,
        });

        snapshot = nextCollections;
        lastError = null;
        lastSyncedAt = syncedAt;
        lastSyncMode = "event_batch";
        lastSyncCounts = { events: events.length };
        return {
          ok: true,
          response,
          event_count: events.length,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown Google Sheets sync error";
        throw error;
      }
    });
  }

  function getStatus() {
    return {
      enabled,
      primary_database_mode: primaryDatabaseMode,
      autoFullSyncOnStartup,
      web_app_url_configured: Boolean(configuredUrl),
      app_url: normalizedAppUrl || null,
      last_synced_at: lastSyncedAt,
      last_sync_mode: lastSyncMode,
      last_sync_counts: lastSyncCounts,
      last_error: lastError,
    };
  }

  return {
    initialize,
    syncFull,
    syncDiff,
    getStatus,
  };
}
