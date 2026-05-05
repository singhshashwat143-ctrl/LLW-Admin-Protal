import { useMemo, useState } from "react";
import { Badge, PageHeader, SectionCard, StatCard } from "../components/UI";
import { PRODUCT_BATCH_OPTIONS } from "../lib/batches";
import { api, useApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatCurrency, formatDateTime } from "../lib/format";
import { hasPermission } from "../lib/permissions";

type RefundRow = {
  id: string;
  order_id?: string | null;
  payment_id?: string | null;
  gateway_order_id: string;
  student_name: string;
  phone: string;
  amount_inr: number;
  course_name: string;
  requested_by: string;
  requested_by_email: string;
  requested_by_role?: string;
  admin_comment: string;
  user_comment: string;
  status: string;
  approval_chain?: string;
  next_approver_name?: string;
  next_approver_role?: string;
  decision_by?: string;
  decision_by_role?: string;
  created_at: string;
  approved_at?: string | null;
  rejected_at?: string | null;
  order?: {
    coupon_code?: string;
    amount_paid_inr?: number;
    net_cash_in_hand_inr?: number;
    product?: { id?: string; name?: string } | null;
    batch_month_key?: string;
    batch_month_label?: string;
  } | null;
};

type RefundSummary = {
  requestedCount: number;
  approvedCount: number;
  rejectedCount: number;
  requestedAmount: number;
  approvedAmount: number;
  rejectedAmount: number;
};

function tone(status: string): "green" | "red" | "gold" {
  if (status === "APPROVED") return "green";
  if (status === "REJECTED") return "red";
  return "gold";
}

