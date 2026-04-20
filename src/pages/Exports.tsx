import { useMemo, useState } from "react";
import { PageHeader, SectionCard } from "../components/UI";
import { api, useApi } from "../lib/api";
import { navigate } from "../lib/router";

type ProductRow = {
  id: string;
  name: string;
};

type TeamResponse = {
  bdas: Array<{ id: string; name: string; manager_name?: string }>;
  managers: Array<{ manager_name: string }>;
};

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? "").replaceAll("\"", "\"\"")}"`).join(",")),
  ].join("\n");
}

export function ExportsPage() {
  const productsApi = useApi<{ products: ProductRow[] }>("/api/products", { products: [] });
  const teamApi = useApi<TeamResponse>("/api/team", { bdas: [], managers: [] });
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<Array<Record<string, unknown>>>([]);
  const [filters, setFilters] = useState({
    type: "payments",
    days: "30",
    dateFrom: "",
    dateTo: "",
    sourceType: "ALL",
    bdaId: "",
    managerName: "",
    productId: "",
    paymentMode: "ALL",
    paymentBucket: "ALL",
    paymentState: "ALL",
    paymentStatus: "ALL",
  });

  const previewColumns = useMemo(() => {
    if (!previewRows.length) return [];
    const preferred = [
      "sales_date",
      "created_at",
      "refund_date",
      "source_type",
      "source_label",
      "bda_name",
      "manager_name",
      "customer_name",
      "product_name",
      "payment_mode",
      "payment_state",
      "payment_status",
      "amount_inr",
      "refund_amount_inr",
      "amount_due_inr",
      "transaction_id",
    ];
    return preferred.filter((key) => key in previewRows[0]).slice(0, 8);
  }, [previewRows]);

  async function fetchExportRows() {
    setLoading(true);
    setNotice("");
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.set(key, value);
      });
      const response = await api<{ data: Array<Record<string, unknown>> }>(`/api/admin/export?${queryParams.toString()}`);
      setPreviewRows(response.data);
      setNotice(response.data.length ? `${response.data.length} rows loaded for preview.` : "No rows matched the selected filters.");
      return response.data;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load export preview.");
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function downloadExport() {
    const rows = await fetchExportRows();
    if (!rows.length) return;

    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filters.type}-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotice(`${filters.type} export downloaded.`);
  }

  return (
    <div className="page-grid compact-canvas">
      <PageHeader
        eyebrow="Exports"
        title="Payment and collections exports"
        description="Download class, webinar, BDA, manual, token, pending, completed, failed, and refunded payment data with date and source filters."
        actions={
          <>
            <button className="btn-secondary" type="button" onClick={() => navigate("/payments")}>Back to Payments</button>
            <button className="btn-primary" type="button" onClick={downloadExport} disabled={loading}>{loading ? "Preparing..." : "Download CSV"}</button>
          </>
        }
      />

      {notice ? (
        <div className="rounded-[22px] border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-5 py-4 text-sm text-[var(--success)]">
          {notice}
        </div>
      ) : null}

      <SectionCard title="Export Filters" subtitle="Track class payments, BDA payments, payment date and time, full/token, pending, completed, failed, and refunded from one place.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <select className="input-dark" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
            <option value="payments">Payments</option>
            <option value="enrollments">Enrollments</option>
            <option value="tokens">Token Dues</option>
            <option value="refunds">Refunds</option>
          </select>

          <select className="input-dark" value={filters.days} onChange={(event) => setFilters({ ...filters, days: event.target.value })}>
            <option value="7">Last 7 days</option>
            <option value="15">Last 15 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
          </select>

          <input className="input-dark" type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} />
          <input className="input-dark" type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} />

          <select className="input-dark" value={filters.sourceType} onChange={(event) => setFilters({ ...filters, sourceType: event.target.value })}>
            <option value="ALL">All sources</option>
            <option value="BDA">BDA</option>
            <option value="WEBINAR">Webinar</option>
            <option value="BOOTCAMP">Bootcamp</option>
            <option value="MANUAL">Manual</option>
          </select>

          <select className="input-dark" value={filters.bdaId} onChange={(event) => setFilters({ ...filters, bdaId: event.target.value })}>
            <option value="">All BDAs</option>
            {teamApi.data.bdas.map((bda) => (
              <option key={bda.id} value={bda.id}>{bda.name}</option>
            ))}
          </select>

          <select className="input-dark" value={filters.managerName} onChange={(event) => setFilters({ ...filters, managerName: event.target.value })}>
            <option value="">All managers</option>
            {teamApi.data.managers.map((manager) => (
              <option key={manager.manager_name} value={manager.manager_name}>{manager.manager_name}</option>
            ))}
          </select>

          <select className="input-dark" value={filters.productId} onChange={(event) => setFilters({ ...filters, productId: event.target.value })}>
            <option value="">All products / classes</option>
            {productsApi.data.products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>

          <select className="input-dark" value={filters.paymentMode} onChange={(event) => setFilters({ ...filters, paymentMode: event.target.value })}>
            <option value="ALL">All modes</option>
            <option value="FULL">Full</option>
            <option value="TOKEN">Token</option>
          </select>

          <select className="input-dark" value={filters.paymentBucket} onChange={(event) => setFilters({ ...filters, paymentBucket: event.target.value })}>
            <option value="ALL">All buckets</option>
            <option value="FULL">Full</option>
            <option value="TOKEN">Token</option>
            <option value="RECOVERY">Recovery</option>
            <option value="REFUND">Refund</option>
          </select>

          <select className="input-dark" value={filters.paymentState} onChange={(event) => setFilters({ ...filters, paymentState: event.target.value })}>
            <option value="ALL">All states</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="TOKEN">Token</option>
            <option value="PARTIAL">Partial</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>

          <select className="input-dark" value={filters.paymentStatus} onChange={(event) => setFilters({ ...filters, paymentStatus: event.target.value })}>
            <option value="ALL">All gateway statuses</option>
            <option value="CREATED">Created</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-secondary" type="button" onClick={fetchExportRows} disabled={loading}>{loading ? "Loading..." : "Preview Export"}</button>
          <button className="btn-primary" type="button" onClick={downloadExport} disabled={loading}>{loading ? "Preparing..." : "Download CSV"}</button>
        </div>
      </SectionCard>

      <SectionCard title="Preview" subtitle="Preview the filtered rows before downloading.">
        <div className="table-shell table-shell-scrollable admin-table-scroll payments-table-scroll">
          <table className="compact-table">
            <thead>
              <tr>
                {previewColumns.map((column) => (
                  <th key={column}>{column.replaceAll("_", " ")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.slice(0, 25).map((row, index) => (
                <tr key={`${row.order_id || row.payment_id || row.refund_id || "row"}-${index}`}>
                  {previewColumns.map((column) => (
                    <td key={column}>{String(row[column] ?? "—")}</td>
                  ))}
                </tr>
              ))}
              {!previewRows.length ? (
                <tr>
                  <td colSpan={Math.max(previewColumns.length, 1)} className="py-10 text-center text-sm text-[var(--text-secondary)]">
                    No preview rows loaded yet.
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
