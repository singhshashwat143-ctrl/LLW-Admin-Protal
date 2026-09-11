import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../lib/api";

// Public "reserve your seat" page for a webinar. Captures the registrant, and
// (if the browser allows) subscribes them to Web Push so the server can fire a
// reminder 15 / 10 / 5 minutes before the class starts. The push plumbing lives
// in /sw.js (service worker) + /api/rooms/:roomName/register (server).

type RegisterWebinar = {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  status: string;
  attendee_url: string;
  livekit_room_name: string;
};

const pushSupported =
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  typeof window !== "undefined" &&
  "PushManager" in window &&
  "Notification" in window;

// VAPID application server keys are base64url; the Push API wants a Uint8Array.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function useCountdown(targetIso: string): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const target = new Date(targetIso).getTime();
  if (!Number.isFinite(target)) return "";
  const diff = target - Date.now();
  if (diff <= 0) return "Starting now";
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((diff % 60000) / 1000);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function WebinarRegisterPage({ roomName }: { roomName: string }) {
  const [webinar, setWebinar] = useState<RegisterWebinar | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [formError, setFormError] = useState("");

  const [remindersOn, setRemindersOn] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderNote, setReminderNote] = useState("");

  const savedContact = useRef<{ name: string; email: string; phone: string } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<{ ok: boolean; webinar: RegisterWebinar }>(`/api/rooms/${roomName}`)
      .then((response) => {
        if (!active) return;
        setWebinar(response.webinar);
      })
      .catch(() => {
        if (active) setLoadError("We couldn't find this class. Please check the link.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [roomName]);

  const countdown = useCountdown(webinar?.start_time || "");
  const startsLabel = useMemo(() => (webinar ? formatWhen(webinar.start_time) : ""), [webinar]);
  const isEnded = String(webinar?.status || "").toUpperCase() === "ENDED";
  const startMs = webinar ? new Date(webinar.start_time).getTime() : NaN;
  const canJoinNow = Number.isFinite(startMs) && Date.now() >= startMs - 5 * 60000 && !isEnded;

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!name.trim()) {
      setFormError("Please enter your name.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setFormError("Enter your email or phone number so we can reach you.");
      return;
    }
    setSubmitting(true);
    try {
      await api(`/api/rooms/${roomName}/register`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() }),
      });
      savedContact.current = { name: name.trim(), email: email.trim(), phone: phone.trim() };
      setRegistered(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function enableReminders() {
    if (!pushSupported) {
      setReminderNote("This browser can't show reminders. Please bookmark this page and join at the scheduled time.");
      return;
    }
    setReminderBusy(true);
    setReminderNote("");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setReminderNote("Reminders are blocked. Allow notifications in your browser to get a 15/10/5-minute alert.");
        return;
      }

      const keyResponse = await api<{ ok: boolean; key: string; enabled: boolean }>("/api/push/vapid-public-key");
      if (!keyResponse.key || !keyResponse.enabled) {
        setReminderNote("Reminders aren't available right now, but your seat is reserved. Please join at the scheduled time.");
        return;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          // Cast: the Push API accepts a Uint8Array here, but the DOM lib types
          // the field as BufferSource with an ArrayBuffer (not ArrayBufferLike).
          applicationServerKey: urlBase64ToUint8Array(keyResponse.key) as unknown as BufferSource,
        });
      }

      const contact = savedContact.current || { name: name.trim(), email: email.trim(), phone: phone.trim() };
      await api(`/api/rooms/${roomName}/register`, {
        method: "POST",
        body: JSON.stringify({ ...contact, subscription: subscription.toJSON() }),
      });
      setRemindersOn(true);
      setReminderNote("");
    } catch (error) {
      setReminderNote(error instanceof Error ? error.message : "Couldn't turn on reminders. Please try again.");
    } finally {
      setReminderBusy(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-[var(--bg-primary)]" />;
  }

  if (loadError || !webinar) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Class not found</h1>
          <p className="mt-2 text-sm text-slate-500">{loadError || "This registration link is invalid."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] shadow-sm overflow-hidden">
          <div className="bg-[var(--accent)] px-6 py-5 text-white">
            <div className="text-xs uppercase tracking-[0.22em] opacity-80">Live class registration</div>
            <h1 className="mt-1 text-2xl font-bold leading-tight">{webinar.title}</h1>
          </div>

          <div className="px-6 py-5">
            {startsLabel && (
              <div className="flex items-center justify-between rounded-xl bg-[var(--accent-soft)] px-4 py-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Starts</div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{startsLabel}</div>
                </div>
                {!isEnded && (
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Countdown</div>
                    <div className="text-sm font-semibold text-[var(--accent)]">{countdown}</div>
                  </div>
                )}
              </div>
            )}

            {webinar.description && (
              <p className="mt-4 text-sm leading-relaxed text-slate-500">{webinar.description}</p>
            )}

            {isEnded ? (
              <div className="mt-5 rounded-xl border border-[var(--border)] px-4 py-4 text-center text-sm text-slate-500">
                This class has ended. Registration is closed.
              </div>
            ) : !registered ? (
              <form className="mt-5 space-y-3" onSubmit={handleRegister}>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Your name</label>
                  <input
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Full name"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                  <input
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    type="email"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Phone (WhatsApp)</label>
                  <input
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+91…"
                    type="tel"
                    autoComplete="tel"
                  />
                </div>
                {formError && <p className="text-sm text-red-500">{formError}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
                >
                  {submitting ? "Reserving…" : "Reserve my seat"}
                </button>
              </form>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  ✓ You're registered, {savedContact.current?.name || "there"}. We'll hold your seat.
                </div>

                {!remindersOn ? (
                  <div className="rounded-xl border border-[var(--border)] px-4 py-4">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Get a reminder before it starts</div>
                    <p className="mt-1 text-xs text-slate-500">
                      We'll notify you 15, 10 and 5 minutes before the class — even if this tab is closed.
                    </p>
                    <button
                      onClick={enableReminders}
                      disabled={reminderBusy}
                      className="mt-3 w-full rounded-xl border border-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] transition disabled:opacity-60"
                    >
                      {reminderBusy ? "Enabling…" : "🔔 Enable reminders"}
                    </button>
                    {reminderNote && <p className="mt-2 text-xs text-amber-600">{reminderNote}</p>}
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    🔔 Reminders are on. Watch for alerts 15, 10 and 5 minutes before we go live.
                  </div>
                )}

                <a
                  href={webinar.attendee_url}
                  className={`block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${
                    canJoinNow
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] text-slate-500"
                  }`}
                >
                  {canJoinNow ? "Join the class now →" : "Join link (opens when class starts)"}
                </a>
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">Livelong Wealth · Live classes</p>
      </div>
    </div>
  );
}