export function RefundsPage() {
  const { user } = useAuth();
  const { data, setData } = useApi<{ refunds: RefundRow[]; summary: RefundSummary }>("/api/refunds", {
    refunds: [],
    summary: {
      requestedCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      requestedAmount: 0,
      approvedAmount: 0,
      rejectedAmount: 0,
    },
  });
  const [tab, setTab] = useState("REQUESTED");
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const canApproveRefunds = hasPermission(user, "approve_refunds");
  const productOptions = useMemo(() => {
    const seen = new Map<string, string>();
    data.refunds.forEach((row) => {
      if (row.order?.product?.id && row.order?.product?.name && !seen.has(row.order.product.id)) {
        seen.set(row.order.product.id, row.order.product.name);
      }
    });
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((left, right) => left.name.localeCompare(right.name));
  }, [data.refunds]);

  const refunds = useMemo(() => {
    return data.refunds.filter((row) => {
      const matchesTab =
        tab === "HISTORY"
          ? row.status !== "REQUESTED"
          : row.status === tab;
      const rowDate = row.approved_at || row.rejected_at || row.created_at;
      const rowTime = rowDate ? new Date(rowDate).getTime() : null;
      const matchesProduct = !productFilter || row.order?.product?.id === productFilter;
      const matchesBatch = !batchFilter || row.order?.batch_month_key === batchFilter;
      const matchesDateFrom = !dateFrom || (rowTime !== null && rowTime >= new Date(dateFrom).getTime());
      const matchesDateTo = !dateTo || (rowTime !== null && rowTime <= new Date(`${dateTo}T23:59:59.999`).getTime());
      const matchesSearch =
        !search
        || row.phone.includes(search)
        || row.student_name.toLowerCase().includes(search.toLowerCase())
        || row.course_name.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesProduct && matchesBatch && matchesDateFrom && matchesDateTo && matchesSearch;
    });
  }, [batchFilter, data.refunds, dateFrom, dateTo, productFilter, search, tab]);

  async function updateDecision(id: string, decision: "APPROVED" | "REJECTED") {
    const response = await api<{ refund: RefundRow }>(`/api/refunds/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    });
    setData({
      refunds: data.refunds.map((row) => (row.id === id ? response.refund : row)),
      summary: {
        requestedCount: data.refunds.map((row) => (row.id === id ? response.refund : row)).filter((row) => row.status === "REQUESTED").length,
        approvedCount: data.refunds.map((row) => (row.id === id ? response.refund : row)).filter((row) => row.status === "APPROVED").length,
        rejectedCount: data.refunds.map((row) => (row.id === id ? response.refund : row)).filter((row) => row.status === "REJECTED").length,
        requestedAmount: data.refunds
          .map((row) => (row.id === id ? response.refund : row))
          .filter((row) => row.status === "REQUESTED")
          .reduce((sum, row) => sum + Number(row.amount_inr || 0), 0),
        approvedAmount: data.refunds
          .map((row) => (row.id === id ? response.refund : row))
          .filter((row) => row.status === "APPROVED")
          .reduce((sum, row) => sum + Number(row.amount_inr || 0), 0),
        rejectedAmount: data.refunds
          .map((row) => (row.id === id ? response.refund : row))
          .filter((row) => row.status === "REJECTED")
          .reduce((sum, row) => sum + Number(row.amount_inr || 0), 0),
      },
    });
  }

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Refunds"
        title="Refund requests"
        description="Review incoming refund requests and preserve an audit trail for every decision."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Requested Refunds" value={formatCurrency((data.summary.requestedAmount || 0) / 100)} meta={`${data.summary.requestedCount || 0} requests open`} />
        <StatCard label="Approved Refunds" value={formatCurrency((data.summary.approvedAmount || 0) / 100)} meta={`${data.summary.approvedCount || 0} approved and audited`} />
        <StatCard label="Rejected Refunds" value={formatCurrency((data.summary.rejectedAmount || 0) / 100)} meta={`${data.summary.rejectedCount || 0} rejected`} />
      </div>

      <SectionCard title="Refunds">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                ["REQUESTED", "Requests"],
                ["APPROVED", "Approved"],
                ["HISTORY", "History"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={tab === value ? "btn-primary" : "btn-secondary"}
                  type="button"
                  onClick={() => setTab(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="payments-toolbar">
              <div className="payments-filters">
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
            </div>
          </div>
          <input className="input-dark max-w-[360px]" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by phone, customer, or course..." />
        </div>

        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Gateway Order ID</th>
                <th>User</th>
                <th>Amount</th>
                <th>Course</th>
                <th>Order Audit</th>
                <th>Requested By</th>
                <th>Review</th>
                <th>Comments</th>
                <th>Audit Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>
                    <div className="font-mono text-xs">{row.gateway_order_id}</div>
                  </td>
                  <td>
                    <div className="font-medium text-[var(--text-strong)]">{row.student_name}</div>
                    <div className="text-sm text-[var(--text-secondary)]">{row.phone}</div>
                  </td>
                  <td>{formatCurrency((row.amount_inr || 0) / 100)}</td>
                  <td>
                    <div>{row.course_name}</div>
                    {row.order?.batch_month_label ? <div className="text-xs text-[var(--text-secondary)]">Batch {row.order.batch_month_label}</div> : null}
                  </td>
                  <td>
                    <div className="font-mono text-xs">{row.order_id || "-"}</div>
                    {row.order?.coupon_code ? <div className="text-xs text-[var(--text-secondary)]">Coupon {row.order.coupon_code}</div> : null}
                    <div className="text-xs text-[var(--text-secondary)]">Collected {formatCurrency(((row.order?.amount_paid_inr || 0)) / 100)}</div>
                    <div className="text-xs text-[var(--text-secondary)]">Net cash {formatCurrency(((row.order?.net_cash_in_hand_inr || 0)) / 100)}</div>
                  </td>
                  <td>
                    <div>{row.requested_by}</div>
                    <div className="text-sm text-[var(--text-secondary)]">{row.requested_by_email}</div>
                    {row.requested_by_role ? <div className="text-xs text-[var(--text-secondary)]">{row.requested_by_role}</div> : null}
                  </td>
                  <td>
                    {row.next_approver_name && row.status === "REQUESTED" ? (
                      <div className="mt-1 text-xs text-[var(--text-secondary)]">
                        In review
                      </div>
                    ) : row.decision_by ? (
                      <div className="mt-1 text-xs text-[var(--text-secondary)]">
                        Closed by {row.decision_by}{row.decision_by_role ? ` • ${row.decision_by_role}` : ""}
                      </div>
                    ) : <div className="text-sm">Open</div>}
                  </td>
                  <td>
                    <div className="text-sm">{row.admin_comment || "No admin comments"}</div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">{row.user_comment}</div>
                  </td>
                  <td>{formatDateTime(row.approved_at || row.rejected_at || row.created_at)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={tone(row.status)}>{row.status}</Badge>
                      {row.status === "REQUESTED" && canApproveRefunds ? (
                        <>
                          <button className="btn-primary" type="button" onClick={() => updateDecision(row.id, "APPROVED")}>Approve</button>
                          <button className="btn-secondary" type="button" onClick={() => updateDecision(row.id, "REJECTED")}>Reject</button>
                        </>
                      ) : row.status === "REQUESTED" ? <span className="text-xs text-[var(--text-secondary)]">Awaiting admin approval</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!refunds.length ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-sm text-[var(--text-secondary)]">
                    No refunds matched the current product, batch, date, or search filters.
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
