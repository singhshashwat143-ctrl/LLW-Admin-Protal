import { PageHeader, SectionCard, StatCard } from "../components/UI";
import { useApi } from "../lib/api";
import { formatCurrency } from "../lib/format";

type Invoice = {
  id: number;
  email: string | null;
  name: string | null;
  kind: string;
  period: string;
  amount_inr: number;
  profit_usd: number | null;
  status: string;
  rzp_payment_id: string | null;
  created_at: string | null;
  paid_at: string | null;
};

type Summary = {
  total: number;
  paid_count: number;
  open_count: number;
  revenue_inr: number;
  open_inr: number;
  activation_count: number;
  activation_inr: number;
  profit_share_count: number;
  profit_share_inr: number;
  profit_share_profit_usd: number;
};

const usd = (n: number | null | undefined) => "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const KIND_LABEL: Record<string, string> = { activation: "Activation", profit_share: "Profit share" };

function KindTag({ kind }: { kind: string }) {
  const label = KIND_LABEL[kind] || kind;
  const tone = kind === "profit_share"
    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
    : "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{label}</span>;
}

export function CryptxPaymentsPage() {
  const { data } = useApi<{ summary: Summary | null; invoices: Invoice[] }>("/api/cryptx-sync/invoices", { summary: null, invoices: [] }, 60000);
  const s = data.summary;
  const invoices = data.invoices || [];

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="CryptX · Razorpay"
        title="Payments & Profit Sharing"
        description="Every CryptX invoice from Razorpay — ₹2,000 activation payments and monthly profit-share payouts. Synced live from cryptx.wealthx.tech."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue Collected" value={formatCurrency(s?.revenue_inr || 0)} meta={`${s?.paid_count ?? 0} paid invoices`} />
        <StatCard label="Activation Payments" value={formatCurrency(s?.activation_inr || 0)} meta={`${s?.activation_count ?? 0} × ₹2,000 activations`} />
        <StatCard label="Profit Share Collected" value={formatCurrency(s?.profit_share_inr || 0)} meta={`On ${usd(s?.profit_share_profit_usd)} client profit`} />
        <StatCard label="Open / Unpaid" value={formatCurrency(s?.open_inr || 0)} meta={`${s?.open_count ?? 0} open invoices`} />
      </div>

      <SectionCard title="Invoices" subtitle="Activation + profit-share invoices, newest first.">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Period</th>
                <th>Amount</th>
                <th>Profit (USD)</th>
                <th>Status</th>
                <th>Razorpay ID</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((iv) => (
                <tr key={iv.id}>
                  <td>{iv.id}</td>
                  <td className="font-medium text-[var(--text-strong)]">{iv.name || iv.email || "—"}</td>
                  <td><KindTag kind={iv.kind} /></td>
                  <td>{iv.period || "—"}</td>
                  <td className="font-mono">{formatCurrency(iv.amount_inr || 0)}</td>
                  <td className="font-mono">{iv.profit_usd != null ? usd(iv.profit_usd) : "—"}</td>
                  <td>
                    {iv.status === "paid"
                      ? <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">paid</span>
                      : <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">open</span>}
                  </td>
                  <td className="font-mono text-xs">{iv.rzp_payment_id || "—"}</td>
                  <td className="text-xs text-[var(--text-secondary)]">{(iv.paid_at || iv.created_at || "").slice(0, 10) || "—"}</td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: "28px", color: "var(--text-secondary)" }}>No invoices synced yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
