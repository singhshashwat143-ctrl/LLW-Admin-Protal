import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Room as LiveKitRoom, RoomEvent, ScreenSharePresets, Track } from "livekit-client";
import { io, type Socket } from "socket.io-client";
import { Badge, PageHeader, SectionCard } from "../components/UI";
import { api, useApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatCurrency, formatDateTime } from "../lib/format";
import { navigate } from "../lib/router";

type Webinar = {
  id: string;
  title: string;
  description?: string;
  category: string;
  language?: string;
  ui_type: string;
  start_time: string;
  end_time: string;
  server_no: string;
  status: string;
  short_host_url: string;
  short_attendee_url: string;
  host_url: string;
  attendee_url: string;
  peak_attendance: number;
  total_attendees: number;
  banner_url?: string;
  price_inr?: number;
  token_price_inr?: number;
  payment_mode?: "FULL" | "TOKEN";
  payment_required?: boolean;
  enroll_button_enabled?: boolean;
  created_by?: string;
  instructor?: { name?: string } | null;
  sessions_count?: number;
};

type Session = {
  id: string;
  webinar_id: string;
  title: string;
  room_name: string;
  host_url: string;
  attendee_url: string;
  short_host_url: string;
  short_attendee_url: string;
  start_time: string;
  end_time: string;
  status: string;
  is_active: boolean;
};

type Attendance = {
  id: string;
  session_id: string;
  session_title: string;
  role: string;
  name: string;
  phone?: string;
  join_time: string;
  leave_time?: string | null;
  duration_mins?: number;
  payment_status?: string;
  enroll_clicks?: number;
  join_counts?: number;
  rating?: number;
  connection_quality?: number;
  mic_toggle_count?: number;
  camera_toggle_count?: number;
  camera_duration?: number;
  mic_duration?: number;
  student_id?: string | null;
};

type CheckoutResponse = {
  order?: {
    id: string;
    status?: string;
    amount_inr?: number;
    student?: { name?: string; email?: string; phone?: string } | null;
    phone?: string;
    webinar?: { title?: string } | null;
    product?: { name?: string } | null;
    bootcamp?: { title?: string } | null;
  };
  payment?: {
    id?: string;
    amount_inr?: number;
    method?: string;
    status?: string;
    razorpay_order_id?: string;
  };
  already_paid?: boolean;
  razorpayKeyId?: string;
};

type LiveKitJoinInfo = {
  url: string;
  token: string | null;
  identity: string;
  canPublish: boolean;
  canPublishAudio?: boolean;
  canPublishVideo?: boolean;
  canShareScreen?: boolean;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on?: (event: string, handler: (payload: any) => void) => void };
  }
}

type RoomSnapshot = {
  participants: Array<{ socketId: string; attendanceId: string; role: string; name: string; joinedAt: string; isMicOn?: boolean; isCameraOn?: boolean; isScreenSharing?: boolean; isHandRaised?: boolean; phone?: string; email?: string }>;
  messages: Array<{ id: string; role: string; name: string; text: string; createdAt: string; target?: "ALL" | "HOST"; messageType?: "CHAT" | "TOAST"; highlight?: boolean; attendanceId?: string }>;
};

type StageCandidate = {
  id: string;
  name: string;
  role: string;
  isMicOn?: boolean;
  isCameraOn?: boolean;
  isScreenSharing?: boolean;
  stageStream: MediaStream | null;
  cameraStream?: MediaStream | null;
};

function chooseStageCandidate(
  candidates: StageCandidate[],
  activeSpeakerIds: string[],
  screenSharePriority: Record<string, number>,
  preferLocalId?: string,
) {
  if (!candidates.length) return null;
  const activeSpeakerOrder = new Map(activeSpeakerIds.map((id, index) => [id, index]));
  return [...candidates].sort((left, right) => {
    const leftIsSharing = Boolean(left.isScreenSharing && left.stageStream);
    const rightIsSharing = Boolean(right.isScreenSharing && right.stageStream);
    if (leftIsSharing !== rightIsSharing) return leftIsSharing ? -1 : 1;

    if (leftIsSharing && rightIsSharing) {
      const leftShareRank = Number(screenSharePriority[left.id] || 0);
      const rightShareRank = Number(screenSharePriority[right.id] || 0);
      if (leftShareRank !== rightShareRank) return rightShareRank - leftShareRank;
    }

    const leftSpeakerRank = activeSpeakerOrder.get(left.id);
    const rightSpeakerRank = activeSpeakerOrder.get(right.id);
    if (leftSpeakerRank !== undefined || rightSpeakerRank !== undefined) {
      if (leftSpeakerRank === undefined) return 1;
      if (rightSpeakerRank === undefined) return -1;
      if (leftSpeakerRank !== rightSpeakerRank) return leftSpeakerRank - rightSpeakerRank;
    }

    const leftHasVideo = Boolean(left.stageStream && (left.isScreenSharing || left.isCameraOn));
    const rightHasVideo = Boolean(right.stageStream && (right.isScreenSharing || right.isCameraOn));
    if (leftHasVideo !== rightHasVideo) return leftHasVideo ? -1 : 1;

    const leftCameraOnly = Boolean(left.cameraStream && left.isCameraOn);
    const rightCameraOnly = Boolean(right.cameraStream && right.isCameraOn);
    if (leftCameraOnly !== rightCameraOnly) return leftCameraOnly ? -1 : 1;

    if (preferLocalId) {
      if (left.id === preferLocalId && right.id !== preferLocalId) return -1;
      if (right.id === preferLocalId && left.id !== preferLocalId) return 1;
    }

    return left.name.localeCompare(right.name);
  })[0];
}

function describeMediaError(kind: "microphone" | "camera" | "screen share" | "room connection", error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const lowered = message.toLowerCase();
  if (lowered.includes("permission") || lowered.includes("denied") || lowered.includes("notallowed")) {
    return `Allow ${kind} access in the browser and try again.`;
  }
  if (lowered.includes("notfound") || lowered.includes("device")) {
    return `No ${kind} device is available right now.`;
  }
  if (kind === "room connection") {
    return "Could not connect to the webinar media server.";
  }
  return `Could not start ${kind}. ${message || "Please try again."}`;
}

const defaultMeetingForm = {
  title: "",
  type: "MASTERCLASS",
  category: "Finance",
  ui_type: "WEBINAR",
  start_time: "2026-04-12T19:00",
  end_time: "2026-04-12T21:00",
  server_no: "Livekit-New-06",
  payment_required: false,
  price_inr: 0,
  is_simulation: false,
};

