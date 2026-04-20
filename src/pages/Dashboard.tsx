import { PageHeader, SectionCard, StatCard } from "../components/UI";
import { useApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatCurrency, formatDateTime } from "../lib/format";
import { hasPermission } from "../lib/permissions";
import { navigate } from "../lib/router";

type DashboardResponse = {
  stats: {
    activeWebinarsToday?: number;
  };
  revenueTotals: {
    soldValue: number;
    grossCollections: number;
    refundedAmount: number;
    cashInHand: number;
    newRevenue: number;
    recoveryRevenue: number;
    outstandingAmount: number;
  };
  cashVsValueSeries: Array<{
    label: string;
    soldValue: number;
    cashInHand: number;
  }>;
  recentOrders: Array<{
    id: string;
    student?: { name?: string; phone?: string } | null;
    product?: { name?: string } | null;
    product_value_inr?: number;
    amount_paid_inr?: number;
    amount_due_inr?: number;
    status: string;
  }>;
  leaderboard: Array<{
    id: string;
    name: string;
    manager_name?: string;
    totalRevenue: number;
    netRevenue?: number;
    refundedAmount?: number;
    newRevenue: number;
    recoveryRevenue: number;
    recoveryPipeline: number;
  }>;
  upcomingWebinars: Array<{
    id: string;
    title: string;
    attendee_url: string;
    start_time: string;
    instructor?: { name?: string } | null;
  }>;
  managerSummary: Array<{
    manager_name: string;
    totalRevenue: number;
    netRevenue?: number;
    refundedAmount?: number;
    recoveryPipeline: number;
    teamMembers: number;
    top_bda: string;
  }>;
};

