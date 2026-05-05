import { useMemo, useState } from "react";
import { Badge, PageHeader, SectionCard, StatCard } from "../components/UI";
import { PRODUCT_BATCH_OPTIONS } from "../lib/batches";
import { api, useApi } from "../lib/api";
import { formatCurrency, formatDateTime } from "../lib/format";
import { navigate } from "../lib/router";

type PaymentHistory = {
  id: string;
  amount_inr: number;
  method: string;
  status: string;
  type: string;
  stage: string;
  transaction_id: string;
  created_at: string;
};

type OperationRow = {
  id: string;
  order_number: string;
  student?: { id?: string; name?: string; email?: string; phone?: string } | null;
  bda?: { id?: string; name?: string } | null;
  product?: { id?: string; name?: string } | null;
  status: string;
  bdm_name?: string;
  manager_name?: string;
  batch_month_key?: string;
  batch_month_label?: string;
  batch_is_active?: boolean | null;
  payment_mode: string;
  product_value_inr: number;
  amount_paid_inr: number;
  refunded_amount_inr?: number;
  net_cash_in_hand_inr?: number;
  latest_transaction_id?: string;
  payment_history: PaymentHistory[];
  access_revocation_requested?: boolean;
  access_revocation_requested_by?: string;
  access_revoked?: boolean;
  access_revoked_by?: string;
  operations: {
    portal_access_done: boolean;
    broker_setup_done: boolean;
  };
  operations_completed?: boolean;
  created_at: string;
  updated_at?: string;
};

type OperationsResponse = {
  operations: OperationRow[];
  summary: {
    total: number;
    pending: number;
    completed: number;
    netCashInHand: number;
  };
};

function statusTone(status: string): "green" | "blue" {
  return status === "ACTIVE" ? "green" : "blue";
}

function paymentTone(status: string): "green" | "gold" | "red" | "purple" {
  if (status === "PAID") return "green";
  if (status === "FAILED") return "red";
  if (status === "REFUNDED") return "purple";
  return "gold";
}

function compactText(value: string, max = 32) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

