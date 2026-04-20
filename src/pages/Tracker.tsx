import { PageHeader, SectionCard } from "../components/UI";
import { useApi } from "../lib/api";
import { formatCurrency, formatDateTime } from "../lib/format";
import { navigate } from "../lib/router";

type TrackerResponse = {
  rows: Array<{
    id: string;
    title: string;
    category: string;
    start_time: string;
    is_simulation?: boolean;
    instructor?: { name?: string } | null;
  }>;
  salesTracker: {
    summary: {
      outstandingAmount: number;
      dueToday: number;
      overdue: number;
      thisMonthCollections: number;
    };
    enrollments: Array<{
      id: string;
      order_number: string;
      student?: { name?: string; phone?: string; email?: string } | null;
      bda?: { name?: string } | null;
      manager_name?: string;
      product?: { name?: string } | null;
      source?: string;
      product_value_inr: number;
      amount_paid_inr: number;
      amount_due_inr: number;
      status: string;
      token_due?: { due_date?: string | null } | null;
      payment_history: Array<{
        id: string;
        amount_inr: number;
        method: string;
        status: string;
        transaction_id: string;
        created_at: string;
      }>;
      payment_link?: string;
    }>;
    leaderboard: Array<{
      id: string;
      name: string;
      totalRevenue: number;
      netRevenue?: number;
      refundedAmount?: number;
      recoveryPipeline: number;
    }>;
  };
};

export function DailyTrackerPage() {
  const { data, refresh } = useApi<TrackerResponse>("/api/tracker?teacher=ALL", {
    rows: [],
    salesTracker: {
      summary: {
        outstandingAmount: 0,
        dueToday: 0,
        overdue: 0,
        thisMonthCollections: 0,
      },
      enrollments: [],
      leaderboard: [],
    },
  });

  const dueRows = data.salesTracker.enrollments.filter((row) => row.amount_due_inr > 0);

  return (
    <div className="page-grid compact-canvas">
      <PageHeader
        eyebrow="Tracker"
        title="BDA and manager tracker"
        description="Track customer enrollments, pending token recoveries, manager ownership, and keep the webinar schedule visible in the same workspace."
        actions={
          <>
            <button className="btn-secondary" type="button" onClick={refresh}>Refresh</button>
            <button className="btn-primary" type="button" onClick={() => navigate("/onboarding")}>New Enrollment</button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TrackerMetric label="Outstanding Amount" value={formatCurrency((data.salesTracker.summary.outstandingAmount || 0) / 100)} meta="Total remaining collection" />
        <TrackerMetric label="Due Today" value={String(data.salesTracker.summary.dueToday || 0)} meta="Promises landing today" />
        <TrackerMetric label="Overdue" value={String(data.salesTracker.summary.overdue || 0)} meta="Promises past the due date" />
        <TrackerMetric label="This Month" value={formatCurrency((data.salesTracker.summary.thisMonthCollections || 0) / 100)} meta="Collections across all BDAs" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <SectionCard title="Customer Tracker" subtitle="Per-enrollment tracker for BDAs with paid vs due, latest transaction ID, and next follow-up date.">
          <div className="table-shell table-shell-scrollable admin-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>BDA / Manager</th>
                  <th>Product</th>
                  <th>Paid / Due</th>
                  <th>Latest Transactions</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {dueRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="cell-stack">
                        <span className="font-semibold text-[var(--text-strong)]">{row.student?.name || "—"}</span>
                        <span className="text-xs text-[var(--text-secondary)]">{row.student?.phone || "—"}</span>
                        <span className="text-xs text-[var(--text-secondary)]">{row.source || "—"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <span>{row.bda?.name || "—"}</span>
                        <span className="text-xs text-[var(--text-secondary)]">{row.manager_name || "Unassigned manager"}</span>
                      </div>
                    </td>
                    <td>{row.product?.name || "—"}</td>
                    <td>
                      <div className="cell-stack">
                        <span>{formatCurrency((row.amount_paid_inr || 0) / 100)} collected</span>
                        <span className="text-xs text-[var(--text-secondary)]">{formatCurrency((row.amount_due_inr || 0) / 100)} pending</span>
                        <span className="text-xs text-[var(--text-secondary)]">Order value {formatCurrency((row.product_value_inr || 0) / 100)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-2">
                        {row.payment_history.slice(0, 3).map((payment) => (
                          <div key={payment.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs">
                            <div className="font-mono text-[var(--text-strong)]">{payment.transaction_id}</div>
                            <div className="mt-1 text-[var(--text-secondary)]">
                              {formatCurrency((payment.amount_inr || 0) / 100)} • {payment.method.replaceAll("_", " ")} • {payment.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      {row.token_due?.due_date ? (
                        <div className="cell-stack">
                          <span>{new Date(row.token_due.due_date).toLocaleDateString("en-IN")}</span>
                          <span className="text-xs text-[var(--text-secondary)]">{new Date(row.token_due.due_date).getTime() < Date.now() ? "Follow up urgently" : "On track"}</span>
                        </div>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Top BDA Snapshot" subtitle="Quick leaderboard pulled from the same OMS-style collections data.">
          <div className="space-y-3">
            {data.salesTracker.leaderboard.slice(0, 5).map((entry, index) => (
              <div key={entry.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">#{index + 1}</div>
                    <div className="mt-2 font-semibold text-[var(--text-strong)]">{entry.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-[var(--text-strong)]">{formatCurrency((entry.totalRevenue || 0) / 100)}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">Net {formatCurrency((entry.netRevenue || 0) / 100)} • Refunded {formatCurrency((entry.refundedAmount || 0) / 100)}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">Pipeline {formatCurrency((entry.recoveryPipeline || 0) / 100)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Webinar Schedule" subtitle="The original daily webinar tracker stays available below the BDA tracker.">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Class Title</th>
                <th>Teacher</th>
                <th>Class Timing</th>
                <th>Live</th>
                <th>Category</th>
                <th>Simulation</th>
                <th>Schedule Date</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.instructor?.name || "-"}</td>
                  <td>{formatDateTime(row.start_time)}</td>
                  <td><a href={`/live/${row.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-white font-semibold">L</a></td>
                  <td>{row.category}</td>
                  <td>{row.is_simulation ? "Yes" : "No"}</td>
                  <td>{new Date(row.start_time).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function TrackerMetric({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-panel)]">
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
      <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</h3>
      <p className="mt-1.5 text-[13px] text-slate-500">{meta}</p>
    </div>
  );
}
