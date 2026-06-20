import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDashboardStore } from "../server/data-store.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.join(__dirname, "..");

const inputPath = process.argv[2];

if (!inputPath) {
  throw new Error("Usage: node tmp/replace-may-orders-from-oms.mjs <normalized-rows.json>");
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parsePaymentTargetId(link) {
  const url = String(link?.original_url || "").trim();
  const match = /\/(?:payment|subscription)\/([^/?#]+)/.exec(url);
  return match?.[1] || null;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const rawRows = JSON.parse(fs.readFileSync(inputPath, "utf8"));
assert(Array.isArray(rawRows) && rawRows.length > 0, "Normalized rows JSON is empty.");

const store = await createDashboardStore();

try {
  const productsByName = new Map(store.data.products.map((product) => [String(product.name || "").trim().toLowerCase(), product]));
  const teamByEmail = new Map(
    store.data.team
      .map((member) => [String(member.email || "").trim().toLowerCase(), member]),
  );

  const validationErrors = [];
  rawRows.forEach((row, index) => {
    const productName = String(row.product_name || "").trim().toLowerCase();
    const bdaEmail = String(row.bda_email || "").trim().toLowerCase();
    if (!productsByName.has(productName)) {
      validationErrors.push(`Row ${index + 2}: product not found for "${row.product_name}"`);
    }
    if (bdaEmail && !teamByEmail.has(bdaEmail)) {
      validationErrors.push(`Row ${index + 2}: sales owner email not found for "${row.bda_email}"`);
    }
    if (!["FULL", "TOKEN"].includes(String(row.payment_mode || "").toUpperCase())) {
      validationErrors.push(`Row ${index + 2}: invalid payment_mode "${row.payment_mode}"`);
    }
    if (!String(row.payment_date || "").trim()) {
      validationErrors.push(`Row ${index + 2}: payment_date is required`);
    }
  });

  if (validationErrors.length) {
    throw new Error(`Validation failed:\n${validationErrors.join("\n")}`);
  }

  const backupDir = path.join(workspaceRoot, "data", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `live-remote-pre-may-replace-${nowStamp()}.json`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        persistence: store.getPersistenceStatus(),
        data: store.data,
      },
      null,
      2,
    ),
  );

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
    students: store.data.students.length,
    payments: store.data.payment_records.length,
    due_promises: store.data.due_promises.length,
    refunds: store.data.refunds.length,
    links: store.data.links.length,
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

  const created = [];
  const errors = [];

  rawRows.forEach((row, index) => {
    try {
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

      created.push({
        row_number: index + 2,
        order_id: createdEntry.order.id,
        order_number: createdEntry.order.order_number,
        customer_name: createdEntry.order.student?.name || row.customer_name || "",
      });
    } catch (error) {
      errors.push({
        row_number: index + 2,
        message: error instanceof Error ? error.message : "Unable to import row.",
      });
    }
  });

  store.persist = originalPersist;

  if (errors.length) {
    throw new Error(`Import created ${created.length} rows but also failed rows:\n${errors.map((entry) => `Row ${entry.row_number}: ${entry.message}`).join("\n")}`);
  }

  const referencedStudentIds = new Set(store.data.orders.map((order) => order.student_id).filter(Boolean));
  store.data.students = store.data.students.filter((student) => referencedStudentIds.has(student.id));

  await store.persist("may-2026-oms-replace");
  await store.flush();

  const after = {
    orders: store.data.orders.length,
    students: store.data.students.length,
    payments: store.data.payment_records.length,
    due_promises: store.data.due_promises.length,
    refunds: store.data.refunds.length,
    links: store.data.links.length,
    may_orders: store.data.orders.filter((order) => String(order.created_at || "").startsWith("2026-05")).length,
    june_orders: store.data.orders.filter((order) => String(order.created_at || "").startsWith("2026-06")).length,
  };

  console.log(
    JSON.stringify(
      {
        ok: true,
        backupPath,
        before,
        imported: {
          created_count: created.length,
          error_count: errors.length,
        },
        after,
      },
      null,
      2,
    ),
  );
} finally {
  await store.close();
}
