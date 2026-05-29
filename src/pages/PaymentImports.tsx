import { useMemo, useState } from "react";
import { PageHeader, SectionCard } from "../components/UI";
import { api, useApi } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { navigate } from "../lib/router";

type ProductRow = {
  id: string;
  name: string;
  discounted_price: number;
};

type TeamResponse = {
  bdas: Array<{ id: string; name: string; email?: string; manager_name?: string }>;
};

type ImportRow = Record<string, string>;

type ImportResponse = {
  created_count: number;
  error_count: number;
  created: Array<{ row_number: number; order_id: string; order_number: string; customer_name: string }>;
  errors: Array<{ row_number: number; message: string }>;
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

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
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current.trim());
      current = "";
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current.trim());
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function buildObjectsFromCsv(text: string) {
  const rows = parseCsv(text);
  const headers = rows[0]?.map((value) => value.trim()) || [];
  return rows.slice(1).map((values) => {
    const entry: ImportRow = {};
    headers.forEach((header, index) => {
      entry[header] = values[index] || "";
    });
    return entry;
  }).filter((entry) => Object.values(entry).some(Boolean));
}

const sampleCsv = [
  "customer_name,phone,email,bda_email,product_name,batch_month_key,base_price_rs,sale_price_rs,payment_mode,collected_amount_rs,payment_date,payment_method,reference_code,promise_date,source,language,learning_schedule",
  "Rahul Menon,9876543210,rahul@example.com,aika@livelongwealth.com,CTP + LiveX0 (Offline),MAY,169999,59000,TOKEN,2000,2026-04-28,CASH,APR-TOKEN-001,2026-05-18,GTC sale,Malayalam,WEEKEND",
  "Neha Sharma,9988776655,neha@example.com,aika@livelongwealth.com,CTP + LiveX0 (Online),MAY,69999,47000,FULL,47000,2026-05-05,BANK_TRANSFER,UTR-778899,,Referral,English,WEEKDAY",
].join("\n");

export function PaymentImportsPage() {
  const productsApi = useApi<{ products: ProductRow[] }>("/api/products", { products: [] });
  const teamApi = useApi<TeamResponse>("/api/team", { bdas: [] });
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const previewRows = useMemo(() => rows.slice(0, 8), [rows]);

  async function handleFile(file: File) {
    const text = await file.text();
    const parsed = buildObjectsFromCsv(text);
    setRows(parsed);
    setFileName(file.name);
    setResult(null);
    setNotice(`Loaded ${parsed.length} row${parsed.length === 1 ? "" : "s"} from ${file.name}.`);
  }

  function downloadSample() {
    const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "payment-import-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    if (!rows.length) {
      setNotice("Upload a CSV first.");
      return;
    }
    try {
      setImporting(true);
      const response = await api<ImportResponse>("/api/payment-imports", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      setResult(response);
      setNotice(`Imported ${response.created_count} row${response.created_count === 1 ? "" : "s"} with ${response.error_count} error${response.error_count === 1 ? "" : "s"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to import this CSV.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="page-grid compact-canvas">
      <PageHeader
        eyebrow="Payment Import"
        title="Pending Payment CSV Import"
        description="Import manual token and full-payment rows with the original paid date so monthly reporting follows the real collection date."
        actions={
          <>
            <button className="btn-secondary" type="button" onClick={() => navigate("/payments")}>Payments Board</button>
            <button className="btn-primary" type="button" onClick={downloadSample}>Download Sample CSV</button>
          </>
        }
      />

      {notice ? (
        <div className="rounded-[22px] border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-5 py-4 text-sm text-[var(--success)]">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Import CSV" subtitle="Use the sample format. Product matching supports `product_name`, `product_slug`, or `product_id`. Sales-owner matching supports `bda_email`, `sales_owner_email`, `bda_name`, or `bda_id`.">
          <div className="flex flex-wrap items-center gap-3">
            <label className="btn-secondary cursor-pointer">
              Choose CSV
              <input
                className="hidden"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleFile(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button className="btn-primary" type="button" onClick={runImport} disabled={importing || !rows.length}>
              {importing ? "Importing..." : "Append To DB"}
            </button>
            {fileName ? <span className="text-sm text-[var(--text-secondary)]">{fileName} • {rows.length} rows</span> : null}
          </div>

          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--text-secondary)]">
            Required columns: `customer_name`, `product_name` or `product_id`, `sale_price_rs`, `payment_mode`, `collected_amount_rs`, `payment_date`.
            Optional columns: `phone`, `email`, `bda_email`, `batch_month_key`, `base_price_rs`, `payment_method`, `reference_code`, `promise_date`, `source`, `language`, `learning_schedule`.
          </div>

          {previewRows.length ? (
            <div className="mt-5 table-shell table-shell-scrollable admin-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Sold</th>
                    <th>Collected</th>
                    <th>Mode</th>
                    <th>Paid Date</th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={`${row.customer_name}-${row.phone}-${index}`}>
                      <td>{row.customer_name || row.student_name || row.name || "-"}</td>
                      <td>{row.product_name || row.product_id || row.product_slug || "-"}</td>
                      <td>{row.sale_price_rs ? formatCurrency(Number(row.sale_price_rs || 0)) : "-"}</td>
                      <td>{row.collected_amount_rs ? formatCurrency(Number(row.collected_amount_rs || 0)) : "-"}</td>
                      <td>{row.payment_mode || "-"}</td>
                      <td>{row.payment_date || "-"}</td>
                      <td>{row.bda_email || row.sales_owner_email || row.bda_name || row.bda_id || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {result ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] p-4">
                <div className="text-sm font-semibold text-[var(--text-strong)]">Imported rows</div>
                <div className="mt-2 text-sm text-[var(--text-secondary)]">{result.created_count}</div>
                <div className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
                  {result.created.slice(0, 6).map((row) => (
                    <div key={`${row.order_id}-${row.row_number}`}>
                      Row {row.row_number}: {row.customer_name} • {row.order_number}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] p-4">
                <div className="text-sm font-semibold text-[var(--text-strong)]">Errors</div>
                <div className="mt-2 text-sm text-[var(--text-secondary)]">{result.error_count}</div>
                <div className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
                  {result.errors.length ? result.errors.slice(0, 6).map((row) => (
                    <div key={`${row.row_number}-${row.message}`}>
                      Row {row.row_number}: {row.message}
                    </div>
                  )) : <div>No row errors.</div>}
                </div>
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Reference" subtitle="Use these current products and BDA owners while preparing the CSV.">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Products</div>
              <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                {productsApi.data.products.slice(0, 8).map((product) => (
                  <div key={product.id}>
                    <div className="text-[var(--text-strong)]">{product.name}</div>
                    <div className="font-mono text-xs">{product.id} • Base {formatCurrency((product.discounted_price || 0) / 100)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">BDA Owners</div>
              <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                {teamApi.data.bdas.map((member) => (
                  <div key={member.id}>
                    <div className="text-[var(--text-strong)]">{member.name}</div>
                    <div className="text-xs">{member.email || member.id}{member.manager_name ? ` • ${member.manager_name}` : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
