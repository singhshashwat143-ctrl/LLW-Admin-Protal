import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const workspaceRoot = "/Users/shashwatsingh/Desktop/llw_webinare";
const inputCsvPath = "/Users/shashwatsingh/Downloads/OMS format - May Pending cases.csv";

process.env.GOOGLE_SHEETS_AS_PRIMARY_DB = "true";
process.env.GOOGLE_SHEETS_SYNC_TIMEOUT_MS = process.env.GOOGLE_SHEETS_SYNC_TIMEOUT_MS || "200000";

const { createGoogleSheetsPrimaryPersistence } = await import("../server/google-sheets-primary-persistence.mjs");

function nowIso() {
  return new Date().toISOString();
}

function nowStamp() {
  return nowIso().replace(/[:.]/g, "-");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
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

function parseCsv(pathname) {
  const text = fs.readFileSync(pathname, "utf8").trim();
  const lines = text.split(/\r?\n/);
  const headers = parseCsvLine(lines[0]).map((value) => value.trim());
  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const row = { __row_number: rowIndex + 2 };
    headers.forEach((header, index) => {
      row[header] = String(values[index] || "").trim();
    });
    return row;
  });
}

function parseIndianDateToIso(dateText) {
  const value = String(dateText || "").trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!match) {
    throw new Error(`Unsupported payment_date "${dateText}"`);
  }
  const [, dd, mm, yyyy] = match;
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0)).toISOString();
}

function uniqueBy(items, selector) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = selector(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

async function loadRemoteSnapshotStrict() {
  const persistence = await createGoogleSheetsPrimaryPersistence();
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const snapshot = await persistence.load({});
      const ok = Array.isArray(snapshot?.orders) && snapshot.orders.length >= 50 && Array.isArray(snapshot?.team) && snapshot.team.length >= 10;
      if (!ok) {
        throw new Error(`Remote snapshot validation failed on attempt ${attempt}`);
      }
      return { persistence, snapshot };
    } catch (error) {
      lastError = error;
    }
  }
  await persistence.close();
  throw lastError || new Error("Unable to load live remote snapshot");
}

function normalizeInputRow(row) {
  const bdaAliases = {
    "kavya@livelongwelath.com": "kavya@livelongwealth.com",
  };
  const productAliases = {
    "ctp (online)": "Indian + Forex CTP (Online)",
  };
  const normalizedBdaEmail = bdaAliases[String(row.bda_email || "").trim().toLowerCase()] || String(row.bda_email || "").trim().toLowerCase();
  const normalizedProductName = productAliases[String(row.product_name || "").trim().toLowerCase()] || String(row.product_name || "").trim();
  const salePrice = Number(row.sale_price_rs || 0);
  const collectedAmount = Number(row.collected_amount_rs || 0);
  return {
    row_number: row.__row_number,
    customer_name: row.customer_name,
    phone: normalizePhone(row.phone),
    email: String(row.email || "").trim().toLowerCase(),
    bda_email: normalizedBdaEmail,
    product_name: normalizedProductName,
    batch_month_key: String(row.batch_month_key || "").trim().toUpperCase(),
    base_price_rs: Number(row.base_price_rs || 0),
    sale_price_rs: salePrice,
    collected_amount_rs: collectedAmount,
    payment_date_iso: parseIndianDateToIso(row.payment_date),
    payment_method: "RAZORPAY",
    payment_mode: collectedAmount >= salePrice ? "FULL" : "TOKEN",
    source: String(row.source || "").trim(),
    language: String(row.language || "").trim(),
    learning_schedule: String(row.learning_schedule || "").trim(),
    reference_code: String(row.reference_code || "").trim(),
    promise_date: String(row.promise_date || "").trim(),
  };
}

function buildExistingPaymentKeys(snapshot) {
  const studentsById = new Map((snapshot.students || []).map((student) => [student.id, student]));
  const productsById = new Map((snapshot.products || []).map((product) => [product.id, product]));
  return new Set((snapshot.orders || []).map((order) => {
    const student = studentsById.get(order.student_id) || {};
    const product = productsById.get(order.product_id) || {};
    return [
      normalizePhone(student.phone || ""),
      String(student.email || "").trim().toLowerCase(),
      String(product.name || "").trim().toLowerCase(),
      String(order.created_at || "").slice(0, 10),
      Number(order.product_value_inr || 0),
      Number(order.amount_paid_inr || 0),
    ].join("|");
  }));
}

const { persistence, snapshot } = await loadRemoteSnapshotStrict();
const remoteSnapshot = clone(snapshot);
const inputRows = parseCsv(inputCsvPath).map(normalizeInputRow);

const team = Array.isArray(remoteSnapshot.team) ? remoteSnapshot.team : [];
const teamByEmail = new Map(team.map((member) => [String(member.email || "").trim().toLowerCase(), member]));
const saravana = teamByEmail.get("saravana@livelongwealth.com");
if (!saravana) {
  throw new Error("Saravana Kumar manager record not found in live team");
}

const newBdas = [
  { name: "Subham Bhoi", email: "subham@livelongwealth.com", phone: "7259272795" },
  { name: "R.Basavaraj", email: "rbasavaraj@livelongwealth.com", phone: "7204325679" },
  { name: "Vysakh P P", email: "pvysakh@livelongwealth.com", phone: "7204305741" },
  { name: "Pradeep D", email: "pradeep@livelongwealth.com", phone: "7022819015" },
  { name: "Adithya", email: "adithya@livelongwealth.com", phone: "7204322475" },
];

