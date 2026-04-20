import { PageHeader, SectionCard } from "../components/UI";
import { useApi } from "../lib/api";
import { formatCurrency, formatDateTime } from "../lib/format";

type OrderRow = {
  id: string;
  order_number: string;
  student?: { name?: string } | null;
  product?: { name?: string } | null;
  bda?: { name?: string } | null;
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

export function OrdersPage() {
  const { data } = useApi<{ orders: OrderRow[] }>("/api/orders", { orders: [] });

  return (
    <div className="page-grid compact-canvas">
      <PageHeader
        eyebrow="Orders"
        title="Order and transaction desk"
        description="Every token and recovery now sits against its own transaction ID while the order keeps sold value, collected value, due amount, and BDA ownership together."
      />
      <SectionCard title="Orders" subtitle="OMS-style order totals plus transaction mapping.">
        <div className="table-shell table-shell-scrollable admin-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order No</th>
                <th>Student</th>
                <th>Product</th>
                <th>BDA</th>
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
              {data.orders.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono text-xs">{row.order_number}</td>
                  <td>{row.student?.name || "-"}</td>
                  <td>
                    <div>{row.product?.name || "-"}</div>
                    {row.coupon_code ? <div className="text-xs text-[var(--text-secondary)]">Coupon {row.coupon_code}</div> : null}
                  </td>
                  <td>{row.bda?.name || "-"}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
