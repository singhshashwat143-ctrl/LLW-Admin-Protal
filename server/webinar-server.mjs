import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { Server } from "socket.io";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { TrackSource } from "@livekit/protocol";
import { constants, createDashboardStore } from "./data-store.mjs";
import { createGoogleSheetsMirror } from "./google-sheets-sync.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distPath = join(__dirname, "..", "dist");
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: false },
});
const store = await createDashboardStore();
const port = Number(process.env.PORT || 4000);
const pyMdApiKey = process.env.PYMD_API_KEY || "";
const pyMdBaseUrl = "https://py.md/api";
const pyMdCustomDomain = process.env.PYMD_DOMAIN || "";
const publicAppUrl = (process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");
const googleSheetsMirror = createGoogleSheetsMirror({ appUrl: publicAppUrl });
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || "";
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "";
const razorpayBaseUrl = "https://api.razorpay.com/v1";
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const aisensyApiKey = process.env.AISSENSY_API_KEY || process.env.AISENSY_API_KEY || "";
const aisensyPaymentLinkCampaign = process.env.AISSENSY_PAYMENT_LINK_CAMPAIGN || "payment_link_onboarding_2";
const aisensyWebhookUrl = process.env.AISSENSY_WEBHOOK_URL || "";
const sessionSecret = process.env.SESSION_SECRET || "llw-demo-session-secret";
const livekitUrl = process.env.LIVEKIT_URL || process.env.LIVEKIT_HOST_URL || "";
const livekitApiKey = process.env.LIVEKIT_API_KEY || "";
const livekitApiSecret = process.env.LIVEKIT_API_SECRET || "";
const livekitControlUrl = livekitUrl.startsWith("wss://")
  ? `https://${livekitUrl.slice("wss://".length)}`
  : livekitUrl.startsWith("ws://")
    ? `http://${livekitUrl.slice("ws://".length)}`
    : livekitUrl;
const roomService = livekitControlUrl && livekitApiKey && livekitApiSecret
  ? new RoomServiceClient(livekitControlUrl, livekitApiKey, livekitApiSecret)
  : null;
const googleOauthClient = new OAuth2Client(googleClientId, googleClientSecret);
const roomPresence = new Map();
const roomChats = new Map();
const socketRoomMeta = new Map();

app.use(cors());
app.use(express.json());

function withAbsolute(req, path) {
  if (!path) return path;
  if (path.startsWith("http")) return path;
  return `${req.protocol}://${req.get("host")}${path}`;
}

async function flushStore() {
  await store.flush();
  try {
    await googleSheetsMirror.syncDiff(store, { reason: "store-flush" });
  } catch (error) {
    console.error("Google Sheets incremental sync failed:", error instanceof Error ? error.message : error);
  }
}

function queueStoreFlush(context = "Deferred store flush failed") {
  void flushStore().catch((error) => {
    console.error(context, error instanceof Error ? error.message : error);
  });
}

async function flushStoreWithResponseBudget({
  timeoutMs = 1500,
  context = "Deferred store flush failed",
} = {}) {
  let completed = false;
  const flushPromise = flushStore()
    .then(() => {
      completed = true;
    })
    .catch((error) => {
      completed = true;
      throw error;
    });

  await Promise.race([
    flushPromise,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);

  if (!completed) {
    void flushPromise.catch((error) => {
      console.error(context, error instanceof Error ? error.message : error);
    });
  }
}

function serializeWebinar(req, webinar) {
  if (!webinar) return null;
  return {
    ...webinar,
    host_url: withAbsolute(req, webinar.host_url),
    attendee_url: withAbsolute(req, webinar.attendee_url),
    short_host_url: withAbsolute(req, webinar.short_host_url),
    short_attendee_url: withAbsolute(req, webinar.short_attendee_url),
  };
}

function serializeSession(req, session) {
  if (!session) return null;
  return {
    ...session,
    host_url: withAbsolute(req, session.host_url),
    attendee_url: withAbsolute(req, session.attendee_url),
    short_host_url: withAbsolute(req, session.short_host_url),
    short_attendee_url: withAbsolute(req, session.short_attendee_url),
  };
}

function serializeLink(req, link) {
  if (!link) return null;
  const storedShort = link.short_path || link.short_url || "";
  if (String(link.short_url || "").startsWith("http://") || String(link.short_url || "").startsWith("https://")) {
    return {
      ...link,
      slug: link.slug || new URL(link.short_url).pathname.replace(/^\//, ""),
      short_path: link.short_path || new URL(link.short_url).pathname,
      short_url: link.short_url,
    };
  }
  let shortPath = storedShort;
  if (storedShort.startsWith("https://llw.local/")) {
    shortPath = new URL(storedShort).pathname;
  }
  return {
    ...link,
    slug: link.slug || shortPath.replace(/^\//, ""),
    short_path: shortPath.startsWith("/") ? shortPath : `/${shortPath}`,
    short_url: withAbsolute(req, shortPath),
  };
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);
}

function createPyMdAlias(base) {
  const prefix = "llw";
  const cleaned = slugify(base).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 8);
  const body = `${cleaned}${random}`.slice(0, 11);
  return `${prefix}${body}`.slice(0, 15);
}

function normalizeAliasSuffix(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 11);
}

function createEditableAlias(suffix = "", fallbackBase = "") {
  const normalized = normalizeAliasSuffix(suffix);
  if (normalized) {
    return `llw-${normalized}`.slice(0, 15);
  }
  const generated = createPyMdAlias(fallbackBase);
  return generated.startsWith("llw-") ? generated : `llw-${generated.slice(3)}`.slice(0, 15);
}

function withPublicAbsolute(req, path) {
  if (!path) return path;
  if (path.startsWith("http")) return path;
  if (publicAppUrl) return `${publicAppUrl}${path}`;
  return withAbsolute(req, path);
}

async function createPyMdShortLink({ target, label, preferredSlug, domain }) {
  if (!pyMdApiKey) {
    throw new Error("Missing PYMD API key");
  }

  const payload = {
    target,
    description: label,
    reuse: true,
    customurl: preferredSlug || undefined,
    domain: domain || pyMdCustomDomain || undefined,
  };

  const response = await fetch(`${pyMdBaseUrl}/links`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": pyMdApiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PyMD create failed: ${response.status} ${body}`);
  }

  const link = await response.json();
  return {
    slug: link.address,
    short_url: link.link,
  };
}

function buildRazorpayAuthHeader() {
  const token = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");
  return `Basic ${token}`;
}

async function razorpayRequest(path, init = {}) {
  const response = await fetch(`${razorpayBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: buildRazorpayAuthHeader(),
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Razorpay request failed: ${response.status} ${body}`);
  }

  return response.json();
}

async function createRazorpayOrder(order, customer = {}) {
  return razorpayRequest("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: Number(order.amount_inr || 0),
      currency: "INR",
      receipt: order.order_number || order.transaction_id || order.id,
      notes: {
        local_order_id: order.order_id || order.id,
        local_payment_id: order.id || "",
        student_name: customer.student_name || customer.name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        source: customer.source || order.utm_source || "admin",
      },
    }),
  });
}

async function fetchRazorpayOrderPayments(razorpayOrderId) {
  return razorpayRequest(`/orders/${razorpayOrderId}/payments`, {
    method: "GET",
  });
}

function normalizeAiSensyPhone(phone = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

async function sendAiSensyCampaign(payload) {
  const response = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }

  if (!response.ok) {
    throw new Error(
      typeof body === "object" && body?.message
        ? body.message
        : `AiSensy request failed: ${response.status}${raw ? ` ${raw}` : ""}`,
    );
  }

  return body;
}

function getAiSensyErrorMessage(error) {
  if (!error) return "";
  if (error instanceof Error) return error.message || "";
  return String(error);
}

function attachRazorpayOrder(order, razorpayOrder) {
  order.razorpay_order_id = razorpayOrder.id;
  order.gateway_provider = "RAZORPAY";
  order.gateway_mode = "test";
  order.currency = razorpayOrder.currency || "INR";
  order.updated_at = new Date().toISOString();
}

function extractSlugFromLink(link) {
  if (!link) return "";
  try {
    if (String(link).startsWith("http")) {
      return new URL(link).pathname.replace(/^\//, "");
    }
  } catch {
    // Ignore URL parsing errors and fall back to a path slug.
  }
  return String(link).replace(/^\//, "");
}

function updatePaymentLinkRecord(paymentId, shortUrl) {
  const payment = store.getPaymentRecord(paymentId);
  if (!payment) return null;

  const slug = extractSlugFromLink(shortUrl);
  payment.payment_link = shortUrl;
  payment.slug = slug;
  payment.updated_at = new Date().toISOString();

  const linkRecord = store.data.links.find((item) => item.original_url === `/payment/${paymentId}`);
  if (linkRecord) {
    linkRecord.slug = slug;
    linkRecord.short_path = shortUrl.startsWith("http") ? new URL(shortUrl).pathname : `/${slug}`;
    linkRecord.short_url = shortUrl;
  }

  return payment;
}

function queueDeferredPaymentSetup(req, created, payload = {}) {
  const paymentId = created?.payment?.id;
  if (!paymentId) return;

  void (async () => {
    const payment = store.getPaymentRecord(paymentId);
    if (!payment || payment.method !== "RAZORPAY") {
      return;
    }

    const shouldCollectCustomerDetails = Boolean(created.order?.collect_customer_details_on_checkout);
    let changed = false;

    try {
      if (!shouldCollectCustomerDetails && !payment.razorpay_order_id) {
        const student = created.order.student || created.order?.student || {};
        const razorpayOrder = await createRazorpayOrder(
          {
            id: payment.id,
            order_id: payment.order_id,
            order_number: created.order.order_number,
            transaction_id: payment.transaction_id,
            amount_inr: payment.amount_inr,
            utm_source: created.order.source || created.order.utm_source,
          },
          {
            student_name: student?.name,
            phone: student?.phone,
            email: student?.email,
            source: created.order.source || created.order.utm_source,
          },
        );
        store.attachRazorpayOrderToPayment(payment.id, razorpayOrder);
        changed = true;
      }

      if (pyMdApiKey) {
        const target = resolveShortenerTarget(req, `/payment/__placeholder__`, true);
        const external = await createPyMdShortLink({
          target: target.replace("/__placeholder__", `/${payment.id}`),
          label: `Payment ${created.order.offer_title || created.order.product?.name || created.order.student?.name || created.order.order_number || payment.id}`,
          preferredSlug: createEditableAlias(
            payload?.alias_suffix || payload?.short_alias || payload?.shortAlias,
            created.order.offer_title || created.order.product?.name || created.order.student?.name || created.order.order_number || "payment",
          ),
        });
        updatePaymentLinkRecord(payment.id, external.short_url);
        changed = true;
      }

      if (changed) {
        store.save();
        queueStoreFlush("Deferred payment setup flush failed:");
      }
    } catch (error) {
      console.error("Deferred payment setup failed:", error instanceof Error ? error.message : error);
    }
  })();
}

function finalizePaymentCreation(req, created, payload = {}) {
  const payment = store.getPaymentRecord(created.payment.id);
  if (!payment) {
    throw new Error("Payment record not found");
  }

  if (payment.method === "RAZORPAY") {
    // Persist the working local link immediately and warm up external integrations in the background.
    queueDeferredPaymentSetup(req, created, payload);
  }

  const responsePayment = store.getPaymentRecord(payment.id);
  const responsePaymentLink = responsePayment?.payment_link
    ? withAbsolute(req, responsePayment.payment_link)
    : "";

  return {
    order: store.attachOrder(store.data.orders.find((entry) => entry.id === payment.order_id)),
    payment: responsePayment
      ? {
          ...responsePayment,
          payment_link: responsePaymentLink || responsePayment.payment_link,
        }
      : null,
    link: responsePayment?.payment_link
      ? {
          short_url: responsePaymentLink || responsePayment.payment_link,
          slug: responsePayment.slug || extractSlugFromLink(responsePayment.payment_link),
        }
      : null,
  };
}

function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const digest = createHmac("sha256", razorpayKeySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return digest === signature;
}

function maskSecret(secret = "") {
  if (!secret) return "";
  if (secret.length <= 8) return `${secret.slice(0, 2)}••••`;
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}

function createSessionToken(user) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Date.now(),
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function getUserFromSessionToken(token) {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expectedSignature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  if (signature !== expectedSignature) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const user = store.data.team.find(
      (item) => item.id === session.sub && String(item.email || "").toLowerCase() === String(session.email || "").toLowerCase(),
    );
    if (!user || user.is_active === false) return null;
    return user;
  } catch {
    return null;
  }
}

function getCurrentUser(req) {
  const authHeader = String(req.get("authorization") || "");
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  return getUserFromSessionToken(token);
}

function requireAuthenticatedUser(req, res) {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ ok: false, message: "Please sign in again to continue." });
    return null;
  }
  return user;
}

