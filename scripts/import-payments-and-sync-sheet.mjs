import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

const csvPath = process.argv[2] || "/Users/shashwatsingh/Downloads/payments-export-2026-05-08.csv";
const dataFile = path.join(rootDir, "data", "app-data.json");
const outputDir = path.join(rootDir, "outputs", "google-sheets-sync");
const webAppUrl = process.env.GOOGLE_SHEETS_WEB_APP_URL || "https://script.google.com/macros/s/AKfycbzSnSEociIsfEUnuvysPzrjBsiB8pRQwKMBt2I5yHfx7afBGBWDFH3jfCE1OYD0DbQI/exec";
const requestTimeoutMs = Math.max(Number(process.env.GOOGLE_SHEETS_SYNC_TIMEOUT_MS || 20000) || 20000, 1000);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function parseCsv(text) {
  const rows = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  if (!lines.length) return rows;

  const headers = parseCsvLine(lines[0]);
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function normalizeScalar(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function flattenRecord(value, prefix = "", target = {}) {
  if (Array.isArray(value)) {
    if (prefix) target[prefix] = JSON.stringify(value);
    return target;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length && prefix) {
      target[prefix] = "";
      return target;
    }
    for (const [key, child] of entries) {
      flattenRecord(child, prefix ? `${prefix}.${key}` : key, target);
    }
    return target;
  }

  if (prefix) target[prefix] = normalizeScalar(value);
  return target;
}

function buildRecordId(sheet, record) {
  const candidates = [
    record.id,
    record.payment_id,
    record.order_id,
    record.student_id,
    record.product_id,
    record.transaction_id,
    record.code,
    record.email,
    record.slug,
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }

  return `${sheet}:${createHash("sha256").update(JSON.stringify(record)).digest("hex").slice(0, 24)}`;
}

function toSheetRows(sheet, records, meta) {
  return records.map((record) => ({
    __sheet: sheet,
    __mode: "full_sync",
    __event_type: "snapshot",
    __record_id: buildRecordId(sheet, record),
    __synced_at: meta.syncedAt,
    __sync_run_id: meta.syncRunId,
    __source: meta.source,
    __payload_json: JSON.stringify(record),
    ...flattenRecord(record),
  }));
}

function buildProductBatchRows(products) {
  return products.flatMap((product) => (
    Array.isArray(product.batches)
      ? product.batches.map((batch) => ({
          product_id: product.id || "",
          product_name: product.name || "",
          product_slug: product.slug || "",
          product_mode: product.mode || "",
          batch_key: batch.key || "",
          batch_label: batch.label || "",
          batch_is_active: Boolean(batch.is_active),
          product_is_active: Boolean(product.is_active),
          price: Number(product.price || 0),
          discounted_price: Number(product.discounted_price || 0),
          updated_at: product.updated_at || "",
        }))
      : []
  ));
}

function buildProductSessionRows(products) {
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

function buildCollections(data, latestPayments) {
  const products = Array.isArray(data.products) ? data.products : [];
  return {
    products,
    product_batches: buildProductBatchRows(products),
    product_session_dates: buildProductSessionRows(products),
    team: Array.isArray(data.team) ? data.team : [],
    students: Array.isArray(data.students) ? data.students : [],
    coupons: Array.isArray(data.coupons) ? data.coupons : [],
    orders_local: Array.isArray(data.orders) ? data.orders : [],
    payment_records_local: Array.isArray(data.payment_records) ? data.payment_records : [],
    payments_latest_csv: latestPayments,
    instructors: Array.isArray(data.instructors) ? data.instructors : [],
    bootcamps: Array.isArray(data.bootcamps) ? data.bootcamps : [],
    webinars: Array.isArray(data.webinars) ? data.webinars : [],
    links: Array.isArray(data.links) ? data.links : [],
    refunds: Array.isArray(data.refunds) ? data.refunds : [],
  };
}

async function postPayload(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(webAppUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}${body?.message ? `: ${body.message}` : ""}`);
    }

    return body;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Google Sheets sync timed out after ${requestTimeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }
  if (!fs.existsSync(dataFile)) {
    throw new Error(`App data file not found: ${dataFile}`);
  }

  ensureDir(outputDir);

  const latestPayments = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  const collections = buildCollections(data, latestPayments);
  const syncRunId = randomUUID();
  const syncedAt = nowIso();
  const meta = {
    syncRunId,
    syncedAt,
    source: "llw-webinare-manual-export",
  };

  const sheets = Object.fromEntries(
    Object.entries(collections).map(([sheet, records]) => [sheet, toSheetRows(sheet, records, meta)]),
  );

  const payload = {
    type: "full_sync",
    source: meta.source,
    generated_at: syncedAt,
    sync_run_id: syncRunId,
    sheets,
  };

  const payloadPath = path.join(outputDir, `payload-${syncedAt.slice(0, 19).replace(/:/g, "-")}.json`);
  fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2));

  let postResult = null;
  let postError = null;

  try {
    postResult = await postPayload(payload);
  } catch (error) {
    postError = error instanceof Error ? error.message : String(error);
  }

  const report = {
    csvPath,
    webAppUrl,
    syncRunId,
    syncedAt,
    counts: Object.fromEntries(Object.entries(collections).map(([sheet, records]) => [sheet, records.length])),
    payloadPath,
    postResult,
    postError,
  };

  const reportPath = path.join(outputDir, `sync-report-${syncedAt.slice(0, 19).replace(/:/g, "-")}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
