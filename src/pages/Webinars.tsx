import { useState } from "react";
import { PageHeader, SectionCard } from "../components/UI";
import { api, useApi } from "../lib/api";
import { formatCurrency, formatDateTime } from "../lib/format";

export function WebinarsPage() {
  const { data } = useApi<any>("/api/webinars", { webinars: [] });

  return (
    <div className="page-grid">
      <PageHeader eyebrow="Webinars" title="Masterclass inventory" description="List all LLW masterclasses with instructors, timing, status, payment setup, and both host and attendee short URLs." actions={<a href="/webinars/new" className="btn-primary">Add Masterclass</a>} />
      <SectionCard title="Webinar List">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Instructor</th>
                <th>Category</th>
                <th>Language</th>
                <th>Start Time</th>
                <th>Status</th>
                <th>Price</th>
                <th>Host URL</th>
                <th>Attendee URL</th>
              </tr>
            </thead>
            <tbody>
              {data.webinars.map((row: any, index: number) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>{row.title}</td>
                  <td>{row.instructor?.name || "-"}</td>
                  <td>{row.category}</td>
                  <td>{row.language}</td>
                  <td>{formatDateTime(row.start_time)}</td>
                  <td>{row.status}</td>
                  <td>{row.payment_required ? formatCurrency((row.price_inr || 0) / 100) : "Free"}</td>
                  <td className="font-mono text-xs">{row.short_host_url}</td>
                  <td className="font-mono text-xs">{row.short_attendee_url}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

export function WebinarFormPage() {
  const [form, setForm] = useState({
    title: "Indian Market Gold Webinar",
    type: "MASTERCLASS",
    category: "Indian Market",
    language: "Malayalam",
    description: "",
    start_time: "2026-04-13T19:00",
    end_time: "2026-04-13T21:00",
    ui_type: "WEBINAR",
    server_no: "Livekit-New-06",
    payment_required: false,
    price_inr: 3999900,
    is_simulation: false,
  });
  const [created, setCreated] = useState<any>(null);

  async function save() {
    const response = await api<any>("/api/webinars", { method: "POST", body: JSON.stringify(form) });
    setCreated(response.webinar);
  }

  return (
    <div className="page-grid">
      <PageHeader eyebrow="Create Webinar" title="Generate webinar + URLs" description="Saving this form creates the webinar, LiveKit room, host token, attendee token, TinyURL short links, and optional paid access." />
      <SectionCard title="Webinar Setup">
        <div className="grid gap-3 md:grid-cols-2">
          <input className="input-dark" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <select className="input-dark" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>MASTERCLASS</option><option>BOOTCAMP</option><option>EVENT</option></select>
          <select className="input-dark" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Indian Market</option><option>Forex</option><option>CTP</option><option>LiveX0</option></select>
          <select className="input-dark" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })}><option>English</option><option>Hindi</option><option>Malayalam</option><option>Tamil</option></select>
          <input className="input-dark" type="datetime-local" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} />
          <input className="input-dark" type="datetime-local" value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })} />
          <select className="input-dark" value={form.ui_type} onChange={(event) => setForm({ ...form, ui_type: event.target.value })}><option>WEBINAR</option><option>MEETING</option></select>
          <select className="input-dark" value={form.server_no} onChange={(event) => setForm({ ...form, server_no: event.target.value })}>{Array.from({ length: 12 }, (_, index) => `Livekit-New-${String(index + 1).padStart(2, "0")}`).map((server) => <option key={server}>{server}</option>)}</select>
          <select className="input-dark" value={String(form.payment_required)} onChange={(event) => setForm({ ...form, payment_required: event.target.value === "true" })}><option value="false">Free access</option><option value="true">Paid access</option></select>
          <input className="input-dark" type="number" value={form.price_inr} onChange={(event) => setForm({ ...form, price_inr: Number(event.target.value) })} placeholder="Price in paise" />
        </div>
        <button className="btn-primary mt-4" type="button" onClick={save}>Create Webinar</button>
      </SectionCard>

      {created ? (
        <SectionCard title="Webinar Created Successfully" subtitle="This replaces the old plain success box with the new webinar-facing preview and working links.">
          <div className="webinar-promo-card">
            <div className="webinar-promo-grid">
              <div className="space-y-5">
                <div className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/80">
                  Webinar Ready
                </div>
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{created.title}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200/88">
                    {created.description || "Your webinar is live with host and attendee rooms, stronger button states, and the new in-room payment-ready attendee experience."}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="webinar-stat-chip">
                    <span className="webinar-stat-label">Start</span>
                    <strong>{formatDateTime(created.start_time)}</strong>
                  </div>
                  <div className="webinar-stat-chip">
                    <span className="webinar-stat-label">Category</span>
                    <strong>{created.category}</strong>
                  </div>
                  <div className="webinar-stat-chip">
                    <span className="webinar-stat-label">Language</span>
                    <strong>{created.language}</strong>
                  </div>
                  <div className="webinar-stat-chip">
                    <span className="webinar-stat-label">Price</span>
                    <strong>{created.payment_required ? formatCurrency((created.price_inr || 0) / 100) : "Free"}</strong>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a className="webinar-cta-button" href={created.attendee_url} target="_blank" rel="noreferrer">Open Attendee Experience</a>
                  <a className="webinar-secondary-button" href={created.host_url} target="_blank" rel="noreferrer">Open Host Console</a>
                </div>
              </div>
              <div className="webinar-price-panel space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-300">Working URLs</div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Host</div>
                    <div className="mt-2 break-all font-mono text-sm text-white">{created.short_host_url}</div>
                  </div>
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Attendee</div>
                    <div className="mt-2 break-all font-mono text-sm text-white">{created.short_attendee_url}</div>
                  </div>
                </div>
                <div className="text-sm leading-6 text-slate-300">
                  When attendees open the attendee room, they’ll now see the upgraded webinar UI and can trigger Razorpay from inside the webinar itself.
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

export function MasterclassLandingPage({ slug }: { slug: string }) {
  const { data } = useApi<any>("/api/webinars", { webinars: [] });
  const webinar = data.webinars.find((item: any) => item.slug === slug) || data.webinars[0];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#0a0a0a,_#080808)] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="glass-card rounded-[32px] overflow-hidden">
          <img src={webinar?.banner_url} alt={webinar?.title} className="h-64 w-full object-cover opacity-80" />
          <div className="p-6 md:p-8">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[var(--accent)]">Masterclass</p>
            <h1 className="font-display mt-2 text-4xl text-[var(--text-strong)]">{webinar?.title}</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{webinar?.description}</p>
          </div>
        </section>
        <section className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
          <SectionCard title="About the Session">
            <p className="text-sm leading-7 text-[var(--text-secondary)]">{webinar?.description}</p>
            <p className="mt-4 text-sm text-[var(--text-secondary)]">Date & time: {webinar?.start_time ? formatDateTime(webinar.start_time) : "-"}</p>
          </SectionCard>
          <SectionCard title="Register">
            <div className="space-y-3">
              <input className="input-dark" placeholder="Name" />
              <input className="input-dark" placeholder="Phone" />
              <input className="input-dark" placeholder="Email" />
              <button className="btn-primary w-full" type="button">{webinar?.payment_required ? `Pay ${formatCurrency((webinar?.price_inr || 0) / 100)}` : "Register on WhatsApp"}</button>
            </div>
          </SectionCard>
        </section>
      </div>
    </div>
  );
}
