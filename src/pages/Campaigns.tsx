import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { PageHeader, SectionCard, StatCard } from "../components/UI";
import { api, useApi } from "../lib/api";

type Campaign = {
  id: string; name: string; channel: string; lp: string;
  whatsapp_group_url: string; distribution: string; slug: string; lead_count: number;
};
type Lead = {
  id: string; name: string; email: string | null; phone: string | null;
  campaign_id: string | null; source: string; stage: string; group_joined: boolean; created_at: string;
};
type LeadStats = { total: number; group_joined: number; by_source: { lp: number; webinar: number; bda: number; csv: number } };

// Minimal CSV -> array of {header: value} objects (handles quoted fields + CRLF).
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (cur !== "" || row.length) { row.push(cur); rows.push(row); row = []; cur = ""; }
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => {
      const o: Record<string, string> = {};
      headers.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
      return o;
    });
}

export function CampaignsPage() {
  const { data: campaignsData, refresh: refreshCampaigns } = useApi<{ campaigns: Campaign[] }>("/api/campaigns", { campaigns: [] });
  const { data: leadsData, refresh: refreshLeads } = useApi<{ stats: LeadStats | null; leads: Lead[] }>("/api/leads", { stats: null, leads: [] });
  const campaigns = campaignsData.campaigns || [];
  const leads = leadsData.leads || [];
  const stats = leadsData.stats;

  const [form, setForm] = useState({ name: "", channel: "meta", lp: "webinar", whatsapp_group_url: "", distribution: "webinar" });
  const [adLink, setAdLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const res = await api<{ ok: boolean; ad_link: string }>("/api/campaigns", { method: "POST", body: JSON.stringify(form) });
      setAdLink(res.ad_link);
      setForm({ ...form, name: "", whatsapp_group_url: "" });
      refreshCampaigns();
    } catch (error) {
      setImportMsg(error instanceof Error ? error.message : "Could not create campaign.");
    } finally {
      setCreating(false);
    }
  }

  async function onCsv(file: File) {
    setImportMsg("Reading file…");
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) { setImportMsg("No rows found in that CSV."); return; }
    setImportMsg(`Importing ${rows.length} rows…`);
    try {
      const res = await api<{ created: number; updated: number; total: number }>("/api/leads/import", {
        method: "POST",
        body: JSON.stringify({ rows, source: "csv" }),
      });
      setImportMsg(`Imported ${res.total} lead${res.total === 1 ? "" : "s"} — ${res.created} new, ${res.updated} updated.`);
      refreshLeads();
    } catch (error) {
      setImportMsg(error instanceof Error ? error.message : "Import failed.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const campaignName = useMemo(() => {
    const map = new Map(campaigns.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? map.get(id) || "—" : "—");
  }, [campaigns]);

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Marketing"
        title="Campaigns & Leads"
        description="Create a campaign, drop the link straight into your ad, and every fill lands here — plus upload any lead CSV and it auto-maps into the database."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Leads" value={String(stats?.total ?? 0)} meta="Across every source" />
        <StatCard label="Joined WhatsApp" value={String(stats?.group_joined ?? 0)} meta="Clicked through to the group" />
        <StatCard label="From Campaigns" value={String(stats?.by_source.lp ?? 0)} meta="Landing-page form fills" />
        <StatCard label="From CSV / Calling" value={String((stats?.by_source.csv ?? 0) + (stats?.by_source.bda ?? 0))} meta="Uploaded or BDA/BDM entered" />
      </div>

      <SectionCard title="Create a campaign" subtitle="Pick the landing page and the WhatsApp group behind it. You get one link to paste in the ad.">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={createCampaign}>
          <input className="input-dark" placeholder="Campaign name (e.g. Sat 6pm Webinar — Meta)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input-dark" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
            <option value="meta">Meta / Facebook</option>
            <option value="google">Google</option>
            <option value="youtube">YouTube</option>
            <option value="other">Other</option>
          </select>
          <select className="input-dark" value={form.lp} onChange={(e) => setForm({ ...form, lp: e.target.value })}>
            <option value="webinar">LP: Webinar register</option>
            <option value="group">LP: Straight to group</option>
          </select>
          <select className="input-dark" value={form.distribution} onChange={(e) => setForm({ ...form, distribution: e.target.value })}>
            <option value="webinar">Distribution: Webinar</option>
            <option value="calling">Distribution: BDA / BDM calling</option>
          </select>
          <input className="input-dark md:col-span-2" placeholder="WhatsApp group invite link (behind the LP)" value={form.whatsapp_group_url} onChange={(e) => setForm({ ...form, whatsapp_group_url: e.target.value })} />
          <button className="btn-primary md:col-span-2" type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create campaign & get ad link"}
          </button>
        </form>
        {adLink ? (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Paste this link in your ad</div>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 break-all font-mono text-sm text-[var(--text-strong)]">{adLink}</code>
              <button
                type="button"
                className="btn-secondary btn-compact"
                onClick={() => { navigator.clipboard?.writeText(adLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Campaigns" subtitle="Live campaigns with their ad links and lead counts.">
        <div className="table-shell">
          <table>
            <thead>
              <tr><th>Campaign</th><th>Channel</th><th>Distribution</th><th>Leads</th><th>Ad link</th></tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-[var(--text-strong)]">{c.name}</td>
                  <td className="capitalize">{c.channel}</td>
                  <td className="capitalize">{c.distribution}</td>
                  <td className="font-mono">{c.lead_count}</td>
                  <td className="break-all font-mono text-xs">{origin}/go/{c.slug}</td>
                </tr>
              ))}
              {campaigns.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-sm text-[var(--text-secondary)]">No campaigns yet — create one above.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Leads" subtitle="Every lead, auto-organized. Upload any CSV — the columns are matched automatically.">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            id="lead-csv"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsv(f); }}
          />
          <label htmlFor="lead-csv" className="btn-primary btn-compact cursor-pointer">Upload lead CSV</label>
          {importMsg ? <span className="text-sm text-[var(--text-secondary)]">{importMsg}</span> : null}
        </div>
        <div className="table-shell table-shell-scrollable">
          <table className="compact-table">
            <thead>
              <tr><th>#</th><th>Name</th><th>Phone</th><th>Email</th><th>Campaign</th><th>Source</th><th>Group</th><th>Stage</th></tr>
            </thead>
            <tbody>
              {leads.map((l, i) => (
                <tr key={l.id}>
                  <td>{i + 1}</td>
                  <td className="font-medium text-[var(--text-strong)]">{l.name || "—"}</td>
                  <td className="font-mono text-xs">{l.phone || "—"}</td>
                  <td className="text-xs">{l.email || "—"}</td>
                  <td className="text-xs">{campaignName(l.campaign_id)}</td>
                  <td className="text-xs capitalize">{l.source}</td>
                  <td>{l.group_joined ? "✓" : "—"}</td>
                  <td className="text-xs capitalize">{l.stage}</td>
                </tr>
              ))}
              {leads.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-sm text-[var(--text-secondary)]">No leads yet — create a campaign or upload a CSV.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