function normalizeUserRole(user) {
  const role = String(user?.role || "BDA").toUpperCase();
  if (["SUPER_ADMIN", "ADMIN", "BDM", "OPERATIONS", "MARKETING"].includes(role)) {
    return role;
  }
  return "BDA";
}

function isAdminUser(user) {
  return ["ADMIN", "SUPER_ADMIN"].includes(normalizeUserRole(user));
}

function isManagerUser(user) {
  return normalizeUserRole(user) === "BDM";
}

function isOperationsUser(user) {
  return normalizeUserRole(user) === "OPERATIONS";
}

function isMarketingUser(user) {
  return normalizeUserRole(user) === "MARKETING";
}

function canJoinAsHost(user) {
  return isAdminUser(user);
}

function getStoredTeamMember(user) {
  if (!user) return null;
  const email = String(user.email || "").toLowerCase();
  return store.data.team.find(
    (member) => member.id === user.id || String(member.email || "").toLowerCase() === email,
  ) ?? null;
}

function getManagerScope(user) {
  const member = getStoredTeamMember(user) || user || {};
  return {
    id: String(member.id || user?.id || ""),
    name: String(member.name || user?.name || ""),
    teamName: String(member.team_name || user?.team_name || "").trim(),
  };
}

function isBdaInManagerScope(managerUser, member) {
  if (!member || normalizeUserRole(member) !== "BDA") return false;
  const scope = getManagerScope(managerUser);
  const memberTeamName = String(member.team_name || "").trim();
  const memberManagerName = String(member.manager_name || "").trim();
  return Boolean(
    (scope.teamName && memberTeamName === scope.teamName)
    || (scope.name && memberManagerName === scope.name),
  );
}

async function createLiveKitToken({ roomName, identity, name, canPublish, canPublishData = false, canPublishSources }) {
  if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
    return null;
  }
  const token = new AccessToken(livekitApiKey, livekitApiSecret, {
    identity,
    name,
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canPublishData,
    canPublishSources,
    canSubscribe: true,
  });
  return token.toJwt();
}

async function updateParticipantPublishPermission(roomName, identity, canPublish, canPublishSources = []) {
  if (!roomService) {
    throw new Error("LiveKit room service is not configured.");
  }
  return roomService.updateParticipant(roomName, identity, {
    permission: {
      canSubscribe: true,
      canPublish,
      canPublishData: false,
      canPublishSources,
    },
  });
}

function requireAdminPermission(req, res, message = "This action requires admin approval.") {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return null;
  if (!isAdminUser(user)) {
    res.status(403).json({ ok: false, message });
    return null;
  }
  return user;
}

function requireOperationsPermission(req, res, message = "Only operations, admin, and super-admin users can access this area.") {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return null;
  if (!(isOperationsUser(user) || isAdminUser(user))) {
    res.status(403).json({ ok: false, message });
    return null;
  }
  return user;
}

function requireSettingsPermission(req, res, message = "Only managers, admin, and super-admin users can access settings.") {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return null;
  if (!(isManagerUser(user) || isAdminUser(user))) {
    res.status(403).json({ ok: false, message });
    return null;
  }
  return user;
}

function requireMarketingPermission(req, res, message = "Only marketing, admin, and super-admin users can access marketing spend.") {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return null;
  if (!(isMarketingUser(user) || isAdminUser(user))) {
    res.status(403).json({ ok: false, message });
    return null;
  }
  return user;
}

function getManagedBdaIds(user) {
  const role = normalizeUserRole(user);
  if (isAdminUser(user) || isOperationsUser(user)) {
    return store.data.team.filter((member) => normalizeUserRole(member) === "BDA").map((member) => member.id);
  }
  if (role === "BDM") {
    return store.data.team.filter((member) => isBdaInManagerScope(user, member)).map((member) => member.id);
  }
  if (role === "BDA") {
    return [user.id];
  }
  return [];
}

function scopeOrderRowsForUser(user, rows) {
  if (isAdminUser(user) || isOperationsUser(user)) {
    return rows;
  }
  if (isManagerUser(user)) {
    const managedBdaIds = new Set(getManagedBdaIds(user));
    const scope = getManagerScope(user);
    return rows.filter((row) => (
      managedBdaIds.has(String(row.bda?.id || row.bda_id || ""))
      || (scope.teamName && String(row.team_name || "").trim() === scope.teamName)
      || String(row.manager_name || "").trim() === scope.name
      || row.created_by_user_id === scope.id
    ));
  }
  return rows.filter((row) => row.bda?.id === user.id || row.bda_id === user.id || row.created_by_user_id === user.id);
}

function scopeStudentRowsForUser(user, students) {
  if (isAdminUser(user) || isOperationsUser(user)) {
    return students;
  }
  const visibleStudentIds = new Set(scopeOrderRowsForUser(user, store.getOrders()).map((order) => order.student?.id || order.student_id).filter(Boolean));
  return students.filter((student) => visibleStudentIds.has(student.id));
}

function scopeLeaderboardForUser(user, leaderboard) {
  if (isAdminUser(user) || isOperationsUser(user)) {
    return leaderboard;
  }
  if (isManagerUser(user)) {
    const managedBdaIds = new Set(getManagedBdaIds(user));
    const scope = getManagerScope(user);
    return leaderboard.filter((entry) => (
      managedBdaIds.has(String(entry.id || ""))
      || (scope.teamName && String(entry.team_name || "").trim() === scope.teamName)
      || String(entry.manager_name || "").trim() === scope.name
    ));
  }
  const userEmail = String(user.email || "").trim().toLowerCase();
  return leaderboard.filter((entry) => (
    entry.id === user.id
    || (userEmail && String(entry.email || "").trim().toLowerCase() === userEmail)
  ));
}

function scopeManagerSummaryForUser(user, managerSummary) {
  if (isAdminUser(user) || isOperationsUser(user)) {
    return managerSummary;
  }
  if (isManagerUser(user)) {
    const scope = getManagerScope(user);
    return managerSummary.filter((entry) => (
      (scope.teamName && String(entry.team_name || "").trim() === scope.teamName)
      || String(entry.manager_name || "").trim() === scope.name
    ));
  }
  return [];
}

function formatLocalDateInput(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDefaultDashboardRange() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 29);
  return {
    start,
    end,
    dateFrom: formatLocalDateInput(start),
    dateTo: formatLocalDateInput(end),
  };
}

function parseLocalDateValue(value, endOfDay = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const [, year, month, day] = match;
  return endOfDay
    ? new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999)
    : new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
}

function parseLocalMonthValue(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const [, year, month] = match;
  return new Date(Number(year), Number(month) - 1, 1, 0, 0, 0, 0);
}

