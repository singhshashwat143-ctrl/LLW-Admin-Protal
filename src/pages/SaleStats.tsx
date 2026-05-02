import { PageHeader, SectionCard } from "../components/UI";
import { useApi } from "../lib/api";
import { formatCurrency } from "../lib/format";

type SalesSummaryResponse = {
  summary: Array<{
    label: string;
    amount: number;
    count: number;
  }>;
  monthlyRevenue: Array<{
    label: string;
    amount: number;
  }>;
  podSales: Array<{
    product: string;
    today: number;
    yesterday: number;
    week: number;
    month: number;
    lastMonth: number;
  }>;
};

export function SaleStatsPage() {
  const { data } = useApi<SalesSummaryResponse>("/api/sales/summary", { summary: [], monthlyRevenue: [], podSales: [] });
  const maxMonthlyAmount = Math.max(1, ...data.monthlyRevenue.map((item) => item.amount || 0));

  return (
    <div className="page-grid">
      <PageHeader eyebrow="Sales" title="Revenue atlas" description="Time-boxed revenue totals, monthly patterns, and product-wise sales for the scope allowed by your role." />

      <SectionCard title="Summary Table">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Window</th>
                <th>Amount</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {data.summary.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{formatCurrency(row.amount)}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Revenue by Month" subtitle="Rolling 12-month net revenue trend">
        <div className="chart-bars">
          {data.monthlyRevenue.map((item) => (
            <div className="chart-bar" key={item.label}>
              <span style={{ height: `${Math.max(((item.amount || 0) / maxMonthlyAmount) * 100, 4)}%` }} title={formatCurrency(item.amount)} />
              <strong className="text-xs">{item.label}</strong>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="POD Level Sales">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Products</th>
                <th>Today</th>
                <th>Yesterday</th>
                <th>This Week</th>
                <th>This Month</th>
                <th>Last Month</th>
              </tr>
            </thead>
            <tbody>
              {data.podSales.map((row) => (
                <tr key={row.product}>
                  <td>{row.product}</td>
                  <td>{formatCurrency(row.today)}</td>
                  <td>{formatCurrency(row.yesterday)}</td>
                  <td>{formatCurrency(row.week)}</td>
                  <td>{formatCurrency(row.month)}</td>
                  <td>{formatCurrency(row.lastMonth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
