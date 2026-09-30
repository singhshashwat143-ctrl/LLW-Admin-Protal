import { useEffect, useState } from "react";
import { PageHeader, SectionCard } from "../components/UI";
import { api, useApi } from "../lib/api";
import { formatCurrency, formatDateTime } from "../lib/format";
import { MasterclassMark, MasterclassWordmark, DEFAULT_MASTERCLASS_LOGO } from "../components/MasterclassLogo";

// The public registration + reminders page lives at /webinar/register/<room>,
// where <room> is the same room name used in the attendee URL.
function registrationUrlFromAttendee(attendeeUrl: string): string {
  const room = (attendeeUrl || "").split("?")[0].split("/").filter(Boolean).pop() || "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/webinar/register/${room}`;
}

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
                <th>Registration Link</th>
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
                  <td className="font-mono text-xs">
                    <a className="underline decoration-slate-400" href={`/webinar/register/${(row.attendee_url || "").split("?")[0].split("/").filter(Boolean).pop()}`} target="_blank" rel="noreferrer">Open ↗</a>
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
                  <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Registration + reminders</div>
                    <a className="mt-2 block break-all font-mono text-sm text-white underline decoration-white/30" href={registrationUrlFromAttendee(created.attendee_url)} target="_blank" rel="noreferrer">{registrationUrlFromAttendee(created.attendee_url)}</a>
                    <div className="mt-1 text-[11px] text-slate-400">Share this so attendees register and get 15/10/5-min reminders.</div>
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

function useCountdown(target?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const ms = target ? new Date(target).getTime() - now : 0;
  const live = target ? ms <= 0 : false;
  const clamp = Math.max(0, ms);
  return {
    live,
    days: Math.floor(clamp / 86400000),
    hours: Math.floor((clamp % 86400000) / 3600000),
    mins: Math.floor((clamp % 3600000) / 60000),
    secs: Math.floor((clamp % 60000) / 1000),
  };
}

