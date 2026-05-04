import { useMemo, useState } from "react";
import { Badge, PageHeader, SectionCard } from "../components/UI";
import { api, useApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatCurrency, formatDateTime } from "../lib/format";
import { normalizeRole } from "../lib/permissions";

type ProductBatch = {
  key: string;
  label: string;
  is_active: boolean;
};

type ProductRow = {
  id: string;
  name: string;
  batches: ProductBatch[];
};

type OrderRow = {
  id: string;
  order_number: string;
  student?: { name?: string } | null;
  product?: { id?: string; name?: string } | null;
  bda?: { name?: string } | null;
  bdm_name?: string;
  manager_name?: string;
  batch_month_key?: string;
  batch_month_label?: string;
  batch_is_active?: boolean | null;
  original_product_value_inr?: number;
  discount_inr?: number;
  coupon_code?: string;
  product_value_inr: number;
  amount_paid_inr: number;
  refunded_amount_inr?: number;
  net_cash_in_hand_inr?: number;
  amount_due_inr: number;
  status: string;
  latest_transaction_id?: string;
  transaction_count?: number;
  created_at: string;
};

function getBatchTone(row: Pick<OrderRow, "batch_is_active">): "green" | "gold" | "blue" {
  if (row.batch_is_active === true) return "green";
  if (row.batch_is_active === false) return "gold";
  return "blue";
}

function getBatchStatusLabel(row: Pick<OrderRow, "batch_is_active" | "batch_month_label">) {
  if (!row.batch_month_label) return "No batch assigned";
  if (row.batch_is_active === true) return "Operational";
  if (row.batch_is_active === false) return "Non-operational";
  return "Saved batch";
}

export function OrdersPage() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const canEditBatch = role === "ADMIN" || role === "SUPER_ADMIN";
  const ordersApi = useApi<{ orders: OrderRow[] }>("/api/orders", { orders: [] });
  const productsApi = useApi<{ products: ProductRow[] }>("/api/products", { products: [] });
  const [notice, setNotice] = useState("");
  const [savingOrderId, setSavingOrderId] = useState("");
  const [batchDrafts, setBatchDrafts] = useState<Record<string, string>>({});
  const productById = useMemo(
    () => new Map(productsApi.data.products.map((product) => [product.id, product])),
    [productsApi.data.products],
  );

  async function saveBatch(row: OrderRow) {
    const nextBatchKey = batchDrafts[row.id] ?? row.batch_month_key ?? "";
    if (nextBatchKey === (row.batch_month_key ?? "")) {
      setNotice("Batch is already up to date.");
      return;
    }
    setSavingOrderId(row.id);
    try {
      await api(`/api/orders/${row.id}/operations`, {
        method: "PATCH",
        body: JSON.stringify({ batch_month_key: nextBatchKey }),
      });
      setNotice(`Batch updated for ${row.order_number}.`);
      setBatchDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      ordersApi.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update the batch.");
    } finally {
      setSavingOrderId("");
    }
  }

  return (
    <div className="page-grid compact-canvas">
      <PageHeader
        eyebrow="Orders"
        title="Order and transaction desk"
        description="Every token and recovery now sits against its own transaction ID while the order keeps sold value, collected value, due amount, and BDA ownership together."
      />
      {notice ? (
        <div className="rounded-[22px] border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-5 py-4 text-sm text-[var(--success)]">
          {notice}
        </div>
      ) : null}
      <SectionCard title="Orders" subtitle="OMS-style order totals plus transaction mapping.">
        <div className="table-shell table-shell-scrollable admin-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order No</th>
                <th>Student</th>
                <th>Product</th>
                <th>BDA</th>
                <th>BDM</th>
                <th>Order Value</th>
                <th>Cash Audit</th>
                <th>Due</th>
                <th>Txn ID</th>
                <th>Txn Count</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {ordersApi.data.orders.map((row) => {
                const product = row.product?.id ? productById.get(row.product.id) ?? null : null;
                const selectedBatchKey = batchDrafts[row.id] ?? row.batch_month_key ?? "";
                const batchChanged = selectedBatchKey !== (row.batch_month_key ?? "");
                return (
                <tr key={row.id}>
                  <td className="font-mono text-xs">{row.order_number}</td>
                  <td>{row.student?.name || "-"}</td>
                  <td>
                    <div>{row.product?.name || "-"}</div>
                    {row.batch_month_label ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-[var(--text-secondary)]">Batch {row.batch_month_label}</span>
                        <Badge tone={getBatchTone(row)}>{getBatchStatusLabel(row)}</Badge>
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-[var(--text-secondary)]">No batch assigned</div>
                    )}
                    {canEditBatch && product ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <select
                          className="input-dark min-w-[190px]"
                          value={selectedBatchKey}
                          disabled={savingOrderId === row.id}
                          onChange={(event) => setBatchDrafts((current) => ({ ...current, [row.id]: event.target.value }))}
                        >
                          <option value="">No batch</option>
                          {product.batches.map((batch) => (
                            <option key={batch.key} value={batch.key}>
                              {batch.label} • {batch.is_active ? "Operational" : "Non-operational"}
                            </option>
                          ))}
                        </select>
                        <button
                          className="btn-secondary btn-compact"
                          type="button"
                          disabled={!batchChanged || savingOrderId === row.id}
                          onClick={() => void saveBatch(row)}
                        >
                          {savingOrderId === row.id ? "Saving..." : "Save Batch"}
                        </button>
                      </div>
                    ) : null}
                    {row.coupon_code ? <div className="text-xs text-[var(--text-secondary)]">Coupon {row.coupon_code}</div> : null}
                  </td>
                  <td>{row.bda?.name || "-"}</td>
                  <td>{row.bdm_name || row.manager_name || "-"}</td>
                  <td>
                    <div>Net {formatCurrency((row.product_value_inr || 0) / 100)}</div>
                    {row.discount_inr ? <div className="text-xs text-[var(--text-secondary)]">Discount {formatCurrency((row.discount_inr || 0) / 100)}</div> : null}
                    {(row.original_product_value_inr || 0) > (row.product_value_inr || 0) ? (
                      <div className="text-xs text-[var(--text-secondary)]">Gross {formatCurrency((row.original_product_value_inr || 0) / 100)}</div>
                    ) : null}
                  </td>
                  <td>
                    <div>Collected {formatCurrency((row.amount_paid_inr || 0) / 100)}</div>
                    {row.refunded_amount_inr ? <div className="text-xs text-[var(--text-secondary)]">Refunded {formatCurrency((row.refunded_amount_inr || 0) / 100)}</div> : null}
                    <div className="text-xs text-[var(--text-secondary)]">Net cash {formatCurrency((row.net_cash_in_hand_inr || 0) / 100)}</div>
                  </td>
                  <td>{formatCurrency((row.amount_due_inr || 0) / 100)}</td>
                  <td className="font-mono text-xs">{row.latest_transaction_id || "-"}</td>
                  <td>{row.transaction_count || 0}</td>
                  <td>{row.status}</td>
                  <td>{formatDateTime(row.created_at)}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
