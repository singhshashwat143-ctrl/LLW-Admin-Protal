import { useEffect, useMemo, useState } from "react";
import { PageHeader, SectionCard, StatCard } from "../components/UI";
import { useApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatCurrency, formatDateTime } from "../lib/format";
import { hasPermission, normalizeRole } from "../lib/permissions";
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
    date?: string;
    soldValue: number;
    cashInHand: number;
  }>;
  graphFilters: {
    month?: string;
    dateFrom?: string;
    dateTo?: string;
    label?: string;
  };
  recentOrders: Array<{
    id: string;
    student?: { name?: string; phone?: string } | null;
    product?: { name?: string } | null;
    batch_month_label?: string;
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

function formatMonthInput(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateInput(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function buildDefaultLast30Range() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 29);
  return {
    dateFrom: formatDateInput(start),
    dateTo: formatDateInput(end),
  };
}

function buildMonthRange(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return null;
  return {
    dateFrom: formatDateInput(new Date(year, month - 1, 1)),
    dateTo: formatDateInput(new Date(year, month, 0)),
  };
}

function buildRecentMonthOptions(count = 12) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - index);
    return {
      value: formatMonthInput(date),
      label: date.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    };
  });
}

export function DashboardPage() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const canViewProgramOps = role === "ADMIN" || role === "SUPER_ADMIN" || role === "OPERATIONS";
  const monthOptions = useMemo(() => buildRecentMonthOptions(), []);
  const defaultRange = useMemo(() => buildDefaultLast30Range(), []);
  const [monthFilter, setMonthFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const effectiveRange = useMemo(() => {
    if (monthFilter) {
      return buildMonthRange(monthFilter) || { dateFrom, dateTo };
    }
    return { dateFrom, dateTo };
  }, [dateFrom, dateTo, monthFilter]);

  const dashboardPath = useMemo(() => {
    const params = new URLSearchParams();
    if (monthFilter) params.set("month", monthFilter);
    if (effectiveRange.dateFrom) params.set("dateFrom", effectiveRange.dateFrom);
    if (effectiveRange.dateTo) params.set("dateTo", effectiveRange.dateTo);
    const query = params.toString();
    return query ? `/api/dashboard/stats?${query}` : "/api/dashboard/stats";
  }, [effectiveRange.dateFrom, effectiveRange.dateTo, monthFilter]);

  const { data } = useApi<DashboardResponse>(dashboardPath, {
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
    graphFilters: {},
    recentOrders: [],
    leaderboard: [],
    upcomingWebinars: [],
    managerSummary: [],
  });
  const outstandingMeta = "Remaining amount on collected orders inside the selected dashboard range";
  const graphLabel = data.graphFilters.label || "Last 30 days";
  const hasGraphFilters = Boolean(
    monthFilter
    || effectiveRange.dateFrom !== defaultRange.dateFrom
    || effectiveRange.dateTo !== defaultRange.dateTo,
  );

  function exportSnapshot() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `llw-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function resetGraphFilters() {
    setMonthFilter("");
    setDateFrom(defaultRange.dateFrom);
    setDateTo(defaultRange.dateTo);
  }

  return (
    <div className="page-grid compact-canvas">
      <PageHeader
        eyebrow="OMS Overview"
        title="Revenue, recovery, and operations snapshot"
        description="This dashboard now mirrors the OMS revenue view and automatically scopes the numbers to you, your team, or the full business based on your role."
        actions={
          <>
            {hasPermission(user, "export_data") ? <button className="btn-secondary" type="button" onClick={exportSnapshot}>Export Snapshot</button> : null}
            <button className="btn-primary" type="button" onClick={() => navigate("/payments")}>Open Payments Board</button>
          </>
        }
      />

      <SectionCard title="Dashboard Filter" subtitle={`This range updates the cards, graph, leaderboard, and recent orders together. Current window: ${graphLabel}.`}>
        <div className="payments-toolbar">
          <div className="payments-filters">
            <select
              className="input-dark min-w-[180px]"
              value={monthFilter}
              onChange={(event) => {
                const nextMonth = event.target.value;
                setMonthFilter(nextMonth);
                const nextRange = nextMonth ? buildMonthRange(nextMonth) : defaultRange;
                if (nextRange) {
                  setDateFrom(nextRange.dateFrom);
                  setDateTo(nextRange.dateTo);
                }
              }}
            >
              <option value="">Last 30 days</option>
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              className="input-dark min-w-[150px]"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setMonthFilter("");
                setDateFrom(event.target.value);
              }}
            />
            <input
              className="input-dark min-w-[150px]"
              type="date"
              value={dateTo}
              onChange={(event) => {
                setMonthFilter("");
                setDateTo(event.target.value);
              }}
            />
            {hasGraphFilters ? <button className="btn-secondary" type="button" onClick={resetGraphFilters}>Reset</button> : null}
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <StatCard label="Sold Value" value={formatCurrency((data.revenueTotals.soldValue || 0) / 100)} meta="Net product cost after discount booked in the selected range" />
        <StatCard label="Gross Collections" value={formatCurrency((data.revenueTotals.grossCollections || 0) / 100)} meta="Successful collections in the selected range" />
        <StatCard label="Approved Refunds" value={formatCurrency((data.revenueTotals.refundedAmount || 0) / 100)} meta="Approved refunds in the selected range" />
        <StatCard label="Net Cash In Hand" value={formatCurrency((data.revenueTotals.cashInHand || 0) / 100)} meta="Collections retained in the selected range" />
        <StatCard label="New Revenue" value={formatCurrency((data.revenueTotals.newRevenue || 0) / 100)} meta="Enrollment collections in the selected range" />
        <StatCard label="Recovery Revenue" value={formatCurrency((data.revenueTotals.recoveryRevenue || 0) / 100)} meta="Recovery collections in the selected range" />
        <StatCard label="Outstanding" value={formatCurrency((data.revenueTotals.outstandingAmount || 0) / 100)} meta={outstandingMeta} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <SectionCard title="Revenue Overview" subtitle={`Grey = sold value, indigo = cash in hand. All dashboard revenue data below uses this same window: ${graphLabel}.`}>
          <RevenueBars items={data.cashVsValueSeries} />
        </SectionCard>

        {data.managerSummary.length ? (
          <SectionCard title="Manager Snapshot" subtitle="Current manager ownership inside the selected dashboard range.">
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
        ) : (
          <SectionCard title="Personal Snapshot" subtitle="Your filtered dashboard is limited to the revenue you are allowed to see.">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--text-secondary)]">
              Your charts, recent orders, and leaderboard rows are already filtered to your own revenue scope.
            </div>
          </SectionCard>
        )}
      </div>

      <div className={`grid gap-4 ${canViewProgramOps ? "xl:grid-cols-[1.05fr_0.95fr]" : ""}`}>
        <SectionCard title="Top BDA Leaderboard" subtitle="Collections, refunds, and pipeline are filtered to the same selected dashboard range.">
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

        {canViewProgramOps ? (
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
        ) : null}
      </div>

      <SectionCard title="Recent Orders" subtitle="Latest orders created inside the selected dashboard range.">
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
                  <td>{order.product?.name || "-"}{order.batch_month_label ? ` • ${order.batch_month_label}` : ""}</td>
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
  items: Array<{ label: string; date?: string; soldValue: number; cashInHand: number }>;
}) {
  const max = Math.max(1, ...items.flatMap((item) => [item.soldValue || 0, item.cashInHand || 0]));
  const labelStep = items.length > 60 ? 6 : items.length > 31 ? 3 : items.length > 18 ? 2 : 1;

  return (
    <div className="space-y-4 overflow-x-auto pb-2">
      <div className="flex min-w-max items-end gap-3">
        {items.map((item, index) => (
          <div key={`${item.date || item.label}-${index}`} className="grid w-10 gap-2 justify-items-center">
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
            <span className="text-center text-[11px] text-[var(--text-secondary)]">
              {index % labelStep === 0 || index === items.length - 1 ? item.label : " "}
            </span>
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