function buildDashboardGraphFilter(query = {}) {
  const month = String(query.month || "").trim();
  let dateFrom = String(query.dateFrom || "").trim();
  let dateTo = String(query.dateTo || "").trim();
  const defaultRange = buildDefaultDashboardRange();

  if ((!dateFrom || !dateTo) && month) {
    const monthStart = parseLocalMonthValue(month);
    if (monthStart) {
      if (!dateFrom) {
        dateFrom = formatLocalDateInput(monthStart);
      }
      if (!dateTo) {
        dateTo = formatLocalDateInput(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));
      }
    }
  }

  let start = parseLocalDateValue(dateFrom, false);
  let end = parseLocalDateValue(dateTo, true);

  if (start && !end) {
    end = new Date();
    end.setHours(23, 59, 59, 999);
  } else if (!start && end) {
    start = new Date(end);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 29);
  } else if (!start && !end) {
    start = defaultRange.start;
    end = defaultRange.end;
  }

  if (start && end && start.getTime() > end.getTime()) {
    const normalizedEnd = new Date(start);
    normalizedEnd.setHours(23, 59, 59, 999);
    const normalizedStart = new Date(end);
    normalizedStart.setHours(0, 0, 0, 0);
    start = normalizedStart;
    end = normalizedEnd;
  }

  const monthLabel = month
    ? new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : "";
  const normalizedDateFrom = start ? formatLocalDateInput(start) : "";
  const normalizedDateTo = end ? formatLocalDateInput(end) : "";
  const isDefaultRange = !month && normalizedDateFrom === defaultRange.dateFrom && normalizedDateTo === defaultRange.dateTo;
  const label = isDefaultRange
    ? "Last 30 days"
    : start && end
    ? monthLabel || `${start.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} - ${end.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
    : "Last 30 days";

  return {
    month,
    dateFrom: normalizedDateFrom,
    dateTo: normalizedDateTo,
    start,
    end,
    label,
  };
}

function canAccessOrder(user, order) {
  if (!order) return false;
  if (isAdminUser(user) || isOperationsUser(user)) {
    return true;
  }
  if (isManagerUser(user)) {
    const scope = getManagerScope(user);
    return (
      (scope.teamName && String(order.team_name || "").trim() === scope.teamName)
      || String(order.manager_name || "").trim() === scope.name
    );
  }
  return order.bda?.id === user.id || order.bda_id === user.id;
}

function buildScopedCashVsValueSeries(orders, graphFilter = {}) {
  const start = graphFilter.start ? new Date(graphFilter.start) : new Date();
  const end = graphFilter.end ? new Date(graphFilter.end) : new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const rows = [];
  for (let day = new Date(start), index = 0; day.getTime() <= end.getTime() && index < 366; day.setDate(day.getDate() + 1), index += 1) {
    const next = new Date(day);
    next.setDate(day.getDate() + 1);

    const soldValue = orders
      .filter((order) => {
        const created = new Date(order.created_at).getTime();
        return created >= day.getTime() && created < next.getTime();
      })
      .reduce((sum, order) => sum + Number(order.product_value_inr || 0), 0);

    const grossCollections = orders
      .flatMap((order) => order.payment_history || [])
      .filter((payment) => {
        if (payment.status !== "PAID" || !payment.paid_at) return false;
        const paidAt = new Date(payment.paid_at).getTime();
        return paidAt >= day.getTime() && paidAt < next.getTime();
      })
      .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0);

    const refundedAmount = orders
      .flatMap((order) => order.refund_history || [])
      .filter((refund) => {
        if (refund.status !== "APPROVED") return false;
        const approvedAt = new Date(refund.approved_at || refund.updated_at || refund.created_at).getTime();
        return approvedAt >= day.getTime() && approvedAt < next.getTime();
      })
      .reduce((sum, refund) => sum + Number(refund.amount_inr || 0), 0);

    rows.push({
      label: day.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      date: formatLocalDateInput(day),
      soldValue,
      cashInHand: Math.max(grossCollections - refundedAmount, 0),
    });
  }

  return {
    rows,
    filters: {
      month: graphFilter.month || "",
      dateFrom: graphFilter.dateFrom || "",
      dateTo: graphFilter.dateTo || "",
      label: graphFilter.label || "Last 30 days",
    },
  };
}

function isTimestampWithinDashboardFilter(value, graphFilter) {
  if (!value || !graphFilter?.start || !graphFilter?.end) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= graphFilter.start.getTime() && time <= graphFilter.end.getTime();
}

function getApprovedRefundEventTime(refund) {
  return refund?.approved_at || refund?.updated_at || refund?.created_at || null;
}

function shouldCountOrderInOutstanding(order) {
  return Number(order?.amount_due_inr || 0) > 0 && Number(order?.amount_paid_inr || 0) > 0;
}

function summarizeDashboardOrders(orders, graphFilter) {
  const createdOrders = orders.filter((order) => isTimestampWithinDashboardFilter(order.created_at, graphFilter));
  const paidPayments = orders
    .flatMap((order) => order.payment_history || [])
    .filter((payment) => payment.status === "PAID" && payment.paid_at && isTimestampWithinDashboardFilter(payment.paid_at, graphFilter));
  const approvedRefunds = orders
    .flatMap((order) => order.refund_history || [])
    .filter((refund) => refund.status === "APPROVED" && isTimestampWithinDashboardFilter(getApprovedRefundEventTime(refund), graphFilter));
  const grossCollections = paidPayments.reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0);
  const refundedAmount = approvedRefunds.reduce((sum, refund) => sum + Number(refund.amount_inr || 0), 0);

  return {
    createdOrders,
    soldValue: createdOrders.reduce((sum, order) => sum + Number(order.product_value_inr || 0), 0),
    grossCollections,
    refundedAmount,
    cashInHand: Math.max(grossCollections - refundedAmount, 0),
    newRevenue: paidPayments
      .filter((payment) => payment.type === "ENROLLMENT")
      .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0),
    recoveryRevenue: paidPayments
      .filter((payment) => payment.type === "RECOVERY")
      .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0),
    outstandingAmount: createdOrders
      .filter((order) => shouldCountOrderInOutstanding(order))
      .reduce((sum, order) => sum + Number(order.amount_due_inr || 0), 0),
    customers: new Set(createdOrders.map((order) => order.student?.id || order.student_id).filter(Boolean)).size,
  };
}

function getVisibleDashboardBdas(user) {
  if (isAdminUser(user) || isOperationsUser(user)) {
    return store.data.team.filter((member) => normalizeUserRole(member) === "BDA");
  }
  if (isManagerUser(user)) {
    return store.data.team.filter((member) => isBdaInManagerScope(user, member));
  }
  return store.data.team.filter((member) => normalizeUserRole(member) === "BDA" && member.id === user.id);
}

function getVisibleDashboardManagers(user) {
  if (isAdminUser(user) || isOperationsUser(user)) {
    return store.data.team.filter((member) => normalizeUserRole(member) === "BDM");
  }
  if (isManagerUser(user)) {
    return store.data.team.filter((member) => normalizeUserRole(member) === "BDM" && member.id === user.id);
  }
  return [];
}

function buildFilteredDashboardLeaderboard(user, orders, graphFilter) {
  return getVisibleDashboardBdas(user)
    .map((member) => {
      const memberOrders = orders.filter((order) => order.bda?.id === member.id || order.bda_id === member.id);
      const summary = summarizeDashboardOrders(memberOrders, graphFilter);
      return {
        id: member.id,
        name: member.name,
        manager_name: member.manager_name || "",
        team_name: member.team_name || "",
        totalRevenue: summary.grossCollections,
        netRevenue: summary.cashInHand,
        refundedAmount: summary.refundedAmount,
        newRevenue: summary.newRevenue,
        recoveryRevenue: summary.recoveryRevenue,
        recoveryPipeline: summary.outstandingAmount,
        soldValue: summary.soldValue,
        customers: summary.customers,
      };
    })
    .sort((left, right) => (
      right.totalRevenue - left.totalRevenue
      || right.soldValue - left.soldValue
      || right.recoveryPipeline - left.recoveryPipeline
      || left.name.localeCompare(right.name)
    ));
}

function buildFilteredDashboardManagerSummary(user, orders, graphFilter, leaderboard) {
  const visibleBdas = getVisibleDashboardBdas(user);
  return getVisibleDashboardManagers(user)
    .map((manager) => {
      const managerTeamName = String(manager.team_name || "").trim();
      const teamEntries = leaderboard.filter((entry) => (
        (managerTeamName && String(entry.team_name || "").trim() === managerTeamName)
        || entry.manager_name === manager.name
      ));
      const directOrders = orders.filter((order) => order.bda?.id === manager.id || order.bda_id === manager.id);
      const directSummary = summarizeDashboardOrders(directOrders, graphFilter);
      const topBda = teamEntries.reduce((best, entry) => {
        if (!best || entry.totalRevenue > best.totalRevenue) return entry;
        return best;
      }, null);

      return {
        manager_name: manager.name,
        team_name: manager.team_name || "",
        totalRevenue: teamEntries.reduce((sum, entry) => sum + Number(entry.totalRevenue || 0), 0) + directSummary.grossCollections,
        netRevenue: teamEntries.reduce((sum, entry) => sum + Number(entry.netRevenue || 0), 0) + directSummary.cashInHand,
        refundedAmount: teamEntries.reduce((sum, entry) => sum + Number(entry.refundedAmount || 0), 0) + directSummary.refundedAmount,
        recoveryPipeline: teamEntries.reduce((sum, entry) => sum + Number(entry.recoveryPipeline || 0), 0) + directSummary.outstandingAmount,
        teamMembers: visibleBdas.filter((member) => (
          (managerTeamName && String(member.team_name || "").trim() === managerTeamName)
          || member.manager_name === manager.name
        )).length,
        top_bda: topBda?.name || "—",
      };
    })
    .sort((left, right) => right.totalRevenue - left.totalRevenue || left.manager_name.localeCompare(right.manager_name));
}

function buildScopedDashboardPayload(user, graphFilter = buildDashboardGraphFilter()) {
  const orders = scopeOrderRowsForUser(user, store.getOrders());
  const summary = summarizeDashboardOrders(orders, graphFilter);
  const fullLeaderboard = buildFilteredDashboardLeaderboard(user, orders, graphFilter);
  const leaderboard = fullLeaderboard.slice(0, 5);
  const managerSummary = buildFilteredDashboardManagerSummary(user, orders, graphFilter, fullLeaderboard);
  const cashVsValueSeries = buildScopedCashVsValueSeries(orders, graphFilter);
  const canViewProgramOps = isAdminUser(user) || isOperationsUser(user);

  return {
    stats: {
      activeWebinarsToday: canViewProgramOps ? store.data.webinars.filter((item) => item.status === "LIVE").length : 0,
    },
    revenueTotals: {
      soldValue: summary.soldValue,
      grossCollections: summary.grossCollections,
      refundedAmount: summary.refundedAmount,
      cashInHand: summary.cashInHand,
      newRevenue: summary.newRevenue,
      recoveryRevenue: summary.recoveryRevenue,
      outstandingAmount: summary.outstandingAmount,
    },
    cashVsValueSeries: cashVsValueSeries.rows,
    graphFilters: cashVsValueSeries.filters,
    recentOrders: [...summary.createdOrders]
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .slice(0, 10),
    leaderboard,
    upcomingWebinars: canViewProgramOps
      ? store.data.webinars
        .map((item) => store.attachInstructor(item))
        .filter((item) => ["LIVE", "SCHEDULED"].includes(item.status))
      : [],
    managerSummary,
  };
}

function buildScopedSalesSummaryPayload(user) {
  const orders = scopeOrderRowsForUser(user, store.getOrders());
  return store.getSalesSummaryForOrders(orders);
}

function buildScopedTrackerPayload(user) {
  const enrollments = scopeOrderRowsForUser(user, store.getSalesTracker().enrollments);
  const leaderboard = scopeLeaderboardForUser(user, store.getSalesTracker().leaderboard);
  const managerSummary = scopeManagerSummaryForUser(user, store.getSalesTracker().managerSummary);
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const thisMonthCollections = enrollments
    .flatMap((row) => row.payment_history || [])
    .filter((payment) => payment.status === "PAID" && String(payment.paid_at || "").startsWith(monthPrefix))
    .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0);

  return {
    enrollments,
    leaderboard,
    managerSummary,
    summary: {
      outstandingAmount: enrollments
        .filter((row) => shouldCountOrderInOutstanding(row))
        .reduce((sum, row) => sum + Number(row.amount_due_inr || 0), 0),
      dueToday: enrollments.filter((row) => row.token_due?.due_date && new Date(row.token_due.due_date).toDateString() === new Date().toDateString()).length,
      overdue: enrollments.filter((row) => row.token_due?.due_date && new Date(row.token_due.due_date).getTime() < Date.now()).length,
      thisMonthCollections,
    },
  };
}

function getTeamPayloadForUser(user) {
  const summary = store.getTeamSummary();
  if (!user || isAdminUser(user) || isOperationsUser(user)) {
    return {
      ...summary,
      salesOwners: summary.salesOwners,
    };
  }
  if (isManagerUser(user)) {
    const self = getStoredTeamMember(user) || summary.team.find((member) => member.id === user.id) || user;
    const managedBdas = summary.bdas.filter((member) => isBdaInManagerScope(self, member));
    return {
      team: summary.team.filter((member) => member.id === self.id || managedBdas.some((entry) => entry.id === member.id)),
      admins: summary.admins,
      bdas: managedBdas,
      salesOwners: [self, ...managedBdas],
      managers: summary.managers.filter((manager) => String(manager.manager_name || "").trim() === String(self.name || "").trim()),
      leaderboard: summary.leaderboard.filter((entry) => managedBdas.some((member) => member.id === entry.id)),
    };
  }

  const self = summary.team.find((member) => member.id === user.id) || user;
  return {
    team: [self],
    admins: summary.admins,
    bdas: summary.bdas.filter((member) => member.id === user.id),
    salesOwners: [self],
    managers: summary.managers.filter((manager) => manager.manager_name === self.manager_name),
    leaderboard: summary.leaderboard.filter((entry) => entry.id === user.id),
  };
}

function getScopedExportFilters(user, filters) {
  if (isAdminUser(user)) {
    return filters;
  }
  if (isManagerUser(user)) {
    return {
      ...filters,
      managerName: user.name,
      bdaId: getManagedBdaIds(user).includes(String(filters.bdaId || "")) ? filters.bdaId : undefined,
    };
  }
  return null;
}

function isPaymentExpired(payment) {
  if (!payment?.valid_until || payment?.status === "PAID") return false;
  const validUntil = new Date(payment.valid_until).getTime();
  return Number.isFinite(validUntil) && validUntil < Date.now();
}

function findApprovedGoogleUser(profile) {
  const email = String(profile.email || "").toLowerCase();
  let user = store.data.team.find((item) => item.email.toLowerCase() === email) ?? null;

  if (!user) {
    throw new Error("This Google account is not approved for dashboard access.");
  }
  if (user.is_active === false) {
    throw new Error("This Google account is currently inactive.");
  }

  if (!user.name) {
    user.name = profile.name || user.name;
  }
  user.avatar_url = profile.picture || user.avatar_url || "";
  user.auth_provider = "GOOGLE";
  user.updated_at = new Date().toISOString();

  store.save();
  return user;
}

function resolveShortenerTarget(req, path, allowRelative = false) {
  const raw = String(path || "").trim();
  if (!raw) {
    throw new Error("Target URL is required.");
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    if (raw.includes("localhost") || raw.includes("127.0.0.1")) {
      throw new Error("PyMD cannot shorten localhost URLs. Use a real public URL.");
    }
    return raw;
  }

  if (!allowRelative) {
    throw new Error("Enter a full target URL starting with https://. Relative or localhost links are not allowed for PyMD.");
  }

  const target = withPublicAbsolute(req, raw);
  if (!target?.startsWith("http") || target.includes("localhost") || target.includes("127.0.0.1")) {
    throw new Error("This link needs PUBLIC_APP_URL set to a real public domain before PyMD can shorten it.");
  }
  return target;
}

async function ensureExternalShortLinks(req, options) {
  const { hostTarget, attendeeTarget, hostLabel, attendeeLabel, hostSlugBase, attendeeSlugBase } = options;

      const host = await createPyMdShortLink({
    target: hostTarget,
    label: hostLabel,
    preferredSlug: createPyMdAlias(hostSlugBase),
  });

  const attendee = await createPyMdShortLink({
    target: attendeeTarget,
    label: attendeeLabel,
    preferredSlug: createPyMdAlias(attendeeSlugBase),
  });

  return {
    host_url: host.short_url,
    attendee_url: attendee.short_url,
    short_host_url: host.short_url,
    short_attendee_url: attendee.short_url,
  };
}

function normalizeRoomMessageTarget(value = "ALL") {
  return String(value || "ALL").toUpperCase() === "HOST" ? "HOST" : "ALL";
}

function normalizeRoomMessageType(value = "CHAT") {
  return String(value || "CHAT").toUpperCase() === "TOAST" ? "TOAST" : "CHAT";
}

function isRoomMessageVisibleToViewer(message, viewer = {}) {
  if (normalizeRoomMessageTarget(message?.target) === "ALL") return true;
  const isSender = viewer?.attendanceId && viewer.attendanceId === message?.attendanceId;
  return String(viewer?.role || "").toUpperCase() === "HOST" || Boolean(isSender);
}

function getVisibleRoomMessages(roomName, viewer = {}) {
  return (roomChats.get(roomName) || []).filter((message) => isRoomMessageVisibleToViewer(message, viewer));
}

function getRoomSockets(roomName) {
  const socketIds = io.sockets.adapter.rooms.get(roomName) || new Set();
  return [...socketIds]
    .map((socketId) => io.sockets.sockets.get(socketId))
    .filter(Boolean);
}

function roomSnapshot(roomName, viewer = {}) {
  return {
    participants: roomPresence.get(roomName) || [],
    messages: getVisibleRoomMessages(roomName, viewer),
  };
}

function emitRoomSnapshot(roomName) {
  for (const socket of getRoomSockets(roomName)) {
    socket.emit("room:snapshot", roomSnapshot(roomName, socketRoomMeta.get(socket.id) || {}));
  }
}

function addRoomMessage(roomName, input = {}) {
  const message = {
    id: crypto.randomUUID(),
    role: String(input.role || "SYSTEM"),
    name: String(input.name || "System"),
    text: String(input.text || "").slice(0, 500),
    createdAt: new Date().toISOString(),
    attendanceId: input.attendanceId || "",
    target: normalizeRoomMessageTarget(input.target),
    messageType: normalizeRoomMessageType(input.messageType),
    highlight: Boolean(input.highlight),
  };

  if (!message.text) return null;

  const messages = roomChats.get(roomName) || [];
  roomChats.set(roomName, [...messages.slice(-59), message]);

  if (message.messageType === "TOAST") {
    const payload = { id: message.id, text: message.text, name: message.name, role: message.role };
    if (message.target === "HOST") {
      for (const socket of getRoomSockets(roomName)) {
        const meta = socketRoomMeta.get(socket.id) || {};
        if (String(meta.role || "").toUpperCase() === "HOST") {
          socket.emit("room:toast", payload);
        }
      }
    } else {
      io.to(roomName).emit("room:toast", payload);
    }
  }

  emitRoomSnapshot(roomName);
  return message;
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "llw-api",
    port,
    persistence: store.getPersistenceStatus(),
    googleSheets: googleSheetsMirror.getStatus(),
  });
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body?.email || "").toLowerCase();
  const user = store.data.team.find((item) => item.email.toLowerCase() === email && item.is_active !== false) ?? null;
  if (!user) {
    return res.status(403).json({ ok: false, message: "This account is not approved for dashboard access." });
  }
  res.json({ ok: true, token: createSessionToken(user), user });
});

app.get("/api/auth/config", (_req, res) => {
  res.json({
    ok: true,
    googleClientId,
    authProvider: "google",
  });
});

app.post("/api/auth/google", async (req, res) => {
  try {
    const credential = String(req.body?.credential || "");
    if (!credential) {
      return res.status(400).json({ ok: false, message: "Missing Google credential" });
    }

    const ticket = await googleOauthClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({ ok: false, message: "Google account email is not verified" });
    }

    const user = findApprovedGoogleUser(payload);
    res.json({
      ok: true,
      token: createSessionToken(user),
      user,
    });
  } catch (error) {
    res.status(403).json({ ok: false, message: error instanceof Error ? error.message : "Google sign-in failed" });
  }
});

app.get("/api/auth/me", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  res.json({ ok: true, user });
});

app.get("/api/dashboard/stats", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  res.json({ ok: true, ...buildScopedDashboardPayload(user, buildDashboardGraphFilter(req.query || {})) });
});

app.get("/api/sales/summary", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  res.json({ ok: true, ...buildScopedSalesSummaryPayload(user) });
});

app.get("/api/tracker", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  res.json({
    ok: true,
    rows: isAdminUser(user) || isOperationsUser(user) ? store.getTracker(String(req.query.teacher || "ALL")) : [],
    salesTracker: buildScopedTrackerPayload(user),
  });
});

app.get("/api/instructors", (_req, res) => {
  res.json({ ok: true, instructors: store.data.instructors });
});

app.post("/api/instructors", (req, res) => {
  const record = {
    id: crypto.randomUUID(),
    ...req.body,
    slug: req.body?.slug || String(req.body?.name || "teacher").toLowerCase().replace(/\s+/g, "-"),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  store.data.instructors.unshift(record);
  store.save();
  res.status(201).json({ ok: true, instructor: record });
});

app.put("/api/instructors/:id", (req, res) => {
  const index = store.data.instructors.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, message: "Instructor not found" });
  store.data.instructors[index] = { ...store.data.instructors[index], ...req.body, updated_at: new Date().toISOString() };
  store.save();
  res.json({ ok: true, instructor: store.data.instructors[index] });
});

app.delete("/api/instructors/:id", (req, res) => {
  store.data.instructors = store.data.instructors.filter((item) => item.id !== req.params.id);
  store.save();
  res.json({ ok: true });
});

app.get("/api/products", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  res.json({ ok: true, products: store.data.products });
});

app.post("/api/products", (req, res) => {
  const user = requireAdminPermission(req, res, "Only admin users can create products.");
  if (!user) return;
  const record = { id: crypto.randomUUID(), ...req.body, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  store.data.products.unshift(record);
  store.save();
  res.status(201).json({ ok: true, product: record });
});

app.put("/api/products/:id", (req, res) => {
  const user = requireAdminPermission(req, res, "Only admin users can update product details.");
  if (!user) return;
  const index = store.data.products.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, message: "Product not found" });
  store.data.products[index] = { ...store.data.products[index], ...req.body, updated_at: new Date().toISOString() };
  store.save();
  res.json({ ok: true, product: store.data.products[index] });
});

app.delete("/api/products/:id", (req, res) => {
  const user = requireAdminPermission(req, res, "Only admin users can delete products.");
  if (!user) return;
  store.data.products = store.data.products.filter((item) => item.id !== req.params.id);
  store.save();
  res.json({ ok: true });
});

app.get("/api/webinars", (req, res) => {
  const webinars = store.data.webinars.map((item) => ({
    ...serializeWebinar(req, item),
    instructor: store.data.instructors.find((instructor) => instructor.id === item.instructor_id) ?? null,
    sessions_count: store.getSessions(item.id).length,
  }));
  res.json({ ok: true, webinars });
});

app.post("/api/webinars", async (req, res) => {
  try {
    const webinar = store.createWebinar(req.body ?? {});
    try {
      const external = await ensureExternalShortLinks(req, {
        hostTarget: withPublicAbsolute(req, webinar.host_url),
        attendeeTarget: withPublicAbsolute(req, webinar.attendee_url),
        hostLabel: `${webinar.title} Host`,
        attendeeLabel: `${webinar.title} Attendee`,
        hostSlugBase: `${webinar.slug}-host`,
        attendeeSlugBase: `${webinar.slug}-join`,
      });
      Object.assign(webinar, external);
      const index = store.data.webinars.findIndex((item) => item.id === webinar.id);
      if (index >= 0) {
        store.data.webinars[index] = { ...store.data.webinars[index], ...external, updated_at: new Date().toISOString() };
      }
      const session = store.data.webinarSessions.find((item) => item.webinar_id === webinar.id && item.room_name === webinar.livekit_room_name);
      if (session) {
        Object.assign(session, external, { updated_at: new Date().toISOString() });
      }
      const relatedLinks = store.data.links.filter((item) => item.original_url === webinar.host_url || item.original_url === webinar.attendee_url);
      relatedLinks.forEach((item) => {
        if (item.label.includes("Host")) {
          item.slug = new URL(external.short_host_url).pathname.slice(1);
          item.short_path = new URL(external.short_host_url).pathname;
          item.short_url = external.short_host_url;
        } else {
          item.slug = new URL(external.short_attendee_url).pathname.slice(1);
          item.short_path = new URL(external.short_attendee_url).pathname;
          item.short_url = external.short_attendee_url;
        }
      });
      store.save();
    } catch {
      // Fall back to local short links if the provider is unavailable.
    }
    res.status(201).json({ ok: true, webinar: serializeWebinar(req, webinar) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Webinar creation failed" });
  }
});

app.put("/api/webinars/:id", (req, res) => {
  const index = store.data.webinars.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, message: "Webinar not found" });
  store.data.webinars[index] = { ...store.data.webinars[index], ...req.body, updated_at: new Date().toISOString() };
  store.save();
  res.json({ ok: true, webinar: serializeWebinar(req, store.data.webinars[index]) });
});

app.delete("/api/webinars/:id", (req, res) => {
  store.data.webinars = store.data.webinars.filter((item) => item.id !== req.params.id);
  store.data.webinarSessions = store.data.webinarSessions.filter((item) => item.webinar_id !== req.params.id);
  store.save();
  res.json({ ok: true });
});

app.get("/api/webinars/:id/urls", (req, res) => {
  const webinar = store.data.webinars.find((item) => item.id === req.params.id);
  if (!webinar) return res.status(404).json({ ok: false, message: "Webinar not found" });
  res.json({
    ok: true,
    host_url: withAbsolute(req, webinar.host_url),
    attendee_url: withAbsolute(req, webinar.attendee_url),
    short_host_url: webinar.short_host_url,
    short_attendee_url: webinar.short_attendee_url,
  });
});

app.get("/api/webinars/:id/sessions", (req, res) => {
  const webinar = store.data.webinars.find((item) => item.id === req.params.id);
  if (!webinar) return res.status(404).json({ ok: false, message: "Webinar not found" });
  res.json({
    ok: true,
    webinar: serializeWebinar(req, webinar),
    sessions: store.getSessions(req.params.id).map((item) => serializeSession(req, item)),
  });
});

app.post("/api/webinars/:id/sessions", async (req, res) => {
  try {
    const session = store.createSession(req.params.id, req.body ?? {});
    try {
      const webinar = store.data.webinars.find((item) => item.id === session.webinar_id);
      if (webinar) {
        const external = await ensureExternalShortLinks(req, {
          hostTarget: withPublicAbsolute(req, session.host_url),
          attendeeTarget: withPublicAbsolute(req, session.attendee_url),
          hostLabel: `${session.title} Host`,
          attendeeLabel: `${session.title} Attendee`,
          hostSlugBase: `${webinar.slug}-${session.id}-host`,
          attendeeSlugBase: `${webinar.slug}-${session.id}-join`,
        });
        Object.assign(session, external, { updated_at: new Date().toISOString() });
        webinar.host_url = external.host_url;
        webinar.attendee_url = external.attendee_url;
        webinar.short_host_url = external.short_host_url;
        webinar.short_attendee_url = external.short_attendee_url;
        webinar.updated_at = new Date().toISOString();
        store.save();
      }
    } catch {
      // Fall back to local short links if the provider is unavailable.
    }
    res.status(201).json({ ok: true, session: serializeSession(req, session) });
  } catch (error) {
    res.status(404).json({ ok: false, message: error instanceof Error ? error.message : "Unable to create session" });
  }
});

app.get("/api/webinars/:id/analytics", (req, res) => {
  const analytics = store.getWebinarAnalytics(req.params.id);
  if (!analytics) return res.status(404).json({ ok: false, message: "Webinar not found" });
  res.json({
    ok: true,
    webinar: serializeWebinar(req, analytics.webinar),
    sessions: analytics.sessions.map((item) => serializeSession(req, item)),
    stats: analytics.stats,
    timeline: analytics.timeline,
    attendees: analytics.attendees,
  });
});

app.get("/api/rooms/:roomName", (req, res) => {
  const room = store.getRoomByName(req.params.roomName);
  if (!room) return res.status(404).json({ ok: false, message: "Room not found" });
  res.json({
    ok: true,
    webinar: serializeWebinar(req, room.webinar),
    session: serializeSession(req, room.session),
    room: roomSnapshot(req.params.roomName),
  });
});

app.post("/api/rooms/:roomName/join", async (req, res) => {
  try {
    const requestedRole = String(req.body?.role || "ATTENDEE").toUpperCase();
    const role = requestedRole === "HOST" ? "HOST" : "ATTENDEE";
    const currentUser = role === "HOST" ? requireAuthenticatedUser(req, res) : null;
    if (role === "HOST") {
      if (!currentUser) return;
      if (!canJoinAsHost(currentUser)) {
        return res.status(403).json({ ok: false, message: "Only admin or super-admin users can join as host." });
      }
    }
    const joined = store.joinRoom({
      roomName: req.params.roomName,
      role,
      name: role === "HOST" ? String(req.body?.name || currentUser?.name || "Host Console") : req.body?.name,
      phone: req.body?.phone,
      email: role === "HOST" ? String(currentUser?.email || "") : req.body?.email,
    });
    const hostCanPublish = role === "HOST";
    const canPublishAudio = hostCanPublish;
    const canPublishVideo = hostCanPublish;
    const canShareScreen = hostCanPublish;
    const canPublish = hostCanPublish;
    const livekitToken = await createLiveKitToken({
      roomName: req.params.roomName,
      identity: joined.attendance.id,
      name: joined.attendance.name,
      canPublish,
      canPublishData: hostCanPublish,
      canPublishSources: hostCanPublish ? undefined : [TrackSource.MICROPHONE],
    });

    res.json({
      ok: true,
      webinar: serializeWebinar(req, joined.webinar),
      session: serializeSession(req, joined.session),
      attendance: joined.attendance,
      student: joined.student,
      livekit: {
        url: livekitUrl,
        token: livekitToken,
        identity: joined.attendance.id,
        canPublish: canPublishAudio || canPublishVideo || canShareScreen,
        canPublishAudio,
        canPublishVideo,
        canShareScreen,
      },
    });
  } catch (error) {
    res.status(404).json({ ok: false, message: error instanceof Error ? error.message : "Join failed" });
  }
});

app.post("/api/attendance/:id/leave", (req, res) => {
  const attendance = store.leaveRoom(req.params.id);
  if (!attendance) return res.status(404).json({ ok: false, message: "Attendance not found" });
  res.json({ ok: true, attendance });
});

app.post("/api/attendance/:id/enroll-click", (req, res) => {
  const attendance = store.incrementEnrollClick(req.params.id);
  if (!attendance) return res.status(404).json({ ok: false, message: "Attendance not found" });
  res.json({ ok: true, attendance });
});

app.get("/api/bootcamps", (_req, res) => {
  res.json({ ok: true, bootcamps: store.data.bootcamps.map((item) => store.attachBootcamp(item)) });
});

app.post("/api/bootcamps", (req, res) => {
  const slug = String(req.body?.slug || req.body?.title || "bootcamp");
  const record = {
    id: crypto.randomUUID(),
    ...req.body,
    slug,
    public_page_url: `/bootcamp/${slug}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  store.data.bootcamps.unshift(record);
  store.save();
  res.status(201).json({ ok: true, bootcamp: record });
});

