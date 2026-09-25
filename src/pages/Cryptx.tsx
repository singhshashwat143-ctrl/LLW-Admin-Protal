import { PageHeader, SectionCard, StatCard } from "../components/UI";
import { useApi } from "../lib/api";
import { formatCurrency } from "../lib/format";

type CryptxClient = {
  email: string;
  cryptx_uid: number | null;
  balance_usd: number | null;
  payment_status: string;
  paid_until: string | null;
  activation_paid: boolean;
  total_profit_usd: number;
  total_paid_inr: number;
  open_inr: number;
  n_accounts: number;
  n_invoices: number;
  is_client: boolean;
  signed_up: string | null;
  synced_at: string | null;
};

type SyncStatus = {
  mode: string;
  total: number;
  clients: number;
  paid: number;
  total_balance_usd: number;
  total_profit_usd: number;
  last_sync_at: string | null;
};

const usd = (n: number | null | undefined) =>
  "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

function StatusPill({ status }: { status: string }) {
  const s = (status || "none").toLowerCase();
  const tone =
    s === "paid"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      : s === "expired"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tone}`}>{s}</span>;
}

export function CryptxPage() {
  const { data: statusData } = useApi<{ status: SyncStatus | null }>("/api/cryptx-sync/status", { status: null });
  const { data: clientsData, loading } = useApi<{ clients: CryptxClient[] }>("/api/cryptx-sync/clients", { clients: [] });
  const status = statusData.status;
  const clients = clientsData.clients;
  const lastSync = status?.last_sync_at ? new Date(status.last_sync_at).toLocaleString("en-IN") : "—";

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="CryptX"
        title="CryptX Clients"
        description="Live sync from cryptx.wealthx.tech — deposit balance, profit, and payment status per client, joined to the funnel by email. Refreshes automatically every 15 minutes."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Synced Records" value={String(status?.total ?? 0)} meta={`Last sync ${lastSync}`} />
        <StatCard label="Converted Clients" value={String(status?.clients ?? 0)} meta="Active or paid CryptX account" />
        <StatCard label="Paid" value={String(status?.paid ?? 0)} meta="Payment status = paid" />
        <StatCard label="Total Balance" value={usd(status?.total_balance_usd)} meta="Across all client accounts" />
        <StatCard label="Total Profit" value={usd(status?.total_profit_usd)} meta="Gross profit for the share" />
      </div>

      <SectionCard title="Client Roster" subtitle="Synced from CryptX. A record becomes a client once it has an active or paid account.">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Email</th>
                <th>Status</th>
                <th>Balance (USD)</th>
                <th>Profit (USD)</th>
                <th>Paid (INR)</th>
                <th>Accts</th>
                <th>Invoices</th>
                <th>Client</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr key={c.email}>
                  <td>{i + 1}</td>
                  <td className="font-medium text-[var(--text-strong)]">{c.email}</td>
                  <td><StatusPill status={c.payment_status} /></td>
                  <td className="font-mono">{c.balance_usd != null ? usd(c.balance_usd) : "—"}</td>
                  <td className="font-mono">{c.total_profit_usd ? usd(c.total_profit_usd) : "—"}</td>
                  <td className="font-mono">{c.total_paid_inr ? formatCurrency(c.total_paid_inr) : "—"}</td>
                  <td>{c.n_accounts}</td>
                  <td>{c.n_invoices}</td>
                  <td>{c.is_client ? "✓" : "—"}</td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "28px", color: "var(--text-secondary)" }}>
                    {loading ? "Loading…" : "No CryptX clients synced yet. The sync runs every 15 minutes."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
