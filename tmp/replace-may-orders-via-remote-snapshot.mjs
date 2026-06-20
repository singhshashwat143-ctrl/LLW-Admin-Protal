import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";

const workspaceRoot = "/Users/shashwatsingh/Desktop/llw_webinare";
const inputPath = process.argv[2];
const remoteSnapshotPath = process.argv[3];

if (!inputPath || !remoteSnapshotPath) {
  throw new Error("Usage: node tmp/replace-may-orders-via-remote-snapshot.mjs <normalized-rows.json> <remote-snapshot.json>");
}

const normalizedRows = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const remotePayload = JSON.parse(fs.readFileSync(remoteSnapshotPath, "utf8"));
const remoteSnapshot = remotePayload.snapshot || remotePayload;

const tempDataPath = path.join(workspaceRoot, "tmp", `remote-working-${Date.now()}.json`);
fs.writeFileSync(tempDataPath, JSON.stringify(remoteSnapshot, null, 2));

process.env.GOOGLE_SHEETS_AS_PRIMARY_DB = "false";
process.env.DATA_FILE = tempDataPath;
process.env.DATA_BACKUP_DIR = path.join(workspaceRoot, "tmp", "manual-db-backups");

const { createDashboardStore } = await import("../server/data-store.mjs");
const { createGoogleSheetsPrimaryPersistence } = await import("../server/google-sheets-primary-persistence.mjs");

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parsePaymentTargetId(link) {
  const url = String(link?.original_url || "").trim();
  const match = /\/(?:payment|subscription)\/([^/?#]+)/.exec(url);
  return match?.[1] || null;
}

function buildChecksum(payloadText) {
  return createHash("sha256").update(payloadText).digest("hex");
}

const store = await createDashboardStore();

try {
  const productsByName = new Map(store.data.products.map((product) => [String(product.name || "").trim().toLowerCase(), product]));
  const teamByEmail = new Map(store.data.team.map((member) => [String(member.email || "").trim().toLowerCase(), member]));

  const validationErrors = [];
  normalizedRows.forEach((row, index) => {
    if (!productsByName.has(String(row.product_name || "").trim().toLowerCase())) {
      validationErrors.push(`Row ${index + 2}: product not found for "${row.product_name}"`);
    }
    if (!teamByEmail.has(String(row.bda_email || "").trim().toLowerCase())) {
      validationErrors.push(`Row ${index + 2}: sales owner email not found for "${row.bda_email}"`);
    }
  });
  if (validationErrors.length) {
    throw new Error(validationErrors.join("\n"));
  }

  const backupDir = path.join(workspaceRoot, "data", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `live-remote-pre-may-hard-replace-${nowStamp()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(remotePayload, null, 2));

  const mayOrderIds = new Set(
    store.data.orders
      .filter((order) => String(order.created_at || "").startsWith("2026-05"))
      .map((order) => order.id),
  );
  const mayPaymentIds = new Set(
    store.data.payment_records
      .filter((payment) => mayOrderIds.has(payment.order_id))
      .map((payment) => payment.id),
  );

  const before = {
    orders: store.data.orders.length,
    payments: store.data.payment_records.length,
    may_orders: mayOrderIds.size,
    june_orders: store.data.orders.filter((order) => String(order.created_at || "").startsWith("2026-06")).length,
  };

  store.data.orders = store.data.orders.filter((order) => !mayOrderIds.has(order.id));
  store.data.payment_records = store.data.payment_records.filter((payment) => !mayOrderIds.has(payment.order_id));
  store.data.due_promises = store.data.due_promises.filter((promise) => !mayOrderIds.has(promise.order_id));
  store.data.refunds = store.data.refunds.filter((refund) => !mayOrderIds.has(refund.order_id));
  store.data.links = store.data.links.filter((link) => {
    const targetId = parsePaymentTargetId(link);
    return !targetId || !mayPaymentIds.has(targetId);
  });

  const actor = {
    id: "manual-may-replace",
    name: "May OMS Replace",
    email: "shashwat@livelongwealth.com",
    role: "SUPER_ADMIN",
  };

  const originalPersist = store.persist.bind(store);
  store.persist = () => Promise.resolve();
  const imported = [];
  for (let index = 0; index < normalizedRows.length; index += 1) {
    const row = normalizedRows[index];
    const product = productsByName.get(String(row.product_name || "").trim().toLowerCase());
    const owner = teamByEmail.get(String(row.bda_email || "").trim().toLowerCase()) || null;
    const createdAt = String(row.payment_date || "").trim();
    const createdEntry = store.createPaymentLink({
      student_name: row.customer_name,
      phone: row.phone,
      email: row.email,
      bda_id: owner?.id || null,
      product_id: product.id,
      original_product_value_inr: Number(row.base_price_rs || 0) * 100,
      product_value_inr: Number(row.sale_price_rs || 0) * 100,
      payment_type: row.payment_mode,
      payment_method: row.payment_method,
      amount_inr: Number(row.collected_amount_rs || 0) * 100,
      token_amount: String(row.payment_mode || "").toUpperCase() === "TOKEN" ? Number(row.collected_amount_rs || 0) * 100 : 0,
      reference_code: row.reference_code,
      transaction_id: row.transaction_id || row.reference_code,
      source: row.source,
      campaign: "oms-may-replace",
      batch_month_key: row.batch_month_key,
      promise_date: row.promise_date || null,
      source_type: owner?.id ? "BDA" : "MANUAL",
      created_at: createdAt,
      paid_at: createdAt,
      status: "PAID",
      language: row.language,
      learning_schedule: row.learning_schedule,
      collect_customer_details_on_checkout: false,
    }, actor);
    imported.push({
      row_number: index + 2,
      order_id: createdEntry.order.id,
      payment_id: createdEntry.payment.id,
      name: row.customer_name,
    });
  }
  store.persist = originalPersist;

  const referencedStudentIds = new Set(store.data.orders.map((order) => order.student_id).filter(Boolean));
  store.data.students = store.data.students.filter((student) => referencedStudentIds.has(student.id));

  const snapshot = JSON.parse(JSON.stringify(store.data));
  const persistence = await createGoogleSheetsPrimaryPersistence();
  await persistence.load(snapshot);
  await persistence.save(snapshot, "may-2026-hard-replace");
  await persistence.flush();

  const after = {
    orders: snapshot.orders.length,
    payments: snapshot.payment_records.length,
    may_orders: snapshot.orders.filter((order) => String(order.created_at || "").startsWith("2026-05")).length,
    june_orders: snapshot.orders.filter((order) => String(order.created_at || "").startsWith("2026-06")).length,
  };

  console.log(JSON.stringify({
    ok: true,
    backupPath,
    tempDataPath,
    checksum: buildChecksum(JSON.stringify(snapshot)),
    imported_count: imported.length,
    before,
    after,
    persistence: persistence.getStatus(),
    run_id: randomUUID(),
  }, null, 2));
} finally {
  await store.close();
}