app.put("/api/bootcamps/:id", (req, res) => {
  const index = store.data.bootcamps.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, message: "Bootcamp not found" });
  store.data.bootcamps[index] = { ...store.data.bootcamps[index], ...req.body, updated_at: new Date().toISOString() };
  store.save();
  res.json({ ok: true, bootcamp: store.data.bootcamps[index] });
});

app.delete("/api/bootcamps/:id", (req, res) => {
  store.data.bootcamps = store.data.bootcamps.filter((item) => item.id !== req.params.id);
  store.save();
  res.json({ ok: true });
});

app.get("/api/students", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  res.json({ ok: true, students: scopeStudentRowsForUser(user, store.data.students) });
});

app.post("/api/students", (req, res) => {
  const record = { id: crypto.randomUUID(), ...req.body, created_at: new Date().toISOString() };
  store.data.students.unshift(record);
  store.save();
  res.status(201).json({ ok: true, student: record });
});

app.get("/api/students/:id", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const student = store.data.students.find((item) => item.id === req.params.id);
  if (!student) return res.status(404).json({ ok: false, message: "Student not found" });
  if (!scopeStudentRowsForUser(user, [student]).length) {
    return res.status(403).json({ ok: false, message: "You do not have access to this student." });
  }
  const orderHistory = store.data.orders.filter((item) => item.student_id === student.id);
  const attendanceHistory = store.data.webinarAttendance.filter((item) => item.student_id === student.id);
  res.json({ ok: true, student, orderHistory, attendanceHistory, whatsappLog: ["Enrollment confirmation sent", "Reminder sent"] });
});

