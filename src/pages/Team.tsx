import { PageHeader, SectionCard } from "../components/UI";
import { useApi } from "../lib/api";
import { formatCurrency } from "../lib/format";

type TeamResponse = {
  team: Array<{ id: string; name: string; email: string; role: string; is_active?: boolean; manager_name?: string; team_name?: string }>;
  admins: Array<{ id: string; name: string; email: string; role: string }>;
  bdas: Array<{ id: string; name: string; email: string; manager_name?: string; team_name?: string }>;
  managers: Array<{
    manager_name: string;
    totalRevenue: number;
    netRevenue?: number;
    refundedAmount?: number;
    newRevenue: number;
    recoveryRevenue: number;
    recoveryPipeline: number;
    teamMembers: number;
    top_bda: string;
  }>;
  leaderboard: Array<{
    id: string;
    name: string;
    email: string;
    manager_name?: string;
    totalRevenue: number;
    netRevenue?: number;
    refundedAmount?: number;
    newRevenue: number;
    recoveryRevenue: number;
    recoveryPipeline: number;
    customers: number;
  }>;
};

export function TeamPage() {
  const { data } = useApi<TeamResponse>("/api/team", {
    team: [],
    admins: [],
    bdas: [],
    managers: [],
    leaderboard: [],
  });

  return (
    <div className="page-grid compact-canvas">
      <PageHeader
        eyebrow="Team"
        title="Managers, BDAs, and leaderboard view"
        description="This now brings the OMS-style manager track and top-BDA leaderboard into the webinar portal."
      />

      <SectionCard title="Manager Track" subtitle="Collections stay separate from refunds so paid amounts stay visible.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.managers.map((manager) => (
            <div key={manager.manager_name} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{manager.manager_name}</div>
              <div className="mt-3 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency((manager.totalRevenue || 0) / 100)}</div>
              <div className="mt-2 text-sm text-[var(--text-secondary)]">
                {manager.teamMembers} BDAs • Top performer {manager.top_bda || "—"}
              </div>
              <div className="mt-3 text-sm text-[var(--text-secondary)]">
                New {formatCurrency((manager.newRevenue || 0) / 100)} • Recovery {formatCurrency((manager.recoveryRevenue || 0) / 100)}
              </div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">
                Net {formatCurrency((manager.netRevenue || 0) / 100)} • Refunded {formatCurrency((manager.refundedAmount || 0) / 100)}
              </div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">
                Pipeline {formatCurrency((manager.recoveryPipeline || 0) / 100)}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Top BDA Leaderboard" subtitle="Individual BDA track for collections, refunds, recovery, and customer count.">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>BDA</th>
                <th>Manager</th>
                <th>Email</th>
                <th>Collections</th>
                <th>Net</th>
                <th>Refunded</th>
                <th>New Revenue</th>
                <th>Recovery Revenue</th>
                <th>Recovery Pipeline</th>
                <th>Customers</th>
              </tr>
            </thead>
            <tbody>
              {data.leaderboard.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.name}</td>
                  <td>{entry.manager_name || "—"}</td>
                  <td>{entry.email}</td>
                  <td>{formatCurrency((entry.totalRevenue || 0) / 100)}</td>
                  <td>{formatCurrency((entry.netRevenue || 0) / 100)}</td>
                  <td>{formatCurrency((entry.refundedAmount || 0) / 100)}</td>
                  <td>{formatCurrency((entry.newRevenue || 0) / 100)}</td>
                  <td>{formatCurrency((entry.recoveryRevenue || 0) / 100)}</td>
                  <td>{formatCurrency((entry.recoveryPipeline || 0) / 100)}</td>
                  <td>{entry.customers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Operations Team" subtitle="Admin and super-admin roster.">
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {data.admins.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.email}</td>
                    <td>{row.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="BDA Roster" subtitle="Team ownership by manager and function.">
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Manager</th>
                  <th>Team</th>
                </tr>
              </thead>
              <tbody>
                {data.bdas.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.email}</td>
                    <td>{row.manager_name || "—"}</td>
                    <td>{row.team_name || "Revenue"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