export function OperationsPage() {
  const operationsApi = useApi<OperationsResponse>("/api/operations", {
    operations: [],
    summary: {
      total: 0,
      pending: 0,
      completed: 0,
      netCashInHand: 0,
    },
  });
  const [query, setQuery] = useState("");
  const [checklistFilter, setChecklistFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [notice, setNotice] = useState("");
  const [savingOpsId, setSavingOpsId] = useState("");

  const productOptions = useMemo(() => {
    const seen = new Map<string, string>();
    operationsApi.data.operations.forEach((row) => {
      if (row.product?.id && row.product?.name && !seen.has(row.product.id)) {
        seen.set(row.product.id, row.product.name);
      }
    });
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((left, right) => left.name.localeCompare(right.name));
  }, [operationsApi.data.operations]);

  const filteredRows = useMemo(() => {
    return operationsApi.data.operations.filter((row) => {
      const matchesChecklist =
        checklistFilter === "ALL"
        || (checklistFilter === "PENDING" && !row.operations_completed)
        || (checklistFilter === "COMPLETED" && row.operations_completed);
      const haystack = [row.student?.name, row.student?.phone, row.student?.email, row.product?.name, row.order_number, row.latest_transaction_id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query.toLowerCase());
      const rowTime = row.created_at ? new Date(row.created_at).getTime() : null;
      const matchesProduct = !productFilter || row.product?.id === productFilter;
      const matchesBatch = !batchFilter || row.batch_month_key === batchFilter;
      const matchesDateFrom = !dateFrom || (rowTime !== null && rowTime >= new Date(dateFrom).getTime());
      const matchesDateTo = !dateTo || (rowTime !== null && rowTime <= new Date(`${dateTo}T23:59:59.999`).getTime());
      return matchesChecklist && matchesProduct && matchesBatch && matchesDateFrom && matchesDateTo && matchesQuery;
    });
  }, [batchFilter, checklistFilter, dateFrom, dateTo, operationsApi.data.operations, productFilter, query]);

  const filteredSummary = useMemo(() => ({
    total: filteredRows.length,
    pending: filteredRows.filter((row) => !row.operations_completed).length,
    completed: filteredRows.filter((row) => row.operations_completed).length,
    netCashInHand: filteredRows.reduce((sum, row) => sum + Number(row.net_cash_in_hand_inr || 0), 0),
  }), [filteredRows]);

  async function toggleOperation(orderId: string, key: keyof OperationRow["operations"], value: boolean) {
    setSavingOpsId(orderId);
    try {
      await api(`/api/orders/${orderId}/operations`, {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
      setNotice("Operations checklist updated.");
      operationsApi.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update operations checklist.");
    } finally {
      setSavingOpsId("");
    }
  }

  async function toggleAccessRevoke(orderId: string, value: boolean) {
    setSavingOpsId(orderId);
    try {
      await api(`/api/orders/${orderId}/operations`, {
        method: "PATCH",
        body: JSON.stringify({ access_revoked: value }),
      });
      setNotice(value ? "Access revoked." : "Access revoke cleared.");
      operationsApi.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update access status.");
    } finally {
      setSavingOpsId("");
    }
  }

  return (
    <div className="page-grid compact-canvas">
      <PageHeader
        eyebrow="Operations"
        title="Paid orders operations queue"
        description="All successfully paid token and full orders appear here, so the operations team can track fulfilment as soon as money is collected."
        actions={
          <>
            <button className="btn-secondary" type="button" onClick={operationsApi.refresh}>Refresh</button>
            <button className="btn-primary" type="button" onClick={() => navigate("/payments")}>Back to Payments</button>
          </>
        }
      />

      {notice ? (
        <div className="rounded-[22px] border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-5 py-4 text-sm text-[var(--success)]">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ready For Ops" value={String(filteredSummary.total || 0)} meta="Successful token and full payments in the current filter" />
        <StatCard label="Pending Checklist" value={String(filteredSummary.pending || 0)} meta="Orders still awaiting fulfilment steps" />
        <StatCard label="Completed" value={String(filteredSummary.completed || 0)} meta="Orders whose checklist is fully done" />
        <StatCard label="Net Cash Covered" value={formatCurrency((filteredSummary.netCashInHand || 0) / 100)} meta="Retained cash across the filtered queue" />
      </div>

      <SectionCard title="Operations Queue" subtitle="All successful token and full payments are shown here. Use product, batch, and date filters to focus the queue.">
        <div className="payments-toolbar mb-4">
          <div className="payments-filters">
            <select className="input-dark min-w-[180px]" value={checklistFilter} onChange={(event) => setChecklistFilter(event.target.value)}>
              <option value="ALL">All checklist states</option>
              <option value="PENDING">Pending checklist</option>
              <option value="COMPLETED">Completed checklist</option>
            </select>
            <select className="input-dark min-w-[180px]" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
              <option value="">All products</option>
              {productOptions.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
            <select className="input-dark min-w-[150px]" value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)}>
              <option value="">All batches</option>
              {PRODUCT_BATCH_OPTIONS.map((batch) => (
                <option key={batch.key} value={batch.key}>{batch.label}</option>
              ))}
            </select>
            <input className="input-dark min-w-[150px]" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <input className="input-dark min-w-[150px]" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
          <div className="payments-search">
            <input className="input-dark" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by customer, product, order, or transaction ID" />
          </div>
        </div>

        <div className="table-shell table-shell-scrollable admin-table-scroll payments-table-scroll">
          <table className="compact-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>BDA</th>
                <th>BDM</th>
                <th>Product</th>
                <th>Payment Audit</th>
                <th>Operations</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="cell-stack">
                      <div className="font-medium text-[var(--text-strong)]">{compactText(row.student?.name || "Guest user", 26)}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{row.student?.phone || "-"}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{compactText(row.student?.email || row.order_number || "-", 30)}</div>
                    </div>
                  </td>
                  <td>
                    <div>{row.bda?.name || "—"}</div>
                  </td>
                  <td>
                    <div>{row.bdm_name || row.manager_name || "Unassigned BDM"}</div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <div>{row.product?.name || "-"}</div>
                      {row.batch_month_label ? <div className="text-xs text-[var(--text-secondary)]">Batch {row.batch_month_label}{row.batch_is_active === false ? " • Non-operational" : " • Operational"}</div> : null}
                      <div className="text-xs text-[var(--text-secondary)]">{row.payment_mode} order</div>
                      <div className="text-xs text-[var(--text-secondary)]">Created {formatDateTime(row.created_at)}</div>
                    </div>
                  </td>
                  <td>
                    <div className="space-y-2">
                      <div className="cell-stack">
                        <div>Order value {formatCurrency((row.product_value_inr || 0) / 100)}</div>
                        <div className="text-xs text-[var(--text-secondary)]">Paid {formatCurrency((row.amount_paid_inr || 0) / 100)}</div>
                        {row.refunded_amount_inr ? <div className="text-xs text-[var(--text-secondary)]">Refunded {formatCurrency((row.refunded_amount_inr || 0) / 100)}</div> : null}
                        <div className="text-xs text-[var(--text-secondary)]">Net cash {formatCurrency((row.net_cash_in_hand_inr || 0) / 100)}</div>
                      </div>
                      {row.payment_history.map((payment) => (
                        <div key={payment.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[var(--text-strong)]">{payment.transaction_id}</span>
                            <Badge tone={paymentTone(payment.status)}>{payment.status}</Badge>
                          </div>
                          <div className="mt-1 text-[var(--text-secondary)]">
                            {formatCurrency((payment.amount_inr || 0) / 100)} • {payment.method.replaceAll("_", " ")} • {payment.stage.replaceAll("_", " ")}
                          </div>
                          <div className="mt-1 text-[var(--text-secondary)]">{formatDateTime(payment.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="grid gap-2 text-xs">
                      {([
                        ["portal_access_done", "Portal access"],
                        ["broker_setup_done", "Broker setup"],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={row.operations[key]}
                            disabled={savingOpsId === row.id}
                            onChange={(event) => void toggleOperation(row.id, key, event.target.checked)}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(row.access_revoked)}
                          disabled={savingOpsId === row.id}
                          onChange={(event) => void toggleAccessRevoke(row.id, event.target.checked)}
                        />
                        <span>Access revoked</span>
                      </label>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {row.operations_completed ? "Checklist complete" : "Checklist pending"}
                      </div>
                      {row.access_revocation_requested ? (
                        <div className="text-xs text-[var(--text-secondary)]">
                          Revoke requested by {row.access_revocation_requested_by || "Revenue desk"}
                        </div>
                      ) : null}
                      {row.access_revoked ? (
                        <div className="text-xs text-[var(--danger)]">
                          Access revoked{row.access_revoked_by ? ` by ${row.access_revoked_by}` : ""}
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredRows.length ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-[var(--text-secondary)]">
                    No paid token or full orders match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