app.get("/api/orders", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  res.json({ ok: true, orders: scopeOrderRowsForUser(user, store.getOrders()) });
});

app.get("/api/payments", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  res.json({ ok: true, payments: scopeOrderRowsForUser(user, store.getPayments()) });
});

app.get("/api/operations", (req, res) => {
  const user = requireOperationsPermission(req, res);
  if (!user) return;
  res.json({ ok: true, ...store.getOperationsQueue() });
});

app.get("/api/marketing/campaigns", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  res.json({
    ok: true,
    ...store.getMarketingCampaigns({
      query: String(req.query.query || ""),
      recentDays: Number(req.query.recentDays || 30) || 30,
    }),
  });
});

app.get("/api/marketing/spend", (req, res) => {
  const user = requireMarketingPermission(req, res);
  if (!user) return;
  res.json({
    ok: true,
    ...store.getMarketingSpend({
      query: String(req.query.query || ""),
      year: Number(req.query.year || 0) || undefined,
      month: Number(req.query.month || 0) || undefined,
    }),
  });
});

app.post("/api/marketing/spend", (req, res) => {
  const user = requireMarketingPermission(req, res);
  if (!user) return;
  try {
    const row = store.createMarketingSpend(req.body ?? {}, user);
    res.status(201).json({ ok: true, row });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Unable to save marketing spend row." });
  }
});

app.patch("/api/marketing/spend/:id", (req, res) => {
  const user = requireMarketingPermission(req, res);
  if (!user) return;
  try {
    const row = store.updateMarketingSpend(req.params.id, req.body ?? {}, user);
    res.json({ ok: true, row });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Unable to update marketing spend row." });
  }
});

app.post("/api/payment-links", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  let created;
  const wasExistingOrder = Boolean(req.body?.existing_order_id || req.body?.order_id);
  try {
    created = store.createPaymentLink(req.body ?? {}, user);
    const finalized = finalizePaymentCreation(req, created, req.body ?? {});
    await flushStoreWithResponseBudget({ context: "Deferred payment creation flush failed:" });
    res.status(201).json({ ok: true, ...finalized });
  } catch (error) {
    if (created?.payment?.id) {
      store.data.payment_records = store.data.payment_records.filter((item) => item.id !== created.payment.id);
      store.data.links = store.data.links.filter((item) => item.original_url !== `/payment/${created.payment.id}`);
    }
    if (!wasExistingOrder && created?.order?.id) {
      store.data.orders = store.data.orders.filter((item) => item.id !== created.order.id);
      const studentId = created.order.student?.id || created.order.student_id;
      const hasOtherOrders = store.data.orders.some((item) => item.student_id === studentId);
      if (!hasOtherOrders) {
        store.data.students = store.data.students.filter((item) => item.id !== studentId);
      }
    }
    if (created?.order?.coupon_id) {
      const coupon = store.data.coupons.find((item) => item.id === created.order.coupon_id);
      if (coupon) {
        coupon.usage_count = Math.max(Number(coupon.usage_count || 0) - 1, 0);
        coupon.updated_at = new Date().toISOString();
      }
    }
    store.save();
    await flushStore();
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Payment creation failed" });
  }
});

app.post("/api/public/webinar-enrollments", async (req, res) => {
  const attendanceId = String(req.body?.attendance_id || req.body?.attendanceId || "").trim();
  const webinarId = String(req.body?.webinar_id || req.body?.webinarId || "").trim();

  if (!attendanceId || !webinarId) {
    return res.status(400).json({ ok: false, message: "Attendance and webinar details are required." });
  }

  const attendance = store.data.webinarAttendance.find((item) => item.id === attendanceId) ?? null;
  if (!attendance || attendance.role !== "ATTENDEE" || attendance.webinar_id !== webinarId) {
    return res.status(403).json({ ok: false, message: "This attendee session is not allowed to create a payment." });
  }

  const webinar = store.data.webinars.find((item) => item.id === webinarId) ?? null;
  if (!webinar) {
    return res.status(404).json({ ok: false, message: "Webinar not found." });
  }

  let created;
  try {
    created = store.createPaymentLink({
      ...req.body,
      webinar_id: webinarId,
      student_name: String(req.body?.student_name || req.body?.customer_name || attendance.name || "Attendee").trim(),
      phone: String(req.body?.phone || attendance.phone || "").trim(),
      email: String(req.body?.email || attendance.email || "").trim(),
      source: String(req.body?.source || webinar.title || "Webinar").trim(),
      source_type: "WEBINAR",
      campaign: String(req.body?.campaign || "webinar-enroll-now").trim(),
      collect_customer_details_on_checkout: false,
    }, {
      role: "ATTENDEE",
      name: attendance.name || "Attendee",
      email: attendance.email || "",
    });
    const finalized = finalizePaymentCreation(req, created, req.body ?? {});
    await flushStoreWithResponseBudget({ context: "Deferred webinar enrollment flush failed:" });
    res.status(201).json({ ok: true, ...finalized });
  } catch (error) {
    if (created?.payment?.id) {
      store.data.payment_records = store.data.payment_records.filter((item) => item.id !== created.payment.id);
      store.data.links = store.data.links.filter((item) => item.original_url !== `/payment/${created.payment.id}`);
    }
    if (created?.order?.id) {
      store.data.orders = store.data.orders.filter((item) => item.id !== created.order.id);
      const studentId = created.order.student?.id || created.order.student_id;
      const hasOtherOrders = store.data.orders.some((item) => item.student_id === studentId);
      if (!hasOtherOrders) {
        store.data.students = store.data.students.filter((item) => item.id !== studentId);
      }
    }
    if (created?.order?.coupon_id) {
      const coupon = store.data.coupons.find((item) => item.id === created.order.coupon_id);
      if (coupon) {
        coupon.usage_count = Math.max(Number(coupon.usage_count || 0) - 1, 0);
        coupon.updated_at = new Date().toISOString();
      }
    }
    store.save();
    await flushStore();
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Payment creation failed" });
  }
});