export function DashboardPage() {
  const { user } = useAuth();
  const { data } = useApi<DashboardResponse>("/api/dashboard/stats", {
    stats: {},
    revenueTotals: {
      soldValue: 0,
      grossCollections: 0,
      refundedAmount: 0,
      cashInHand: 0,
      newRevenue: 0,
      recoveryRevenue: 0,
      outstandingAmount: 0,
    },
    cashVsValueSeries: [],
    recentOrders: [],
    leaderboard: [],
    upcomingWebinars: [],
    managerSummary: [],
  });

  function exportSnapshot() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `llw-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-grid compact-canvas">
      <PageHeader
        eyebrow="OMS Overview"
        title="Revenue, recovery, and operations snapshot"
        description="This dashboard now mirrors the OMS revenue view with sold value vs cash-in-hand, recovery revenue, and top-BDA visibility."
        actions={
          <>
            {hasPermission(user, "export_data") ? <button className="btn-secondary" type="button" onClick={exportSnapshot}>Export Snapshot</button> : null}
            <button className="btn-primary" type="button" onClick={() => navigate("/payments")}>Open Payments Board</button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <StatCard label="Sold Value" value={formatCurrency((data.revenueTotals.soldValue || 0) / 100)} meta="Total product value booked" />
        <StatCard label="Gross Collections" value={formatCurrency((data.revenueTotals.grossCollections || 0) / 100)} meta="All successful collections before refunds" />
        <StatCard label="Approved Refunds" value={formatCurrency((data.revenueTotals.refundedAmount || 0) / 100)} meta="Refunds now audited into net totals" />
        <StatCard label="Net Cash In Hand" value={formatCurrency((data.revenueTotals.cashInHand || 0) / 100)} meta="Collections retained after refunds" />
        <StatCard label="New Revenue" value={formatCurrency((data.revenueTotals.newRevenue || 0) / 100)} meta="Primary enrollment collections" />
        <StatCard label="Recovery Revenue" value={formatCurrency((data.revenueTotals.recoveryRevenue || 0) / 100)} meta="Remaining-amount recoveries" />
        <StatCard label="Outstanding" value={formatCurrency((data.revenueTotals.outstandingAmount || 0) / 100)} meta={`${data.stats.activeWebinarsToday || 0} active webinars today`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <SectionCard title="Revenue Overview" subtitle="Grey = sold value, indigo = cash in hand.">
          <RevenueBars items={data.cashVsValueSeries} />
        </SectionCard>

        <SectionCard title="Manager Snapshot" subtitle="Current manager ownership with collections, refunds, and retained cash.">
          <div className="space-y-3">
            {data.managerSummary.map((manager) => (
              <div key={manager.manager_name} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[var(--text-strong)]">{manager.manager_name}</div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">{manager.teamMembers} team members • Top BDA: {manager.top_bda || "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-[var(--text-strong)]">{formatCurrency((manager.totalRevenue || 0) / 100)}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">Net cash {formatCurrency((manager.netRevenue || 0) / 100)}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">Refunded {formatCurrency((manager.refundedAmount || 0) / 100)}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">Recovery pipeline {formatCurrency((manager.recoveryPipeline || 0) / 100)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Top BDA Leaderboard" subtitle="Collections stay visible even when refunds are audited separately.">
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>BDA</th>
                  <th>Manager</th>
                  <th>Collections</th>
                  <th>Net</th>
                  <th>Refunded</th>
                  <th>New</th>
                  <th>Recovery</th>
                  <th>Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.name}</td>
                    <td>{entry.manager_name || "—"}</td>
                    <td>{formatCurrency((entry.totalRevenue || 0) / 100)}</td>
                    <td>{formatCurrency((entry.netRevenue || 0) / 100)}</td>
                    <td>{formatCurrency((entry.refundedAmount || 0) / 100)}</td>
                    <td>{formatCurrency((entry.newRevenue || 0) / 100)}</td>
                    <td>{formatCurrency((entry.recoveryRevenue || 0) / 100)}</td>
                    <td>{formatCurrency((entry.recoveryPipeline || 0) / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Upcoming Webinars" subtitle="Live classes still stay visible alongside the OMS metrics.">
          <div className="space-y-3">
            {data.upcomingWebinars.map((webinar) => (
              <div key={webinar.id} className="rounded-3xl border border-[rgba(201,168,76,0.14)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{webinar.title}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{webinar.instructor?.name || "Unassigned"} • {formatDateTime(webinar.start_time)}</p>
                  </div>
                  <a href={webinar.attendee_url} className="btn-secondary inline-block text-sm">Attendance Link</a>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Recent Orders" subtitle="Latest orders with sold value, collected amount, and remaining due.">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Phone</th>
                <th>Product</th>
                <th>Sold Value</th>
                <th>Collected</th>
                <th>Remaining</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((order) => (
                <tr key={order.id}>
                  <td>{order.student?.name || "-"}</td>
                  <td className="font-mono text-xs">{order.student?.phone || "-"}</td>
                  <td>{order.product?.name || "-"}</td>
                  <td>{formatCurrency((order.product_value_inr || 0) / 100)}</td>
                  <td>{formatCurrency((order.amount_paid_inr || 0) / 100)}</td>
                  <td>{formatCurrency((order.amount_due_inr || 0) / 100)}</td>
                  <td>{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function RevenueBars({
  items,
}: {
  items: Array<{ label: string; soldValue: number; cashInHand: number }>;
}) {
  const max = Math.max(1, ...items.flatMap((item) => [item.soldValue || 0, item.cashInHand || 0]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(32px,1fr))] gap-3 items-end min-h-[260px]">
        {items.map((item) => (
          <div key={item.label} className="grid gap-2 justify-items-center">
            <div className="flex h-[220px] items-end gap-1">
              <span
                className="w-3 rounded-t-md bg-slate-300"
                style={{ height: `${Math.max((item.soldValue / max) * 100, 4)}%` }}
                title={`Sold value ${formatCurrency((item.soldValue || 0) / 100)}`}
              />
              <span
                className="w-3 rounded-t-md bg-[var(--accent)]"
                style={{ height: `${Math.max((item.cashInHand / max) * 100, 4)}%` }}
                title={`Cash in hand ${formatCurrency((item.cashInHand || 0) / 100)}`}
              />
            </div>
            <span className="text-[11px] text-[var(--text-secondary)]">{item.label}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-slate-300" /> Sold value</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[var(--accent)]" /> Cash in hand</span>
      </div>
    </div>
  );
}