const addedTeam = [];
for (const member of newBdas) {
  const email = String(member.email || "").trim().toLowerCase();
  if (teamByEmail.has(email)) {
    continue;
  }
  const record = {
    id: crypto.randomUUID(),
    name: member.name,
    email,
    phone: member.phone,
    role: "BDA",
    is_active: true,
    password: "google-oauth",
    manager_name: saravana.name,
    team_name: saravana.team_name || "Saravana Kumar Team",
    created_at: nowIso(),
    updated_at: nowIso(),
    auth_provider: "GOOGLE",
    avatar_url: "",
  };
  team.unshift(record);
  teamByEmail.set(email, record);
  addedTeam.push(record);
}

const productsByName = new Map((remoteSnapshot.products || []).map((product) => [String(product.name || "").trim().toLowerCase(), product]));
const validationErrors = [];
for (const row of inputRows) {
  if (!teamByEmail.has(row.bda_email)) {
    validationErrors.push(`Row ${row.row_number}: unknown BDA email ${row.bda_email}`);
  }
  if (!productsByName.has(String(row.product_name || "").trim().toLowerCase())) {
    validationErrors.push(`Row ${row.row_number}: unknown product ${row.product_name}`);
  }
}
if (validationErrors.length) {
  throw new Error(validationErrors.join("\n"));
}

const backupDir = path.join(workspaceRoot, "data", "backups");
fs.mkdirSync(backupDir, { recursive: true });
const backupPath = path.join(backupDir, `live-remote-pre-may-pending-append-${nowStamp()}.json`);
fs.writeFileSync(backupPath, JSON.stringify({ exported_at: nowIso(), snapshot }, null, 2));

const tempSnapshotPath = path.join(workspaceRoot, "tmp", `remote-working-may-pending-${Date.now()}.json`);
fs.writeFileSync(tempSnapshotPath, JSON.stringify(remoteSnapshot, null, 2));

process.env.GOOGLE_SHEETS_AS_PRIMARY_DB = "false";
process.env.DATA_FILE = tempSnapshotPath;
process.env.DATA_BACKUP_DIR = path.join(workspaceRoot, "tmp", "manual-db-backups");

const { createDashboardStore } = await import("../server/data-store.mjs");
const store = await createDashboardStore();

try {
  const actor = {
    id: "manual-may-pending-append",
    name: "May Pending Append",
    email: "shashwat@livelongwealth.com",
    role: "SUPER_ADMIN",
  };

  const existingKeys = buildExistingPaymentKeys(store.data);
  const created = [];
  const skipped = [];
  const originalPersist = store.persist.bind(store);
  store.persist = () => Promise.resolve();

  for (const row of inputRows) {
    const product = productsByName.get(String(row.product_name || "").trim().toLowerCase());
    const owner = teamByEmail.get(row.bda_email) || null;
    const dedupeKey = [
      row.phone,
      row.email,
      String(product.name || "").trim().toLowerCase(),
      row.payment_date_iso.slice(0, 10),
      Math.round(row.sale_price_rs * 100),
      Math.round(row.collected_amount_rs * 100),
    ].join("|");

    if (existingKeys.has(dedupeKey)) {
      skipped.push({ row_number: row.row_number, customer_name: row.customer_name, reason: "already-present" });
      continue;
    }

    const result = store.createPaymentLink({
      student_name: row.customer_name,
      phone: row.phone,
      email: row.email,
      bda_id: owner?.id || null,
      product_id: product.id,
      original_product_value_inr: Math.round(row.base_price_rs * 100),
      product_value_inr: Math.round(row.sale_price_rs * 100),
      payment_type: row.payment_mode,
      payment_method: row.payment_method,
      amount_inr: Math.round(row.collected_amount_rs * 100),
      token_amount: row.payment_mode === "TOKEN" ? Math.round(row.collected_amount_rs * 100) : 0,
      reference_code: row.reference_code,
      transaction_id: row.reference_code,
      source: row.source,
      campaign: "oms-may-pending-append",
      batch_month_key: row.batch_month_key,
      promise_date: row.promise_date || null,
      source_type: owner?.id ? "BDA" : "MANUAL",
      created_at: row.payment_date_iso,
      paid_at: row.payment_date_iso,
      status: "PAID",
      language: row.language,
      learning_schedule: row.learning_schedule,
      collect_customer_details_on_checkout: false,
    }, actor);

    created.push({
      row_number: row.row_number,
      order_id: result.order.id,
      payment_id: result.payment.id,
      customer_name: row.customer_name,
      owner_email: row.bda_email,
    });
    existingKeys.add(dedupeKey);
  }

  store.persist = originalPersist;
  const referencedStudentIds = new Set(store.data.orders.map((order) => order.student_id).filter(Boolean));
  store.data.students = store.data.students.filter((student) => referencedStudentIds.has(student.id));

  const finalSnapshot = clone(store.data);
  const writePersistence = await createGoogleSheetsPrimaryPersistence();
  await writePersistence.save(finalSnapshot, "append-may-pending-cases-and-team");
  await writePersistence.flush();

  console.log(JSON.stringify({
    ok: true,
    backupPath,
    tempSnapshotPath,
    added_team_count: addedTeam.length,
    added_team: addedTeam.map((member) => ({ name: member.name, email: member.email, manager_name: member.manager_name })),
    created_count: created.length,
    skipped_count: skipped.length,
    created,
    skipped,
    final_counts: {
      orders: finalSnapshot.orders.length,
      payments: finalSnapshot.payment_records.length,
      students: finalSnapshot.students.length,
      may_orders: finalSnapshot.orders.filter((order) => String(order.created_at || "").startsWith("2026-05")).length,
    },
    persistence: writePersistence.getStatus(),
  }, null, 2));

  await writePersistence.close();
} finally {
  await store.close();
  await persistence.close();
}
