import { PageHeader, SectionCard } from "../components/UI";
import { useApi } from "../lib/api";
import { formatCurrency } from "../lib/format";

export function SaleStatsPage() {
  const { data } = useApi<any>("/api/sales/summary", { summary: [], monthlyRevenue: [], podSales: [] });

  return (
    <div className="page-grid">
      <PageHeader eyebrow="Sales" title="Revenue atlas" description="Replicates the LLW sale-stats view with time-boxed totals, yearly monthly patterns, and POD-wise sales output." />

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
              {data.summary.map((row: any) => (
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

      <SectionCard title="Revenue by Month" subtitle="Three-year trend scaffold">
        <div className="chart-bars">
          {data.monthlyRevenue.map((item: any) => (
            <div className="chart-bar" key={item.label}>
              <span style={{ height: `${item.value}%` }} />
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
                <th>Product Category</th>
                <th>Today</th>
                <th>Yesterday</th>
                <th>This Week</th>
                <th>This Month</th>
                <th>Last Month</th>
              </tr>
            </thead>
            <tbody>
              {data.podSales.map((row: any) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
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