export function MasterclassLandingPage({ slug }: { slug: string }) {
  const { data } = useApi<any>("/api/webinars", { webinars: [] });
  const webinar = data.webinars.find((item: any) => item.slug === slug) || data.webinars[0];

  const title = webinar?.title || "The CryptX Wealth Masterclass";
  const description = webinar?.description
    || "A live, no-fluff session on how disciplined crypto strategies compound — with real results, real numbers, and your questions answered on the spot.";
  const host = webinar?.instructor?.name || "Livelong Wealth";
  const when = webinar?.start_time ? formatDateTime(webinar.start_time) : "Announced soon";
  const cd = useCountdown(webinar?.start_time);
  const room = (webinar?.attendee_url || "").split("?")[0].split("/").filter(Boolean).pop() || "";
  const registerUrl = room ? `/webinar/register/${room}` : "#register";
  const priced = Boolean(webinar?.payment_required);
  const priceLabel = priced ? formatCurrency((webinar?.price_inr || 0) / 100) : "Free to attend";
  const cta = priced ? `Reserve your seat · ${priceLabel}` : "Reserve your free seat";

  const ORANGE = "#F7931A";
  const INK = "#161C2D";

  const learn = [
    { t: "The strategy, live", d: "Watch the exact playbook run in real time — not slides about theory, the actual method." },
    { t: "Real numbers", d: "See the results, the risk, and the costs laid bare. No cherry-picked screenshots." },
    { t: "Ask anything", d: "Live Q&A — bring your doubts and get them answered before you commit a rupee." },
  ];

  const box = { border: "1px solid #ECECF0", borderRadius: 18, background: "#fff" };

  return (
    <div style={{ minHeight: "100vh", background: "#fff", color: INK, fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", borderBottom: "1px solid #F0F0F3" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <MasterclassWordmark variant={DEFAULT_MASTERCLASS_LOGO} size={40} />
          <a href={registerUrl} style={{ background: ORANGE, color: "#fff", fontWeight: 700, fontSize: 14, padding: "10px 18px", borderRadius: 11, textDecoration: "none" }}>Reserve seat</a>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(28px,6vw,64px) 20px", display: "grid", gap: 40, gridTemplateColumns: "1fr", alignItems: "center" }} className="mc-hero">
        <div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#FFF3E4", color: "#B4630B", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", padding: "7px 13px", borderRadius: 999 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#E5484D", display: "inline-block" }} />
            {cd.live ? "LIVE NOW" : "LIVE MASTERCLASS"}
          </span>
          <h1 style={{ fontSize: "clamp(32px,5vw,52px)", lineHeight: 1.05, letterSpacing: "-0.02em", fontWeight: 800, margin: "18px 0 0", textWrap: "balance" as any }}>{title}</h1>
          <p style={{ fontSize: "clamp(15px,2.2vw,18px)", lineHeight: 1.6, color: "#4B5563", margin: "16px 0 0", maxWidth: 560 }}>{description}</p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "22px 0 0", alignItems: "center" }}>
            <span style={{ ...box, padding: "10px 14px", fontSize: 14, fontWeight: 600, display: "inline-flex", gap: 8, alignItems: "center" }}>📅 {when}</span>
            <span style={{ ...box, padding: "10px 14px", fontSize: 14, fontWeight: 600, display: "inline-flex", gap: 8, alignItems: "center" }}>🎙 {host}</span>
            <span style={{ background: "#F0FDF4", color: "#15803D", border: "1px solid #DCFCE7", padding: "10px 14px", borderRadius: 18, fontSize: 14, fontWeight: 700 }}>{priceLabel}</span>
          </div>

          {!cd.live && webinar?.start_time ? (
            <div style={{ display: "flex", gap: 10, margin: "24px 0 0" }}>
              {[["Days", cd.days], ["Hrs", cd.hours], ["Min", cd.mins], ["Sec", cd.secs]].map(([l, v]) => (
                <div key={l as string} style={{ ...box, minWidth: 62, textAlign: "center", padding: "10px 6px" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: INK }}>{String(v).padStart(2, "0")}</div>
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", color: "#9CA3AF", fontWeight: 700 }}>{(l as string).toUpperCase()}</div>
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "28px 0 0" }}>
            <a href={registerUrl} style={{ background: ORANGE, color: "#fff", fontWeight: 800, fontSize: 16, padding: "15px 26px", borderRadius: 13, textDecoration: "none", boxShadow: "0 10px 28px rgba(247,147,26,0.35)" }}>{cta} →</a>
            <a href="#learn" style={{ color: INK, fontWeight: 700, fontSize: 16, padding: "15px 20px", borderRadius: 13, textDecoration: "none", border: "1px solid #E5E7EB" }}>What you'll learn</a>
          </div>
          <p style={{ fontSize: 13, color: "#9CA3AF", margin: "16px 0 0" }}>Joined by <strong style={{ color: INK }}>2,000+ traders</strong> across India · Replay & notes shared after</p>
        </div>

        {/* Poster card */}
        <div style={{ background: "linear-gradient(160deg,#0F1420,#1C2436)", borderRadius: 28, padding: 28, color: "#fff", position: "relative", overflow: "hidden" }}>
          <svg viewBox="0 0 400 200" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5 }} aria-hidden="true">
            <path d="M0 150 C 90 150, 130 60, 200 60 S 320 20, 400 30" fill="none" stroke={ORANGE} strokeWidth="2.5" />
            <path d="M0 175 C 90 175, 130 110, 200 110 S 320 90, 400 95" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
          </svg>
          <div style={{ position: "relative" }}>
            <MasterclassMark variant={DEFAULT_MASTERCLASS_LOGO} size={64} onDark />
            <div style={{ marginTop: 20, fontSize: 12, letterSpacing: "0.2em", color: "#8A93A6", fontWeight: 700 }}>LIVE SESSION</div>
            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>{title}</div>
            <div style={{ marginTop: 14, display: "flex", gap: 18, fontSize: 13, color: "#C7CDD9" }}>
              <span>🎙 {host}</span><span>📅 {when}</span>
            </div>
            <div style={{ marginTop: 22, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 16, fontSize: 13, color: "#8A93A6" }}>
              Streamed in HD · Live Q&A · No download needed
            </div>
          </div>
        </div>
      </section>

      {/* What you'll learn */}
      <section id="learn" style={{ maxWidth: 1120, margin: "0 auto", padding: "8px 20px 8px" }}>
        <h2 style={{ fontSize: "clamp(24px,3.5vw,34px)", fontWeight: 800, letterSpacing: "-0.02em", textWrap: "balance" as any }}>Why this hour is worth it</h2>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", marginTop: 22 }}>
          {learn.map((c, i) => (
            <div key={c.t} style={{ ...box, padding: 22 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#FFF3E4", color: "#B4630B", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{i + 1}</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: "14px 0 6px" }}>{c.t}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "#6B7280", margin: 0 }}>{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ ...box, padding: "clamp(24px,4vw,40px)", display: "grid", gap: 24, gridTemplateColumns: "1fr" }} className="mc-about">
          <div>
            <div style={{ fontSize: 12, letterSpacing: "0.2em", color: ORANGE, fontWeight: 700 }}>ABOUT THE SESSION</div>
            <p style={{ fontSize: "clamp(16px,2.4vw,20px)", lineHeight: 1.6, color: "#374151", margin: "12px 0 0" }}>{description}</p>
            <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href={registerUrl} style={{ background: INK, color: "#fff", fontWeight: 700, fontSize: 15, padding: "13px 22px", borderRadius: 12, textDecoration: "none" }}>{cta} →</a>
            </div>
          </div>
        </div>
      </section>

      {/* Register band */}
      <section id="register" style={{ background: "linear-gradient(135deg,#F7931A,#E67C0E)", color: "#fff" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(36px,6vw,64px) 20px", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(26px,4vw,40px)", fontWeight: 800, letterSpacing: "-0.02em", margin: 0, textWrap: "balance" as any }}>Seats are limited. Save yours.</h2>
          <p style={{ fontSize: 16, opacity: 0.92, margin: "12px auto 0", maxWidth: 520 }}>Register once — we'll send you the join link and reminders on WhatsApp before we go live.</p>
          <a href={registerUrl} style={{ display: "inline-block", marginTop: 24, background: "#fff", color: "#B4630B", fontWeight: 800, fontSize: 17, padding: "16px 34px", borderRadius: 14, textDecoration: "none" }}>{cta} →</a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 20px", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
        <MasterclassWordmark variant={DEFAULT_MASTERCLASS_LOGO} size={34} />
        <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>© {new Date().getFullYear()} Livelong Wealth · CryptX Masterclass</p>
      </footer>

      <style>{`
        @media (min-width: 900px) {
          .mc-hero { grid-template-columns: 1.15fr 0.85fr !important; }
        }
      `}</style>
    </div>
  );
}
