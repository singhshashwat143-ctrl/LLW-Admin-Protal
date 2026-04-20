import { useState } from "react";
import { PageHeader, SectionCard } from "../components/UI";
import { api, useApi } from "../lib/api";
import { formatCurrency, formatDateTime } from "../lib/format";
import { navigate } from "../lib/router";

export function BootcampListPage() {
  const { data } = useApi<any>("/api/bootcamps", { bootcamps: [] });

  return (
    <div className="page-grid">
      <PageHeader eyebrow="Bootcamps" title="Bootcamp CMS" description="Manage title, teacher, facilitator, pricing, onboarding links, and the generated public bootcamp page." actions={<a href="/bootcamps/new" className="btn-primary">Add Bootcamp</a>} />
      <SectionCard title="Bootcamp List">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Teacher</th>
                <th>Facilitator</th>
                <th>Price</th>
                <th>Offer Price</th>
                <th>Created On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.bootcamps.map((row: any, index: number) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td><a href={`/bootcamps/${row.id}/edit`} className="text-link">{row.title}</a></td>
                  <td>{row.instructor?.name || row.instructor_id}</td>
                  <td>{row.facilitator?.name || row.facilitator_id}</td>
                  <td>{formatCurrency(row.price / 100)}</td>
                  <td>{formatCurrency(row.discounted_price / 100)}</td>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td><button className="btn-secondary inline-block text-sm" type="button" onClick={() => navigate(`/bootcamp/${row.slug}`)}>View Page</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

export function BootcampFormPage({ id }: { id?: string }) {
  const [form, setForm] = useState({
    title: "Indian Market Wealth Sprint",
    slug: "indian-market-wealth-sprint",
    short_description: "Six-month guided bootcamp with live mentoring.",
    long_description: "<p>Learn setups, psychology, and execution.</p>",
    price: 4000000,
    discounted_price: 3999900,
    whatsapp_group_url: "https://chat.whatsapp.com/demo-group",
    onboarding_form_url: "https://forms.gle/demo-onboarding",
  });
  const [savedUrl, setSavedUrl] = useState("");

  async function save() {
    const response = await api<any>("/api/bootcamps", { method: "POST", body: JSON.stringify(form) });
    setSavedUrl(response.bootcamp.public_page_url);
  }

  return (
    <div className="page-grid">
      <PageHeader eyebrow="Bootcamp Form" title={id ? "Edit Bootcamp" : "Create Bootcamp"} description="The bootcamp form doubles as the CMS. Offer price defaults to base price minus Rs. 1." />
      <SectionCard title="Form Fields">
        <div className="grid gap-3 md:grid-cols-2">
          <input className="input-dark" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value, slug: event.target.value.toLowerCase().replace(/\s+/g, "-") })} placeholder="TITLE *" />
          <input className="input-dark" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="SLUG *" />
          <textarea className="input-dark md:col-span-2" rows={3} value={form.short_description} onChange={(event) => setForm({ ...form, short_description: event.target.value })} />
          <textarea className="input-dark md:col-span-2" rows={6} value={form.long_description} onChange={(event) => setForm({ ...form, long_description: event.target.value })} />
          <input className="input-dark" value={String(form.price)} onChange={(event) => {
            const price = Number(event.target.value);
            setForm({ ...form, price, discounted_price: Math.max(price - 100, 0) });
          }} />
          <input className="input-dark" value={String(form.discounted_price)} onChange={(event) => setForm({ ...form, discounted_price: Number(event.target.value) })} />
          <input className="input-dark" value={form.whatsapp_group_url} onChange={(event) => setForm({ ...form, whatsapp_group_url: event.target.value })} />
          <input className="input-dark" value={form.onboarding_form_url} onChange={(event) => setForm({ ...form, onboarding_form_url: event.target.value })} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-primary" type="button" onClick={save}>Save</button>
          <button className="btn-secondary" type="button" onClick={() => navigate(`/bootcamp/${form.slug}`)}>Preview Public Page</button>
        </div>
        {savedUrl ? <p className="mt-4 text-sm text-link">Public URL: {savedUrl}</p> : null}
      </SectionCard>
    </div>
  );
}

export function BootcampLandingPage({ slug }: { slug: string }) {
  const { data } = useApi<any>("/api/bootcamps", { bootcamps: [] });
  const bootcamp = data.bootcamps.find((item: any) => item.slug === slug) || data.bootcamps[0];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#0a0a0a,_#080808)] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="glass-card rounded-[32px] overflow-hidden">
          <img src={bootcamp?.banner_url} alt={bootcamp?.title} className="h-64 w-full object-cover opacity-80" />
          <div className="p-6 md:p-8">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[var(--accent)]">Bootcamp</p>
            <h1 className="font-display mt-2 text-4xl text-[var(--text-strong)]">{bootcamp?.title}</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{bootcamp?.sub_heading}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <div className="rounded-full border border-[var(--border-soft)] bg-white px-4 py-2 text-[var(--text-strong)]">{formatCurrency((bootcamp?.discounted_price || 0) / 100)}</div>
              <button className="btn-primary" type="button" onClick={() => document.getElementById("bootcamp-registration")?.scrollIntoView({ behavior: "smooth" })}>Enroll Now</button>
            </div>
          </div>
        </section>
        <section className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
          <SectionCard title="About">{bootcamp?.long_description ? <div dangerouslySetInnerHTML={{ __html: bootcamp.long_description }} /> : null}</SectionCard>
          <section id="bootcamp-registration">
          <SectionCard title="Registration">
            <div className="space-y-3">
              <input className="input-dark" placeholder="Name" />
              <input className="input-dark" placeholder="Phone" />
              <input className="input-dark" placeholder="Email" />
              <button className="btn-primary w-full" type="button" onClick={() => window.alert("Demo payment link generated from the admin Payments page. Use Payments > Generate Payment Link for a real stored link.")}>Pay {formatCurrency((bootcamp?.discounted_price || 0) / 100)} via Razorpay</button>
            </div>
          </SectionCard>
          </section>
        </section>
      </div>
    </div>
  );
}
