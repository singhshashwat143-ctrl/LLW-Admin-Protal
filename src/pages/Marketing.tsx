import { useMemo, useState } from "react";
import { PageHeader, SectionCard, StatCard } from "../components/UI";
import { api, useApi } from "../lib/api";
import { formatCurrency, formatDateTime } from "../lib/format";

type MarketingRow = {
  id: string;
  date: string;
  channel: string;
  campaign_name: string;
  department: string;
  daily_spend_inr: number;
  lead_quantity: number;
  product_value_inr: number;
  new_order_count: number;
  in_hand_revenue_inr: number;
  with_gst_spend_inr: number;
};

type MarketingResponse = {
  rows: MarketingRow[];
  summary: {
    totalRows: number;
    totalSpendInr: number;
    totalLeads: number;
    totalProductValueInr: number;
    totalNewOrders: number;
    totalInHandRevenueInr: number;
    totalWithGstSpendInr: number;
    campaigns: number;
  };
};

const initialForm = {
  date: "",
  channel: "",
  campaign_name: "",
  department: "",
  daily_spend_inr: "",
  lead_quantity: "",
  product_value_inr: "",
  new_order_count: "",
  in_hand_revenue_inr: "",
  with_gst_spend_inr: "",
};

export function MarketingPage() {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);

  const apiPath = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (year) params.set("year", year);
    if (month) params.set("month", month);
    return `/api/marketing/spend?${params.toString()}`;
  }, [month, query, year]);

  const marketingApi = useApi<MarketingResponse>(apiPath, {
    rows: [],
    summary: {
      totalRows: 0,
      totalSpendInr: 0,
      totalLeads: 0,
      totalProductValueInr: 0,
      totalNewOrders: 0,
      totalInHandRevenueInr: 0,
      totalWithGstSpendInr: 0,
      campaigns: 0,
    },
  });

  function updateField<Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startEdit(row: MarketingRow) {
    setEditingId(row.id);
    setForm({
      date: row.date.slice(0, 10),
      channel: row.channel || "",
      campaign_name: row.campaign_name || "",
      department: row.department || "",
      daily_spend_inr: String(row.daily_spend_inr || ""),
      lead_quantity: String(row.lead_quantity || ""),
      product_value_inr: String(row.product_value_inr || ""),
      new_order_count: String(row.new_order_count || ""),
      in_hand_revenue_inr: String(row.in_hand_revenue_inr || ""),
      with_gst_spend_inr: String(row.with_gst_spend_inr || ""),
    });
    setNotice("");
  }

  function resetForm() {
    setEditingId("");
    setForm(initialForm);
  }

  async function saveRow() {
    if (!form.date || !form.campaign_name.trim()) {
      setNotice("Date and campaign name are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        campaign_name: form.campaign_name.trim(),
        channel: form.channel.trim(),
        department: form.department.trim(),
        daily_spend_inr: Number(form.daily_spend_inr || 0),
        lead_quantity: Number(form.lead_quantity || 0),
        product_value_inr: Number(form.product_value_inr || 0),
        new_order_count: Number(form.new_order_count || 0),
        in_hand_revenue_inr: Number(form.in_hand_revenue_inr || 0),
        with_gst_spend_inr: Number(form.with_gst_spend_inr || 0),
      };
      if (editingId) {
        await api(`/api/marketing/spend/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setNotice("Marketing spend row updated.");
      } else {
        await api("/api/marketing/spend", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setNotice("Marketing spend row added.");
      }
      resetForm();
      marketingApi.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save marketing spend row.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-grid compact-canvas">
      <PageHeader
        eyebrow="Marketing"
        title="Marketing spend tracker"
        description="Track campaign spend, leads, product value, orders, and in-hand revenue. Recent spend imported from the marketing sheet stays editable here."
      />

      {notice ? (
        <div className="rounded-[22px] border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-5 py-4 text-sm text-[var(--success)]">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Spend" value={formatCurrency(marketingApi.data.summary.totalSpendInr || 0)} meta="Daily spend total for the current filter" />
        <StatCard label="Leads" value={String(marketingApi.data.summary.totalLeads || 0)} meta="Leads captured across visible campaigns" />
        <StatCard label="Orders" value={String(marketingApi.data.summary.totalNewOrders || 0)} meta="New orders recorded in the visible spend rows" />
        <StatCard label="Campaigns" value={String(marketingApi.data.summary.campaigns || 0)} meta="Distinct campaigns in the current view" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <SectionCard title={editingId ? "Edit Spend Row" : "Add Spend Row"} subtitle="Use this to maintain existing rows or add a fresh campaign entry.">
          <div className="grid gap-4 md:grid-cols-2">
            <input className="input-dark" type="date" value={form.date} onChange={(event) => updateField("date", event.target.value)} />
            <input className="input-dark" value={form.channel} onChange={(event) => updateField("channel", event.target.value)} placeholder="Channel" />
            <input className="input-dark" value={form.campaign_name} onChange={(event) => updateField("campaign_name", event.target.value)} placeholder="Campaign name" />
            <input className="input-dark" value={form.department} onChange={(event) => updateField("department", event.target.value)} placeholder="Department" />
            <input className="input-dark" type="number" min="0" value={form.daily_spend_inr} onChange={(event) => updateField("daily_spend_inr", event.target.value)} placeholder="Daily spend (₹)" />
            <input className="input-dark" type="number" min="0" value={form.with_gst_spend_inr} onChange={(event) => updateField("with_gst_spend_inr", event.target.value)} placeholder="Spend with GST (₹)" />
            <input className="input-dark" type="number" min="0" value={form.lead_quantity} onChange={(event) => updateField("lead_quantity", event.target.value)} placeholder="Lead quantity" />
            <input className="input-dark" type="number" min="0" value={form.new_order_count} onChange={(event) => updateField("new_order_count", event.target.value)} placeholder="New orders" />
            <input className="input-dark" type="number" min="0" value={form.product_value_inr} onChange={(event) => updateField("product_value_inr", event.target.value)} placeholder="Product value (₹)" />
            <input className="input-dark" type="number" min="0" value={form.in_hand_revenue_inr} onChange={(event) => updateField("in_hand_revenue_inr", event.target.value)} placeholder="In-hand revenue (₹)" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-primary" type="button" onClick={saveRow} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Campaign Entry"}
            </button>
            {editingId ? <button className="btn-secondary" type="button" onClick={resetForm}>Cancel Edit</button> : null}
          </div>
        </SectionCard>

        <SectionCard title="Spend Ledger" subtitle="Default filter is the current year. Use search and month/year filters to inspect older imported spend from 2025 onward.">
          <div className="payments-toolbar mb-4">
            <div className="payments-filters">
              <input className="input-dark min-w-[200px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search campaign, channel, or department" />
              <input className="input-dark min-w-[120px]" type="number" min="2025" value={year} onChange={(event) => setYear(event.target.value)} placeholder="Year" />
              <select className="input-dark min-w-[150px]" value={month} onChange={(event) => setMonth(event.target.value)}>
                <option value="">All months</option>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>{new Date(2000, value - 1, 1).toLocaleString("en-IN", { month: "long" })}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-shell table-shell-scrollable admin-table-scroll payments-table-scroll">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Campaign</th>
                  <th>Channel / Dept</th>
                  <th>Spend</th>
                  <th>Leads / Orders</th>
                  <th>Revenue</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {marketingApi.data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.date)}</td>
                    <td>{row.campaign_name}</td>
                    <td>
                      <div className="cell-stack">
                        <div>{row.channel || "—"}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{row.department || "—"}</div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <div>{formatCurrency(row.daily_spend_inr || 0)}</div>
                        <div className="text-xs text-[var(--text-secondary)]">GST {formatCurrency(row.with_gst_spend_inr || 0)}</div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <div>Leads {row.lead_quantity || 0}</div>
                        <div className="text-xs text-[var(--text-secondary)]">Orders {row.new_order_count || 0}</div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <div>Value {formatCurrency(row.product_value_inr || 0)}</div>
                        <div className="text-xs text-[var(--text-secondary)]">In hand {formatCurrency(row.in_hand_revenue_inr || 0)}</div>
                      </div>
                    </td>
                    <td>
                      <button className="btn-secondary btn-compact" type="button" onClick={() => startEdit(row)}>Edit</button>
                    </td>
                  </tr>
                ))}
                {!marketingApi.data.rows.length ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-[var(--text-secondary)]">
                      No marketing spend rows matched the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