app.post("/api/enrollments", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  let created;
  try {
    created = store.createPaymentLink(req.body ?? {}, user);
    const finalized = finalizePaymentCreation(req, created, req.body ?? {});
    await flushStoreWithResponseBudget({ context: "Deferred enrollment flush failed:" });
    res.status(201).json({ ok: true, ...finalized });
  } catch (error) {
    if (created?.payment?.id) {
      store.data.payment_records = store.data.payment_records.filter((item) => item.id !== created.payment.id);
      store.data.links = store.data.links.filter((item) => item.original_url !== `/payment/${created.payment.id}`);
    }
    if (created?.order?.id) {
      store.data.orders = store.data.orders.filter((item) => item.id !== created.order.id);
      const studentId = created.order.student?.id || created.order.student_id;
      const hasOtherOrders = store.data.orders.some((item) => item.student_id === studentId);
      if (!hasOtherOrders) {
        store.data.students = store.data.students.filter((item) => item.id !== studentId);
      }
      store.save();
    }
    if (created?.order?.coupon_id) {
      const coupon = store.data.coupons.find((item) => item.id === created.order.coupon_id);
      if (coupon) {
        coupon.usage_count = Math.max(Number(coupon.usage_count || 0) - 1, 0);
        coupon.updated_at = new Date().toISOString();
      }
      store.save();
    }
    await flushStore();
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Enrollment creation failed" });
  }
});

app.post("/api/orders/:id/recovery-link", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const scopedOrder = scopeOrderRowsForUser(user, store.getOrders()).find((entry) => entry.id === req.params.id);
  if (!scopedOrder) {
    return res.status(403).json({ ok: false, message: "You do not have access to this order." });
  }
  let created;
  try {
    created = store.createRecoveryLink(req.params.id, req.body ?? {});
    const finalized = finalizePaymentCreation(req, created, req.body ?? {});
    await flushStoreWithResponseBudget({ context: "Deferred recovery-link flush failed:" });
    res.status(201).json({ ok: true, ...finalized });
  } catch (error) {
    if (created?.payment?.id) {
      store.data.payment_records = store.data.payment_records.filter((item) => item.id !== created.payment.id);
      store.data.links = store.data.links.filter((item) => item.original_url !== `/payment/${created.payment.id}`);
      store.save();
    }
    await flushStore();
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Unable to create recovery link" });
  }
});

app.post("/api/payment-imports", async (req, res) => {
  const user = requireAdminPermission(req, res, "Only admin and super-admin users can import payment CSVs.");
  if (!user) return;
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) {
    return res.status(400).json({ ok: false, message: "At least one CSV row is required." });
  }
  try {
    const result = store.importPaymentRows(rows, user);
    await flushStore();
    res.status(201).json({
      ok: true,
      created_count: result.created.length,
      error_count: result.errors.length,
      created: result.created,
      errors: result.errors,
    });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Unable to import payments." });
  }
});

app.patch("/api/orders/:id/operations", async (req, res) => {
  const user = requireOperationsPermission(req, res);
  if (!user) return;
  try {
    const order = store.updateOperations(req.params.id, {
      ...(req.body ?? {}),
      access_revoked_by: user.name || user.email || "Operations",
    });
    await flushStore();
    res.json({ ok: true, order });
  } catch (error) {
    res.status(404).json({ ok: false, message: error instanceof Error ? error.message : "Order not found" });
  }
});

app.post("/api/orders/:id/request-access-revoke", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const scopedOrder = scopeOrderRowsForUser(user, store.getOrders()).find((entry) => entry.id === req.params.id);
  if (!scopedOrder) {
    return res.status(403).json({ ok: false, message: "You do not have access to this order." });
  }
  try {
    const order = store.requestAccessRevoke(req.params.id, user);
    await flushStore();
    res.json({ ok: true, order });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Unable to request access revoke." });
  }
});

app.get("/api/admin/export", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const filters = {
    days: Number(req.query.days || 0) || undefined,
    dateFrom: String(req.query.dateFrom || "") || undefined,
    dateTo: String(req.query.dateTo || "") || undefined,
    bdaId: String(req.query.bdaId || "") || undefined,
    managerName: String(req.query.managerName || "") || undefined,
    productId: String(req.query.productId || "") || undefined,
    batchKey: String(req.query.batchKey || "") || undefined,
    sourceType: String(req.query.sourceType || "ALL"),
    paymentMode: String(req.query.paymentMode || "ALL"),
    paymentBucket: String(req.query.paymentBucket || "ALL"),
    paymentState: String(req.query.paymentState || "ALL"),
    paymentStatus: String(req.query.paymentStatus || "ALL"),
  };
  const scopedFilters = getScopedExportFilters(user, filters);
  if (!scopedFilters) {
    return res.status(403).json({ ok: false, message: "You do not have permission to export data." });
  }
  const type = String(req.query.type || "payments");
  const exportData = store.getExportData(scopedFilters);
  const data =
    type === "tokens"
      ? exportData.tokens
      : type === "refunds"
        ? exportData.refunds
      : type === "enrollments"
        ? exportData.enrollments
        : exportData.payments;
  res.json({ ok: true, data });
});

app.get("/api/refunds", (req, res) => {
  const user = requireAdminPermission(req, res, "Only admin and finance users can review the refund board.");
  if (!user) return;
  res.json({ ok: true, refunds: store.getRefunds(), summary: store.getRefundSummary() });
});

app.post("/api/refunds", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const refund = store.createRefund(req.body ?? {}, user);
  await flushStore();
  res.status(201).json({ ok: true, refund });
});

app.post("/api/refunds/:id/decision", async (req, res) => {
  const user = requireAdminPermission(req, res, "Only admin and finance users can approve or reject refunds.");
  if (!user) return;
  const refund = store.updateRefund(req.params.id, String(req.body?.decision || "REQUESTED"), String(req.body?.admin_comment || ""), user);
  if (!refund) return res.status(404).json({ ok: false, message: "Refund not found" });
  await flushStore();
  res.json({ ok: true, refund });
});

app.get("/api/coupons", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  res.json({ ok: true, coupons: store.getCoupons(user) });
});

app.post("/api/coupons", (req, res) => {
  const user = requireSettingsPermission(req, res, "Only managers, admin, and super-admin users can create coupons.");
  if (!user) return;
  try {
    const coupon = store.createCoupon(req.body ?? {}, user);
    res.status(201).json({ ok: true, coupon });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Unable to create coupon" });
  }
});

app.post("/api/orders/create", (req, res) => {
  res.status(501).json({ ok: false, message: "Use /api/payment-links or /api/orders/checkout-session for Razorpay-backed orders." });
});

app.post("/api/orders/verify-payment", async (req, res) => {
  const payment = req.body?.payment_id ? store.getPaymentRecord(req.body.payment_id) : null;
  const order = payment
    ? store.data.orders.find((item) => item.id === payment.order_id)
    : store.data.orders.find((item) => item.id === req.body?.order_id || item.order_number === req.body?.order_number);
  if (!order && !payment) return res.status(404).json({ ok: false, message: "Order not found" });

  if (req.body?.razorpay_order_id && req.body?.razorpay_payment_id && req.body?.razorpay_signature) {
    const isValid = verifyRazorpaySignature({
      orderId: String(req.body.razorpay_order_id),
      paymentId: String(req.body.razorpay_payment_id),
      signature: String(req.body.razorpay_signature),
    });
    if (!isValid) {
      return res.status(400).json({ ok: false, message: "Invalid Razorpay signature" });
    }
    if (payment) {
      payment.razorpay_order_id = String(req.body.razorpay_order_id);
      payment.razorpay_signature = String(req.body.razorpay_signature);
    }
  }

  if (payment && isPaymentExpired(payment)) {
    return res.status(410).json({ ok: false, message: "This payment link has expired. Please ask your team for a fresh link." });
  }

  try {
    const result = store.markPaymentPaid({
      payment_id: payment?.id,
      order_id: order?.id,
      razorpay_order_id: req.body?.razorpay_order_id,
      razorpay_payment_id: req.body?.razorpay_payment_id,
      razorpay_signature: req.body?.razorpay_signature,
    });
    if (result?.order?.webinar_id) {
      const webinar = store.data.webinars.find((item) => item.id === result.order.webinar_id);
      if (webinar?.livekit_room_name) {
        addRoomMessage(webinar.livekit_room_name, {
          role: "SYSTEM",
          name: "Enrollment",
          text: `Congratulations! ${result.order.student?.name || result.order.student_name || "A learner"} has enrolled.`,
          target: "ALL",
          messageType: "TOAST",
          highlight: true,
        });
      }
    }
    await flushStore();
    res.json({ ok: true, ...result, aisensy: "enrollment_confirmation queued" });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Unable to verify payment" });
  }
});

app.post("/api/orders/mark-payment-failed", async (req, res) => {
  try {
    const result = store.markPaymentFailed({
      payment_id: req.body?.payment_id,
      order_id: req.body?.order_id,
      failure_code: req.body?.failure_code,
      failure_reason: req.body?.failure_reason,
    });
    await flushStore();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Unable to mark payment failed" });
  }
});

app.post("/api/orders/reconcile-payment", async (req, res) => {
  try {
    const payment = req.body?.payment_id ? store.getPaymentRecord(req.body.payment_id) : null;
    const order = payment
      ? store.data.orders.find((item) => item.id === payment.order_id)
      : store.data.orders.find((item) => item.id === req.body?.order_id || item.order_number === req.body?.order_number);
    if (!order) {
      return res.status(404).json({ ok: false, message: "Order not found" });
    }

    if (payment?.status === "PAID" || order.status === "ACTIVE" || order.status === "OPERATIONS_IN_PROGRESS") {
      return res.json({ ok: true, paid: true, order: store.attachOrder(order), payment: payment || store.getLatestPaymentForOrder(order.id, { preferOpen: true }) });
    }

    const openPayment = payment || store.getLatestPaymentForOrder(order.id, { preferOpen: true });
    if (!openPayment?.razorpay_order_id) {
      return res.status(400).json({ ok: false, paid: false, message: "Razorpay order not initialized yet." });
    }

    const response = await fetchRazorpayOrderPayments(openPayment.razorpay_order_id);
    const payments = Array.isArray(response?.items) ? response.items : [];
    const orderedPayments = [...payments].sort((left, right) => Number(right.created_at || 0) - Number(left.created_at || 0));
    const paidPayment = orderedPayments.find((item) => ["captured", "authorized"].includes(String(item.status || "").toLowerCase()));

    if (!paidPayment) {
      const failedPayment = orderedPayments.find((item) => String(item.status || "").toLowerCase() === "failed");
      if (failedPayment) {
        openPayment.razorpay_payment_id = failedPayment.id || openPayment.razorpay_payment_id;
        openPayment.updated_at = new Date().toISOString();
        const failureMessage = failedPayment.error_description || failedPayment.error_reason || "Payment failed on Razorpay.";
        const result = store.markPaymentFailed({
          payment_id: openPayment.id,
          order_id: order.id,
          failure_code: failedPayment.error_code,
          failure_reason: failureMessage,
        });
        await flushStore();
        return res.json({ ok: true, paid: false, failed: true, message: failureMessage, ...result });
      }
      return res.json({ ok: true, paid: false, order: store.attachOrder(order), payment: openPayment });
    }

    const result = store.markPaymentPaid({
      payment_id: openPayment.id,
      order_id: order.id,
      razorpay_order_id: paidPayment.order_id || openPayment.razorpay_order_id,
      razorpay_payment_id: paidPayment.id,
      razorpay_signature: openPayment.razorpay_signature || "",
    });

    if (result?.order?.webinar_id) {
      const webinar = store.data.webinars.find((item) => item.id === result.order.webinar_id);
      if (webinar?.livekit_room_name) {
        addRoomMessage(webinar.livekit_room_name, {
          role: "SYSTEM",
          name: "Enrollment",
          text: `Congratulations! ${result.order.student?.name || result.order.student_name || "A learner"} has enrolled.`,
          target: "ALL",
          messageType: "TOAST",
          highlight: true,
        });
      }
    }

    await flushStore();
    return res.json({ ok: true, paid: true, ...result });
  } catch (error) {
    res.status(400).json({ ok: false, paid: false, message: error instanceof Error ? error.message : "Unable to reconcile payment." });
  }
});