function useRazorpayScript() {
  useEffect(() => {
    const scriptId = "razorpay-checkout-script";
    if (document.getElementById(scriptId)) return;
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);
}

function getStoredAuthToken() {
  try {
    const raw = window.localStorage.getItem("llw-auth-session");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed?.token || "";
  } catch {
    return "";
  }
}

function WebinarPromoCard({
  webinar,
  attendeeCount,
  ctaLabel,
  ctaDisabled,
  ctaBusy,
  onCta,
  secondaryAction,
  eyebrow = "Premium Webinar",
}: {
  webinar: Webinar;
  attendeeCount?: number;
  ctaLabel: string;
  ctaDisabled?: boolean;
  ctaBusy?: boolean;
  onCta?: () => void;
  secondaryAction?: ReactNode;
  eyebrow?: string;
}) {
  const price = webinar.payment_required ? formatCurrency((webinar.price_inr || 0) / 100) : "Free Access";

  return (
    <div className="webinar-promo-card">
      <div className="webinar-promo-grid">
        <div className="space-y-5">
          <div className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/80">
            {eyebrow}
          </div>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{webinar.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200/88">
              {webinar.description || "A high-conviction webinar room built for live teaching, audience energy, and instant enrollment."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="webinar-stat-chip">
              <span className="webinar-stat-label">When</span>
              <strong>{formatDateTime(webinar.start_time)}</strong>
            </div>
            <div className="webinar-stat-chip">
              <span className="webinar-stat-label">Language</span>
              <strong>{webinar.language || "English"}</strong>
            </div>
            <div className="webinar-stat-chip">
              <span className="webinar-stat-label">Category</span>
              <strong>{webinar.category}</strong>
            </div>
            <div className="webinar-stat-chip">
              <span className="webinar-stat-label">Audience</span>
              <strong>{attendeeCount || 0} live</strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="webinar-cta-button" type="button" onClick={onCta} disabled={ctaDisabled || ctaBusy}>
              {ctaBusy ? "Opening Razorpay..." : ctaLabel}
            </button>
            {secondaryAction}
          </div>
        </div>

        <div className="webinar-price-panel">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-300">Enrollment</div>
          <div className="mt-3 text-4xl font-semibold text-white">{price}</div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {webinar.payment_required ? "Razorpay opens on top of this webinar page. No redirect, no broken flow." : "This session is free to join. Share the attendee link and start the room."}
          </p>
          <div className="mt-6 space-y-3 text-sm text-slate-200">
            <div className="webinar-feature-row"><span className="webinar-feature-dot" /> Live host + attendee room</div>
            <div className="webinar-feature-row"><span className="webinar-feature-dot" /> Same-page payment checkout</div>
            <div className="webinar-feature-row"><span className="webinar-feature-dot" /> Attendance + payment tracking</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LiveClassesPage() {
  const { data, setData } = useApi<{ webinars: Webinar[] }>("/api/webinars", { webinars: [] });
  const productsApi = useApi<{ products: Array<{ id: string; name: string; discounted_price: number; category: string }> }>("/api/products", { products: [] });
  const [form, setForm] = useState(defaultMeetingForm);
  const [createdLinks, setCreatedLinks] = useState<{ host_url: string; attendee_url: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  async function createMeeting() {
    const response = await api<{ webinar: Webinar }>("/api/webinars", { method: "POST", body: JSON.stringify(form) });
    setData({ webinars: [response.webinar, ...data.webinars] });
    setCreatedLinks({ host_url: response.webinar.host_url, attendee_url: response.webinar.attendee_url });
    setShowAddModal(false);
  }

  return (
    <div className="page-grid admin-page-grid live-page-grid">
      <PageHeader
        eyebrow="Live Ops"
        title="Live Classes & Meetings Dashboard"
        description="Create working webinar sessions, get real host and attendee links, and open the class preview page with stored attendance analytics."
        actions={
          <div className="page-actions">
            <button className="btn-secondary" type="button">Simulations</button>
            <button className="btn-secondary" type="button" onClick={() => navigate("/webinars/new")}>Add Masterclass to Testing</button>
            <button className="btn-primary" type="button" onClick={() => setShowAddModal(true)}>Add Meeting</button>
          </div>
        }
      />

      <div className="grid min-h-0 gap-6 compact-canvas live-page-content">
        <SectionCard title="Live Inventory" subtitle="Current and upcoming live rooms with generated links and preview entry points.">
          <div className="table-shell table-shell-scrollable admin-table-scroll live-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Name</th>
                  <th>Live Attendance</th>
                  <th>Category</th>
                  <th>Meeting URLs</th>
                  <th>UI Type</th>
                  <th>Start Time</th>
                  <th>Server No</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.webinars.map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>
                      <div className="font-medium text-[var(--text-strong)]">{row.title}</div>
                      <div className="text-sm text-[var(--text-secondary)]">{row.instructor?.name || row.created_by || "Admin"}</div>
                    </td>
                    <td>{row.total_attendees || row.peak_attendance || 0}</td>
                    <td>{row.category}</td>
                    <td className="font-mono text-xs">
                      <div className="live-links">
                        <div className="live-link-chip">
                          <span className="live-link-chip-label">Host</span>
                          <span className="live-link-chip-text">{row.short_host_url}</span>
                        </div>
                        <div className="live-link-chip">
                          <span className="live-link-chip-label">Attend</span>
                          <span className="live-link-chip-text">{row.short_attendee_url}</span>
                        </div>
                      </div>
                    </td>
                    <td><Badge tone={row.ui_type === "MEETING" ? "blue" : "gold"}>{row.ui_type}</Badge></td>
                    <td>{formatDateTime(row.start_time)}</td>
                    <td>{row.server_no}</td>
                    <td>
                      <div className="table-action-row">
                        <button className="btn-secondary text-sm" type="button" onClick={() => navigate(`/live/${row.id}`)}>Preview</button>
                        <a className="btn-primary text-sm" href={row.attendee_url} target="_blank" rel="noreferrer">Open Attendee Room</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="app-modal-card shrink-0">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h3 className="text-lg font-bold text-slate-900">Add Meeting</h3>
                <button type="button" className="text-slate-400 hover:text-slate-600" onClick={() => setShowAddModal(false)}>✕</button>
              </div>
              <div className="p-6">
                <p className="text-[13px] text-slate-500 mb-5">Saving this generates a webinar, a first live session, and working links.</p>
                <div className="space-y-4">
                  <select className="input-dark" value={form.title} onChange={(event) => {
                    const product = productsApi.data.products.find((item) => item.name === event.target.value);
                    setForm({
                      ...form,
                      title: event.target.value,
                      category: product?.category || form.category,
                      price_inr: product?.discounted_price || form.price_inr,
                      payment_required: Boolean(product),
                    });
                  }}>
                    <option value="">Select masterclass / product</option>
                    {productsApi.data.products.map((product) => <option key={product.id} value={product.name}>{product.name}</option>)}
                  </select>
                  <input className="input-dark" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Meeting Title" />
                  <div className="grid gap-3 md:grid-cols-2">
                    <select className="input-dark" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                      <option>MASTERCLASS</option>
                      <option>BOOTCAMP</option>
                    </select>
                    <select className="input-dark" value={form.ui_type} onChange={(event) => setForm({ ...form, ui_type: event.target.value })}>
                      <option>WEBINAR</option>
                      <option>MEETING</option>
                    </select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input className="input-dark" type="datetime-local" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} />
                    <input className="input-dark" type="datetime-local" value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })} />
                  </div>
                  <select className="input-dark" value={form.server_no} onChange={(event) => setForm({ ...form, server_no: event.target.value })}>
                    {Array.from({ length: 12 }, (_, index) => `Livekit-New-${String(index + 1).padStart(2, "0")}`).map((server) => (
                      <option key={server}>{server}</option>
                    ))}
                  </select>
                  <button className="btn-primary w-full" type="button" onClick={createMeeting}>Save Meeting</button>
                  {createdLinks ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[13px] text-emerald-900">
                      <div className="font-mono">Host: {createdLinks.host_url}</div>
                      <div className="mt-1 font-mono">Attendee: {createdLinks.attendee_url}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function WebinarDetailPage({ id }: { id: string }) {
  const { data, refresh } = useApi<{
    webinar: Webinar | null;
    sessions: Session[];
    stats: Record<string, unknown>;
    timeline: Array<{ minute: string; concurrent: number }>;
    attendees: Attendance[];
  }>(`/api/webinars/${id}/analytics`, { webinar: null, sessions: [], stats: {}, timeline: [], attendees: [] });

  useEffect(() => {
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const stats = data.stats as {
    totalDuration?: number;
    totalEntries?: number;
    totalAttendees?: number;
    peakAttendance?: number;
    enrollNowAttendance?: number;
    quality?: number;
    deviceBreakdown?: Record<string, number>;
    interactions?: { cameraOn?: number; micOn?: number };
  };

  const maxTimelineVal = Math.max(1, ...data.timeline.map((t) => t.concurrent));
  const buildSvgPath = () => {
    if (data.timeline.length === 0) return "";
    const w = 1000;
    const h = 250;
    const step = w / Math.max(1, data.timeline.length - 1);
    
    let path = `M0,${h}`;
    data.timeline.forEach((pt, i) => {
      const x = i * step;
      const y = h - (pt.concurrent / maxTimelineVal) * h * 0.9;
      path += ` L${x},${y}`;
    });
    path += ` L${w},${h} Z`;
    return path;
  };

  return (
    <div className="bg-white min-h-screen text-slate-800 p-6 md:p-8 border border-slate-200 shadow-sm rounded-xl">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">{data.webinar?.title || "Meeting Details"}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-[var(--link)] font-medium">Meeting Details</p>
          <div className="mt-2 flex items-center gap-2 text-[13px] text-slate-600 font-medium">
            <span>{data.webinar?.start_time ? formatDateTime(data.webinar.start_time) : "—"}</span>
            <span className="text-slate-400">→</span>
            <span>{data.webinar?.end_time ? formatDateTime(data.webinar.end_time) : "—"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export Timeline
          </button>
          <button className="rounded-md bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition">Chat</button>
        </div>
      </div>

      {/* Stats Grids */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Duration */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none text-slate-800">{stats.totalDuration || 0} mins</div>
            <div className="text-[13px] text-slate-500 mt-1">Total Duration</div>
          </div>
        </div>
        {/* Total Entries */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none text-slate-800">{stats.totalEntries || 0}</div>
            <div className="text-[13px] text-slate-500 mt-1">Total Entries</div>
          </div>
        </div>
        {/* Total Attendees */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="11" cy="7" r="4"></circle><line x1="22" y1="11" x2="16" y2="11"></line><line x1="19" y1="8" x2="19" y2="14"></line></svg>
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none text-slate-800">{stats.totalAttendees || 0}</div>
            <div className="text-[13px] text-slate-500 mt-1">Total Attendees</div>
          </div>
        </div>
        {/* Pitch Attendance */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none text-slate-800">{stats.enrollNowAttendance || 0}</div>
            <div className="text-[13px] text-slate-500 mt-1">Pitch Attendance</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Avg Packet Loss */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 19c2.485 0 4.5-2.015 4.5-4.5s-2.015-4.5-4.5-4.5h-1c-.552-2.761-3.038-5-6-5s-5.448 2.239-6 5h-1c-1.657 0-3 1.343-3 3s1.343 3 3 3h14z"></path></svg>
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none text-slate-800">{(stats.quality ? 100 - stats.quality : 1.93).toFixed(2)}%</div>
            <div className="text-[13px] text-slate-500 mt-1">Average Packet Loss</div>
          </div>
        </div>
        {/* Peak Attendance */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none text-slate-800">{stats.peakAttendance || 0}</div>
            <div className="text-[13px] text-slate-500 mt-1">Peak Attendance</div>
          </div>
        </div>
        {/* Enroll Now */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none text-slate-800">0</div>
            <div className="text-[13px] text-slate-500 mt-1">Enroll Now Attendance</div>
          </div>
        </div>
        {/* Connection Quality */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4">
           <div className="flex items-center justify-center gap-2">
             <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-600">%</div>
             <div><div className="text-base font-bold leading-none text-slate-800">{stats.quality ? Math.floor(stats.quality) : 89}%</div><div className="text-[11px] text-slate-400 mt-1">Excellent</div></div>
           </div>
           <div className="flex items-center justify-center gap-2">
             <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-500">%</div>
             <div><div className="text-base font-bold leading-none text-slate-800">{stats.quality ? Math.floor((100 - stats.quality) / 2) : 5}%</div><div className="text-[11px] text-slate-400 mt-1">Good</div></div>
           </div>
           <div className="flex items-center justify-center gap-2">
             <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-[11px] font-bold text-rose-500">%</div>
             <div><div className="text-base font-bold leading-none text-slate-800">{stats.quality ? Math.ceil((100 - stats.quality) / 2) : 2}%</div><div className="text-[11px] text-slate-400 mt-1">Poor</div></div>
           </div>
        </div>
      </div>

      {/* Chart and Sidebar */}
      <div className="mt-10 flex flex-col xl:flex-row gap-8">
         <div className="flex-1 relative h-[360px] border-b border-l border-slate-200">
            <div className="absolute left-[-30px] top-0 bottom-0 flex flex-col justify-between text-[11px] font-medium text-slate-500 items-end pb-[20px]">
               <span>{maxTimelineVal}</span>
               <span>{Math.floor(maxTimelineVal * 0.75)}</span>
               <span>{Math.floor(maxTimelineVal * 0.5)}</span>
               <span>{Math.floor(maxTimelineVal * 0.25)}</span>
               <span>0</span>
            </div>
            <svg className="w-full h-[340px]" viewBox="0 0 1000 250" preserveAspectRatio="none">
              <path d={buildSvgPath()} fill="url(#purpleGradient)"></path>
              <defs>
                 <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7B61FF" />
                    <stop offset="100%" stopColor="#7B61FF" />
                 </linearGradient>
              </defs>
            </svg>
            <div className="absolute bottom-[-24px] left-0 right-0 flex justify-between text-[10px] font-medium text-slate-500 overflow-hidden">
               {Array.from({ length: 45 }).map((_, i) => <span key={i} className="-rotate-45 block origin-left whitespace-nowrap">{i * 3}</span>)}
            </div>
         </div>
         {/* Right Sidebar Breakdown */}
         <div className="w-[200px] shrink-0 space-y-8 pl-4">
            <div>
               <h4 className="text-[12px] font-bold tracking-widest text-slate-400 uppercase">Devices</h4>
               <div className="mt-4 space-y-4">
                  <div className="text-sm text-slate-700 font-semibold">Mobile</div>
                  <div className="text-sm text-slate-700 font-semibold">Android App</div>
                  <div className="text-sm text-slate-700 font-semibold">Desktop</div>
               </div>
            </div>
            <div>
               <h4 className="text-[12px] font-bold tracking-widest text-slate-400 uppercase">Interactions</h4>
               <div className="mt-4 space-y-4">
                  <div className="text-sm text-slate-700 font-semibold">Camera On</div>
                  <div className="text-sm text-slate-700 font-semibold">Mic On</div>
               </div>
            </div>
         </div>
      </div>

      {/* Attendees Table */}
      <div className="mt-16">
        <div className="mb-4 flex justify-end">
          <input className="w-72 rounded-md border border-slate-200 px-4 py-2 text-sm outline-none focus:border-indigo-500 placeholder-slate-400 shadow-sm" placeholder="Search" />
        </div>
        <div className="table-shell">
          <table className="w-full text-left compact-table">
            <thead className="bg-[#f8f9fc] border-t border-b border-slate-200">
              <tr>
                {["Name", "Duration", "Camera Duration", "Mic Duration", "Payment Status", "Join Counts", "Rating", "Connection Timeline", "Times Microphone Turned", "Times Camera Turned"].map((col) => (
                   <th key={col} className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-[#A45B3F]">
                      <div className="flex items-center gap-1.5">{col} <span className="text-[#dcbdb1] text-[10px]">↓</span></div>
                   </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {data.attendees.map((row) => (
                 <tr key={row.id} className="hover:bg-slate-50/50">
                    {/* Name */}
                    <td className="px-4 py-5 align-top">
                       <div className="flex items-start gap-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700 uppercase">
                             {row.name.charAt(0)}
                          </div>
                          <div>
                             <div className="text-[14px] font-bold text-slate-800">{row.name}</div>
                             <div className="mt-1 flex items-center gap-1 text-[12px] font-mono text-slate-500">
                                📱 {row.phone || "+91 0000000000"}
                             </div>
                          </div>
                       </div>
                    </td>
                    {/* Duration */}
                    <td className="px-4 py-5 align-top">
                       <div className="text-[14px] font-bold text-slate-800">{row.duration_mins || 0} mins</div>
                       <div className="text-[12px] text-slate-500 mt-0.5">Duration</div>
                    </td>
                    {/* Camera */}
                    <td className="px-4 py-5 align-top">
                       <div className="text-[14px] font-bold text-slate-800">{row.camera_duration || 0} secs</div>
                       <div className="text-[12px] text-slate-500 mt-0.5">Camera Duration</div>
                    </td>
                    {/* Mic */}
                    <td className="px-4 py-5 align-top">
                       <div className="text-[14px] font-bold text-slate-800">{row.mic_duration || 0} secs</div>
                       <div className="text-[12px] text-slate-500 mt-0.5">Mic Duration</div>
                    </td>
                    {/* Payment */}
                    <td className="px-4 py-5 align-top">
                       <div className="text-[14px] text-slate-700">{row.payment_status || "-"}</div>
                       <div className="text-[12px] text-slate-500 mt-0.5">Payment Status</div>
                       <div className="mt-2 inline-block rounded-md bg-[#f97316] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
                         Enroll Clicks: {row.enroll_clicks || 0}
                       </div>
                    </td>
                    {/* Join Counts */}
                    <td className="px-4 py-5 align-top">
                       <div className="text-[14px] font-bold text-slate-800">{row.join_counts || 1}</div>
                       <div className="text-[12px] text-slate-500 mt-0.5">Join Counts</div>
                    </td>
                    {/* Rating */}
                    <td className="px-4 py-5 align-top">
                       <div className="text-[14px] font-bold text-slate-800">{(row.rating || 0).toFixed(2)}</div>
                       <div className="text-[12px] text-slate-500 mt-0.5">Rating</div>
                    </td>
                    {/* Connection */}
                    <td className="px-4 py-5 align-top">
                       <div className="flex h-2.5 w-full max-w-[130px] overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-[#4ade80]" style={{ width: `${row.connection_quality || 0}%` }}></div>
                          <div className="h-full bg-[#facc15]" style={{ width: `${100 - (row.connection_quality || 0)}%` }}></div>
                       </div>
                       <div className="mt-2 flex gap-2 text-[11px] font-bold">
                          <span className="text-[#16a34a]">● {row.connection_quality || 0}%</span>
                          <span className="text-[#ca8a04]">● {100 - (row.connection_quality || 0)}%</span>
                          <span className="text-[#e11d48]">● 0%</span>
                       </div>
                    </td>
                    {/* Mic toggles */}
                    <td className="px-4 py-5 align-top">
                       <div className="text-[14px] font-bold text-slate-800">{row.mic_toggle_count || 0}</div>
                       <div className="text-[12px] text-slate-500 mt-0.5">Microphone On</div>
                    </td>
                    {/* Camera toggles */}
                    <td className="px-4 py-5 align-top">
                       <div className="text-[14px] font-bold text-slate-800">{row.camera_toggle_count || 0}</div>
                       <div className="text-[12px] text-slate-500 mt-0.5">Camera On</div>
                    </td>
                 </tr>
               ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PublicShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(201,168,76,0.2),_transparent_24%),linear-gradient(180deg,_#0a0a0a,_#080808)] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="glass-card rounded-[28px] p-6 md:p-8">
          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[var(--accent)]">Livelong Wealth</p>
          <h1 className="font-display mt-3 text-4xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">{description}</p>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function useRoomConnection(role: "HOST" | "ATTENDEE", roomName: string, joinPayload: { name: string; phone: string; email: string } | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [webinar, setWebinar] = useState<Webinar | null>(null);
  const [room, setRoom] = useState<RoomSnapshot>({ participants: [], messages: [] });
  const [attendanceId, setAttendanceId] = useState("");
  const [ownSocketId, setOwnSocketId] = useState("");
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [activeToast, setActiveToast] = useState<{ id: string; text: string; name?: string } | null>(null);
  const [meetingEndedMessage, setMeetingEndedMessage] = useState("");
  const [unmutePrompt, setUnmutePrompt] = useState("");
  const [forceMuteSignal, setForceMuteSignal] = useState(0);
  const [livekit, setLivekit] = useState<LiveKitJoinInfo | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const attendanceIdRef = useRef("");

  useEffect(() => {
    api<{ webinar: Webinar; session: Session; room: RoomSnapshot }>(`/api/rooms/${roomName}`).then((response) => {
      setWebinar(response.webinar);
      setSession(response.session);
      setRoom(response.room);
    }).catch(() => undefined);
  }, [roomName]);

  useEffect(() => {
    if (!joinPayload) return;
    let active = true;
    let localAttendanceId = "";

    api<{ webinar: Webinar; session: Session; attendance: Attendance; livekit?: LiveKitJoinInfo | null }>(`/api/rooms/${roomName}/join`, {
      method: "POST",
      body: JSON.stringify({ ...joinPayload, role }),
    }).then((response) => {
      if (!active) return;
      setWebinar(response.webinar);
      setSession(response.session);
      setAttendanceId(response.attendance.id);
      attendanceIdRef.current = response.attendance.id;
      localAttendanceId = response.attendance.id;
      setLivekit(response.livekit || null);

      const socket = io(window.location.origin, {
        transports: ["websocket", "polling"],
        auth: {
          roomName,
          attendanceId: response.attendance.id,
          role,
          name: joinPayload.name,
          phone: joinPayload.phone,
          email: joinPayload.email,
          token: getStoredAuthToken(),
        },
      });

      socket.on("room:snapshot", (snapshot: RoomSnapshot) => setRoom(snapshot));
      socket.on("connect", () => setOwnSocketId(socket.id || ""));
      socket.on("webinar:update", (nextWebinar: Webinar) => setWebinar(nextWebinar));
      socket.on("room:toast", (toast: { id: string; text: string; name?: string }) => setActiveToast(toast));
      socket.on("participant:unmute-request", (payload: { message?: string }) => setUnmutePrompt(payload.message || "The host asked you to unmute."));
      socket.on("participant:muted", (payload: { message?: string }) => {
        setActiveToast({ id: `muted-${Date.now()}`, text: payload.message || "The host muted your microphone." });
        setForceMuteSignal(Date.now());
      });
      socket.on("participant:removed", (payload: { message?: string }) => {
        setMeetingEndedMessage(payload.message || "You were removed from the room.");
        socket.disconnect();
      });
      socket.on("meeting:ended", (payload: { message?: string }) => {
        setMeetingEndedMessage(payload.message || "The host ended the meeting.");
        socket.disconnect();
      });

      socketRef.current = socket;
      setSocketInstance(socket);
    });

    return () => {
      active = false;
      const socket = socketRef.current;
      socketRef.current = null;
      const currentAttendanceId = localAttendanceId || attendanceIdRef.current;
      if (currentAttendanceId) {
        fetch(`/api/attendance/${currentAttendanceId}/leave`, { method: "POST", keepalive: true }).catch(() => undefined);
      }
      socket?.disconnect();
      setSocketInstance(null);
      setOwnSocketId("");
      setLivekit(null);
    };
  }, [joinPayload, role, roomName]);

  useEffect(() => {
    if (!activeToast) return;
    const timer = window.setTimeout(() => setActiveToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [activeToast]);

  useEffect(() => {
    if (!attendanceId) return;
    const onUnload = () => {
      navigator.sendBeacon(`/api/attendance/${attendanceId}/leave`, new Blob([], { type: "application/json" }));
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [attendanceId]);

  const sendMessage = useCallback((text: string, options?: { target?: "ALL" | "HOST"; messageType?: "CHAT" | "TOAST" }) => {
    socketRef.current?.emit("chat:send", { text, ...options });
  }, []);

  const sendMediaState = useCallback((isMicOn: boolean, isCameraOn: boolean, isScreenSharing = false) => {
    socketRef.current?.emit("participant:media", { isMicOn, isCameraOn, isScreenSharing });
  }, []);

  const sendHandRaise = useCallback((isHandRaised: boolean) => {
    socketRef.current?.emit("participant:hand-raise", { isHandRaised });
  }, []);

  const updateLiveWebinar = useCallback((payload: Partial<Webinar>) => {
    socketRef.current?.emit("webinar:update", payload);
    setWebinar((current) => current ? { ...current, ...payload } : current);
  }, []);

  const requestUnmute = useCallback((targetSocketId: string, targetName: string) => {
    socketRef.current?.emit("participant:request-unmute", { targetSocketId, targetName });
  }, []);

  const muteParticipant = useCallback((targetSocketId: string) => {
    socketRef.current?.emit("participant:mute", { targetSocketId });
  }, []);

  const removeParticipant = useCallback((targetSocketId: string) => {
    socketRef.current?.emit("participant:remove", { targetSocketId });
  }, []);

  const endMeeting = useCallback(() => {
    socketRef.current?.emit("meeting:end");
  }, []);

  const clearMeetingEndedMessage = useCallback(() => setMeetingEndedMessage(""), []);
  const clearUnmutePrompt = useCallback(() => setUnmutePrompt(""), []);

  return {
    webinar,
    session,
    room,
    sendMessage,
    sendMediaState,
    sendHandRaise,
    updateLiveWebinar,
    requestUnmute,
    muteParticipant,
    removeParticipant,
    endMeeting,
    attendanceId,
    socket: socketInstance,
    ownSocketId,
    activeToast,
    meetingEndedMessage,
    unmutePrompt,
    forceMuteSignal,
    livekit,
    clearMeetingEndedMessage,
    clearUnmutePrompt,
  };
}

function VideoStream({ stream, muted, label, isCameraOn }: { stream: MediaStream | null; muted?: boolean; label: string; isCameraOn?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => undefined);
  }, [stream]);

  return (
    <div className="relative min-h-[220px] overflow-hidden rounded-[24px] border border-[rgba(201,168,76,0.18)] bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.34))]">
      {stream && !muted && !isCameraOn ? <AudioStream stream={stream} /> : null}
      {stream && isCameraOn ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="h-full min-h-[220px] w-full object-cover" />
      ) : (
        <div className="flex min-h-[220px] items-center justify-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-[rgba(255,255,255,0.12)] text-3xl font-semibold text-white">
            {label.slice(0, 1).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-3 rounded-full bg-[rgba(0,0,0,0.54)] px-3 py-1 text-xs font-semibold text-white backdrop-blur">
        {label}
      </div>
    </div>
  );
}

function AudioStream({ stream, muted = false }: { stream: MediaStream | null; muted?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.srcObject = stream;
    audioRef.current.play().catch(() => undefined);
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline muted={muted} className="hidden" />;
}

function composeMediaStream(...tracks: Array<MediaStreamTrack | null | undefined>) {
  const stream = new MediaStream();
  tracks.forEach((track) => {
    if (track) {
      stream.addTrack(track);
    }
  });
  return stream.getTracks().length ? stream : null;
}

function StageVideo({ stream, muted = false }: { stream: MediaStream | null; muted?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => undefined);
  }, [stream]);

  return <video ref={videoRef} autoPlay playsInline muted={muted} className="gm-video-fill" />;
}

function StageToast({ text }: { text: string }) {
  return (
    <div className="gm-stage-toast" role="status" aria-live="polite">
      {text}
    </div>
  );
}

function SideCameraRail({
  stream,
  label,
  eyebrow,
  muted,
  isCameraOn,
}: {
  stream: MediaStream | null;
  label: string;
  eyebrow: string;
  muted?: boolean;
  isCameraOn?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => undefined);
  }, [stream]);

  return (
    <aside className="gm-camera-panel">
      <div className="gm-camera-panel-header">
        <div>
          <p className="gm-camera-panel-kicker">{eyebrow}</p>
          <h3 className="gm-camera-panel-title">{label}</h3>
        </div>
        <span className="gm-camera-panel-status">{isCameraOn ? "Live" : "Audio only"}</span>
      </div>

      <div className="gm-camera-frame">
        {stream && !muted && !isCameraOn ? <AudioStream stream={stream} /> : null}
        {stream && isCameraOn ? (
          <video ref={videoRef} autoPlay playsInline muted={muted} className="gm-camera-video" />
        ) : (
          <div className="gm-camera-fallback">
            <div className="gm-camera-fallback-avatar">{label.slice(0, 1).toUpperCase()}</div>
            <p className="gm-camera-fallback-name">{label}</p>
          </div>
        )}
        <div className="gm-camera-frame-label">{label}</div>
      </div>
    </aside>
  );
}

function ControlIcon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "mic":
      return <svg {...common}><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 19v3" /></svg>;
    case "mic-off":
      return <svg {...common}><path d="m4 4 16 16" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12" /><path d="M15 9V6a3 3 0 0 0-5.77-1.28" /><path d="M19 10v2a7 7 0 0 1-11.2 5.6" /><path d="M12 19v3" /></svg>;
    case "cam":
      return <svg {...common}><path d="m15 10 5-3v10l-5-3Z" /><rect x="3" y="6" width="12" height="12" rx="2" /></svg>;
    case "cam-off":
      return <svg {...common}><path d="m4 4 16 16" /><path d="M15 10l5-3v10l-5-3" /><path d="M10.58 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3.42" /></svg>;
    case "screen":
      return <svg {...common}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8" /><path d="M12 16v4" /></svg>;
    case "hand":
      return <svg {...common}><path d="M7 11V5a1 1 0 1 1 2 0v6" /><path d="M9 8a1 1 0 1 1 2 0v4" /><path d="M11 8.5a1 1 0 1 1 2 0v3.5" /><path d="M13 9.5a1 1 0 1 1 2 0V13" /><path d="M7 11c-1.5 0-2.5 1.2-2.5 2.8 0 4 2.7 7.2 6.2 7.2h3.1c2.5 0 4.2-1.8 4.2-4.2V12a1 1 0 1 0-2 0" /></svg>;
    case "people":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "chat":
      return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" /></svg>;
    case "offer":
      return <svg {...common}><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 1 1 0-5c3 0 4.5 5 4.5 5Z" /><path d="M12 7h4.5a2.5 2.5 0 1 0 0-5c-3 0-4.5 5-4.5 5Z" /></svg>;
    case "end":
      return <svg {...common}><path d="M4 15c4-4 12-4 16 0" /><path d="M9 15v4" /><path d="M15 15v4" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

function useClassMedia({
  joined,
  canPublishAudio,
  canPublishVideo,
  canShareScreen,
  livekit,
  sendMediaState,
}: {
  joined: boolean;
  canPublishAudio: boolean;
  canPublishVideo: boolean;
  canShareScreen: boolean;
  livekit: LiveKitJoinInfo | null;
  sendMediaState: (isMicOn: boolean, isCameraOn: boolean, isScreenSharing?: boolean) => void;
}) {
  const canPublish = canPublishAudio || canPublishVideo || canShareScreen;
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [remoteCameraStreams, setRemoteCameraStreams] = useState<Map<string, MediaStream>>(new Map());
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Map<string, MediaStream>>(new Map());
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<string[]>([]);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const roomRef = useRef<LiveKitRoom | null>(null);
  const desiredMicEnabledRef = useRef(false);
  const micRecoveryTimeoutsRef = useRef<number[]>([]);
  const remoteTrackStateRef = useRef<Map<string, {
    micAudio: MediaStreamTrack | null;
    screenAudio: MediaStreamTrack | null;
    camera: MediaStreamTrack | null;
    screen: MediaStreamTrack | null;
  }>>(new Map());

  const getPublicationTrack = useCallback((publication: any) => {
    return publication?.track?.mediaStreamTrack || publication?.videoTrack?.mediaStreamTrack || publication?.audioTrack?.mediaStreamTrack || null;
  }, []);

  const clearMicRecoveryTimers = useCallback(() => {
    micRecoveryTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    micRecoveryTimeoutsRef.current = [];
  }, []);

  const buildLocalPreview = useCallback((room: LiveKitRoom | null) => {
    if (!room || !canPublish) {
      setLocalStream(null);
      setLocalCameraStream(null);
      setLocalScreenStream(null);
      return;
    }
    const stream = new MediaStream();
    const publications = Array.from(room.localParticipant.trackPublications.values()) as any[];
    const micPublication = publications.find((publication) => publication.source === Track.Source.Microphone);
    const screenPublication = publications.find((publication) => publication.source === Track.Source.ScreenShare);
    const cameraPublication = publications.find((publication) => publication.source === Track.Source.Camera);
    const audioTrack = getPublicationTrack(micPublication);
    const cameraTrack = getPublicationTrack(cameraPublication);
    const screenTrack = getPublicationTrack(screenPublication);
    const videoTrack = screenTrack || cameraTrack;
    if (audioTrack) stream.addTrack(audioTrack);
    if (videoTrack) stream.addTrack(videoTrack);
    setLocalStream(stream.getTracks().length ? stream : null);
    setLocalCameraStream(composeMediaStream(cameraTrack));
    setLocalScreenStream(composeMediaStream(screenTrack));
    setIsMicOn(Boolean(audioTrack) && room.localParticipant.isMicrophoneEnabled);
    setIsCameraOn(Boolean(cameraTrack) && room.localParticipant.isCameraEnabled);
    setIsScreenSharing(Boolean(screenTrack) && room.localParticipant.isScreenShareEnabled);
  }, [canPublish, getPublicationTrack]);

  const restoreMicrophoneIfNeeded = useCallback(async (room: LiveKitRoom | null) => {
    if (!room || !canPublishAudio || !desiredMicEnabledRef.current) return;
    try {
      const micPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (!micPublication || micPublication.isMuted || !room.localParticipant.isMicrophoneEnabled) {
        await room.localParticipant.setMicrophoneEnabled(true);
      }
      setMediaError("");
    } catch (error) {
      setMediaError(describeMediaError("microphone", error));
    } finally {
      buildLocalPreview(room);
    }
  }, [buildLocalPreview, canPublishAudio]);

  const scheduleMicrophoneRecovery = useCallback((room: LiveKitRoom | null) => {
    if (!room) return;
    clearMicRecoveryTimers();
    [0, 180, 600, 1400].forEach((delay) => {
      const timeoutId = window.setTimeout(() => {
        if (!room.localParticipant.isScreenShareEnabled || !desiredMicEnabledRef.current) return;
        void restoreMicrophoneIfNeeded(room);
      }, delay);
      micRecoveryTimeoutsRef.current.push(timeoutId);
    });
  }, [clearMicRecoveryTimers, restoreMicrophoneIfNeeded]);

  const syncRemoteStream = useCallback((identity: string) => {
    const state = remoteTrackStateRef.current.get(identity);
    setRemoteStreams((current) => {
      const next = new Map(current);
      if (!state || (!state.micAudio && !state.screenAudio && !state.camera && !state.screen)) {
        next.delete(identity);
        return next;
      }
      const stream = composeMediaStream(state.micAudio, state.screenAudio, state.screen || state.camera);
      if (stream) {
        next.set(identity, stream);
      } else {
        next.delete(identity);
      }
      return next;
    });
    setRemoteCameraStreams((current) => {
      const next = new Map(current);
      const stream = state ? composeMediaStream(state.camera) : null;
      if (stream) {
        next.set(identity, stream);
      } else {
        next.delete(identity);
      }
      return next;
    });
    setRemoteScreenStreams((current) => {
      const next = new Map(current);
      const stream = state ? composeMediaStream(state.screen) : null;
      if (stream) {
        next.set(identity, stream);
      } else {
        next.delete(identity);
      }
      return next;
    });
  }, []);

  const updateRemoteTrack = useCallback((identity: string, source: string | undefined, mediaStreamTrack: MediaStreamTrack | null) => {
    const current = remoteTrackStateRef.current.get(identity) || { micAudio: null, screenAudio: null, camera: null, screen: null };
    if (source === Track.Source.Microphone) {
      current.micAudio = mediaStreamTrack;
    } else if (source === Track.Source.ScreenShareAudio) {
      current.screenAudio = mediaStreamTrack;
    } else if (source === Track.Source.ScreenShare) {
      current.screen = mediaStreamTrack;
    } else {
      current.camera = mediaStreamTrack;
    }
    remoteTrackStateRef.current.set(identity, current);
    syncRemoteStream(identity);
  }, [syncRemoteStream]);

  useEffect(() => {
    if (!joined || !livekit?.url || !livekit?.token) {
      setLocalStream(null);
      setLocalCameraStream(null);
      setLocalScreenStream(null);
      setRemoteStreams(new Map());
      setRemoteCameraStreams(new Map());
      setRemoteScreenStreams(new Map());
      setActiveSpeakerIds([]);
      clearMicRecoveryTimers();
      desiredMicEnabledRef.current = false;
      setIsMicOn(false);
      setIsCameraOn(false);
      setIsScreenSharing(false);
      setMediaError("");
      return;
    }

    let active = true;
    const room = new LiveKitRoom({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    const syncExistingParticipant = (participant: any) => {
      participant.trackPublications.forEach((publication: any) => {
        const mediaTrack = getPublicationTrack(publication);
        if (mediaTrack) {
          updateRemoteTrack(participant.identity, publication.source, mediaTrack);
        }
      });
    };

    const onTrackSubscribed = (track: any, publication: any, participant: any) => {
      if (participant.identity === livekit.identity) return;
      const mediaTrack = track?.mediaStreamTrack || null;
      updateRemoteTrack(participant.identity, publication?.source, mediaTrack);
    };

    const onTrackUnsubscribed = (_track: any, publication: any, participant: any) => {
      if (participant.identity === livekit.identity) return;
      updateRemoteTrack(participant.identity, publication?.source, null);
    };

    const onParticipantDisconnected = (participant: any) => {
      remoteTrackStateRef.current.delete(participant.identity);
      setRemoteStreams((current) => {
        const next = new Map(current);
        next.delete(participant.identity);
        return next;
      });
      setRemoteCameraStreams((current) => {
        const next = new Map(current);
        next.delete(participant.identity);
        return next;
      });
      setRemoteScreenStreams((current) => {
        const next = new Map(current);
        next.delete(participant.identity);
        return next;
      });
      setActiveSpeakerIds((current) => current.filter((id) => id !== participant.identity));
    };

    const onActiveSpeakersChanged = (speakers: any[]) => {
      setActiveSpeakerIds(speakers.map((participant) => participant.identity).filter(Boolean));
    };

    const onTrackMuted = (publication: any, participant: any) => {
      if (participant?.identity !== livekit.identity) return;
      buildLocalPreview(room);
      if (publication?.source === Track.Source.Microphone && desiredMicEnabledRef.current && room.localParticipant.isScreenShareEnabled) {
        scheduleMicrophoneRecovery(room);
      }
    };

    const onTrackUnmuted = (_publication: any, participant: any) => {
      if (participant?.identity !== livekit.identity) return;
      buildLocalPreview(room);
    };

    const onLocalTrackPublished = () => {
      buildLocalPreview(room);
    };

    const onLocalTrackUnpublished = (publication: any) => {
      buildLocalPreview(room);
      if (publication?.source === Track.Source.Microphone && desiredMicEnabledRef.current && room.localParticipant.isScreenShareEnabled) {
        scheduleMicrophoneRecovery(room);
      }
    };

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged);
    room.on(RoomEvent.TrackMuted, onTrackMuted);
    room.on(RoomEvent.TrackUnmuted, onTrackUnmuted);
    room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);

    room.connect(livekit.url, livekit.token, { autoSubscribe: true })
      .then(() => {
        if (!active) return;
        setMediaError("");
        room.remoteParticipants.forEach((participant) => syncExistingParticipant(participant));
        buildLocalPreview(room);
      })
      .catch((error) => {
        if (!active) return;
        setMediaError(describeMediaError("room connection", error));
        setLocalStream(null);
        setLocalCameraStream(null);
        setLocalScreenStream(null);
        setRemoteStreams(new Map());
        setRemoteCameraStreams(new Map());
        setRemoteScreenStreams(new Map());
        setActiveSpeakerIds([]);
      });

    return () => {
      active = false;
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged);
      room.off(RoomEvent.TrackMuted, onTrackMuted);
      room.off(RoomEvent.TrackUnmuted, onTrackUnmuted);
      room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
      room.disconnect();
      roomRef.current = null;
      remoteTrackStateRef.current.clear();
      setRemoteStreams(new Map());
      setRemoteCameraStreams(new Map());
      setRemoteScreenStreams(new Map());
      setActiveSpeakerIds([]);
      clearMicRecoveryTimers();
      desiredMicEnabledRef.current = false;
      setLocalStream(null);
      setLocalCameraStream(null);
      setLocalScreenStream(null);
      setIsMicOn(false);
      setIsCameraOn(false);
      setIsScreenSharing(false);
      setMediaError("");
    };
  }, [buildLocalPreview, clearMicRecoveryTimers, getPublicationTrack, joined, livekit, scheduleMicrophoneRecovery, updateRemoteTrack]);

  useEffect(() => {
    sendMediaState(isMicOn, isCameraOn, isScreenSharing);
  }, [isCameraOn, isMicOn, isScreenSharing, sendMediaState]);

  async function toggleMic() {
    const next = !isMicOn;
    const room = roomRef.current;
    if (!room || !canPublishAudio) return;
    const previousDesiredMicState = desiredMicEnabledRef.current;
    desiredMicEnabledRef.current = next;
    try {
      setMediaError("");
      const publication = await room.localParticipant.setMicrophoneEnabled(next);
      setIsMicOn(next);
      if (!next && publication) {
        setIsMicOn(false);
      }
      if (!next) {
        clearMicRecoveryTimers();
      }
      buildLocalPreview(room);
    } catch (error) {
      desiredMicEnabledRef.current = previousDesiredMicState;
      setMediaError(describeMediaError("microphone", error));
    }
  }

  async function toggleCamera() {
    const next = !isCameraOn;
    const room = roomRef.current;
    if (!room || !canPublishVideo) return;
    try {
      setMediaError("");
      await room.localParticipant.setCameraEnabled(next);
      setIsCameraOn(next);
      buildLocalPreview(room);
    } catch (error) {
      setMediaError(describeMediaError("camera", error));
    }
  }

  async function toggleScreenShare() {
    const room = roomRef.current;
    if (!room || !canShareScreen) return;
    const next = !isScreenSharing;
    try {
      setMediaError("");
      const micWasOn = room.localParticipant.isMicrophoneEnabled;
      await room.localParticipant.setScreenShareEnabled(
        next,
        next
          ? {
              audio: false,
              video: true,
              resolution: ScreenSharePresets.h1080fps30.resolution,
              contentHint: "detail",
            }
          : undefined,
        next
          ? {
              screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
              screenShareSimulcastLayers: [ScreenSharePresets.h720fps15],
              degradationPreference: "maintain-resolution",
            }
          : undefined,
      );
      if (next && micWasOn) {
        desiredMicEnabledRef.current = true;
        scheduleMicrophoneRecovery(room);
      } else if (!next) {
        clearMicRecoveryTimers();
      }
      setIsScreenSharing(next);
      buildLocalPreview(room);
    } catch (error) {
      setMediaError(describeMediaError("screen share", error));
    }
  }

  return {
    localStream,
    localCameraStream,
    localScreenStream,
    remoteStreams,
    remoteCameraStreams,
    remoteScreenStreams,
    activeSpeakerIds,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    hasMediaAccess: canPublish ? Boolean(livekit?.token) : true,
    mediaError,
  };
}

function WebinarRoomPage({ role, roomName }: { role: "HOST" | "ATTENDEE"; roomName: string }) {
  useRazorpayScript();
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [joined, setJoined] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftMessageTarget, setDraftMessageTarget] = useState<"ALL" | "HOST">("ALL");
  const [draftMessageType, setDraftMessageType] = useState<"CHAT" | "TOAST">("CHAT");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [linkCopyNotice, setLinkCopyNotice] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState<{ orderId: string; paymentId?: string } | null>(null);
  const [reconcilingPayment, setReconcilingPayment] = useState(false);
  const [sidePanel, setSidePanel] = useState<null | "chat" | "people">(null);
  const [handRaised, setHandRaised] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [duration, setDuration] = useState("00:00");
  const [hostOfferMode, setHostOfferMode] = useState<"FULL" | "TOKEN">("FULL");
  const [hostFullAmount, setHostFullAmount] = useState("9999");
  const [hostTokenAmount, setHostTokenAmount] = useState("499");
  const [screenSharePriority, setScreenSharePriority] = useState<Record<string, number>>({});
  const chatRef = useRef<HTMLDivElement | null>(null);
  const previousScreenShareStateRef = useRef<Map<string, boolean>>(new Map());
  const connection = useRoomConnection(role, roomName, joined ? form : null);
  const canHostRoom = role === "HOST" && ["ADMIN", "SUPER_ADMIN"].includes(String(user?.role || "").toUpperCase());
  const media = useClassMedia({
    joined,
    canPublishAudio: role === "HOST" ? canHostRoom : Boolean(connection.livekit?.canPublishAudio),
    canPublishVideo: role === "HOST" ? canHostRoom : Boolean(connection.livekit?.canPublishVideo),
    canShareScreen: role === "HOST" ? canHostRoom : Boolean(connection.livekit?.canShareScreen),
    livekit: connection.livekit,
    sendMediaState: connection.sendMediaState,
  });

  const activeAttendees = useMemo(() => connection.room.participants.filter((item) => item.role === "ATTENDEE"), [connection.room.participants]);
  const remoteParticipants = useMemo(
    () => connection.room.participants.filter((participant) => participant.socketId !== connection.ownSocketId),
    [connection.ownSocketId, connection.room.participants],
  );
  const hostParticipants = useMemo(
    () => remoteParticipants.filter((participant) => participant.role === "HOST"),
    [remoteParticipants],
  );
  const remoteHostStageCandidates = useMemo<StageCandidate[]>(
    () => hostParticipants.map((participant) => {
      const combinedStream = media.remoteStreams.get(participant.attendanceId) || null;
      const screenStream = media.remoteScreenStreams.get(participant.attendanceId) || null;
      const cameraStream = media.remoteCameraStreams.get(participant.attendanceId) || null;
      return {
        id: participant.attendanceId,
        name: participant.name,
        role: participant.role,
        isMicOn: participant.isMicOn,
        isCameraOn: participant.isCameraOn,
        isScreenSharing: participant.isScreenSharing,
        stageStream: screenStream || combinedStream,
        cameraStream,
      };
    }),
    [hostParticipants, media.remoteCameraStreams, media.remoteScreenStreams, media.remoteStreams],
  );
  const localHostStageCandidate = useMemo<StageCandidate | null>(() => {
    if (role !== "HOST") return null;
    return {
      id: connection.attendanceId || "local-host",
      name: form.name || "Host Console",
      role: "HOST",
      isMicOn: media.isMicOn,
      isCameraOn: media.isCameraOn,
      isScreenSharing: media.isScreenSharing,
      stageStream: media.localScreenStream || media.localStream,
      cameraStream: media.localCameraStream,
    };
  }, [
    connection.attendanceId,
    form.name,
    media.isCameraOn,
    media.isMicOn,
    media.isScreenSharing,
    media.localCameraStream,
    media.localScreenStream,
    media.localStream,
    role,
  ]);
  const hostStageCandidates = useMemo(
    () => (localHostStageCandidate ? [localHostStageCandidate, ...remoteHostStageCandidates] : remoteHostStageCandidates),
    [localHostStageCandidate, remoteHostStageCandidates],
  );
  const enrollEnabled = Boolean(connection.webinar?.payment_required && connection.webinar?.enroll_button_enabled);

  useEffect(() => {
    if (!connection.attendanceId || role !== "ATTENDEE" || !connection.webinar?.id) return;
    api<{ attendees: Attendance[] }>(`/api/webinars/${connection.webinar.id}/analytics`)
      .then((response) => {
        const ownAttendance = response.attendees.find((item) => item.id === connection.attendanceId);
        if (ownAttendance?.payment_status === "PAID") {
          setPaymentComplete(true);
        }
      })
      .catch(() => undefined);
  }, [connection.attendanceId, connection.webinar?.id, role]);

  useEffect(() => {
    if (!connection.webinar) return;
    setHostOfferMode(connection.webinar.payment_mode || "FULL");
    setHostFullAmount(String(Math.round((connection.webinar.price_inr || 0) / 100) || 9999));
    setHostTokenAmount(String(Math.round((connection.webinar.token_price_inr || 0) / 100) || 499));
  }, [connection.webinar]);

  useEffect(() => {
    if (!media.mediaError) return;
    setPaymentNotice(media.mediaError);
  }, [media.mediaError]);

  useEffect(() => {
    setScreenSharePriority((current) => {
      const nextSnapshot = new Map<string, boolean>();
      const nextPriority = { ...current };
      let changed = false;
      const timestampBase = Date.now();

      hostStageCandidates.forEach((participant, index) => {
        const isSharing = Boolean(participant.isScreenSharing);
        const wasSharing = previousScreenShareStateRef.current.get(participant.id) || false;
        nextSnapshot.set(participant.id, isSharing);
        if (isSharing && !wasSharing) {
          nextPriority[participant.id] = timestampBase + index;
          changed = true;
        }
        if (!isSharing && participant.id in nextPriority) {
          delete nextPriority[participant.id];
          changed = true;
        }
      });

      Object.keys(nextPriority).forEach((id) => {
        if (!nextSnapshot.has(id)) {
          delete nextPriority[id];
          changed = true;
        }
      });

      previousScreenShareStateRef.current = nextSnapshot;
      return changed ? nextPriority : current;
    });
  }, [hostStageCandidates]);

  useEffect(() => {
    if (role !== "HOST") return;
    setForm((current) => ({
      name: current.name || user?.name || "",
      phone: current.phone,
      email: user?.email || current.email,
    }));
  }, [role, user?.email, user?.name]);

  useEffect(() => {
    if (!connection.forceMuteSignal || !media.isMicOn) return;
    media.toggleMic();
  }, [connection.forceMuteSignal, media]);

  const reconcileLivePaymentStatus = useCallback(async () => {
    if (!pendingCheckout || reconcilingPayment || paymentComplete) return false;
    try {
      setReconcilingPayment(true);
      const response = await api<{ paid?: boolean; failed?: boolean; message?: string }>("/api/orders/reconcile-payment", {
        method: "POST",
        body: JSON.stringify({
          order_id: pendingCheckout.orderId,
          payment_id: pendingCheckout.paymentId,
        }),
      });
      if (response.paid) {
        setPaymentComplete(true);
        setPaymentNotice("Payment completed successfully.");
        setPendingCheckout(null);
        return true;
      }
      if (response.failed) {
        setPaymentNotice(response.message || "Payment failed. Please try again.");
        setPendingCheckout(null);
      }
      return false;
    } catch {
      return false;
    } finally {
      setReconcilingPayment(false);
    }
  }, [paymentComplete, pendingCheckout, reconcilingPayment]);

  useEffect(() => {
    if (!pendingCheckout || paymentComplete) return;

    const onFocus = () => {
      reconcileLivePaymentStatus().catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        reconcileLivePaymentStatus().catch(() => undefined);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [paymentComplete, pendingCheckout, reconcileLivePaymentStatus]);

  useEffect(() => {
    if (!connection.meetingEndedMessage) return;
    if (connection.attendanceId) {
      fetch(`/api/attendance/${connection.attendanceId}/leave`, { method: "POST", keepalive: true }).catch(() => undefined);
    }
    setJoined(false);
    setSidePanel(null);
    setHandRaised(false);
    setPaymentNotice(connection.meetingEndedMessage);
    connection.clearMeetingEndedMessage();
  }, [connection.attendanceId, connection.clearMeetingEndedMessage, connection.meetingEndedMessage]);

  useEffect(() => {
    if (!joined) return;
    const timer = window.setInterval(() => {
      const now = new Date();
      const hours = now.getHours();
      const mins = String(now.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      setCurrentTime(`${hours % 12 || 12}:${mins} ${ampm}`);

      const ownParticipant = connection.room.participants.find((item) => item.attendanceId === connection.attendanceId);
      const startedAt = ownParticipant?.joinedAt || connection.session?.start_time;
      if (startedAt) {
        const elapsed = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
        const hh = Math.floor(elapsed / 3600);
        const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
        const ss = String(elapsed % 60).padStart(2, "0");
        setDuration(hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [connection.attendanceId, connection.room.participants, connection.session?.start_time, joined]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [connection.room.messages, sidePanel]);

  useEffect(() => {
    if (!linkCopyNotice) return;
    const timer = window.setTimeout(() => setLinkCopyNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [linkCopyNotice]);

  function submitJoin() {
    if (role === "HOST" && !canHostRoom) {
      setPaymentNotice("Sign in as an admin or super-admin account to join as host.");
      return;
    }
    if (!form.name.trim() || !form.phone.trim()) return;
    setJoined(true);
  }

  async function launchEnrollNow() {
    if (role !== "ATTENDEE" || !connection.webinar || !connection.attendanceId) return;
    if (!enrollEnabled) {
      setPaymentNotice("Enrollment is not open right now.");
      return;
    }

    try {
      setPaymentLoading(true);
      setPaymentNotice("");

      await api(`/api/attendance/${connection.attendanceId}/enroll-click`, { method: "POST" });

      const created = await api<{ order: { id: string; status?: string } }>("/api/payment-links", {
        method: "POST",
        body: JSON.stringify({
          webinar_id: connection.webinar.id,
          amount_inr: getActiveEnrollAmountInPaise(),
          original_product_value_inr: Number(connection.webinar.price_inr || getActiveEnrollAmountInPaise()),
          payment_type: connection.webinar.payment_mode === "TOKEN" ? "TOKEN" : "FULL",
          payment_mode: connection.webinar.payment_mode === "TOKEN" ? "TOKEN" : "FULL",
          token_amount: connection.webinar.payment_mode === "TOKEN" ? getActiveEnrollAmountInPaise() : 0,
          student_name: form.name,
          phone: form.phone,
          email: form.email,
          source: connection.webinar.title,
          source_type: "WEBINAR",
          campaign: "webinar-enroll-now",
        }),
      });

      const session = await api<CheckoutResponse>("/api/orders/checkout-session", {
        method: "POST",
        body: JSON.stringify({ order_id: created.order.id }),
      });

      if (session.already_paid || session.payment?.status === "PAID") {
        setPaymentComplete(true);
        setPaymentNotice("Payment already completed for this attendee.");
        setPendingCheckout(null);
        return;
      }

      if (!window.Razorpay || !session.payment?.razorpay_order_id || !session.razorpayKeyId) {
        throw new Error("Razorpay checkout could not be initialized.");
      }

      setPendingCheckout({
        orderId: created.order.id,
        paymentId: session.payment?.id,
      });

      const checkout = new window.Razorpay({
        key: session.razorpayKeyId,
        amount: session.payment?.amount_inr || session.order?.amount_inr,
        currency: "INR",
        name: "Livelong Wealth",
        description: session.order.webinar?.title || session.order.product?.name || session.order.bootcamp?.title || "Enrollment payment",
        order_id: session.payment.razorpay_order_id,
        prefill: {
          name: session.order.student?.name || form.name,
          email: session.order.student?.email || form.email,
          contact: session.order.student?.phone || session.order.phone || form.phone,
        },
        theme: { color: "#dc7c2f" },
        handler: async (response: Record<string, string>) => {
          await api("/api/orders/verify-payment", {
            method: "POST",
            body: JSON.stringify({
              order_id: created.order.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          setPaymentComplete(true);
          setPaymentNotice("Payment completed successfully.");
          setPendingCheckout(null);
        },
        modal: {
          ondismiss: async () => {
            const reconciled = await reconcileLivePaymentStatus();
            if (!reconciled) {
              setPaymentNotice((current) => current || "Checkout was closed before payment completion.");
            }
          },
        },
      });

      checkout.on?.("payment.failed", async (response: any) => {
        try {
          await api("/api/orders/mark-payment-failed", {
            method: "POST",
            body: JSON.stringify({
              order_id: created.order.id,
              payment_id: session.payment?.id,
              failure_code: response?.error?.code,
              failure_reason: response?.error?.description || response?.error?.reason,
            }),
          });
        } catch {
          // Ignore failure logging errors and keep the user-visible error path simple.
        }
        setPendingCheckout(null);
        setPaymentNotice(response?.error?.description || "Payment failed. Please try again.");
      });

      checkout.open();
    } catch (error) {
      setPaymentNotice(error instanceof Error ? error.message : "Unable to open Razorpay checkout.");
    } finally {
      setPaymentLoading(false);
    }
  }

  function togglePanel(panel: "chat" | "people") {
    setSidePanel((current) => (current === panel ? null : panel));
  }

  function sendChatFromPanel() {
    if (!draftMessage.trim()) return;
    connection.sendMessage(draftMessage, {
      target: draftMessageType === "TOAST" ? "ALL" : draftMessageTarget,
      messageType: draftMessageType,
    });
    setDraftMessage("");
    if (draftMessageType === "TOAST") {
      setDraftMessageType("CHAT");
    }
  }

  function toggleHandRaised() {
    const next = !handRaised;
    setHandRaised(next);
    connection.sendHandRaise(next);
  }

  function getActiveEnrollAmountInPaise() {
    if (!connection.webinar) return 0;
    return connection.webinar.payment_mode === "TOKEN"
      ? Number(connection.webinar.token_price_inr || 0)
      : Number(connection.webinar.price_inr || 0);
  }

  function getActiveEnrollLabel() {
    if (!connection.webinar?.payment_required) return "Free";
    const amount = getActiveEnrollAmountInPaise();
    return `${connection.webinar.payment_mode === "TOKEN" ? "Token" : "Full"} • ${formatCurrency(amount / 100)}`;
  }

  function saveHostOfferConfig() {
    connection.updateLiveWebinar({
      payment_required: true,
      enroll_button_enabled: true,
      payment_mode: hostOfferMode,
      price_inr: Math.max(0, Number(hostFullAmount || 0)) * 100,
      token_price_inr: Math.max(0, Number(hostTokenAmount || 0)) * 100,
    });
    setPaymentNotice(`Enroll Now is live with ${hostOfferMode === "TOKEN" ? "Token" : "Full"} payment.`);
  }

  async function leaveCurrentRoom(message = "") {
    if (connection.attendanceId) {
      await fetch(`/api/attendance/${connection.attendanceId}/leave`, { method: "POST", keepalive: true }).catch(() => undefined);
    }
    connection.socket?.disconnect();
    setJoined(false);
    setSidePanel(null);
    setHandRaised(false);
    if (message) {
      setPaymentNotice(message);
    }
  }

  function handleAskToUnmute() {
    if (!media.hasMediaAccess) {
      setPaymentNotice("Allow microphone access first, then you can unmute.");
      connection.clearUnmutePrompt();
      return;
    }
    if (!media.isMicOn) {
      media.toggleMic();
    }
    connection.clearUnmutePrompt();
  }

  function toggleEnrollVisibility() {
    connection.updateLiveWebinar({
      enroll_button_enabled: !connection.webinar?.enroll_button_enabled,
      payment_required: true,
    });
    setPaymentNotice(connection.webinar?.enroll_button_enabled ? "Enroll Now hidden for attendees." : "Enroll Now is now visible to attendees.");
  }

  async function copySessionLink(label: string, value: string) {
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    setLinkCopyNotice(`${label} link copied.`);
  }

  if (!joined) {
    return (
      <div className="gm-prejoin-shell">
        <div className="gm-prejoin-brand">
          <div>
            <div className="gm-prejoin-logo">LW</div>
            <h1 className="gm-prejoin-title">{role === "HOST" ? "Join As Host" : "Join Webinar"}</h1>
            <p className="gm-prejoin-copy">
              {role === "HOST"
                ? "Enter your host details before joining so multiple hosts can run the room together."
                : "Real-time video, live chat, and in-room Razorpay checkout without sending people away."}
            </p>
            <div className="gm-prejoin-points">
              <div>Live webinar stage</div>
              <div>Chat + people drawer</div>
              <div>Offer banner inside the room</div>
              <div>Same-page payment modal</div>
            </div>
          </div>
        </div>

        <div className="gm-prejoin-form-shell">
          <div className="gm-prejoin-form">
            <h2>{role === "HOST" ? "Host Console" : "Join Webinar"}</h2>
            <p>{role === "HOST" ? "Enter your host name, phone, and email to open the host controls." : "Enter your details to open the attendee room."}</p>
            <div className="gm-prejoin-preview">
              <div className="gm-prejoin-avatar">{form.name?.slice(0, 1)?.toUpperCase() || "G"}</div>
            </div>
            <div className="gm-prejoin-fields">
              <input className="gm-prejoin-input" placeholder={role === "HOST" ? "Host Name" : "Your Name"} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <input className="gm-prejoin-input" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <input className="gm-prejoin-input" placeholder="Phone Number" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              <button className="gm-prejoin-btn" type="button" onClick={submitJoin}>{role === "HOST" ? "Join As Host" : "Join Webinar"}</button>
              {paymentNotice ? <div className="gm-payment-note">{paymentNotice}</div> : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (role === "ATTENDEE" && joined) {
    const leadHost = chooseStageCandidate(remoteHostStageCandidates, media.activeSpeakerIds, screenSharePriority);
    const leadRemoteStageStream = leadHost?.stageStream || null;
    const showRemoteVideo = Boolean(leadRemoteStageStream && (leadHost?.isCameraOn || leadHost?.isScreenSharing));
    const showHostCameraPreview = Boolean(leadHost?.isScreenSharing && leadHost?.isCameraOn && leadHost?.cameraStream);
    const hostLabel = leadHost?.name || connection.webinar?.instructor?.name || connection.webinar?.title || "Host";
    const showHostCameraRail = !sidePanel && showHostCameraPreview;

    return (
      <div className="gm-root">
        <div className="gm-main">
          <div className="gm-stage">
            {leadRemoteStageStream && !showRemoteVideo ? <AudioStream stream={leadRemoteStageStream} /> : null}
            {showRemoteVideo ? (
              <StageVideo stream={leadRemoteStageStream} />
            ) : (
              <div className="gm-avatar-stage">
                <div className="gm-avatar-circle">{hostLabel.slice(0, 1).toUpperCase()}</div>
                <p className="gm-avatar-name">{hostLabel}</p>
              </div>
            )}

            {!showHostCameraRail && showHostCameraPreview ? (
              <div className="gm-host-pip">
                <VideoStream stream={leadHost?.cameraStream || null} label={`${hostLabel} camera`} isCameraOn />
              </div>
            ) : null}

            <div className="gm-name-pill">
              <span>{hostLabel}</span>
            </div>

            <div className="gm-live-badge">
              <span className="gm-live-dot" />
              <span>LIVE</span>
            </div>

            {leadHost?.isScreenSharing ? <div className="gm-screen-badge">Presenting</div> : null}

            {connection.activeToast ? <StageToast text={connection.activeToast.text} /> : null}

            {enrollEnabled && !paymentComplete ? (
              <div className="gm-offer-banner">
                <div className="gm-offer-icon">₹</div>
                <div className="gm-offer-text">
                  <p className="gm-offer-title">Special Offer Live</p>
                  <p className="gm-offer-sub">{getActiveEnrollLabel()}</p>
                </div>
                <button onClick={launchEnrollNow} className="gm-offer-btn" disabled={paymentLoading}>
                  {paymentLoading ? "Opening..." : getActiveEnrollLabel()}
                </button>
              </div>
            ) : null}

            {connection.unmutePrompt ? (
              <div className="absolute left-1/2 top-20 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/20 bg-black/75 px-4 py-3 text-sm text-white shadow-xl backdrop-blur">
                <span>{connection.unmutePrompt}</span>
                <button className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white" type="button" onClick={handleAskToUnmute}>Unmute now</button>
                <button className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80" type="button" onClick={connection.clearUnmutePrompt}>Later</button>
              </div>
            ) : null}

            {paymentNotice ? <div className="gm-payment-note">{paymentNotice}</div> : null}
          </div>

          <div className="gm-bar gm-bar-attendee">
            <div className="gm-bar-attendee-top">
              <div className="gm-bar-left">
                <span className="gm-time">{currentTime}</span>
                <span className="gm-bar-divider">|</span>
                <span className="gm-meeting-code">{roomName}</span>
                <span className="gm-bar-divider">·</span>
                <span className="gm-duration">{duration}</span>
              </div>

              <div className="gm-bar-right">
                <button onClick={() => togglePanel("people")} className={`gm-icon-btn ${sidePanel === "people" ? "gm-icon-btn-active" : ""}`} type="button">
                  <ControlIcon name="people" />
                  <span className="gm-people-count">{connection.room.participants.length}</span>
                </button>
                <button onClick={() => togglePanel("chat")} className={`gm-icon-btn ${sidePanel === "chat" ? "gm-icon-btn-active" : ""}`} type="button">
                  <ControlIcon name="chat" />
                </button>
              </div>
            </div>

            <div className="gm-bar-attendee-bottom">
              <div className="gm-ctrl-group">
                {connection.livekit?.canPublishAudio ? (
                  <button className={`gm-btn ${media.isMicOn ? "" : "gm-btn-off"}`} type="button" onClick={media.toggleMic} title="Microphone">
                    <ControlIcon name={media.isMicOn ? "mic" : "mic-off"} />
                  </button>
                ) : null}
                {enrollEnabled ? (
                  <button className={`gm-enroll-btn ${paymentComplete ? "gm-enroll-btn-done" : ""}`} type="button" onClick={launchEnrollNow} disabled={paymentLoading || paymentComplete}>
                    <ControlIcon name="offer" />
                    <span>{paymentComplete ? "Enrolled" : "Enroll Now"}</span>
                  </button>
                ) : null}
                <button className={`gm-btn ${handRaised ? "gm-btn-active" : ""}`} type="button" onClick={toggleHandRaised} title="Raise hand"><ControlIcon name="hand" /></button>
              </div>
              <button onClick={() => leaveCurrentRoom("You left the webinar.")} className="gm-btn-hangup" type="button" title="Leave">
                <ControlIcon name="end" />
              </button>
            </div>
          </div>
        </div>

        {sidePanel ? (
          <div className="gm-panel">
            <div className="gm-panel-header">
              <div className="gm-panel-tabs">
                <button onClick={() => setSidePanel("chat")} className={`gm-tab ${sidePanel === "chat" ? "gm-tab-active" : ""}`} type="button">In-call messages</button>
                <button onClick={() => setSidePanel("people")} className={`gm-tab ${sidePanel === "people" ? "gm-tab-active" : ""}`} type="button">
                  People
                  <span className="gm-tab-count">{connection.room.participants.length}</span>
                </button>
              </div>
              <button onClick={() => setSidePanel(null)} className="gm-panel-close" type="button">x</button>
            </div>

            {sidePanel === "chat" ? (
              <div className="gm-panel-body">
                <div className="gm-chat-notice">
                  <span className="gm-notice-icon">i</span>
                  <span>Choose whether your message goes to everyone or only to the hosts.</span>
                </div>
                <div ref={chatRef} className="gm-chat-list">
                  {connection.room.messages.length === 0 ? (
                    <div className="gm-chat-empty">
                      <div className="gm-chat-empty-img">💬</div>
                      <p>No chat messages yet</p>
                    </div>
                  ) : connection.room.messages.map((message) => (
                    <div key={message.id} className={`gm-msg ${message.name === form.name ? "gm-msg-self" : ""} ${message.highlight ? "rounded-2xl border border-amber-300/30 bg-amber-500/10 p-2" : ""}`}>
                      <div className="gm-msg-avatar">{message.name.slice(0, 1).toUpperCase()}</div>
                      <div className="gm-msg-content">
                        <p className="gm-msg-sender">
                          {message.name}
                          {message.name === form.name ? <span className="gm-msg-you"> (you)</span> : null}
                          {message.target === "HOST" ? <span className="gm-msg-you"> · Only host</span> : null}
                          {message.messageType === "TOAST" ? <span className="gm-msg-you"> · Highlighted</span> : null}
                        </p>
                        <p className="gm-msg-text">{message.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="gm-chat-input-area">
                  <div className="mb-2 flex gap-2">
                    <select className="gm-chat-input" value={draftMessageTarget} onChange={(event) => setDraftMessageTarget(event.target.value as "ALL" | "HOST")}>
                      <option value="ALL">Chat to everyone</option>
                      <option value="HOST">Only host</option>
                    </select>
                  </div>
                  <div className="gm-chat-input-row">
                    <input className="gm-chat-input" value={draftMessage} onChange={(event) => setDraftMessage(event.target.value)} placeholder="Send a message" onKeyDown={(event) => event.key === "Enter" && sendChatFromPanel()} />
                    <button className="gm-send-btn" type="button" onClick={sendChatFromPanel} disabled={!draftMessage.trim()}>Send</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="gm-panel-body">
                <p className="gm-people-label">In this call ({connection.room.participants.length})</p>
                {connection.room.participants.map((participant) => (
                  <div key={participant.socketId} className="gm-person">
                    <div className={`gm-person-avatar ${participant.role === "HOST" ? "gm-person-host-av" : ""}`}>{participant.name.slice(0, 1).toUpperCase()}</div>
                    <div className="gm-person-info">
                      <p className="gm-person-name">{participant.name}{participant.attendanceId === connection.attendanceId ? " (You)" : ""}{participant.role === "HOST" ? <span className="gm-person-role"> · Host</span> : null}</p>
                    </div>
                    {participant.isHandRaised ? <span className="gm-hand-badge">Hand Raised</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : showHostCameraRail ? (
          <SideCameraRail
            stream={leadHost?.cameraStream || null}
            label={`${hostLabel} camera`}
            eyebrow="Host camera"
            isCameraOn
          />
        ) : null}
      </div>
    );
  }

  if (role === "HOST") {
    const leadHost = chooseStageCandidate(
      hostStageCandidates,
      media.activeSpeakerIds,
      screenSharePriority,
      localHostStageCandidate?.id,
    );
    const backupHost = chooseStageCandidate(
      hostStageCandidates.filter((participant) => participant.id !== leadHost?.id),
      media.activeSpeakerIds,
      screenSharePriority,
      localHostStageCandidate?.id,
    );
    const leadStageStream = leadHost?.stageStream || null;
    const leadShowsVideo = Boolean(leadStageStream && (leadHost?.isCameraOn || leadHost?.isScreenSharing));
    const localLeadStage = Boolean(leadHost?.id && leadHost.id === localHostStageCandidate?.id);
    const leadCameraPreviewStream = leadHost?.isScreenSharing ? leadHost.cameraStream || null : null;
    const leadHostLabel = leadHost?.name || form.name || "Host Console";
    const raisedHands = connection.room.participants.filter((participant) => participant.role === "ATTENDEE" && participant.isHandRaised);
    const hostSidePreview = leadCameraPreviewStream
      ? {
          stream: leadCameraPreviewStream,
          label: `${leadHostLabel} camera`,
          eyebrow: localLeadStage ? "Your camera" : "Host camera",
          muted: localLeadStage,
          isCameraOn: true,
        }
      : backupHost?.stageStream
        ? {
            stream: backupHost.stageStream,
            label: backupHost.name,
            eyebrow: backupHost.id === localHostStageCandidate?.id ? "Your feed" : "Host feed",
            muted: backupHost.id === localHostStageCandidate?.id,
            isCameraOn: backupHost.isCameraOn || backupHost.isScreenSharing,
          }
        : null;
    const showHostCameraRail = Boolean(!sidePanel && hostSidePreview);

    return (
      <div className="gm-root">
        <div className="gm-main">
          <div className="gm-stage">
            {leadStageStream && !leadShowsVideo ? <AudioStream stream={leadStageStream} /> : null}
            {leadShowsVideo ? (
              <StageVideo stream={leadStageStream} muted={localLeadStage} />
            ) : (
              <div className="gm-avatar-stage">
                <div className="gm-avatar-circle">{leadHostLabel.slice(0, 1).toUpperCase()}</div>
                <p className="gm-avatar-name">{leadHostLabel}</p>
              </div>
            )}

            <div className="gm-name-pill">
              <span>{leadHostLabel}</span>
            </div>

            <div className="gm-live-badge">
              <span className="gm-live-dot" />
              <span>LIVE</span>
            </div>

            {leadHost?.isScreenSharing ? <div className="gm-screen-badge">Presenting</div> : null}

            {connection.activeToast ? <StageToast text={connection.activeToast.text} /> : null}

            {hostSidePreview && !showHostCameraRail ? (
              <div className="gm-host-pip">
                <VideoStream
                  stream={hostSidePreview.stream}
                  muted={hostSidePreview.muted}
                  label={hostSidePreview.label}
                  isCameraOn={hostSidePreview.isCameraOn}
                />
              </div>
            ) : null}

            <div className={`gm-host-offer-status ${connection.webinar?.payment_mode === "TOKEN" ? "gm-host-offer-status-live" : ""}`}>
              {enrollEnabled ? `Enroll Live • ${getActiveEnrollLabel()}` : "Enroll Hidden"}
            </div>
            {raisedHands.length ? (
              <div className="gm-hand-alert">
                <ControlIcon name="hand" />
                <span>{raisedHands.length} hand raised</span>
              </div>
            ) : null}
          </div>

          <div className="gm-bar">
            <div className="gm-bar-left">
              <span className="gm-time">{currentTime}</span>
              <span className="gm-bar-divider">|</span>
              <span className="gm-meeting-code">{roomName}</span>
              <span className="gm-bar-divider">·</span>
              <span className="gm-duration">{duration}</span>
            </div>

            <div className="gm-bar-center">
              <div className="gm-ctrl-group">
                <button className={`gm-btn ${media.isMicOn ? "" : "gm-btn-off"}`} type="button" onClick={media.toggleMic} title="Microphone">
                  <ControlIcon name={media.isMicOn ? "mic" : "mic-off"} />
                </button>
                <button className={`gm-btn ${media.isCameraOn ? "" : "gm-btn-off"}`} type="button" onClick={media.toggleCamera} title="Camera">
                  <ControlIcon name={media.isCameraOn ? "cam" : "cam-off"} />
                </button>
                <button className={`gm-enroll-btn ${enrollEnabled ? "" : "gm-enroll-btn-done"}`} type="button" onClick={toggleEnrollVisibility} title="Toggle Enroll Now">
                  <ControlIcon name="offer" />
                  <span>{enrollEnabled ? "Turn Enroll Off" : "Turn Enroll On"}</span>
                </button>
                <button className={`gm-btn ${media.isScreenSharing ? "gm-btn-active" : ""}`} type="button" onClick={media.toggleScreenShare} title="Screen share">
                  <ControlIcon name="screen" />
                </button>
                <button className={`gm-btn ${sidePanel === "chat" ? "gm-btn-active" : ""}`} type="button" onClick={() => togglePanel("chat")} title="Chat">
                  <ControlIcon name="chat" />
                </button>
              </div>
              <button onClick={() => connection.endMeeting()} className="gm-btn-hangup" type="button" title="End webinar">
                <ControlIcon name="end" />
              </button>
            </div>

            <div className="gm-bar-right">
              <div className="gm-offer-config">
                <div className="gm-offer-toggle">
                  <button type="button" className={hostOfferMode === "FULL" ? "active" : ""} onClick={() => setHostOfferMode("FULL")}>Full</button>
                  <button type="button" className={hostOfferMode === "TOKEN" ? "active" : ""} onClick={() => setHostOfferMode("TOKEN")}>Token</button>
                </div>
                <input className="gm-price-box" value={hostOfferMode === "FULL" ? hostFullAmount : hostTokenAmount} onChange={(event) => hostOfferMode === "FULL" ? setHostFullAmount(event.target.value.replace(/[^\d]/g, "")) : setHostTokenAmount(event.target.value.replace(/[^\d]/g, ""))} />
                <button className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white" type="button" onClick={saveHostOfferConfig}>Save Offer</button>
              </div>
              <button className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/80" type="button" onClick={() => leaveCurrentRoom("You left the host room.")}>Leave</button>
              <button onClick={() => togglePanel("people")} className={`gm-icon-btn ${sidePanel === "people" ? "gm-icon-btn-active" : ""}`} type="button" title="People">
                <ControlIcon name="people" />
                <span className="gm-people-count">{connection.room.participants.length}</span>
              </button>
            </div>
          </div>
        </div>

        {sidePanel ? (
          <div className="gm-panel">
            <div className="gm-panel-header">
              <div className="gm-panel-tabs">
                <button onClick={() => setSidePanel("chat")} className={`gm-tab ${sidePanel === "chat" ? "gm-tab-active" : ""}`} type="button">In-call messages</button>
                <button onClick={() => setSidePanel("people")} className={`gm-tab ${sidePanel === "people" ? "gm-tab-active" : ""}`} type="button">
                  People
                  <span className="gm-tab-count">{connection.room.participants.length}</span>
                </button>
              </div>
              <button onClick={() => setSidePanel(null)} className="gm-panel-close" type="button">x</button>
            </div>

            {sidePanel === "chat" ? (
              <div className="gm-panel-body">
                <div className="gm-chat-notice">
                  <span className="gm-notice-icon">i</span>
                  <span>Host can send a normal chat or a highlighted toast. Toasts appear in chat and at the top of the room.</span>
                </div>
                <div ref={chatRef} className="gm-chat-list">
                  {connection.room.messages.length === 0 ? (
                    <div className="gm-chat-empty">
                      <div className="gm-chat-empty-img">💬</div>
                      <p>No chat messages yet</p>
                    </div>
                  ) : connection.room.messages.map((message) => (
                    <div key={message.id} className={`gm-msg ${message.name === form.name ? "gm-msg-self" : ""} ${message.highlight ? "rounded-2xl border border-amber-300/30 bg-amber-500/10 p-2" : ""}`}>
                      <div className="gm-msg-avatar">{message.name.slice(0, 1).toUpperCase()}</div>
                      <div className="gm-msg-content">
                        <p className="gm-msg-sender">
                          {message.name}
                          {message.name === form.name ? <span className="gm-msg-you"> (you)</span> : null}
                          {message.target === "HOST" ? <span className="gm-msg-you"> · Only host</span> : null}
                          {message.messageType === "TOAST" ? <span className="gm-msg-you"> · Toast</span> : null}
                        </p>
                        <p className="gm-msg-text">{message.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="gm-chat-input-area">
                  <div className="mb-2 flex gap-2">
                    <select className="gm-chat-input" value={draftMessageTarget} onChange={(event) => setDraftMessageTarget(event.target.value as "ALL" | "HOST")}>
                      <option value="ALL">Chat to everyone</option>
                      <option value="HOST">Only hosts</option>
                    </select>
                    <select className="gm-chat-input" value={draftMessageType} onChange={(event) => setDraftMessageType(event.target.value as "CHAT" | "TOAST")}>
                      <option value="CHAT">Chat</option>
                      <option value="TOAST">Toast</option>
                    </select>
                  </div>
                  <div className="gm-chat-input-row">
                    <input className="gm-chat-input" value={draftMessage} onChange={(event) => setDraftMessage(event.target.value)} placeholder={draftMessageType === "TOAST" ? "Highlighted toast message" : "Broadcast a message"} onKeyDown={(event) => event.key === "Enter" && sendChatFromPanel()} />
                    <button className="gm-send-btn" type="button" onClick={sendChatFromPanel} disabled={!draftMessage.trim()}>Send</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="gm-panel-body">
                <p className="gm-people-label">In this call ({connection.room.participants.length})</p>
                {connection.room.participants.map((participant) => (
                  <div key={participant.socketId} className="gm-person">
                    <div className={`gm-person-avatar ${participant.role === "HOST" ? "gm-person-host-av" : ""}`}>{participant.name.slice(0, 1).toUpperCase()}</div>
                    <div className="gm-person-info">
                      <p className="gm-person-name">{participant.name}{participant.attendanceId === connection.attendanceId ? " (You)" : ""}{participant.role === "HOST" ? <span className="gm-person-role"> · Host</span> : null}</p>
                      <p className="text-xs text-white/60">{participant.phone || participant.email || ""}</p>
                    </div>
                    {participant.isHandRaised ? <span className="gm-hand-badge">Hand Raised</span> : null}
                    {participant.socketId !== connection.ownSocketId ? (
                      <div className="gm-person-actions">
                        {participant.role === "ATTENDEE" && !participant.isMicOn ? (
                          <button className="gm-mini-btn gm-mini-btn-accent" type="button" onClick={() => connection.requestUnmute(participant.socketId, participant.name)}>Ask to unmute</button>
                        ) : null}
                        <button className="rounded-full border border-rose-400/30 px-3 py-1 text-xs text-rose-200" type="button" onClick={() => connection.removeParticipant(participant.socketId)}>Remove</button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : showHostCameraRail && hostSidePreview ? (
          <SideCameraRail
            stream={hostSidePreview.stream}
            label={hostSidePreview.label}
            eyebrow={hostSidePreview.eyebrow}
            muted={hostSidePreview.muted}
            isCameraOn={hostSidePreview.isCameraOn}
          />
        ) : null}
      </div>
    );
  }

  const hostSessionLink = connection.session?.short_host_url || connection.webinar?.short_host_url || connection.session?.host_url || connection.webinar?.host_url || "";
  const attendeeSessionLink = connection.session?.short_attendee_url || connection.webinar?.short_attendee_url || connection.session?.attendee_url || connection.webinar?.attendee_url || "";

  return (
    <PublicShell
      title={role === "HOST" ? "Host Console" : "Webinar Experience"}
      description="These room links are live. Join the class, keep the stage on one screen, and trigger enrollment without sending attendees away from the webinar."
    >
      <div className="grid gap-4 xl:grid-cols-[1.7fr_0.9fr]">
        <SectionCard title={connection.webinar?.title || `Room: ${roomName}`} subtitle={connection.session ? `${connection.session.title} | ${formatDateTime(connection.session.start_time)}` : "Loading room"}>
          {!joined && role === "ATTENDEE" ? (
            <div className="space-y-6">
              {connection.webinar ? (
                <WebinarPromoCard
                  webinar={connection.webinar}
                  attendeeCount={activeAttendees.length}
                  ctaLabel={connection.webinar.payment_required ? `Enroll Now • ${formatCurrency((connection.webinar.price_inr || 0) / 100)}` : "Join Webinar"}
                  ctaDisabled
                  secondaryAction={<span className="text-sm text-slate-300">Fill your details below to enter the room.</span>}
                />
              ) : null}

              <div className="grid gap-4 rounded-[28px] border border-white/10 bg-[#0e1118] p-6 md:grid-cols-2">
                <input className="webinar-input" placeholder="Your name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                <input className="webinar-input" placeholder="Phone number" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                <input className="webinar-input md:col-span-2" placeholder="Email address" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                <button className="webinar-cta-button md:col-span-2" type="button" onClick={submitJoin}>Join Webinar Room</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {role === "ATTENDEE" && connection.webinar ? (
                <div className="space-y-4">
                  <WebinarPromoCard
                    webinar={connection.webinar}
                    attendeeCount={activeAttendees.length}
                    ctaLabel={paymentComplete ? "Enrollment Completed" : `Enroll Now • ${formatCurrency((connection.webinar.price_inr || 0) / 100)}`}
                    ctaDisabled={!connection.webinar.payment_required || paymentComplete}
                    ctaBusy={paymentLoading}
                    onCta={launchEnrollNow}
                    secondaryAction={paymentComplete ? <Badge tone="green">Paid</Badge> : <Badge tone="gold">Live Offer</Badge>}
                    eyebrow="Live Conversion Webinar"
                  />
                  {paymentNotice ? (
                    <div className={`rounded-2xl px-4 py-3 text-sm ${paymentComplete ? "border border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border border-amber-400/25 bg-amber-400/10 text-amber-100"}`}>
                      {paymentNotice}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-[28px] border border-[rgba(201,168,76,0.18)] bg-[rgba(0,0,0,0.24)] p-4">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Live Webinar Stage</h3>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Camera, mic, peer video, and chat are active for this room.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {role === "HOST" ? (
                      <>
                        <button className={media.isMicOn ? "btn-primary" : "btn-secondary"} type="button" onClick={media.toggleMic}>
                          {media.isMicOn ? "Mic On" : "Mic Off"}
                        </button>
                        <button className={media.isCameraOn ? "btn-primary" : "btn-secondary"} type="button" onClick={media.toggleCamera}>
                          {media.isCameraOn ? "Camera On" : "Camera Off"}
                        </button>
                      </>
                    ) : (
                      <Badge tone="gold">View-only audio/video</Badge>
                    )}
                  </div>
                </div>

                {!media.hasMediaAccess ? (
                  <div className="mb-4 rounded-2xl border border-[rgba(220,82,82,0.24)] bg-[rgba(220,82,82,0.08)] p-4 text-sm text-[var(--danger)]">
                    Camera/mic permission is blocked or unavailable. Allow browser permission and refresh if you want live audio/video.
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  <VideoStream stream={media.localScreenStream || media.localStream} muted label={`${form.name || role} (You)`} isCameraOn={media.isCameraOn || media.isScreenSharing} />
                  {remoteParticipants.length ? remoteParticipants.map((participant) => (
                    <VideoStream
                      key={participant.socketId}
                      stream={media.remoteStreams.get(participant.attendanceId) || null}
                      label={`${participant.name} ${participant.isMicOn ? "Mic on" : "Mic off"}`}
                      isCameraOn={participant.isCameraOn || participant.isScreenSharing}
                    />
                  )) : (
                    <div className="flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-[rgba(201,168,76,0.2)] bg-[rgba(255,255,255,0.04)] p-6 text-center text-sm text-[var(--text-secondary)]">
                      Open the other link in a second browser to see host/attendee video here.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[22px] border border-[rgba(201,168,76,0.16)] bg-[rgba(0,0,0,0.24)] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Room</div>
                  <div className="mt-2 font-mono text-sm">{roomName}</div>
                </div>
                <div className="rounded-[22px] border border-[rgba(201,168,76,0.16)] bg-[rgba(0,0,0,0.24)] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Live Participants</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{connection.room.participants.length}</div>
                </div>
                <div className="rounded-[22px] border border-[rgba(201,168,76,0.16)] bg-[rgba(0,0,0,0.24)] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Attendees</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{activeAttendees.length}</div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[rgba(201,168,76,0.16)] bg-[rgba(0,0,0,0.24)] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Class Feed</h3>
                  <Badge tone={role === "HOST" ? "purple" : "green"}>{role}</Badge>
                </div>
                <div className="max-h-[320px] space-y-3 overflow-y-auto">
                  {connection.room.messages.length ? connection.room.messages.map((message) => (
                    <div key={message.id} className="rounded-2xl border border-[rgba(201,168,76,0.12)] bg-[rgba(255,255,255,0.04)] p-4">
                      <div className="text-sm font-medium text-white">{message.name}</div>
                      <div className="mt-1 text-sm text-[var(--text-secondary)]">{message.text}</div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-[rgba(201,168,76,0.2)] p-6 text-center text-sm text-[var(--text-secondary)]">
                      The room is live. Messages between host and attendees will appear here.
                    </div>
                  )}
                </div>
                <div className="mt-4 flex gap-3">
                  <input className="input-dark flex-1" value={draftMessage} onChange={(event) => setDraftMessage(event.target.value)} placeholder={role === "HOST" ? "Broadcast a message to attendees" : "Send a message"} />
                  <button
                    className="btn-primary"
                    type="button"
                    onClick={() => {
                      connection.sendMessage(draftMessage);
                      setDraftMessage("");
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Session Panel">
          <div className="space-y-3">
            {role === "ATTENDEE" && connection.webinar?.payment_required ? (
              <div className="rounded-2xl border border-[rgba(220,124,47,0.24)] bg-[rgba(220,124,47,0.08)] p-4 text-sm text-white">
                <div className="text-xs uppercase tracking-[0.18em] text-orange-200">Offer Panel</div>
                <div className="mt-2 text-lg font-semibold">{formatCurrency((connection.webinar.price_inr || 0) / 100)}</div>
                <div className="mt-1 text-slate-300">Enroll without leaving this webinar page.</div>
                <button className="webinar-cta-button mt-4 w-full" type="button" onClick={launchEnrollNow} disabled={paymentLoading || paymentComplete}>
                  {paymentComplete ? "Payment Completed" : paymentLoading ? "Opening Razorpay..." : "Enroll Now"}
                </button>
              </div>
            ) : null}
            <div className="rounded-2xl border border-[rgba(201,168,76,0.14)] p-4 text-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Session</div>
              <div className="mt-2 font-semibold text-[var(--text-strong)]">{connection.session?.title || "-"}</div>
              <div className="mt-1 text-[var(--text-secondary)]">{connection.webinar?.category || "-"}</div>
            </div>
            <div className="rounded-2xl border border-[rgba(201,168,76,0.14)] p-4 text-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Links</div>
              <div className="gm-link-stack">
                <div className="gm-link-card">
                  <div className="gm-link-card-top">
                    <span className="gm-link-card-label">Host URL</span>
                    <button className="gm-link-copy-btn" type="button" onClick={() => copySessionLink("Host", hostSessionLink)} disabled={!hostSessionLink}>Copy</button>
                  </div>
                  <a className="text-link gm-link-card-url" href={hostSessionLink} target="_blank" rel="noreferrer">{hostSessionLink || "-"}</a>
                </div>
                <div className="gm-link-card">
                  <div className="gm-link-card-top">
                    <span className="gm-link-card-label">Attendee URL</span>
                    <button className="gm-link-copy-btn" type="button" onClick={() => copySessionLink("Attendee", attendeeSessionLink)} disabled={!attendeeSessionLink}>Copy</button>
                  </div>
                  <a className="text-link gm-link-card-url" href={attendeeSessionLink} target="_blank" rel="noreferrer">{attendeeSessionLink || "-"}</a>
                </div>
              </div>
              {linkCopyNotice ? <div className="gm-link-copy-notice">{linkCopyNotice}</div> : null}
            </div>
            <div className="rounded-2xl border border-[rgba(201,168,76,0.14)] p-4 text-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Participants</div>
              <div className="mt-3 space-y-2">
                {connection.room.participants.map((participant) => (
                  <div key={participant.socketId} className="flex items-center justify-between rounded-xl bg-[rgba(255,255,255,0.04)] px-3 py-2">
                    <span>{participant.name}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={participant.isMicOn ? "green" : "red"}>{participant.isMicOn ? "Mic" : "Muted"}</Badge>
                      <Badge tone={participant.isCameraOn ? "green" : "gold"}>{participant.isCameraOn ? "Cam" : "No Cam"}</Badge>
                      <Badge tone={participant.role === "HOST" ? "purple" : "green"}>{participant.role}</Badge>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {role === "HOST" ? (
              <div className="space-y-2">
                <button className="btn-primary w-full" type="button" onClick={() => connection.sendMessage("Welcome everyone. We are starting now.")}>Welcome Broadcast</button>
                <button className="btn-secondary w-full" type="button" onClick={() => connection.sendMessage("Tap the Enroll Now button inside the webinar to open Razorpay without leaving the room.")}>Share Offer Prompt</button>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </PublicShell>
  );
}

export function WebinarAttendPage({ roomName }: { roomName: string }) {
  return <WebinarRoomPage role="ATTENDEE" roomName={roomName} />;
}

export function WebinarHostPage({ roomName }: { roomName: string }) {
  return <WebinarRoomPage role="HOST" roomName={roomName} />;
}
