import "dotenv/config";

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const viewsFile = join(__dirname, "..", "db", "runtime-views.sql");
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const databaseSsl =
  /^(1|true|yes)$/i.test(String(process.env.DATABASE_SSL || ""))
    ? { rejectUnauthorized: false }
    : undefined;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured. Add it to .env before installing runtime views.");
}

const sql = await readFile(viewsFile, "utf8");
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseSsl,
  max: 2,
});

try {
  await pool.query(sql);
  console.log(JSON.stringify({ ok: true, installed: ["runtime_orders", "runtime_payments"] }, null, 2));
} finally {
  await pool.end();
}
