import { useState } from "react";
import { PageHeader, SectionCard } from "../components/UI";
import { api, useApi } from "../lib/api";
import { formatDateTime } from "../lib/format";

type LinkRow = {
  id: string;
  label: string;
  original_url: string;
  short_url: string;
  slug?: string;
  created_at: string;
};

export function LinksPage() {
  const { data, setData } = useApi<{ links: LinkRow[] }>("/api/links", { links: [] });
  const [originalUrl, setOriginalUrl] = useState("https://example.com");
  const [label, setLabel] = useState("Manual LLW link");
  const [aliasSuffix, setAliasSuffix] = useState("xyz-abc");
  const [copied, setCopied] = useState("");

  async function createLink() {
    try {
      const response = await api<{ link: LinkRow }>("/api/links/shorten", {
        method: "POST",
        body: JSON.stringify({ original_url: originalUrl, label, alias_suffix: aliasSuffix }),
      });
      setData({ links: [response.link, ...data.links] });
      await navigator.clipboard?.writeText(response.link.short_url);
      setCopied(`Created and copied ${response.link.short_url}`);
    } catch (error) {
      setCopied(error instanceof Error ? error.message : "Unable to create PyMD link.");
    }
  }

  async function copy(value: string) {
    await navigator.clipboard?.writeText(value);
    setCopied(`Copied ${value}`);
  }

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Links"
        title="PyMD link manager"
        description="Create PyMD short links with editable aliases like llw-xyz-abc. The target must be the real final URL you want PyMD to redirect to."
      />
      {copied ? <div className="rounded-[22px] border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-5 py-4 text-sm text-[var(--success)]">{copied}</div> : null}
      <SectionCard title="Create PyMD Link" subtitle="Enter the real destination URL exactly as PyMD should open it, like py.md/hello-razorpay does.">
        <div className="grid gap-3 md:grid-cols-[220px_180px_1fr_auto]">
          <input className="input-dark" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Label" />
          <input className="input-dark" value={aliasSuffix} onChange={(event) => setAliasSuffix(event.target.value)} placeholder="xyz-abc" />
          <input className="input-dark" value={originalUrl} onChange={(event) => setOriginalUrl(event.target.value)} placeholder="https://your-final-url.com/page" />
          <button className="btn-primary shrink-0" type="button" onClick={createLink}>Create PyMD Link</button>
        </div>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">Preview alias: <span className="font-mono text-[var(--text-strong)]">llw-{aliasSuffix || "xyz-abc"}</span></p>
      </SectionCard>
      <SectionCard title="All Links">
        <div className="table-shell table-scroll">
          <table className="compact-table min-w-[900px]">
            <thead>
              <tr>
                <th>Label</th>
                <th>Slug</th>
                <th>Short URL</th>
                <th>Original URL</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.links.map((row) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td className="font-mono text-xs">{row.slug || row.short_url.split("/").pop()}</td>
                  <td className="font-mono text-xs"><a className="text-link" href={row.short_url} target="_blank" rel="noreferrer">{row.short_url}</a></td>
                  <td className="font-mono text-xs">{row.original_url}</td>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td className="sticky-actions">
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-secondary btn-compact" type="button" onClick={() => copy(row.short_url)}>Copy</button>
                      <a className="btn-primary btn-compact" href={row.short_url} target="_blank" rel="noreferrer">Open</a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