app.post("/api/orders/checkout-session", async (req, res) => {
  try {
    const payment = req.body?.payment_id
      ? store.getPaymentRecord(req.body.payment_id)
      : req.body?.order_id
        ? store.getLatestPaymentForOrder(req.body.order_id, { preferOpen: true })
        : null;
    const order = payment
      ? store.data.orders.find((item) => item.id === payment.order_id)
      : store.data.orders.find((item) => item.id === req.body?.order_id || item.order_number === req.body?.order_number);
    if (!order) return res.status(404).json({ ok: false, message: "Order not found" });

    if (order.collect_customer_details_on_checkout) {
      try {
        store.captureCheckoutCustomer(order.id, req.body ?? {});
        await flushStore();
      } catch (error) {
        return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Customer details are required" });
      }
    }

    if (payment?.status === "PAID" || order.status === "ACTIVE" || order.status === "OPERATIONS_IN_PROGRESS") {
      return res.json({
        ok: true,
        already_paid: true,
        order: store.attachOrder(order),
        payment,
        razorpayKeyId,
      });
    }

    if (!payment) {
      return res.status(404).json({ ok: false, message: "Payment record not found" });
    }

    if (isPaymentExpired(payment)) {
      return res.status(410).json({ ok: false, message: "This payment link has expired. Please request a fresh link before continuing." });
    }

    if (payment.method !== "RAZORPAY") {
      return res.status(400).json({ ok: false, message: "This payment was recorded as a manual payment." });
    }

    if (!payment.razorpay_order_id) {
      const student = store.data.students.find((item) => item.id === order.student_id) ?? {};
      const razorpayOrder = await createRazorpayOrder(
        {
          id: payment.id,
          order_id: order.id,
          order_number: order.order_number,
          transaction_id: payment.transaction_id,
          amount_inr: payment.amount_inr,
          utm_source: order.utm_source,
        },
        {
        student_name: student.name,
        phone: student.phone,
        email: student.email,
        source: order.utm_source,
      });
      store.attachRazorpayOrderToPayment(payment.id, razorpayOrder);
      store.save();
      void flushStore().catch((flushError) => {
        console.error("Deferred payment flush failed:", flushError instanceof Error ? flushError.message : flushError);
      });
    }

    res.json({
      ok: true,
      order: store.attachOrder(order),
      payment: store.getPaymentRecord(payment.id),
      razorpayKeyId,
    });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Unable to prepare Razorpay checkout" });
  }
});

app.post("/api/orders/apply-coupon", async (req, res) => {
  try {
    const result = store.applyCouponToPaymentLink({
      payment_id: req.body?.payment_id,
      order_id: req.body?.order_id,
      order_number: req.body?.order_number,
      coupon_code: req.body?.coupon_code,
    });
    await flushStore();
    res.json({ ok: true, ...result, linkExpired: result.payment ? isPaymentExpired(result.payment) : false });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Unable to apply coupon." });
  }
});

app.get("/api/orders/:id", (req, res) => {
  const payment = store.getPaymentRecord(req.params.id);
  if (payment) {
    const order = store.data.orders.find((item) => item.id === payment.order_id);
    if (!order) return res.status(404).json({ ok: false, message: "Order not found" });
    return res.json({ ok: true, order: store.attachOrder(order), payment, razorpayKeyId, linkExpired: isPaymentExpired(payment) });
  }

  const order = store.data.orders.find((item) => item.id === req.params.id);
  if (!order) return res.status(404).json({ ok: false, message: "Order not found" });
  res.json({
    ok: true,
    order: store.attachOrder(order),
    payment: store.getLatestPaymentForOrder(order.id, { preferOpen: true }),
    razorpayKeyId,
    linkExpired: isPaymentExpired(store.getLatestPaymentForOrder(order.id, { preferOpen: true })),
  });
});

app.get("/api/links", (req, res) => {
  const user = requireAdminPermission(req, res, "Only admin and super-admin users can open the links desk.");
  if (!user) return;
  res.json({ ok: true, links: store.data.links.map((link) => serializeLink(req, link)) });
});

app.post("/api/links/shorten", async (req, res) => {
  const user = requireAdminPermission(req, res, "Only admin and super-admin users can create short links.");
  if (!user) return;
  const link = store.createShortLink(req.body ?? {});
  try {
    try {
      const target = resolveShortenerTarget(req, link.original_url, true);
      const external = await createPyMdShortLink({
        target,
        label: link.label,
        preferredSlug: createEditableAlias(req.body?.alias_suffix || link.slug, link.label),
        domain: req.body?.domain,
      });
      link.slug = external.slug;
      link.short_path = new URL(external.short_url).pathname;
      link.short_url = external.short_url;
    } catch {
      // Keep the locally generated short path when no public app URL/domain is available.
      link.short_url = withAbsolute(req, link.short_path || `/${link.slug}`);
    }
    store.save();
    res.status(201).json({ ok: true, link: serializeLink(req, link) });
  } catch (error) {
    store.data.links = store.data.links.filter((item) => item.id !== link.id);
    store.save();
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "PyMD link creation failed" });
  }
});

app.get("/api/team", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  res.json({ ok: true, ...getTeamPayloadForUser(user) });
});

app.get("/api/settings", (req, res) => {
  const user = requireSettingsPermission(req, res);
  if (!user) return;
  const systemSettings = store.getSystemSettings();
  const sharedSettings = {
    couponPolicy: {
      bdm_max_coupon_percent: 20,
    },
    aisensyPaymentLinkCampaign: systemSettings.aisensy_payment_link_campaign || aisensyPaymentLinkCampaign,
  };
  if (!isAdminUser(user)) {
    return res.json({ ok: true, settings: sharedSettings });
  }
  res.json({
    ok: true,
    settings: {
      ...sharedSettings,
      livekitApiKey: "lk_demo_key",
      livekitApiSecret: "lk_demo_secret",
      livekitHostUrl: "wss://livekit.livelongwealth.com",
      razorpayKeyId,
      razorpayKeySecret: `${razorpayKeySecret.slice(0, 4)}••••${razorpayKeySecret.slice(-4)}`,
      googleClientId,
      googleClientSecret: maskSecret(googleClientSecret),
      aisensyApiKey: aisensyApiKey ? `${aisensyApiKey.slice(0, 8)}••••${aisensyApiKey.slice(-6)}` : "",
      aisensyWebhookUrl: systemSettings.aisensy_webhook_url || aisensyWebhookUrl,
      aisensyPaymentLinkCampaign: systemSettings.aisensy_payment_link_campaign || aisensyPaymentLinkCampaign,
      tinyurlToken: "tiny_demo_token",
      defaultWhatsAppTemplateIds: "enrollment_confirmation, webinar_reminder",
      platformName: "Livelong Wealth",
      platformLogo: "/logo.svg",
      liveServers: constants.serverOptions,
    },
  });
});

app.get("/api/google-sheets/status", (req, res) => {
  const user = requireAdminPermission(req, res, "Only admin and super-admin users can view Google Sheets sync status.");
  if (!user) return;
  res.json({ ok: true, googleSheets: googleSheetsMirror.getStatus() });
});

app.post("/api/google-sheets/sync", async (req, res) => {
  const user = requireAdminPermission(req, res, "Only admin and super-admin users can sync Google Sheets.");
  if (!user) return;

  try {
    const result = await googleSheetsMirror.syncFull(store, {
      reason: String(req.body?.reason || "manual-admin-sync").trim() || "manual-admin-sync",
      force: Boolean(req.body?.force),
    });

    res.json({
      ok: true,
      result,
      googleSheets: googleSheetsMirror.getStatus(),
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      message: error instanceof Error ? error.message : "Google Sheets sync failed.",
      googleSheets: googleSheetsMirror.getStatus(),
    });
  }
});

app.patch("/api/settings/notifications", (req, res) => {
  const user = requireAdminPermission(req, res, "Only admin and super-admin users can update notification settings.");
  if (!user) return;
  try {
    const settings = store.updateSystemSettings({
      aisensy_payment_link_campaign: String(req.body?.aisensy_payment_link_campaign || aisensyPaymentLinkCampaign || "").trim(),
      aisensy_webhook_url: String(req.body?.aisensy_webhook_url || "").trim(),
    });
    res.json({ ok: true, settings });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Unable to update notification settings." });
  }
});

app.post("/api/notifications/aisensy/payment-link", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  try {
    const systemSettings = store.getSystemSettings();
    const campaignName = String(systemSettings.aisensy_payment_link_campaign || aisensyPaymentLinkCampaign || "").trim();
    if (!aisensyApiKey) {
      return res.status(400).json({ ok: false, message: "AiSensy API key is not configured." });
    }
    if (!campaignName) {
      return res.status(400).json({ ok: false, message: "AiSensy payment-link campaign name is missing." });
    }

    const paymentRecord = req.body?.payment_id
      ? store.getPaymentRecord(req.body.payment_id)
      : req.body?.order_id
        ? store.getLatestPaymentForOrder(req.body.order_id, { preferOpen: true })
        : null;
    const linkedOrder = paymentRecord
      ? store.data.orders.find((item) => item.id === paymentRecord.order_id)
      : req.body?.order_id
        ? store.data.orders.find((item) => item.id === req.body.order_id)
        : null;

    const customerName = String(req.body?.customer_name || "").trim();
    const rawPhone = String(req.body?.phone || "").trim();
    const destination = normalizeAiSensyPhone(rawPhone);
    const productName = String(req.body?.product_name || "").trim();
    let paymentLink = String(req.body?.payment_link || "").trim();
    const orderId = String(req.body?.order_id || "").trim();
    const senderName = String(req.body?.sender_name || user.name || user.email || "Livelong Wealth").trim();

    if (!customerName || !destination || !productName || !paymentLink) {
      return res.status(400).json({ ok: false, message: "Customer name, phone, product name, and payment link are required." });
    }

    if (paymentRecord && !String(paymentLink).includes("py.md/")) {
      try {
        const target = String(paymentRecord.payment_link || "").startsWith("http")
          ? String(paymentRecord.payment_link)
          : withPublicAbsolute(req, paymentRecord.payment_link || `/payment/${paymentRecord.id}`);
        const external = await createPyMdShortLink({
          target,
          label: `Payment ${linkedOrder?.offer_title || linkedOrder?.order_number || productName || customerName || paymentRecord.id}`,
          preferredSlug: createEditableAlias(
            "",
            linkedOrder?.offer_title || productName || customerName || paymentRecord.id,
          ),
        });
        updatePaymentLinkRecord(paymentRecord.id, external.short_url);
        paymentLink = external.short_url;
      } catch {
        // If PyMD upgrade fails here, continue with the current link rather than blocking the message.
      }
    }

    const basePayload = {
      apiKey: aisensyApiKey,
      campaignName,
      destination,
      userName: customerName,
      source: "Ondoarding Form",
      tags: ["payment-link", "onboarding"],
      attributes: {
        order_id: orderId || "",
        product_name: productName,
        payment_link: paymentLink,
        assigned_rep: senderName,
      },
    };

    let result = null;
    let templateParamsUsed = [];
    try {
      templateParamsUsed = [customerName, senderName, productName, paymentLink];
      result = await sendAiSensyCampaign({
        ...basePayload,
        templateParams: templateParamsUsed,
      });
    } catch (error) {
      const message = getAiSensyErrorMessage(error).toLowerCase();
      if (!message.includes("template params")) {
        throw error;
      }

      templateParamsUsed = [senderName, productName, paymentLink];
      result = await sendAiSensyCampaign({
        ...basePayload,
        templateParams: templateParamsUsed,
      });
    }

    res.json({
      ok: true,
      message: `AiSensy message sent to ${customerName}.`,
      campaignName,
      templateParamsUsed,
      webhookUrl: systemSettings.aisensy_webhook_url || aisensyWebhookUrl || "",
      result,
    });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Unable to send AiSensy message." });
  }
});

