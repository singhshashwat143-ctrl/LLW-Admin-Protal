import { PageHeader, SectionCard, StatCard } from "../components/UI";
import { useApi } from "../lib/api";

type Funnel = {
  leads: number;
  attended: number;
  cryptx_signup: number;
  converted: number;
  deposited: number;
  total_balance_usd: number;
  total_profit_usd: number;
  cryptx_total: number;
  last_sync_at: string | null;
};

type Journey = {
  email: string;
  name: string;
  phone: string;
  sessions: number;
  attended: boolean;
  cryptx_signup: boolean;
  is_client: boolean;
  balance_usd: number | null;
  profit_usd: number;
  payment_status: string | null;
};

const usd = (n: number | null | undefined) =>
  "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

const STAGES = [
  { key: "leads", label: "Leads", sub: "Webinar attendees reached" },
  { key: "attended", label: "Attended", sub: "Joined the live class" },
  { key: "cryptx_signup", label: "CryptX Signup", sub: "Opened an account" },
  { key: "converted", label: "Converted", sub: "Paid / active account" },
  { key: "deposited", label: "Deposited", sub: "Funded account" },
] as const;

function Dot({ on }: { on: boolean }) {
  return <span aria-hidden style={{ color: on ? "var(--accent, #0e9e8c)" : "var(--text-secondary)" }}>{on ? "●" : "○"}</span>;
}

export function FunnelPage() {
  const { data } = useApi<{ funnel: Funnel | null; journey: Journey[] }>("/api/funnel/overview", { funnel: null, journey: [] });
  const f = data.funnel;
  const journey = data.journey || [];
  const top = f?.leads || 0;
  const lastSync = f?.last_sync_at ? new Date(f.last_sync_at).toLocaleString("en-IN") : "—";

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="CryptX Conversion"
        title="Lead → Deposit Funnel"
        description="Every webinar lead followed through to a CryptX deposit — attendance, account signup, conversion and funding, joined by email. Live from the webinar platform and the CryptX sync."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Converted Clients" value={String(f?.converted ?? 0)} meta={`${pct(f?.converted ?? 0, f?.leads ?? 0)}% of leads`} />
        <StatCard label="Total Deposits (Balance)" value={usd(f?.total_balance_usd)} meta="Across all client accounts" />
        <StatCard label="Total Profit" value={usd(f?.total_profit_usd)} meta="Gross profit generated" />
        <StatCard label="CryptX Accounts" value={String(f?.cryptx_total ?? 0)} meta={`Synced ${lastSync}`} />
      </div>

      <SectionCard title="Conversion funnel" subtitle="Leads → attended → CryptX signup → converted → deposited">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {STAGES.map((s) => {
            const v = (f?.[s.key] as number) ?? 0;
            const width = top > 0 ? Math.max(4, Math.round((v / top) * 100)) : 4;
            return (
              <div key={s.key} style={{ display: "grid", gridTemplateColumns: "150px 1fr 96px", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s.sub}</div>
                </div>
                <div style={{ background: "var(--surface-sunk, rgba(120,130,150,.12))", borderRadius: 8, overflow: "hidden", height: 30 }}>
                  <div style={{ width: `${width}%`, height: "100%", background: "var(--accent, #0e9e8c)", opacity: 0.85, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 10, color: "#fff", fontWeight: 600, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{v}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{pct(v, top)}% of leads</div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Lead journey" subtitle="Each webinar attendee, followed through to their CryptX outcome.">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Lead</th>
                <th>Sessions</th>
                <th>Attended</th>
                <th>CryptX</th>
                <th>Converted</th>
                <th>Balance</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {journey.map((j, i) => (
                <tr key={j.email}>
                  <td>{i + 1}</td>
                  <td>
                    <div className="font-medium text-[var(--text-strong)]">{j.name || j.email}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{j.email}</div>
                  </td>
                  <td>{j.sessions}</td>
                  <td><Dot on={j.attended} /></td>
                  <td><Dot on={j.cryptx_signup} /></td>
                  <td>{j.is_client ? <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">client</span> : <span className="text-[var(--text-secondary)]">—</span>}</td>
                  <td className="font-mono">{j.balance_usd != null ? usd(j.balance_usd) : "—"}</td>
                  <td className="font-mono">{j.profit_usd ? usd(j.profit_usd) : "—"}</td>
                </tr>
              ))}
              {journey.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "28px", color: "var(--text-secondary)" }}>No webinar leads yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
