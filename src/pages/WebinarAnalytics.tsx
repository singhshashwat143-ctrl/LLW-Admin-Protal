import { useMemo, useState } from "react";
import { PageHeader, SectionCard, StatCard } from "../components/UI";
import { useApi } from "../lib/api";
import { formatCurrency } from "../lib/format";

type SessionRow = { id: string; title: string; webinar: string; when: string | null; attendees: number };
type Minute = { m: number; concurrent: number; joined: number; left: number };
type Timeline = {
  start: string | null; total_minutes: number; minutes: Minute[];
  peak: number; peak_minute: number; total_attendees: number; avg_duration_mins: number;
  retention: { at25: number; at50: number; at75: number; at100: number };
};
type Conversion = {
  attendees: number; signups: number; paid: number; paid_pct: number;
  revenue_inr: number; arpu_inr: number; aov_inr: number; deposited: number; total_balance_usd: number;
};
type Resp = { sessions: SessionRow[]; selected: string; timeline: Timeline; conversion: Conversion };

const EMPTY: Resp = {
  sessions: [], selected: "",
  timeline: { start: null, total_minutes: 0, minutes: [], peak: 0, peak_minute: 0, total_attendees: 0, avg_duration_mins: 0, retention: { at25: 0, at50: 0, at75: 0, at100: 0 } },
  conversion: { attendees: 0, signups: 0, paid: 0, paid_pct: 0, revenue_inr: 0, arpu_inr: 0, aov_inr: 0, deposited: 0, total_balance_usd: 0 },
};

// Attendance-over-time curve. The line runs orange while attendance holds or
// climbs, and turns RED on any minute where it drops — so the moments people
// leave are the ones that stand out, exactly as asked.
function AttendanceChart({ timeline }: { timeline: Timeline }) {
  const W = 760, H = 280, padL = 44, padR = 16, padT = 18, padB = 34;
  const mins = timeline.minutes;
  const peak = Math.max(1, timeline.peak);
  const totalM = Math.max(1, timeline.total_minutes);
  const x = (m: number) => padL + (m / totalM) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / peak) * (H - padT - padB);

  const segments = useMemo(() => {
    const segs: { x1: number; y1: number; x2: number; y2: number; drop: boolean }[] = [];
    for (let i = 1; i < mins.length; i++) {
      segs.push({
        x1: x(mins[i - 1].m), y1: y(mins[i - 1].concurrent),
        x2: x(mins[i].m), y2: y(mins[i].concurrent),
        drop: mins[i].concurrent < mins[i - 1].concurrent,
      });
    }
    return segs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mins, peak, totalM]);

  const areaPath = useMemo(() => {
    if (!mins.length) return "";
    let d = `M ${x(mins[0].m)} ${y(0)} `;
    for (const p of mins) d += `L ${x(p.m)} ${y(p.concurrent)} `;
    d += `L ${x(mins[mins.length - 1].m)} ${y(0)} Z`;
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mins, peak, totalM]);

  if (!mins.length) {
    return <div className="py-12 text-center text-sm text-[var(--text-secondary)]">No attendance recorded for this session yet.</div>;
  }

  const yTicks = [0, 0.5, 1].map((f) => Math.round(peak * f));
  const xTickMins = [0, Math.round(totalM / 2), totalM];

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 520 }} role="img" aria-label="Attendance over time">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
            <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-secondary)">{v}</text>
          </g>
        ))}
        <path d={areaPath} fill="var(--accent-soft)" opacity="0.6" />
        {segments.map((s, i) => (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.drop ? "#e5484d" : "var(--accent)"} strokeWidth={s.drop ? 3 : 2.2} strokeLinecap="round" />
        ))}
        {/* peak marker */}
        <circle cx={x(timeline.peak_minute)} cy={y(timeline.peak)} r="4" fill="var(--accent)" stroke="#fff" strokeWidth="1.5" />
        <text x={x(timeline.peak_minute)} y={y(timeline.peak) - 9} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-strong)">peak {timeline.peak}</text>
        {xTickMins.map((m) => (
          <text key={m} x={x(m)} y={H - 12} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">{m}m</text>
        ))}
      </svg>
      <div className="mt-2 flex items-center gap-4 text-xs text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-1"><span style={{ width: 14, height: 3, background: "var(--accent)", display: "inline-block", borderRadius: 2 }} /> holding / growing</span>
        <span className="inline-flex items-center gap-1"><span style={{ width: 14, height: 3, background: "#e5484d", display: "inline-block", borderRadius: 2 }} /> drop-off</span>
      </div>
    </div>
  );
}

export function WebinarAnalyticsPage() {
  const [session, setSession] = useState("");
  const path = useMemo(() => `/api/funnel/webinar-timeline${session ? `?session=${encodeURIComponent(session)}` : ""}`, [session]);
  const { data } = useApi<Resp>(path, EMPTY);
  const { sessions, timeline, conversion } = data;
  const selected = session || data.selected;

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Marketing"
        title="Webinar Analytics"
        description="How a session filled and where people dropped, then what that room converted to on CryptX — paid rate, ARPU and AOV, all from live data."
      />

      <SectionCard title="Session" subtitle="Pick a webinar session to analyze.">
        <select className="input-dark max-w-full md:max-w-[520px]" value={selected} onChange={(e) => setSession(e.target.value)}>
          {sessions.length === 0 ? <option value="">No sessions with attendance yet</option> : null}
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}{s.webinar && s.webinar !== s.title ? ` · ${s.webinar}` : ""} — {s.attendees} attendees{s.when ? ` · ${new Date(s.when).toLocaleDateString("en-IN")}` : ""}
            </option>
          ))}
        </select>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Peak concurrent" value={String(timeline.peak)} meta={`at ${timeline.peak_minute} min in`} />
        <StatCard label="Total attendees" value={String(timeline.total_attendees)} meta="Distinct people who joined" />
        <StatCard label="Avg watch time" value={`${timeline.avg_duration_mins}m`} meta="Mean minutes per attendee" />
        <StatCard label="Held to the end" value={`${timeline.retention.at100}%`} meta="Of peak still present at close" />
      </div>

      <SectionCard title="Attendance over time" subtitle="Concurrency minute by minute — red marks every drop where people left.">
        <AttendanceChart timeline={timeline} />
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {(["at25", "at50", "at75", "at100"] as const).map((k, i) => (
            <div key={k} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
              <div className="text-xs text-[var(--text-secondary)]">Retention @ {[25, 50, 75, 100][i]}%</div>
              <div className="text-lg font-semibold text-[var(--text-strong)]">{timeline.retention[k]}%</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Post-webinar conversion" subtitle="What this room turned into on CryptX — matched by email to real clients and paid invoices.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Paid conversion" value={`${conversion.paid_pct}%`} meta={`${conversion.paid} of ${conversion.attendees} attendees`} />
          <StatCard label="Revenue" value={formatCurrency(conversion.revenue_inr)} meta="Paid invoices from this room" />
          <StatCard label="ARPU" value={formatCurrency(conversion.arpu_inr)} meta="Revenue ÷ every attendee" />
          <StatCard label="AOV" value={formatCurrency(conversion.aov_inr)} meta="Revenue ÷ paying customer" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <StatCard label="CryptX signups" value={String(conversion.signups)} meta="Opened an account" />
          <StatCard label="Funded accounts" value={String(conversion.deposited)} meta="Balance greater than $0" />
          <StatCard label="Deposits (USD)" value={`$${conversion.total_balance_usd.toLocaleString("en-US")}`} meta="Total balance from this room" />
        </div>
      </SectionCard>
    </div>
  );
}