app.patch("/api/settings/coupon-policy", (req, res) => {
  const user = requireAdminPermission(req, res, "Only admin and super-admin users can update coupon policy.");
  if (!user) return;
  try {
    const settings = store.updateSystemSettings({
      bdm_coupon_limit_inr: Number(req.body?.bdm_coupon_limit_inr || 0),
    });
    res.json({ ok: true, settings });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Unable to update coupon policy." });
  }
});

app.post("/api/livekit/attendee-token", (req, res) => {
  res.status(501).json({ ok: false, message: "Use the room join endpoint to receive a LiveKit token." });
});

app.get("/:slug", (req, res, next) => {
  const slug = req.params.slug;
  if (!slug.startsWith("livelong.wealth-")) {
    next();
    return;
  }

  const link = store.data.links.find((item) => {
    const shortPath = item.short_path || (String(item.short_url || "").startsWith("https://llw.local/") ? new URL(item.short_url).pathname : item.short_url);
    return item.slug === slug || shortPath === `/${slug}` || item.short_url === `/${slug}`;
  });
  if (!link) {
    res.status(404).send("Short link not found");
    return;
  }

  res.redirect(302, withAbsolute(req, link.original_url));
});

io.on("connection", (socket) => {
  const auth = socket.handshake.auth || {};
  const roomName = String(auth.roomName || "");
  const attendanceId = String(auth.attendanceId || "");
  const sessionUser = getUserFromSessionToken(String(auth.token || ""));

  if (!roomName || !attendanceId) {
    socket.disconnect(true);
    return;
  }

  const attendance = store.data.webinarAttendance.find((item) => item.id === attendanceId);
  if (!attendance) {
    socket.disconnect(true);
    return;
  }
  const room = store.getRoomByName(roomName);
  if (!room?.session || attendance.session_id !== room.session.id) {
    socket.disconnect(true);
    return;
  }

  const role = String(attendance.role || "ATTENDEE").toUpperCase();
  if (role === "HOST") {
    if (!sessionUser || !canJoinAsHost(sessionUser) || String(sessionUser.email || "").toLowerCase() !== String(attendance.email || "").toLowerCase()) {
      socket.disconnect(true);
      return;
    }
  }

  const name = String(attendance.name || auth.name || "Guest");
  const phone = String(attendance.phone || auth.phone || "");
  const email = String(attendance.email || auth.email || "");

  socketRoomMeta.set(socket.id, { roomName, attendanceId, role, name, phone, email });
  socket.join(roomName);
  const participant = {
    socketId: socket.id,
    attendanceId,
    role,
    name,
    phone,
    email,
    joinedAt: new Date().toISOString(),
    isMicOn: false,
    isCameraOn: false,
    isScreenSharing: false,
    isHandRaised: false,
  };
  const participants = roomPresence.get(roomName) || [];
  roomPresence.set(roomName, [...participants.filter((item) => item.socketId !== socket.id), participant]);
  emitRoomSnapshot(roomName);

  socket.on("chat:send", (payload) => {
    const messageType = normalizeRoomMessageType(payload?.messageType);
    if (messageType === "TOAST" && role !== "HOST") return;
    addRoomMessage(roomName, {
      role,
      name,
      attendanceId,
      text: payload?.text,
      target: messageType === "TOAST" ? "ALL" : payload?.target,
      messageType,
      highlight: messageType === "TOAST",
    });
  });

  socket.on("participant:media", (payload) => {
    const participants = roomPresence.get(roomName) || [];
    const nextParticipants = participants.map((item) => {
      if (item.socketId !== socket.id) return item;
      return {
        ...item,
        isMicOn: Boolean(payload?.isMicOn),
        isCameraOn: Boolean(payload?.isCameraOn),
        isScreenSharing: Boolean(payload?.isScreenSharing),
      };
    });
    roomPresence.set(roomName, nextParticipants);

    const attendance = store.data.webinarAttendance.find((item) => item.id === attendanceId);
    if (attendance) {
      if (payload?.isMicOn) attendance.mic_toggle_count = Number(attendance.mic_toggle_count || 0) + 1;
      if (payload?.isCameraOn) attendance.camera_toggle_count = Number(attendance.camera_toggle_count || 0) + 1;
      attendance.updated_at = new Date().toISOString();
      store.save();
    }

    emitRoomSnapshot(roomName);
  });

  socket.on("participant:hand-raise", (payload) => {
    const participants = roomPresence.get(roomName) || [];
    const nextParticipants = participants.map((item) => {
      if (item.socketId !== socket.id) return item;
      return {
        ...item,
        isHandRaised: Boolean(payload?.isHandRaised),
      };
    });
    roomPresence.set(roomName, nextParticipants);
    emitRoomSnapshot(roomName);
  });

  socket.on("participant:request-unmute", (payload) => {
    if (role !== "HOST") return;
    const targetSocketId = String(payload?.targetSocketId || "");
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    const targetMeta = socketRoomMeta.get(targetSocketId) || {};
    if (!targetSocket || targetSocketId === socket.id) return;
    if (String(targetMeta.roomName || "") !== roomName || String(targetMeta.role || "").toUpperCase() !== "ATTENDEE") return;
    updateParticipantPublishPermission(roomName, String(targetMeta.attendanceId || ""), true, [TrackSource.MICROPHONE])
      .then(() => {
        targetSocket.emit("participant:unmute-request", {
          fromName: name,
          message: `${name} asked you to unmute.`,
        });
        addRoomMessage(roomName, {
          role: "SYSTEM",
          name: "Host Controls",
          text: `${name} asked ${String(payload?.targetName || "an attendee")} to unmute.`,
          target: "ALL",
          messageType: "CHAT",
        });
      })
      .catch((error) => {
        socket.emit("room:toast", {
          id: crypto.randomUUID(),
          text: error instanceof Error ? error.message : "Could not enable attendee microphone.",
        });
      });
  });

  socket.on("participant:mute", (payload) => {
    if (role !== "HOST") return;
    const targetSocketId = String(payload?.targetSocketId || "");
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    const targetMeta = socketRoomMeta.get(targetSocketId) || {};
    if (!targetSocket || targetSocketId === socket.id) return;
    if (String(targetMeta.roomName || "") !== roomName || String(targetMeta.role || "").toUpperCase() !== "ATTENDEE") return;
    updateParticipantPublishPermission(roomName, String(targetMeta.attendanceId || ""), false, [])
      .then(() => {
        targetSocket.emit("participant:muted", {
          fromName: name,
          message: `${name} muted your microphone.`,
        });
        const participants = roomPresence.get(roomName) || [];
        roomPresence.set(roomName, participants.map((item) => (
          item.socketId === targetSocketId ? { ...item, isMicOn: false } : item
        )));
        emitRoomSnapshot(roomName);
      })
      .catch((error) => {
        socket.emit("room:toast", {
          id: crypto.randomUUID(),
          text: error instanceof Error ? error.message : "Could not mute attendee microphone.",
        });
      });
  });

  socket.on("participant:remove", (payload) => {
    if (role !== "HOST") return;
    const targetSocketId = String(payload?.targetSocketId || "");
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (!targetSocket || targetSocketId === socket.id) return;
    const targetMeta = socketRoomMeta.get(targetSocketId) || {};
    targetSocket.emit("participant:removed", {
      fromName: name,
      message: `${name} removed you from the room.`,
    });
    if (targetMeta.attendanceId) {
      store.leaveRoom(String(targetMeta.attendanceId));
    }
    roomPresence.set(roomName, (roomPresence.get(roomName) || []).filter((item) => item.socketId !== targetSocketId));
    socketRoomMeta.delete(targetSocketId);
    emitRoomSnapshot(roomName);
    targetSocket.disconnect(true);
  });

  socket.on("webinar:update", (payload) => {
    if (role !== "HOST") return;
    const room = store.getRoomByName(roomName);
    if (!room?.webinar) return;
    const index = store.data.webinars.findIndex((item) => item.id === room.webinar.id);
    if (index < 0) return;
    const nextWebinar = {
      ...store.data.webinars[index],
      payment_required: Boolean(payload?.payment_required ?? store.data.webinars[index].payment_required),
      enroll_button_enabled: Boolean(payload?.enroll_button_enabled ?? store.data.webinars[index].enroll_button_enabled),
      payment_mode: String(payload?.payment_mode || store.data.webinars[index].payment_mode || "FULL").toUpperCase() === "TOKEN" ? "TOKEN" : "FULL",
      price_inr: Number(payload?.price_inr ?? store.data.webinars[index].price_inr ?? 0),
      token_price_inr: Number(payload?.token_price_inr ?? store.data.webinars[index].token_price_inr ?? 0),
      status: String(payload?.status || store.data.webinars[index].status || "LIVE"),
      updated_at: new Date().toISOString(),
    };
    store.data.webinars[index] = nextWebinar;
    store.save();
    io.to(roomName).emit("webinar:update", store.attachInstructor(nextWebinar));
  });

  socket.on("meeting:end", () => {
    if (role !== "HOST") return;
    const room = store.getRoomByName(roomName);
    if (room?.webinar) {
      const webinarIndex = store.data.webinars.findIndex((item) => item.id === room.webinar.id);
      if (webinarIndex >= 0) {
        store.data.webinars[webinarIndex] = {
          ...store.data.webinars[webinarIndex],
          status: "ENDED",
          enroll_button_enabled: false,
          updated_at: new Date().toISOString(),
        };
      }
      const sessionIndex = store.data.webinarSessions.findIndex((item) => item.id === room.session.id);
      if (sessionIndex >= 0) {
        store.data.webinarSessions[sessionIndex] = {
          ...store.data.webinarSessions[sessionIndex],
          status: "ENDED",
          is_active: false,
          updated_at: new Date().toISOString(),
        };
      }
      store.save();
      io.to(roomName).emit("webinar:update", store.attachInstructor(store.data.webinars[webinarIndex]));
    }
    addRoomMessage(roomName, {
      role: "SYSTEM",
      name: "Host Controls",
      text: `${name} ended the meeting.`,
      target: "ALL",
      messageType: "TOAST",
      highlight: true,
    });
    io.to(roomName).emit("meeting:ended", { message: `${name} ended the meeting.` });
    setTimeout(() => {
      for (const roomSocket of getRoomSockets(roomName)) {
        const meta = socketRoomMeta.get(roomSocket.id) || {};
        if (meta.attendanceId) {
          store.leaveRoom(String(meta.attendanceId));
        }
        socketRoomMeta.delete(roomSocket.id);
        roomSocket.disconnect(true);
      }
      roomPresence.set(roomName, []);
      emitRoomSnapshot(roomName);
    }, 150);
  });

  socket.on("webrtc:signal", (payload) => {
    const targetSocketId = String(payload?.targetSocketId || "");
    if (!targetSocketId) return;
    io.to(targetSocketId).emit("webrtc:signal", {
      fromSocketId: socket.id,
      fromName: name,
      signal: payload.signal,
    });
  });

  socket.on("disconnect", () => {
    const remaining = (roomPresence.get(roomName) || []).filter((item) => item.socketId !== socket.id);
    roomPresence.set(roomName, remaining);
    socketRoomMeta.delete(socket.id);
    if (attendanceId) {
      store.leaveRoom(attendanceId);
    }
    emitRoomSnapshot(roomName);
  });
});

if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api|\/health|\/socket\.io).*/, (req, res) => {
    res.sendFile(join(distPath, "index.html"));
  });
}

try {
  await googleSheetsMirror.initialize(store);
} catch (error) {
  console.error("Google Sheets startup sync failed:", error instanceof Error ? error.message : error);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    try {
      await flushStore();
      await store.close();
    } finally {
      process.exit(0);
    }
  });
}

httpServer.listen(port, () => {
  console.log(`LLW API listening on http://localhost:${port}`);
});
