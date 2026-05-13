import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDashboardStore as createSeedStore, constants } from "./dashboard-data.mjs";
import { createRuntimePersistence } from "./runtime-persistence.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataFile = process.env.DATA_FILE || join(__dirname, "..", "data", "app-data.json");
const seedDataFile = join(__dirname, "..", "db", "app-data.seed.json");
const defaultGitTrackedDataFile = join(__dirname, "..", "data", "app-data.json");
const gitTrackedDataFile = existsSync(defaultGitTrackedDataFile) ? defaultGitTrackedDataFile : seedDataFile;
const backupDir = process.env.DATA_BACKUP_DIR || join(dirname(dataFile), "backups");
const shouldResetTeamFromGitOnStartup = /^(1|true|yes)$/i.test(String(process.env.RESET_TEAM_FROM_GIT_ON_STARTUP || ""));
const teamResetMarkerFile = process.env.RESET_TEAM_FROM_GIT_MARKER_FILE || join(dirname(dataFile), ".team-reset-from-git.done");
const teamResetToken = String(process.env.RESET_TEAM_FROM_GIT_TOKEN || "2026-05-09-admin-access-repair").trim() || "2026-05-09-admin-access-repair";
const shouldResetCouponsFromGitOnStartup = /^(1|true|yes)$/i.test(String(process.env.RESET_COUPONS_FROM_GIT_ON_STARTUP || ""));
const couponResetMarkerFile = process.env.RESET_COUPONS_FROM_GIT_MARKER_FILE || join(dirname(dataFile), ".coupon-reset-from-git.done");
const gitCouponResetToken = String(process.env.RESET_COUPONS_FROM_GIT_TOKEN || "2026-05-13-price-update-coupons").trim() || "2026-05-13-price-update-coupons";
const runtimePersistence = await createRuntimePersistence();
const requiredTeamMembers = [
  { name: "Punith Raj S N", email: "punith@livelongwealth.com", role: "BDM", manager_name: "", team_name: "Punith Raj S N Team" },
  { name: "Aman Israr", email: "aman@livelongwealth.com", role: "BDA", manager_name: "Punith Raj S N", team_name: "Punith Raj S N Team" },
  { name: "Harshitha Gowda", email: "harshitha@livelongwealth.com", role: "BDA", manager_name: "Punith Raj S N", team_name: "Punith Raj S N Team" },
  { name: "Kavya P P", email: "kavya@livelongwealth.com", role: "BDA", manager_name: "Punith Raj S N", team_name: "Punith Raj S N Team" },
  { name: "Sharadhi Bhat", email: "sharadhi@livelongwealth.com", role: "BDA", manager_name: "Punith Raj S N", team_name: "Punith Raj S N Team" },
  { name: "Ankit Saxena", email: "ankit@livelongwealth.com", role: "BDM", manager_name: "", team_name: "Ankit Saxena Team" },
  { name: "Arpitha Fernandes", email: "arpitha@livelongwealth.com", role: "BDA", manager_name: "Ankit Saxena", team_name: "Ankit Saxena Team" },
  { name: "Darshini M D", email: "darshini@livelongwealth.com", role: "BDA", manager_name: "Ankit Saxena", team_name: "Ankit Saxena Team" },
  { name: "Kashif Abbas", email: "kashif@livelongwealth.com", role: "BDA", manager_name: "Ankit Saxena", team_name: "Ankit Saxena Team" },
  { name: "Yeswitha Kadiri", email: "yeswitha@livelongwealth.com", role: "BDA", manager_name: "Ankit Saxena", team_name: "Ankit Saxena Team" },
  { name: "Saravana Kumar", email: "saravana@livelongwealth.com", role: "BDM", manager_name: "", team_name: "Saravana Kumar Team" },
  { name: "Naresh M", email: "naresh@livelongwealth.com", role: "BDA", manager_name: "Saravana Kumar", team_name: "Saravana Kumar Team" },
  { name: "Rohan A R", email: "rohan@livelongwealth.com", role: "BDA", manager_name: "Saravana Kumar", team_name: "Saravana Kumar Team" },
  { name: "Sateesh N S", email: "sateesh@livelongwealth.com", role: "BDA", manager_name: "Saravana Kumar", team_name: "Saravana Kumar Team" },
  { name: "Shreya Sarvade", email: "shreya@livelongwealth.com", role: "BDA", manager_name: "Saravana Kumar", team_name: "Saravana Kumar Team" },
  { name: "Akhila", email: "akhila@livelongwealth.com", role: "BDM", manager_name: "", team_name: "Akhila Team" },
  { name: "Adarsh", email: "adarsh@livelongwealth.com", role: "BDA", manager_name: "Akhila", team_name: "Akhila Team" },
  { name: "Aswin", email: "aswin@livelongwealth.com", role: "BDA", manager_name: "Akhila", team_name: "Akhila Team" },
  { name: "Aika", email: "aika@livelongwealth.com", role: "BDA", manager_name: "Akhila", team_name: "Akhila Team" },
  { name: "Bilu", email: "bilu@livelongwealth.com", role: "BDA", manager_name: "Akhila", team_name: "Akhila Team" },
  { name: "Bibin", email: "bibin@livelongwealth.com", role: "ADMIN", manager_name: "", team_name: "Operations" },
  { name: "Abhinav", email: "abhinav@livelongwealth.com", role: "ADMIN", manager_name: "", team_name: "Operations" },
  { name: "Dhanush", email: "dhanush@livelongwealth.com", role: "ADMIN", manager_name: "", team_name: "Operations" },
  { name: "Arun", email: "arun@livelongwealth.com", role: "ADMIN", manager_name: "", team_name: "Operations" },
  { name: "Vaisakh V S", email: "vaisakh.vs@livelongwealth.com", role: "ADMIN", manager_name: "", team_name: "Operations" },
  { name: "Drisya", email: "drisya@livelongwealth.com", role: "ADMIN", manager_name: "", team_name: "Operations" },
  { name: "Sravani", email: "sravani@livelongwealth.com", role: "ADMIN", manager_name: "", team_name: "Operations" },
];
const requiredTeamMemberByEmail = new Map(requiredTeamMembers.map((member) => [member.email.toLowerCase(), member]));
const productBatchMonths = [
  { key: "JAN", label: "Jan" },
  { key: "FEB", label: "Feb" },
  { key: "MAR", label: "Mar" },
  { key: "APR", label: "Apr" },
  { key: "MAY", label: "May" },
  { key: "JUN", label: "Jun" },
  { key: "JUL", label: "Jul" },
  { key: "AUG", label: "Aug" },
  { key: "SEP", label: "Sep" },
  { key: "OCT", label: "Oct" },
  { key: "NOV", label: "Nov" },
  { key: "DEC", label: "Dec" },
];
const productBatchMonthByKey = new Map(productBatchMonths.map((month) => [month.key, month]));
const supportedProductLanguages = ["English", "Hindi", "Malayalam"];
const supportedLearningSchedules = [
  { key: "WEEKDAY", label: "Weekday" },
  { key: "WEEKEND", label: "Weekend" },
];
const couponResetRevision = 1;
const priceUpdateCouponRevision = 1;
const productSessionDateDefaultRevision = 1;
const priceUpdateCouponSpecs = [
  { productName: "Indian Market (Online)", code: "IMO30000", finalPriceInr: 30000, valueInr: 9999 },
  { productName: "Forex Market (Online)", code: "FMO35000", finalPriceInr: 35000, valueInr: 4999 },
  { productName: "Indian + Forex CTP (Online)", code: "CTPO50000", finalPriceInr: 50000, valueInr: 9999 },
  { productName: "Indian + LiveX0 (Online)", code: "ILXO45000", finalPriceInr: 45000, valueInr: 9999 },
  { productName: "Forex + LiveX0 (Online)", code: "FLXO45000", finalPriceInr: 45000, valueInr: 9999 },
  { productName: "CTP + LiveX0 (Online)", code: "CLXO55000", finalPriceInr: 55000, valueInr: 14999 },
  { productName: "Indian Market (Offline)", code: "IMOFF50000", finalPriceInr: 50000, valueInr: 19999 },
  { productName: "Forex Market (Offline)", code: "FMOFF50000", finalPriceInr: 50000, valueInr: 19999 },
  { productName: "Indian + Forex CTP (Offline)", code: "CTPOFF80000", finalPriceInr: 80000, valueInr: 59999 },
  { productName: "Indian + LiveX0 (Offline)", code: "ILXOFF60000", finalPriceInr: 60000, valueInr: 24999 },
  { productName: "Forex + LiveX0 (Offline)", code: "FLXOFF60000", finalPriceInr: 60000, valueInr: 24999 },
  { productName: "CTP + LiveX0 (Offline)", code: "CLXOFF85000", finalPriceInr: 85000, valueInr: 84999 },
];

function nowIso() {
  return new Date().toISOString();
}

function buildDefaultBatchSessionDate(batchKey = "", referenceValue = nowIso()) {
  const referenceTimestamp = new Date(referenceValue || nowIso()).getTime();
  const referenceDate = Number.isFinite(referenceTimestamp) ? new Date(referenceTimestamp) : new Date();
  const batchIndex = productBatchMonths.findIndex((month) => month.key === batchKey);
  const monthIndex = batchIndex >= 0 ? batchIndex : referenceDate.getUTCMonth();
  const year = referenceDate.getUTCFullYear();
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
}

function coerceIsoTimestamp(value, fallback = nowIso()) {
  if (!value) return fallback;
  const raw = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw;
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function createRoomName(base) {
  const slug = slugify(base) || "session";
  return `${slug}-${Math.random().toString(36).slice(2, 10)}`;
}

function createPrettySlug(base) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `livelong.wealth-${slugify(base || "link")}-${suffix}`.replace(/-+/g, "-");
}

function buildAbsolutePath(roomName, role) {
  return `/webinar/${role}/${roomName}`;
}

function normalizePaymentMethod(value = "RAZORPAY") {
  const normalized = String(value || "RAZORPAY").toUpperCase();
  if (normalized.includes("CASH")) return "CASH";
  if (normalized.includes("BANK") || normalized.includes("TRANSFER")) return "BANK_TRANSFER";
  return "RAZORPAY";
}

function normalizePaymentStatus(value = "CREATED") {
  const normalized = String(value || "CREATED").toUpperCase();
  if (["PAID", "FAILED", "REFUNDED"].includes(normalized)) return normalized;
  return "CREATED";
}

function normalizePaymentType(value = "ENROLLMENT") {
  return String(value || "ENROLLMENT").toUpperCase() === "RECOVERY" ? "RECOVERY" : "ENROLLMENT";
}

function normalizePaymentStage(value = "FULL") {
  const normalized = String(value || "FULL").toUpperCase();
  if (["TOKEN_1", "TOKEN_2", "RECOVERY"].includes(normalized)) return normalized;
  return "FULL";
}

function isPaidStatus(value) {
  return normalizePaymentStatus(value) === "PAID";
}

function isManualMethod(value) {
  const method = normalizePaymentMethod(value);
  return method === "CASH" || method === "BANK_TRANSFER";
}

function normalizeSourceType(value = "MANUAL") {
  const normalized = String(value || "MANUAL").toUpperCase();
  if (["WEBINAR", "BOOTCAMP", "BDA", "MANUAL"].includes(normalized)) return normalized;
  return "MANUAL";
}

function normalizePreferredLanguage(value = "English") {
  const normalized = String(value || "English").trim().toUpperCase();
  if (normalized === "HINDI") return "Hindi";
  if (normalized === "MALAYALAM") return "Malayalam";
  return "English";
}

function normalizeLearningSchedule(value = "WEEKDAY") {
  return String(value || "WEEKDAY").trim().toUpperCase() === "WEEKEND" ? "WEEKEND" : "WEEKDAY";
}

function normalizeCouponType(value = "FLAT") {
  return String(value || "FLAT").toUpperCase() === "PERCENT" ? "PERCENT" : "FLAT";
}

function normalizeCouponUsageFrequency(value = "UNLIMITED") {
  const normalized = String(value || "UNLIMITED").toUpperCase();
  if (["ONE_TIME", "LIMITED"].includes(normalized)) return normalized;
  return "UNLIMITED";
}

function normalizeRefundStatus(value = "REQUESTED") {
  const normalized = String(value || "REQUESTED").toUpperCase();
  if (["APPROVED", "REJECTED"].includes(normalized)) return normalized;
  return "REQUESTED";
}

function dayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatShortDay(value) {
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysAgo(days) {
  const date = startOfToday();
  date.setDate(date.getDate() - days);
  return date;
}

function toEndOfDayIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

function extractAliasFromLink(link) {
  if (!link) return "";
  try {
    if (String(link).startsWith("http")) {
      return new URL(link).pathname.replace(/^\//, "");
    }
  } catch {
    // Ignore invalid URLs and fall back to plain text.
  }
  return String(link).replace(/^\//, "");
}

function cloneSeedData() {
  const seed = structuredClone(createSeedStore().data);
  const createdAt = nowIso();

  seed.webinarSessions = seed.webinars.map((webinar, index) => ({
    id: `session-${String(index + 1).padStart(3, "0")}`,
    webinar_id: webinar.id,
    title: `${webinar.title} Session`,
    description: webinar.description,
    room_name: webinar.livekit_room_name,
    host_url: webinar.host_url,
    attendee_url: webinar.attendee_url,
    short_host_url: webinar.short_host_url,
    short_attendee_url: webinar.short_attendee_url,
    start_time: webinar.start_time,
    end_time: webinar.end_time,
    status: webinar.status,
    is_active: index === 0,
    created_at: webinar.created_at,
    updated_at: webinar.updated_at,
  }));

  seed.webinarAttendance = seed.webinarAttendance.map((record) => ({
    ...record,
    session_id: seed.webinarSessions.find((session) => session.webinar_id === record.webinar_id)?.id ?? null,
    role: "ATTENDEE",
    email: "",
    connection_quality: Number(record.connection_quality || 0),
    session_title: seed.webinarSessions.find((session) => session.webinar_id === record.webinar_id)?.title ?? "",
  }));

  seed.refunds = [
    {
      id: "refund-001",
      order_id: seed.orders[0]?.id ?? null,
      gateway_order_id: seed.orders[0]?.razorpay_order_id || "order_demo_001",
      student_name: seed.students[0]?.name || "Abhinav Menon",
      phone: seed.students[0]?.phone || "919645812284",
      amount_inr: seed.orders[0]?.amount_inr || 3999900,
      course_name: seed.products[0]?.name || "Indian Market (Online)",
      requested_by: "Ayush Pant",
      requested_by_email: "ayush.pant@livelongwealth.com",
      user_comment: "Student requested refund due to schedule mismatch.",
      admin_comment: "",
      status: "REQUESTED",
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: "refund-002",
      order_id: seed.orders[1]?.id ?? null,
      gateway_order_id: seed.orders[1]?.razorpay_order_id || "order_demo_002",
      student_name: seed.students[1]?.name || "Sneha Kulkarni",
      phone: seed.students[1]?.phone || "919876543210",
      amount_inr: seed.orders[1]?.amount_inr || 5999900,
      course_name: seed.products[2]?.name || "Indian + Forex CTP (Online)",
      requested_by: "Saloni Sharma",
      requested_by_email: "saloni.sharma@livelongwealth.com",
      user_comment: "Approved as part of the service recovery flow.",
      admin_comment: "Approved by admin.",
      status: "APPROVED",
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  return seed;
}

function ensureDataFile() {
  if (existsSync(dataFile)) {
    return;
  }

  mkdirSync(dirname(dataFile), { recursive: true });
  if (existsSync(seedDataFile)) {
    writeFileSync(dataFile, readFileSync(seedDataFile, "utf8"));
    return;
  }

  writeFileSync(dataFile, JSON.stringify(buildPersistentData(buildSeedData()), null, 2));
}

function snapshotDataFile() {
  try {
    mkdirSync(backupDir, { recursive: true });
    copyFileSync(dataFile, join(backupDir, "app-data.last.json"));
    const day = new Date().toISOString().slice(0, 10);
    copyFileSync(dataFile, join(backupDir, `app-data.${day}.json`));
  } catch (error) {
    console.error("backup failed", error);
  }
}

function hasAppliedGitTeamResetToken() {
  if (!existsSync(teamResetMarkerFile)) return false;
  try {
    return String(readFileSync(teamResetMarkerFile, "utf8") || "").trim() === teamResetToken;
  } catch {
    return false;
  }
}

function markGitTeamResetApplied() {
  mkdirSync(dirname(teamResetMarkerFile), { recursive: true });
  writeFileSync(teamResetMarkerFile, `${teamResetToken}\n`);
}

function hasAppliedGitCouponResetToken() {
  if (!existsSync(couponResetMarkerFile)) return false;
  try {
    return String(readFileSync(couponResetMarkerFile, "utf8") || "").trim() === gitCouponResetToken;
  } catch {
    return false;
  }
}

function markGitCouponResetApplied() {
  mkdirSync(dirname(couponResetMarkerFile), { recursive: true });
  writeFileSync(couponResetMarkerFile, `${gitCouponResetToken}\n`);
}

function applyGitTrackedTeamReset(snapshot) {
  if (!shouldResetTeamFromGitOnStartup || hasAppliedGitTeamResetToken()) {
    return { data: snapshot, changed: false, reason: "", markDone: false };
  }

  try {
    const gitTracked = buildPersistentData(JSON.parse(readFileSync(gitTrackedDataFile, "utf8")));
    const sourceTeam = Array.isArray(gitTracked.team) ? gitTracked.team : [];
    if (!sourceTeam.length) {
      return { data: snapshot, changed: false, reason: "", markDone: false };
    }

    const next = structuredClone(snapshot);
    const currentTeam = Array.isArray(next.team) ? next.team : [];
    const currentByEmail = new Map(
      currentTeam
        .filter((member) => member?.email)
        .map((member) => [String(member.email).toLowerCase(), member]),
    );
    const currentById = new Map(
      currentTeam
        .filter((member) => member?.id)
        .map((member) => [String(member.id), member]),
    );

    let changed = false;
    let restoredCount = 0;

    sourceTeam.forEach((sourceMember) => {
      const normalizedEmail = String(sourceMember?.email || "").toLowerCase();
      const existingMember = currentByEmail.get(normalizedEmail) || currentById.get(String(sourceMember?.id || "")) || null;
      const mergedMember = existingMember
        ? {
            ...existingMember,
            ...sourceMember,
            avatar_url: sourceMember.avatar_url || existingMember.avatar_url || "",
            updated_at: new Date().toISOString(),
          }
        : structuredClone(sourceMember);

      if (!existingMember) {
        currentTeam.push(mergedMember);
        changed = true;
        restoredCount += 1;
        return;
      }

      const existingSerialized = JSON.stringify(existingMember);
      const mergedSerialized = JSON.stringify(mergedMember);
      if (existingSerialized !== mergedSerialized) {
        const index = currentTeam.findIndex((member) => {
          if (!member) return false;
          if (existingMember.id && member.id === existingMember.id) return true;
          return String(member.email || "").toLowerCase() === String(existingMember.email || "").toLowerCase();
        });
        if (index >= 0) {
          currentTeam[index] = mergedMember;
          changed = true;
          restoredCount += 1;
        }
      }
    });

    if (changed) {
      console.log(`[data-store] Restored ${restoredCount} team records from git-tracked data file.`);
    } else {
      console.log("[data-store] Team records already matched the git-tracked data file.");
    }

    next.team = currentTeam;
    return {
      data: next,
      changed,
      reason: `git-team-reset-${teamResetToken}`,
      markDone: true,
    };
  } catch (error) {
    console.error("[data-store] One-time git team reset failed:", error instanceof Error ? error.message : error);
    return { data: snapshot, changed: false, reason: "", markDone: false };
  }
}

function applyGitTrackedCouponReset(snapshot) {
  if (!shouldResetCouponsFromGitOnStartup || hasAppliedGitCouponResetToken()) {
    return { data: snapshot, changed: false, reason: "", markDone: false };
  }

  try {
    const gitTracked = buildPersistentData(JSON.parse(readFileSync(gitTrackedDataFile, "utf8")));
    const sourceCoupons = (Array.isArray(gitTracked.coupons) ? gitTracked.coupons : [])
      .map(normalizeCoupon)
      .filter((coupon) => coupon.code);
    if (!sourceCoupons.length) {
      return { data: snapshot, changed: false, reason: "", markDone: false };
    }

    const next = structuredClone(snapshot);
    const currentCoupons = (Array.isArray(next.coupons) ? next.coupons : [])
      .map(normalizeCoupon)
      .filter((coupon) => coupon.code);
    const currentByCode = new Map(currentCoupons.map((coupon) => [coupon.code, coupon]));

    let changed = false;
    let syncedCount = 0;
    const mergedCoupons = sourceCoupons.map((sourceCoupon) => {
      const existingCoupon = currentByCode.get(sourceCoupon.code);
      const mergedCoupon = existingCoupon
        ? normalizeCoupon({
            ...existingCoupon,
            ...sourceCoupon,
            id: existingCoupon.id || sourceCoupon.id,
            created_at: existingCoupon.created_at || sourceCoupon.created_at,
            usage_count: Math.max(Number(existingCoupon.usage_count || 0), Number(sourceCoupon.usage_count || 0)),
            updated_at: nowIso(),
          })
        : sourceCoupon;

      if (!existingCoupon || JSON.stringify(existingCoupon) !== JSON.stringify(mergedCoupon)) {
        changed = true;
        syncedCount += 1;
      }

      currentByCode.delete(sourceCoupon.code);
      return mergedCoupon;
    });

    next.coupons = [...mergedCoupons, ...currentByCode.values()];
    if (changed) {
      console.log(`[data-store] Restored ${syncedCount} coupon records from git-tracked data file.`);
    } else {
      console.log("[data-store] Coupons already matched the git-tracked data file.");
    }

    return {
      data: next,
      changed,
      reason: `git-coupon-reset-${gitCouponResetToken}`,
      markDone: true,
    };
  } catch (error) {
    console.error("[data-store] One-time git coupon reset failed:", error instanceof Error ? error.message : error);
    return { data: snapshot, changed: false, reason: "", markDone: false };
  }
}

function buildSeedData() {
  return cloneSeedData();
}

function normalizeTeamMembers(team = []) {
  const adminFallback =
    team.find((member) => ["ADMIN", "SUPER_ADMIN"].includes(String(member.role || "").toUpperCase()))?.name || "Operations Desk";

  const normalized = team.map((member, index) => {
    const email = String(member.email || "").toLowerCase();
    const requiredMember = requiredTeamMemberByEmail.get(email);
    const role = String(requiredMember?.role || member.role || (index === 0 ? "ADMIN" : "BDA")).toUpperCase();
    return {
      ...member,
      name: member.name || requiredMember?.name || "Team Member",
      email: member.email || requiredMember?.email || "",
      role,
      manager_name: member.manager_name || member.managerName || requiredMember?.manager_name || (role === "BDA" ? adminFallback : ""),
      team_name:
        member.team_name
        || member.teamName
        || requiredMember?.team_name
        || (role === "BDA" || role === "BDM" ? "Revenue" : "Operations"),
      is_active: member.is_active !== false,
      created_at: member.created_at || member.createdAt || nowIso(),
      updated_at: member.updated_at || member.updatedAt || nowIso(),
    };
  });

  requiredTeamMembers.forEach((requiredMember) => {
    if (normalized.some((member) => String(member.email || "").toLowerCase() === requiredMember.email.toLowerCase())) {
      return;
    }
    normalized.push({
      id: crypto.randomUUID(),
      name: requiredMember.name,
      email: requiredMember.email,
      role: requiredMember.role,
      is_active: true,
      password: "google-oauth",
      manager_name: requiredMember.manager_name,
      team_name: requiredMember.team_name,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
  });

  return normalized;
}

function normalizeSettings(settings = {}) {
  return {
    ...settings,
    bdm_coupon_limit_inr: Number(settings.bdm_coupon_limit_inr ?? settings.bdmCouponLimitInr ?? 1000000),
    coupon_reset_revision: Number(settings.coupon_reset_revision ?? settings.couponResetRevision ?? 0),
    price_update_coupon_revision: Number(settings.price_update_coupon_revision ?? settings.priceUpdateCouponRevision ?? 0),
    aisensy_payment_link_campaign:
      settings.aisensy_payment_link_campaign
      || settings.aisensyPaymentLinkCampaign
      || "payment_link_onboarding_2",
    aisensy_webhook_url:
      settings.aisensy_webhook_url
      || settings.aisensyWebhookUrl
      || "",
    updated_at: settings.updated_at || settings.updatedAt || nowIso(),
  };
}

function normalizeNumber(value) {
  if (value == null) return 0;
  const normalized = Number(String(value).replace(/,/g, "").trim() || 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

function normalizeMarketingDate(value, month, year) {
  const raw = String(value || "").trim();
  if (raw) {
    const [first = "", second = "", third = ""] = raw.split(/[/-]/).map((part) => part.trim());
    if (first && second && third) {
      const day = Number(first);
      const monthValue = Number(second);
      const yearValue = Number(third);
      if (Number.isFinite(day) && Number.isFinite(monthValue) && Number.isFinite(yearValue)) {
        return new Date(Date.UTC(yearValue, Math.max(monthValue - 1, 0), Math.max(day, 1))).toISOString();
      }
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (month && year) {
    return new Date(Date.UTC(Number(year), Math.max(Number(month) - 1, 0), 1)).toISOString();
  }

  return nowIso();
}

function normalizeMarketingCampaignName(record = {}) {
  return String(
    record.campaign_name
    || record.campaignName
    || record.campaign
    || record[" "]
    || record.market
    || record.CAMPAIGN
    || record.Campaign
    || record.CATEGORY
    || record.category
    || "Unknown Campaign",
  ).trim();
}

function normalizeMarketingSpend(record = {}, index = 0) {
  const month = Number(record.month ?? record.MONTH ?? 0) || null;
  const year = Number(record.year ?? record.YEAR ?? 0) || null;
  const createdAt = record.created_at || record.createdAt || nowIso();

  return {
    ...record,
    id: record.id || `marketing-${String(index + 1).padStart(5, "0")}`,
    date: normalizeMarketingDate(record.date || record.DATE, month, year),
    channel: String(record.channel || record.CATEGORY || record.category || "").trim(),
    campaign_name: normalizeMarketingCampaignName(record),
    department: String(record.department || record.DEPARTMENT || "").trim(),
    daily_spend_inr: normalizeNumber(record.daily_spend_inr ?? record["DAILY SPEND"]),
    lead_quantity: Math.round(normalizeNumber(record.lead_quantity ?? record["LEAD QUANTITY"])),
    product_value_inr: normalizeNumber(record.product_value_inr ?? record["PRODUCT VALUE"]),
    new_order_count: Math.round(normalizeNumber(record.new_order_count ?? record["NEW ORDER"])),
    in_hand_revenue_inr: normalizeNumber(record.in_hand_revenue_inr ?? record["IN HAND REVENUE"]),
    with_gst_spend_inr: normalizeNumber(record.with_gst_spend_inr ?? record["WITH GST SPEND"]),
    month: month || new Date(normalizeMarketingDate(record.date || record.DATE, month, year)).getUTCMonth() + 1,
    year: year || new Date(normalizeMarketingDate(record.date || record.DATE, month, year)).getUTCFullYear(),
    notes: String(record.notes || "").trim(),
    created_by_user_id: record.created_by_user_id || record.createdByUserId || null,
    created_by_name: record.created_by_name || record.createdByName || "",
    created_by_email: record.created_by_email || record.createdByEmail || "",
    created_by_role: record.created_by_role || record.createdByRole || "",
    created_at: createdAt,
    updated_at: record.updated_at || record.updatedAt || createdAt,
  };
}

function normalizeCoupon(record, index = 0) {
  const createdAt = record.created_at || record.createdAt || nowIso();
  const usageFrequency = normalizeCouponUsageFrequency(record.usage_frequency || record.usageFrequency);
  const usageLimitRaw = record.usage_limit_total ?? record.usageLimitTotal;
  const usageLimitTotal =
    usageFrequency === "UNLIMITED"
      ? null
      : Math.max(Number(usageLimitRaw ?? (usageFrequency === "ONE_TIME" ? 1 : 0)), usageFrequency === "ONE_TIME" ? 1 : 0) || null;
  return {
    ...record,
    id: record.id || `coupon-${String(index + 1).padStart(3, "0")}`,
    code: String(record.code || record.coupon_code || record.couponCode || "").trim().toUpperCase(),
    title: String(record.title || record.name || record.code || `Coupon ${index + 1}`).trim(),
    description: String(record.description || "").trim(),
    type: normalizeCouponType(record.type || record.discount_type || record.discountType),
    value: Number(record.value ?? record.discount_value ?? record.discountValue ?? 0),
    max_discount_inr:
      record.max_discount_inr == null && record.maxDiscountInr == null
        ? null
        : Number(record.max_discount_inr ?? record.maxDiscountInr ?? 0),
    applicable_product_id: record.applicable_product_id || record.applicableProductId || null,
    applies_to: String(record.applies_to || record.appliesTo || ((record.applicable_product_id || record.applicableProductId) ? "PRODUCT" : "GENERAL")).toUpperCase() === "PRODUCT" ? "PRODUCT" : "GENERAL",
    is_active: record.is_active ?? record.isActive ?? true,
    usage_count: Number(record.usage_count ?? record.usageCount ?? 0),
    usage_frequency: usageFrequency,
    usage_limit_total: usageLimitTotal,
    expires_at: toEndOfDayIso(record.expires_at || record.expiresAt || record.valid_until || record.validUntil),
    created_by: record.created_by || record.createdBy || "system",
    created_by_user_id: record.created_by_user_id || record.createdByUserId || null,
    created_by_name: record.created_by_name || record.createdByName || "",
    created_by_email: record.created_by_email || record.createdByEmail || "",
    created_by_role: String(record.created_by_role || record.createdByRole || "").toUpperCase(),
    created_at: createdAt,
    updated_at: record.updated_at || record.updatedAt || createdAt,
  };
}

function normalizeRefundRecord(record, index = 0) {
  const createdAt = record.created_at || record.createdAt || nowIso();
  const status = normalizeRefundStatus(record.status);
  return {
    ...record,
    id: record.id || `refund-${String(index + 1).padStart(3, "0")}`,
    order_id: record.order_id || record.orderId || null,
    payment_id: record.payment_id || record.paymentId || null,
    gateway_order_id: record.gateway_order_id || record.gatewayOrderId || "",
    student_name: record.student_name || record.studentName || "Guest user",
    phone: record.phone || "",
    amount_inr: Number(record.amount_inr ?? record.amount ?? 0),
    course_name: record.course_name || record.courseName || "Manual refund",
    requested_by: record.requested_by || record.requestedBy || "Admin",
    requested_by_email: record.requested_by_email || record.requestedByEmail || "admin@livelongwealth.com",
    requested_by_role: record.requested_by_role || record.requestedByRole || "ADMIN",
    user_comment: record.user_comment || record.userComment || "",
    admin_comment: record.admin_comment || record.adminComment || "",
    approval_chain: record.approval_chain || record.approvalChain || "",
    next_approver_name: record.next_approver_name || record.nextApproverName || "",
    next_approver_role: record.next_approver_role || record.nextApproverRole || "",
    status,
    approved_at:
      status === "APPROVED"
        ? record.approved_at || record.approvedAt || record.updated_at || record.updatedAt || createdAt
        : record.approved_at || record.approvedAt || null,
    rejected_at:
      status === "REJECTED"
        ? record.rejected_at || record.rejectedAt || record.updated_at || record.updatedAt || createdAt
        : record.rejected_at || record.rejectedAt || null,
    decision_by: record.decision_by || record.decisionBy || "",
    decision_by_role: record.decision_by_role || record.decisionByRole || "",
    created_at: createdAt,
    updated_at: record.updated_at || record.updatedAt || createdAt,
  };
}

function normalizeBatchKey(value = "") {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .slice(0, 3);
  return productBatchMonthByKey.has(normalized) ? normalized : "";
}

function normalizeProductBatches(batches = []) {
  const batchMap = new Map();

  (Array.isArray(batches) ? batches : []).forEach((batch) => {
    const key = normalizeBatchKey(batch?.key || batch?.month || batch?.value || batch?.label);
    if (!key) return;
    batchMap.set(key, {
      key,
      label: productBatchMonthByKey.get(key)?.label || key,
      is_active: batch?.is_active ?? batch?.isActive ?? batch?.active ?? true,
    });
  });

  return productBatchMonths.map((month) => {
    const existing = batchMap.get(month.key);
    return {
      key: month.key,
      label: month.label,
      is_active: existing?.is_active ?? true,
    };
  });
}

function normalizeSessionDateValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : "";
}

function normalizeProductSessionDates(sessionDates = [], mode = "ONLINE") {
  const sessionMap = new Map();

  (Array.isArray(sessionDates) ? sessionDates : []).forEach((session) => {
    const language = normalizePreferredLanguage(session?.language);
    const learningSchedule = normalizeLearningSchedule(session?.learning_schedule || session?.learningSchedule || session?.schedule);
    sessionMap.set(`${language}:${learningSchedule}`, {
      language,
      learning_schedule: learningSchedule,
      session_date: normalizeSessionDateValue(session?.session_date || session?.sessionDate || session?.date),
    });
  });

  return supportedProductLanguages.flatMap((language) => (
    supportedLearningSchedules.map((schedule) => {
      const key = `${language}:${schedule.key}`;
      const existing = sessionMap.get(key);
      return {
        key: `${language.toUpperCase()}_${schedule.key}`,
        mode: String(mode || "ONLINE").toUpperCase(),
        language,
        learning_schedule: schedule.key,
        label: `${language} • ${schedule.label}`,
        session_date: existing?.session_date || buildDefaultBatchSessionDate("", nowIso()),
      };
    })
  ));
}

function normalizeProductRecord(record, index = 0) {
  const createdAt = record.created_at || record.createdAt || nowIso();
  const mode = String(record.mode || "ONLINE").toUpperCase();
  return {
    ...record,
    id: record.id || `product-${String(index + 1).padStart(3, "0")}`,
    name: String(record.name || `Product ${index + 1}`).trim(),
    slug: record.slug || slugify(record.name || `product-${index + 1}`),
    mode,
    category: String(record.category || "GENERAL").toUpperCase(),
    price: Number(record.price ?? 0),
    discounted_price: Number(record.discounted_price ?? record.discountedPrice ?? record.price ?? 0),
    duration_months: Number(record.duration_months ?? record.durationMonths ?? 6),
    short_description: String(record.short_description || record.shortDescription || "").trim(),
    long_description: String(record.long_description || record.longDescription || "").trim(),
    onboarding_form_url: record.onboarding_form_url || record.onboardingFormUrl || "",
    whatsapp_group_url: record.whatsapp_group_url || record.whatsappGroupUrl || "",
    welcome_kit_url: record.welcome_kit_url || record.welcomeKitUrl || "",
    razorpay_plan_id: record.razorpay_plan_id || record.razorpayPlanId || "",
    is_active: record.is_active ?? record.isActive ?? true,
    batches: normalizeProductBatches(record.batches || record.batch_availability || record.batchAvailability),
    session_dates: normalizeProductSessionDates(record.session_dates || record.sessionDates, mode),
    created_at: createdAt,
    updated_at: record.updated_at || record.updatedAt || createdAt,
  };
}

function buildRefundApprovalFlow(data, requester = {}) {
  const role = String(requester.role || "ADMIN").toUpperCase();
  const adminFallback =
    data.team.find((member) => ["ADMIN", "SUPER_ADMIN"].includes(String(member.role || "").toUpperCase()) && member.is_active !== false) ?? null;

  if (role === "BDA") {
    const teamMember = data.team.find((member) => member.id === requester.id) ?? null;
    const manager =
      data.team.find(
        (member) =>
          member.name === teamMember?.manager_name &&
          ["BDM", "ADMIN", "SUPER_ADMIN"].includes(String(member.role || "").toUpperCase()) &&
          member.is_active !== false,
      ) ?? adminFallback;

    return {
      requestedByRole: "BDA",
      approvalChain: "BDA request -> reporting manager review -> admin approval",
      nextApproverName: manager?.name || teamMember?.manager_name || adminFallback?.name || "Admin Desk",
      nextApproverRole: String(manager?.role || "ADMIN").toUpperCase(),
    };
  }

  if (role === "SUPER_ADMIN") {
    return {
      requestedByRole: "SUPER_ADMIN",
      approvalChain: "Direct finance approval",
      nextApproverName: "Final decision pending",
      nextApproverRole: "SUPER_ADMIN",
    };
  }

  return {
    requestedByRole: "ADMIN",
    approvalChain: "Admin review -> final approval",
    nextApproverName: adminFallback?.name || "Admin Desk",
    nextApproverRole: String(adminFallback?.role || "ADMIN").toUpperCase(),
  };
}

function calculateCouponDiscount(coupon, amountInr) {
  const amount = Math.max(Number(amountInr || 0), 0);
  if (!coupon || !coupon.is_active || amount <= 0) return 0;
  const type = normalizeCouponType(coupon.type);
  const rawDiscount = type === "PERCENT" ? Math.round((amount * Number(coupon.value || 0)) / 100) : Number(coupon.value || 0);
  const capped = coupon.max_discount_inr ? Math.min(rawDiscount, Number(coupon.max_discount_inr || 0)) : rawDiscount;
  return Math.max(Math.min(capped, amount), 0);
}

function isCouponExpired(coupon) {
  if (!coupon?.expires_at) return false;
  const expiresAt = new Date(coupon.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt < Date.now();
}

function getProductValue(order, data) {
  const product = data.products.find((item) => item.id === order.product_id) ?? null;
  return Number(order.product_value_inr || order.productValueInr || product?.discounted_price || order.amount_inr || 0);
}

function normalizeOrderRecord(order, data) {
  const productValue = getProductValue(order, data);
  const initialAmount = Number(order.amount_inr || 0);
  const product = data.products.find((item) => item.id === order.product_id) ?? null;
  const batchKey = normalizeBatchKey(
    order.batch_month_key
    || order.batchMonthKey
    || order.batch_key
    || order.batchKey
    || order.batch
    || order.batch_month_label
    || order.batchMonthLabel,
  );
  const paymentMode =
    String(order.payment_mode || order.paymentMode || "").toUpperCase() === "TOKEN" ||
    (productValue > 0 && initialAmount > 0 && initialAmount < productValue)
      ? "TOKEN"
      : "FULL";

  return {
    ...order,
    order_number: order.order_number || order.orderNumber || `LLW-${Date.now()}`,
    product_value_inr: productValue,
    payment_mode: paymentMode,
    portal_access_done: Boolean(order.portal_access_done ?? order.portalAccessDone),
    broker_setup_done: Boolean(order.broker_setup_done ?? order.brokerSetupDone),
    demat_setup_done: Boolean(order.demat_setup_done ?? order.dematSetupDone),
    welcome_kit_sent: Boolean(order.welcome_kit_sent ?? order.welcomeKitSent),
    promise_date: order.promise_date || order.promiseDate || null,
    collect_customer_details_on_checkout: Boolean(order.collect_customer_details_on_checkout ?? order.collectCustomerDetailsOnCheckout),
    created_by_user_id: order.created_by_user_id || order.createdByUserId || null,
    created_by_name: order.created_by_name || order.createdByName || "",
    created_by_email: order.created_by_email || order.createdByEmail || "",
    created_by_role: order.created_by_role || order.createdByRole || "",
    manager_name: order.manager_name || order.managerName || "",
    team_name: order.team_name || order.teamName || "",
    product_mode: String(order.product_mode || order.productMode || product?.mode || "").toUpperCase(),
    session_date: normalizeSessionDateValue(order.session_date || order.sessionDate) || buildDefaultBatchSessionDate(batchKey, order.created_at || order.createdAt || nowIso()),
    batch_month_key: batchKey || "",
    batch_month_label: batchKey ? productBatchMonthByKey.get(batchKey)?.label || batchKey : "",
    access_revocation_requested: Boolean(order.access_revocation_requested ?? order.accessRevocationRequested),
    access_revocation_requested_at: order.access_revocation_requested_at || order.accessRevocationRequestedAt || null,
    access_revocation_requested_by: order.access_revocation_requested_by || order.accessRevocationRequestedBy || "",
    access_revoked: Boolean(order.access_revoked ?? order.accessRevoked),
    access_revoked_at: order.access_revoked_at || order.accessRevokedAt || null,
    access_revoked_by: order.access_revoked_by || order.accessRevokedBy || "",
    created_at: order.created_at || order.createdAt || nowIso(),
    updated_at: order.updated_at || order.updatedAt || nowIso(),
  };
}

function buildLegacyPaymentRecords(orders, data) {
  return orders.map((order, index) => {
    const productValue = getProductValue(order, data);
    const initialAmount = Number(order.amount_inr || 0);
    const stage = productValue > 0 && initialAmount > 0 && initialAmount < productValue ? "TOKEN_1" : "FULL";
    const status = order.status === "PAID" ? "PAID" : order.status === "REFUNDED" ? "REFUNDED" : "CREATED";
    const paymentLink = order.payment_link || `/payment/${order.id}`;

    return {
      id: `payment-${order.id}`,
      order_id: order.id,
      student_id: order.student_id || null,
      product_id: order.product_id || null,
      amount_inr: initialAmount,
      method: "RAZORPAY",
      status,
      type: "ENROLLMENT",
      stage,
      transaction_id: order.razorpay_payment_id || `TXN-${String(index + 1).padStart(4, "0")}`,
      razorpay_order_id: order.razorpay_order_id || "",
      razorpay_payment_id: order.razorpay_payment_id || "",
      razorpay_signature: order.razorpay_signature || "",
      payment_link: paymentLink,
      slug: extractAliasFromLink(paymentLink),
      reference_code: "",
      proof_url: "",
      valid_until: order.promise_date ? toEndOfDayIso(order.promise_date) : null,
      created_at: order.created_at || nowIso(),
      updated_at: order.updated_at || order.created_at || nowIso(),
      paid_at: order.status === "PAID" ? order.updated_at || order.created_at || nowIso() : null,
    };
  });
}

function normalizePaymentRecord(record, index = 0) {
  const createdAt = record.created_at || record.createdAt || nowIso();
  const status = normalizePaymentStatus(record.status);
  const paymentLink =
    record.payment_link || record.external_url || record.externalUrl || (record.id ? `/payment/${record.id}` : null);

  return {
    ...record,
    id: record.id || crypto.randomUUID(),
    order_id: record.order_id || record.orderId,
    student_id: record.student_id || record.studentId || null,
    product_id: record.product_id || record.productId || null,
    amount_inr: Number(record.amount_inr ?? record.amount ?? 0),
    method: normalizePaymentMethod(record.method || record.payment_method),
    status,
    type: normalizePaymentType(record.type),
    stage: normalizePaymentStage(record.stage || record.payment_stage || record.paymentStage),
    transaction_id:
      record.transaction_id ||
      record.transactionId ||
      record.razorpay_payment_id ||
      record.reference_code ||
      `TXN-${String(index + 1).padStart(4, "0")}`,
    razorpay_order_id: record.razorpay_order_id || record.razorpayOrderId || "",
    razorpay_payment_id: record.razorpay_payment_id || record.razorpayPaymentId || "",
    razorpay_signature: record.razorpay_signature || record.razorpaySignature || "",
    payment_link: paymentLink,
    slug: record.slug || extractAliasFromLink(paymentLink),
    reference_code: record.reference_code || record.referenceCode || "",
    proof_url: record.proof_url || record.proofUrl || "",
    valid_until: record.valid_until || record.validUntil || null,
    created_at: createdAt,
    updated_at: record.updated_at || record.updatedAt || createdAt,
    paid_at:
      status === "PAID"
        ? record.paid_at || record.paidAt || record.updated_at || record.updatedAt || createdAt
        : record.paid_at || record.paidAt || null,
  };
}

function deriveDuePromises(orders, paymentRecords, data) {
  return orders.flatMap((order) => {
    const productValue = getProductValue(order, data);
    const amountPaid = paymentRecords
      .filter((payment) => payment.order_id === order.id && isPaidStatus(payment.status))
      .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0);
    const amountDue = Math.max(productValue - amountPaid, 0);

    if (!amountDue) {
      return [];
    }

    const fallbackDueDate = new Date(new Date(order.created_at || nowIso()).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return [
      {
        id: `due-${order.id}`,
        order_id: order.id,
        due_date: order.promise_date || fallbackDueDate,
        amount_inr: amountDue,
        fulfilled: false,
        created_at: order.created_at || nowIso(),
        updated_at: order.updated_at || order.created_at || nowIso(),
      },
    ];
  });
}

function normalizeDuePromise(promise) {
  const createdAt = promise.created_at || promise.createdAt || nowIso();
  return {
    ...promise,
    id: promise.id || crypto.randomUUID(),
    order_id: promise.order_id || promise.orderId,
    due_date: promise.due_date || promise.dueDate || nowIso(),
    amount_inr: Number(promise.amount_inr ?? promise.amount ?? 0),
    fulfilled: Boolean(promise.fulfilled),
    created_at: createdAt,
    updated_at: promise.updated_at || promise.updatedAt || createdAt,
  };
}

function buildPersistentData(data) {
  const team = normalizeTeamMembers(data.team ?? []);
  const coupons = (data.coupons ?? []).map(normalizeCoupon).filter((coupon) => coupon.code);
  const marketingSpend = (data.marketing_spend ?? data.marketingSpend ?? []).map(normalizeMarketingSpend).filter((row) => row.campaign_name);
  const base = {
    ...data,
    team,
    coupons,
    marketing_spend: marketingSpend,
    settings: normalizeSettings(data.settings ?? {}),
    webinarSessions: data.webinarSessions ?? data.webinar_sessions ?? [],
    webinarAttendance: data.webinarAttendance ?? data.webinar_attendance ?? [],
    refunds: (data.refunds ?? []).map(normalizeRefundRecord),
    links: data.links ?? [],
    products: (data.products ?? []).map(normalizeProductRecord),
    orders: data.orders ?? [],
    students: data.students ?? [],
    webinars: data.webinars ?? [],
    bootcamps: data.bootcamps ?? [],
    instructors: data.instructors ?? [],
  };

  const orders = base.orders.map((order) => normalizeOrderRecord(order, { ...base, orders: base.orders }));
  const paymentRecordsSource = data.payment_records ?? data.paymentRecords ?? [];
  const paymentRecords = (paymentRecordsSource.length ? paymentRecordsSource : buildLegacyPaymentRecords(orders, { ...base, orders })).map(
    (record, index) => normalizePaymentRecord(record, index),
  );
  const duePromisesSource = data.due_promises ?? data.duePromises ?? [];
  const duePromises = (duePromisesSource.length ? duePromisesSource : deriveDuePromises(orders, paymentRecords, { ...base, orders })).map(
    normalizeDuePromise,
  );

  return {
    ...base,
    orders,
    payment_records: paymentRecords,
    due_promises: duePromises,
  };
}

function buildPriceUpdateCoupons(products = [], currentCoupons = []) {
  const productByName = new Map((products || []).map((product) => [String(product.name || "").trim(), product]));
  const couponByCode = new Map((currentCoupons || []).map((coupon) => [String(coupon.code || "").trim().toUpperCase(), coupon]));
  const createdAt = nowIso();

  return priceUpdateCouponSpecs.flatMap((spec, index) => {
    const product = productByName.get(spec.productName);
    if (!product?.id) return [];
    const existingCoupon = couponByCode.get(spec.code) || null;
    return [
      normalizeCoupon({
        id: existingCoupon?.id || `coupon-price-update-${String(index + 1).padStart(12, "0")}`,
        code: spec.code,
        title: `${spec.productName} @ Rs ${spec.finalPriceInr.toLocaleString("en-IN")}`,
        description: `Auto-seeded price update coupon. Final payable price Rs ${spec.finalPriceInr.toLocaleString("en-IN")}.`,
        type: "FLAT",
        value: spec.valueInr * 100,
        max_discount_inr: null,
        applicable_product_id: product.id,
        applies_to: "PRODUCT",
        is_active: true,
        usage_frequency: "UNLIMITED",
        usage_limit_total: null,
        expires_at: null,
        created_by: existingCoupon?.created_by || "shashwat@livelongwealth.com",
        created_by_user_id: existingCoupon?.created_by_user_id || "10000000-0000-0000-0000-000000000001",
        created_by_name: existingCoupon?.created_by_name || "Shashwat Singh",
        created_by_email: existingCoupon?.created_by_email || "shashwat@livelongwealth.com",
        created_by_role: existingCoupon?.created_by_role || "SUPER_ADMIN",
        created_at: existingCoupon?.created_at || createdAt,
        updated_at: createdAt,
        usage_count: Number(existingCoupon?.usage_count || 0),
      }),
    ];
  });
}

function applyRuntimeDataMigrations(data) {
  const next = buildPersistentData(structuredClone(data));
  const currentRevision = Number(next.settings?.coupon_reset_revision || 0);
  const currentPriceUpdateCouponRevision = Number(next.settings?.price_update_coupon_revision || 0);
  const currentProductSessionRevision = Number(next.settings?.product_session_date_default_revision || 0);
  let changed = false;
  let reason = "";

  if (currentRevision < couponResetRevision) {
    next.coupons = [];
    next.settings = normalizeSettings({
      ...next.settings,
      coupon_reset_revision: couponResetRevision,
      updated_at: nowIso(),
    });
    changed = true;
    reason = `coupon-reset-revision-${couponResetRevision}`;
  }

  const requiredPriceUpdateCoupons = buildPriceUpdateCoupons(next.products || [], next.coupons || []);
  const requiredCodes = new Set(requiredPriceUpdateCoupons.map((coupon) => coupon.code));
  const missingRequiredCoupon = requiredPriceUpdateCoupons.some((coupon) => {
    const currentCoupon = (next.coupons || []).find((entry) => entry.code === coupon.code);
    return !currentCoupon
      || currentCoupon.applicable_product_id !== coupon.applicable_product_id
      || Number(currentCoupon.value || 0) !== Number(coupon.value || 0)
      || String(currentCoupon.usage_frequency || "").toUpperCase() !== "UNLIMITED"
      || currentCoupon.is_active !== true;
  });

  if (currentPriceUpdateCouponRevision < priceUpdateCouponRevision || missingRequiredCoupon) {
    const remainingCoupons = (next.coupons || []).filter((coupon) => !requiredCodes.has(coupon.code));
    next.coupons = [...requiredPriceUpdateCoupons, ...remainingCoupons];
    next.settings = normalizeSettings({
      ...next.settings,
      price_update_coupon_revision: priceUpdateCouponRevision,
      updated_at: nowIso(),
    });
    changed = true;
    reason = reason
      ? `${reason}+price-update-coupons-${priceUpdateCouponRevision}`
      : `price-update-coupons-${priceUpdateCouponRevision}`;
  }

  if (currentProductSessionRevision < productSessionDateDefaultRevision) {
    let productsChanged = false;
    next.products = (next.products || []).map((product) => {
      const normalizedSessionDates = normalizeProductSessionDates(product?.session_dates || product?.sessionDates, product?.mode || "ONLINE");
      const currentSessionDates = Array.isArray(product?.session_dates) ? product.session_dates : [];
      if (JSON.stringify(currentSessionDates) === JSON.stringify(normalizedSessionDates)) {
        return product;
      }
      productsChanged = true;
      return {
        ...product,
        session_dates: normalizedSessionDates,
        updated_at: nowIso(),
      };
    });

    next.settings = normalizeSettings({
      ...next.settings,
      product_session_date_default_revision: productSessionDateDefaultRevision,
      updated_at: nowIso(),
    });

    changed = true;
    reason = reason
      ? `${reason}+product-session-date-default-revision-${productSessionDateDefaultRevision}`
      : `product-session-date-default-revision-${productSessionDateDefaultRevision}`;
  }

  return { data: next, changed, reason };
}

async function readDataFile() {
  ensureDataFile();
  try {
    const parsed = JSON.parse(readFileSync(dataFile, "utf8"));
    const normalized = buildPersistentData(parsed);
    const loaded = await runtimePersistence.load(normalized);
    const hydrated = buildPersistentData(loaded);
    const gitReset = applyGitTrackedTeamReset(hydrated);
    const gitCouponReset = applyGitTrackedCouponReset(gitReset.data);
    const migrated = applyRuntimeDataMigrations(gitCouponReset.data);
    const changed = gitReset.changed || gitCouponReset.changed || migrated.changed;
    const reason = [gitReset.reason, gitCouponReset.reason, migrated.reason].filter(Boolean).join("+");
    writeFileSync(dataFile, JSON.stringify(migrated.data, null, 2));
    if (changed) {
      await runtimePersistence.save(migrated.data, reason);
    }
    if (gitReset.markDone) {
      markGitTeamResetApplied();
    }
    if (gitCouponReset.markDone) {
      markGitCouponResetApplied();
    }
    return migrated.data;
  } catch {
    const fallback = buildPersistentData(buildSeedData());
    writeFileSync(dataFile, JSON.stringify(fallback, null, 2));
    const loaded = await runtimePersistence.load(fallback);
    const hydrated = buildPersistentData(loaded);
    const gitReset = applyGitTrackedTeamReset(hydrated);
    const gitCouponReset = applyGitTrackedCouponReset(gitReset.data);
    const migrated = applyRuntimeDataMigrations(gitCouponReset.data);
    const changed = gitReset.changed || gitCouponReset.changed || migrated.changed;
    const reason = [gitReset.reason, gitCouponReset.reason, migrated.reason].filter(Boolean).join("+");
    writeFileSync(dataFile, JSON.stringify(migrated.data, null, 2));
    if (changed) {
      await runtimePersistence.save(migrated.data, reason);
    }
    if (gitReset.markDone) {
      markGitTeamResetApplied();
    }
    if (gitCouponReset.markDone) {
      markGitCouponResetApplied();
    }
    return migrated.data;
  }
}

function minutesBetween(start, end) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return 0;
  }
  return Math.max(Math.round((endTime - startTime) / 60000), 0);
}

function groupTimeline(attendance) {
  if (!attendance.length) {
    return constants.webinarTimeline;
  }

  const buckets = new Map();
  for (const record of attendance) {
    const joinDate = new Date(record.join_time || nowIso());
    const key = joinDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([minute, concurrent]) => ({ minute, concurrent }));
}

function getOrderPayments(data, orderId) {
  return data.payment_records
    .filter((record) => record.order_id === orderId)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
}

function getAmountPaid(order, data) {
  return getOrderPayments(data, order.id)
    .filter((payment) => isPaidStatus(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0);
}

function getApprovedRefundEventTime(refund) {
  return refund.approved_at || refund.updated_at || refund.created_at || nowIso();
}

function getRecoveryInstallmentSummary(order, data) {
  const recoveryPayments = getOrderPayments(data, order.id).filter((payment) => payment.type === "RECOVERY");
  const usableRecoveryPayments = recoveryPayments.filter((payment) => payment.status !== "FAILED");
  const paidRecoveryPayments = recoveryPayments.filter((payment) => payment.status === "PAID");
  return {
    total: recoveryPayments.length,
    usable: usableRecoveryPayments.length,
    paid: paidRecoveryPayments.length,
    remaining: order.payment_mode === "TOKEN" ? Math.max(2 - usableRecoveryPayments.length, 0) : 0,
  };
}

function getApprovedRefunds(data) {
  return (data.refunds ?? []).filter((refund) => normalizeRefundStatus(refund.status) === "APPROVED");
}

function getRefundedAmount(order, data) {
  if (!order?.id) return 0;
  return getApprovedRefunds(data)
    .filter((refund) => refund.order_id === order.id)
    .reduce((sum, refund) => sum + Number(refund.amount_inr || 0), 0);
}

function getNetCashCollected(order, data) {
  return Math.max(getAmountPaid(order, data) - getRefundedAmount(order, data), 0);
}

function getAmountDue(order, data) {
  return Math.max(getProductValue(order, data) - getAmountPaid(order, data), 0);
}

function isOperationsComplete(order) {
  return Boolean(order.portal_access_done && order.broker_setup_done);
}

function computeOrderStatus(order, data) {
  const payments = getOrderPayments(data, order.id);
  const productValue = getProductValue(order, data);
  const amountPaid = getAmountPaid(order, data);
  const refundedAmount = getRefundedAmount(order, data);

  if (amountPaid > 0 && refundedAmount >= amountPaid) {
    return "REFUNDED";
  }

  if (productValue > 0 && amountPaid >= productValue && amountPaid > 0) {
    return isOperationsComplete(order) ? "ACTIVE" : "OPERATIONS_IN_PROGRESS";
  }

  if (amountPaid > 0) {
    return "PARTIAL";
  }

  if (payments.some((payment) => payment.status === "FAILED")) {
    return "FAILED";
  }

  return "PENDING";
}

function getOrderSourceType(order) {
  if (order.webinar_id) return "WEBINAR";
  if (order.bootcamp_id) return "BOOTCAMP";
  if (order.bda_id) return "BDA";
  return normalizeSourceType(order.source_type || "MANUAL");
}

function getOrderSourceLabel(order, data) {
  if (order.webinar_id) {
    return data.webinars.find((entry) => entry.id === order.webinar_id)?.title || "Webinar";
  }
  if (order.bootcamp_id) {
    return data.bootcamps.find((entry) => entry.id === order.bootcamp_id)?.title || "Bootcamp";
  }
  if (order.bda_id) {
    return data.team.find((entry) => entry.id === order.bda_id)?.name || "BDA";
  }
  return order.utm_source || order.created_by_name || "Manual Entry";
}

function getPaymentState(order, data) {
  const amountPaid = getAmountPaid(order, data);
  const refundedAmount = getRefundedAmount(order, data);
  const amountDue = getAmountDue(order, data);
  const latestPayment = getOrderPayments(data, order.id)[0] ?? null;

  if (refundedAmount > 0) {
    return "REFUNDED";
  }

  if (latestPayment?.status === "FAILED" && amountPaid <= 0) {
    return "FAILED";
  }

  if (amountPaid > 0 && amountDue <= 0) {
    return "COMPLETED";
  }

  if (order.payment_mode === "TOKEN" && amountPaid > 0 && amountDue > 0) {
    return "TOKEN";
  }

  if (amountPaid > 0 && amountDue > 0) {
    return "PARTIAL";
  }

  if (latestPayment?.status === "FAILED") {
    return "FAILED";
  }

  return "PENDING";
}

function buildCashVsValueSeries(orders, paymentRecords, data, days = 30) {
  const end = startOfToday();
  const rows = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(end);
    day.setDate(end.getDate() - offset);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);

    const soldValue = orders
      .filter((order) => {
        const created = new Date(order.created_at).getTime();
        return created >= day.getTime() && created < next.getTime();
      })
      .reduce((sum, order) => sum + getProductValue(order, data), 0);

    const paidPayments = paymentRecords.filter((record) => {
      if (!isPaidStatus(record.status) || !record.paid_at) return false;
      const paidAt = new Date(record.paid_at).getTime();
      return paidAt >= day.getTime() && paidAt < next.getTime();
    });
    const approvedRefunds = getApprovedRefunds(data).filter((refund) => {
      const approvedAt = new Date(getApprovedRefundEventTime(refund)).getTime();
      return approvedAt >= day.getTime() && approvedAt < next.getTime();
    });
    const refundedAmount = approvedRefunds.reduce((sum, refund) => sum + Number(refund.amount_inr || 0), 0);

    rows.push({
      label: formatShortDay(day),
      date: dayKey(day),
      soldValue,
      cashInHand: Math.max(
        paidPayments.reduce((sum, record) => sum + Number(record.amount_inr || 0), 0) - refundedAmount,
        0,
      ),
      newRevenue: paidPayments
        .filter((record) => record.type === "ENROLLMENT")
        .reduce((sum, record) => sum + Number(record.amount_inr || 0), 0),
      recoveryRevenue: paidPayments
        .filter((record) => record.type === "RECOVERY")
        .reduce((sum, record) => sum + Number(record.amount_inr || 0), 0),
      refundedAmount,
    });
  }

  return rows;
}

function buildLeaderboard(data) {
  const bdas = data.team.filter((member) => member.role === "BDA");

  return bdas
    .map((bda) => {
      const bdaOrders = data.orders.filter((order) => order.bda_id === bda.id);
      const bdaPayments = data.payment_records.filter((payment) => {
        if (!isPaidStatus(payment.status)) return false;
        const order = data.orders.find((entry) => entry.id === payment.order_id);
        return order?.bda_id === bda.id;
      });
      const recoveryPipeline = data.due_promises
        .filter((promise) => !promise.fulfilled)
        .filter((promise) => data.orders.find((order) => order.id === promise.order_id)?.bda_id === bda.id)
        .reduce((sum, promise) => sum + Number(promise.amount_inr || 0), 0);
      const refundedAmount = getApprovedRefunds(data)
        .filter((refund) => data.orders.find((order) => order.id === refund.order_id)?.bda_id === bda.id)
        .reduce((sum, refund) => sum + Number(refund.amount_inr || 0), 0);
      const grossRevenue = bdaPayments.reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0);

      return {
        id: bda.id,
        name: bda.name,
        email: bda.email,
        manager_name: bda.manager_name || "",
        grossRevenue,
        refundedAmount,
        netRevenue: Math.max(grossRevenue - refundedAmount, 0),
        totalRevenue: grossRevenue,
        newRevenue: bdaPayments
          .filter((payment) => payment.type === "ENROLLMENT")
          .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0),
        recoveryRevenue: bdaPayments
          .filter((payment) => payment.type === "RECOVERY")
          .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0),
        soldValue: bdaOrders.reduce((sum, order) => sum + getProductValue(order, data), 0),
        recoveryPipeline,
        customers: new Set(bdaOrders.map((order) => order.student_id).filter(Boolean)).size,
      };
    })
    .sort((left, right) => right.totalRevenue - left.totalRevenue);
}

function buildManagerSummary(data, leaderboard) {
  const grouped = new Map();

  leaderboard.forEach((entry) => {
    const key = entry.manager_name || "Unassigned";
    const current = grouped.get(key) || {
      manager_name: key,
      totalRevenue: 0,
      grossRevenue: 0,
      netRevenue: 0,
      refundedAmount: 0,
      newRevenue: 0,
      recoveryRevenue: 0,
      soldValue: 0,
      recoveryPipeline: 0,
      teamMembers: 0,
      top_bda: "",
      top_bda_revenue: 0,
    };

    current.grossRevenue += entry.grossRevenue || 0;
    current.netRevenue += entry.netRevenue || Math.max((entry.totalRevenue || 0) - (entry.refundedAmount || 0), 0);
    current.refundedAmount += entry.refundedAmount || 0;
    current.totalRevenue += entry.totalRevenue;
    current.newRevenue += entry.newRevenue;
    current.recoveryRevenue += entry.recoveryRevenue;
    current.soldValue += entry.soldValue;
    current.recoveryPipeline += entry.recoveryPipeline;
    current.teamMembers += 1;

    if (entry.totalRevenue > current.top_bda_revenue) {
      current.top_bda_revenue = entry.totalRevenue;
      current.top_bda = entry.name;
    }

    grouped.set(key, current);
  });

  const managerPeople = data.team.filter((member) => member.role === "BDM");

  managerPeople.forEach((manager) => {
    const key = manager.name;
    if (!grouped.has(key)) {
      grouped.set(key, {
        manager_name: key,
        totalRevenue: 0,
        grossRevenue: 0,
        netRevenue: 0,
        refundedAmount: 0,
        newRevenue: 0,
        recoveryRevenue: 0,
        soldValue: 0,
        recoveryPipeline: 0,
        teamMembers: 0,
        top_bda: "—",
        top_bda_revenue: 0,
      });
    }

    const current = grouped.get(key);
    const directOrders = data.orders.filter((order) => order.bda_id === manager.id);
    const directPayments = data.payment_records.filter((payment) => {
      if (!isPaidStatus(payment.status)) return false;
      const order = data.orders.find((entry) => entry.id === payment.order_id);
      return order?.bda_id === manager.id;
    });
    const directRefunds = getApprovedRefunds(data)
      .filter((refund) => data.orders.find((order) => order.id === refund.order_id)?.bda_id === manager.id)
      .reduce((sum, refund) => sum + Number(refund.amount_inr || 0), 0);
    const directGrossRevenue = directPayments.reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0);
    const directRecoveryPipeline = data.due_promises
      .filter((promise) => !promise.fulfilled)
      .filter((promise) => data.orders.find((order) => order.id === promise.order_id)?.bda_id === manager.id)
      .reduce((sum, promise) => sum + Number(promise.amount_inr || 0), 0);

    current.grossRevenue += directGrossRevenue;
    current.totalRevenue += directGrossRevenue;
    current.netRevenue += Math.max(directGrossRevenue - directRefunds, 0);
    current.refundedAmount += directRefunds;
    current.newRevenue += directPayments
      .filter((payment) => payment.type === "ENROLLMENT")
      .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0);
    current.recoveryRevenue += directPayments
      .filter((payment) => payment.type === "RECOVERY")
      .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0);
    current.soldValue += directOrders.reduce((sum, order) => sum + getProductValue(order, data), 0);
    current.recoveryPipeline += directRecoveryPipeline;
  });

  return [...grouped.values()].sort((left, right) => right.totalRevenue - left.totalRevenue);
}

function withComputedPayment(order, data) {
  const student = data.students.find((item) => item.id === order.student_id) ?? null;
  const product = data.products.find((item) => item.id === order.product_id) ?? null;
  const webinar = data.webinars.find((item) => item.id === order.webinar_id) ?? null;
  const bootcamp = data.bootcamps.find((item) => item.id === order.bootcamp_id) ?? null;
  const bda = data.team.find((item) => item.id === order.bda_id) ?? null;
  const paymentHistory = getOrderPayments(data, order.id).map((payment) => ({
    ...payment,
    readable_method: payment.method.replaceAll("_", " "),
  }));
  const latestPayment = paymentHistory[0] ?? null;
  const latestSuccessfulPayment = paymentHistory
    .filter((payment) => isPaidStatus(payment.status))
    .sort((left, right) => new Date(right.paid_at || right.created_at).getTime() - new Date(left.paid_at || left.created_at).getTime())[0] ?? null;
  const openPayment = paymentHistory.find((payment) => payment.status === "CREATED") ?? latestPayment;
  const productValue = getProductValue(order, data);
  const grossAmountPaid = getAmountPaid(order, data);
  const refundedAmount = getRefundedAmount(order, data);
  const netCashCollected = getNetCashCollected(order, data);
  const amountDue = Math.max(productValue - grossAmountPaid, 0);
  const duePromise = data.due_promises.find((promise) => promise.order_id === order.id && !promise.fulfilled) ?? null;
  const status = computeOrderStatus(order, data);
  const refundHistory = data.refunds
    .filter((refund) => refund.order_id === order.id)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const sourceType = getOrderSourceType(order);
  const sourceLabel = getOrderSourceLabel(order, data);
  const paymentState = getPaymentState(order, data);
  const offerTitle = product?.name || webinar?.title || bootcamp?.title || sourceLabel;
  const recoveryInstallments = getRecoveryInstallmentSummary(order, data);
  const batchKey = order.batch_month_key || "";
  const selectedBatch = product && batchKey
    ? (product.batches || []).find((batch) => batch.key === batchKey) ?? null
    : null;
  const batchLabel = order.batch_month_label || selectedBatch?.label || (batchKey ? productBatchMonthByKey.get(batchKey)?.label || batchKey : "");

  return {
    ...order,
    status,
    student,
    phone: student?.phone || "",
    product,
    webinar,
    bootcamp,
    bda,
    source: order.utm_source || student?.source || (order.webinar_id ? "Webinar" : order.bootcamp_id ? "Bootcamp" : "Website"),
    source_type: sourceType,
    source_label: sourceLabel,
    offer_title: offerTitle,
    payment_state: paymentState,
    type: order.payment_mode === "TOKEN" ? "TOKEN" : "FULL",
    payment_mode: order.payment_mode,
    original_product_value_inr: Number(order.original_product_value_inr || product?.discounted_price || productValue),
    discount_inr: Number(order.discount_inr || 0),
    coupon_id: order.coupon_id || null,
    coupon_code: order.coupon_code || "",
    coupon_title: order.coupon_title || "",
    product_value_inr: productValue,
    amount_paid_inr: grossAmountPaid,
    refunded_amount_inr: refundedAmount,
    net_cash_in_hand_inr: netCashCollected,
    amount_due_inr: amountDue,
    promise_date: order.promise_date || null,
    latest_transaction_id: latestPayment?.transaction_id || "",
    latest_payment_method: latestPayment?.method || "RAZORPAY",
    latest_payment_status: latestPayment?.status || "CREATED",
    latest_successful_payment_at: latestSuccessfulPayment?.paid_at || latestSuccessfulPayment?.created_at || null,
    payment_link: latestPayment?.payment_link || order.payment_link || "",
    current_link_valid_until: openPayment?.valid_until || null,
    collect_customer_details_on_checkout: Boolean(order.collect_customer_details_on_checkout),
    payment_history: paymentHistory,
    refund_history: refundHistory,
    refund_count: refundHistory.length,
    access_revocation_requested: Boolean(order.access_revocation_requested),
    access_revocation_requested_at: order.access_revocation_requested_at || null,
    access_revocation_requested_by: order.access_revocation_requested_by || "",
    access_revoked: Boolean(order.access_revoked),
    access_revoked_at: order.access_revoked_at || null,
    access_revoked_by: order.access_revoked_by || "",
    recovery_installments_used: recoveryInstallments.usable,
    recovery_installments_paid: recoveryInstallments.paid,
    recovery_installments_remaining: recoveryInstallments.remaining,
    batch_month_key: batchKey,
    batch_month_label: batchLabel,
    batch_is_active: selectedBatch ? Boolean(selectedBatch.is_active) : null,
    token_due:
      amountDue > 0
        ? {
            amount_inr: amountDue,
            due_date: duePromise?.due_date || null,
            fulfilled: amountDue === 0,
          }
        : null,
    can_send_recovery: amountDue > 0,
    transaction_count: paymentHistory.length,
    cohort_start_date: order.session_date || webinar?.start_time || bootcamp?.created_at || order.created_at,
    operations: {
      portal_access_done: Boolean(order.portal_access_done),
      broker_setup_done: Boolean(order.broker_setup_done),
      demat_setup_done: Boolean(order.demat_setup_done),
      welcome_kit_sent: Boolean(order.welcome_kit_sent),
    },
    operations_completed: isOperationsComplete(order),
    manager_name: order.manager_name || bda?.manager_name || "",
    bdm_name: order.manager_name || bda?.manager_name || "",
    team_name: order.team_name || bda?.team_name || "",
    created_by_user_id: order.created_by_user_id || null,
    created_by_name: order.created_by_name || "",
    created_by_email: order.created_by_email || "",
    created_by_role: order.created_by_role || "",
  };
}

function matchesDays(value, days) {
  if (!days) return true;
  return new Date(value).getTime() >= daysAgo(days - 1).getTime();
}

function buildExportRows(data) {
  const orders = data.orders.map((order) => withComputedPayment(order, data));
  const payments = data.payment_records.map((payment) => {
    const order = orders.find((entry) => entry.id === payment.order_id);
    return {
      payment_id: payment.id,
      order_id: payment.order_id,
      sales_date: payment.paid_at || payment.created_at,
      bda_id: order?.bda?.id || "",
      bda_name: order?.bda?.name || "",
      manager_name: order?.manager_name || "",
      customer_name: order?.student?.name || "",
      phone: order?.student?.phone || "",
      product_id: order?.product?.id || "",
      product_name: order?.offer_title || order?.product?.name || "",
      batch_month_key: order?.batch_month_key || "",
      batch_month_label: order?.batch_month_label || "",
      source_type: order?.source_type || "",
      source_label: order?.source_label || "",
      payment_mode: order?.payment_mode || "FULL",
      payment_bucket: payment.type === "RECOVERY" ? "RECOVERY" : order?.payment_mode || "FULL",
      payment_method: payment.method,
      transaction_id: payment.transaction_id,
      amount_inr: Number(payment.amount_inr || 0),
      original_order_value_inr: Number(order?.original_product_value_inr || order?.product_value_inr || 0),
      discount_inr: Number(order?.discount_inr || 0),
      coupon_code: order?.coupon_code || "",
      order_value_inr: Number(order?.product_value_inr || 0),
      refunded_amount_inr: Number(order?.refunded_amount_inr || 0),
      net_cash_in_hand_inr: Number(order?.net_cash_in_hand_inr || 0),
      amount_due_inr: Number(order?.amount_due_inr || 0),
      payment_state: order?.payment_state || "PENDING",
      payment_status: payment.status,
      order_status: order?.status || "PENDING",
      source: order?.source || "",
      stage: payment.stage,
    };
  });

  const enrollments = orders.map((order) => ({
    order_id: order.id,
    created_at: order.created_at,
    bda_id: order.bda?.id || "",
    bda_name: order.bda?.name || "",
    manager_name: order.manager_name || "",
    customer_name: order.student?.name || "",
    phone: order.student?.phone || "",
    product_id: order.product?.id || "",
    product_name: order.offer_title || order.product?.name || "",
    batch_month_key: order.batch_month_key || "",
    batch_month_label: order.batch_month_label || "",
    source_type: order.source_type || "",
    source_label: order.source_label || "",
    original_product_value_inr: order.original_product_value_inr,
    discount_inr: order.discount_inr,
    coupon_code: order.coupon_code,
    payment_mode: order.payment_mode,
    payment_state: order.payment_state || "PENDING",
    product_value_inr: order.product_value_inr,
    amount_paid_inr: order.amount_paid_inr,
    refunded_amount_inr: order.refunded_amount_inr,
    net_cash_in_hand_inr: order.net_cash_in_hand_inr,
    amount_due_inr: order.amount_due_inr,
    status: order.status,
    source: order.source,
  }));

  const tokens = orders
    .filter((order) => order.amount_due_inr > 0)
    .map((order) => ({
      order_id: order.id,
      bda_id: order.bda?.id || "",
      bda_name: order.bda?.name || "",
      manager_name: order.manager_name || "",
      customer_name: order.student?.name || "",
      phone: order.student?.phone || "",
      product_id: order.product?.id || "",
      product_name: order.offer_title || order.product?.name || "",
      batch_month_key: order.batch_month_key || "",
      batch_month_label: order.batch_month_label || "",
      source_type: order.source_type || "",
      source_label: order.source_label || "",
      coupon_code: order.coupon_code || "",
      discount_inr: order.discount_inr || 0,
      amount_due_inr: order.amount_due_inr,
      due_date: order.token_due?.due_date || "",
      payment_state: order.payment_state || "PENDING",
      source: order.source,
      transaction_count: order.transaction_count,
    }));

  const refunds = data.refunds.map((refund) => {
    const order = orders.find((entry) => entry.id === refund.order_id);
    return {
      refund_id: refund.id,
      order_id: refund.order_id || "",
      payment_id: refund.payment_id || "",
      refund_date: getApprovedRefundEventTime(refund),
      refund_status: refund.status,
      bda_id: order?.bda?.id || "",
      bda_name: order?.bda?.name || "",
      manager_name: order?.manager_name || "",
      customer_name: refund.student_name || order?.student?.name || "",
      phone: refund.phone || order?.student?.phone || "",
      product_id: order?.product?.id || "",
      product_name: order?.offer_title || order?.product?.name || refund.course_name || "",
      batch_month_key: order?.batch_month_key || "",
      batch_month_label: order?.batch_month_label || "",
      source_type: order?.source_type || "",
      source_label: order?.source_label || "",
      payment_mode: order?.payment_mode || "",
      payment_bucket: "REFUND",
      coupon_code: order?.coupon_code || "",
      refund_amount_inr: Number(refund.amount_inr || 0),
      order_value_inr: Number(order?.product_value_inr || 0),
      collected_inr: Number(order?.amount_paid_inr || 0),
      net_cash_in_hand_inr: Number(order?.net_cash_in_hand_inr || 0),
      requested_by: refund.requested_by || "",
      requested_by_email: refund.requested_by_email || "",
      source: order?.source || "",
    };
  });

  return { payments, enrollments, tokens, refunds };
}

function applyExportFilters(rows, filters) {
  return rows.filter((row) => {
    const dateValue = row.sales_date || row.created_at || row.due_date;
    const matchesDate = matchesDays(dateValue, filters.days);
    const rowTimestamp = dateValue ? new Date(dateValue).getTime() : null;
    const matchesDateFrom = !filters.dateFrom || (rowTimestamp !== null && rowTimestamp >= new Date(filters.dateFrom).getTime());
    const matchesDateTo = !filters.dateTo || (rowTimestamp !== null && rowTimestamp <= new Date(`${filters.dateTo}T23:59:59.999Z`).getTime());
    const matchesBda = !filters.bdaId || row.bda_id === filters.bdaId;
    const matchesManager = !filters.managerName || row.manager_name === filters.managerName;
    const matchesProduct = !filters.productId || row.product_id === filters.productId;
    const matchesBatch = !filters.batchKey || row.batch_month_key === filters.batchKey;
    const matchesSourceType = !filters.sourceType || filters.sourceType === "ALL" || row.source_type === filters.sourceType;
    const matchesMode = !filters.paymentMode || filters.paymentMode === "ALL" || row.payment_mode === filters.paymentMode;
    const matchesBucket = !filters.paymentBucket || filters.paymentBucket === "ALL" || row.payment_bucket === filters.paymentBucket;
    const matchesPaymentState = !filters.paymentState || filters.paymentState === "ALL" || row.payment_state === filters.paymentState;
    const matchesPaymentStatus = !filters.paymentStatus || filters.paymentStatus === "ALL" || row.payment_status === filters.paymentStatus;
    return matchesDate && matchesDateFrom && matchesDateTo && matchesBda && matchesManager && matchesProduct && matchesBatch && matchesSourceType && matchesMode && matchesBucket && matchesPaymentState && matchesPaymentStatus;
  });
}

function buildMarketingSummary(rows = []) {
  return {
    totalRows: rows.length,
    totalSpendInr: rows.reduce((sum, row) => sum + Number(row.daily_spend_inr || 0), 0),
    totalLeads: rows.reduce((sum, row) => sum + Number(row.lead_quantity || 0), 0),
    totalProductValueInr: rows.reduce((sum, row) => sum + Number(row.product_value_inr || 0), 0),
    totalNewOrders: rows.reduce((sum, row) => sum + Number(row.new_order_count || 0), 0),
    totalInHandRevenueInr: rows.reduce((sum, row) => sum + Number(row.in_hand_revenue_inr || 0), 0),
    totalWithGstSpendInr: rows.reduce((sum, row) => sum + Number(row.with_gst_spend_inr || 0), 0),
    campaigns: new Set(rows.map((row) => row.campaign_name).filter(Boolean)).size,
  };
}

function collectMarketingCampaigns(rows = []) {
  const campaigns = new Map();

  rows.forEach((row) => {
    const name = String(row.campaign_name || "").trim();
    if (!name) return;
    const current = campaigns.get(name) || {
      name,
      last_seen_at: row.date,
      channel: row.channel || "",
      department: row.department || "",
      spend_inr: 0,
      entries: 0,
    };
    if (new Date(row.date).getTime() > new Date(current.last_seen_at).getTime()) {
      current.last_seen_at = row.date;
      current.channel = row.channel || current.channel;
      current.department = row.department || current.department;
    }
    current.spend_inr += Number(row.daily_spend_inr || 0);
    current.entries += 1;
    campaigns.set(name, current);
  });

  return [...campaigns.values()].sort((left, right) => new Date(right.last_seen_at).getTime() - new Date(left.last_seen_at).getTime());
}

function getActorTeamMember(data, actor = {}) {
  if (actor?.id) {
    return data.team.find((member) => member.id === actor.id) ?? null;
  }
  if (actor?.email) {
    return data.team.find((member) => String(member.email || "").toLowerCase() === String(actor.email || "").toLowerCase()) ?? null;
  }
  return null;
}

function getCouponOwnerTeamMember(data, coupon = {}) {
  const byId = coupon.created_by_user_id ? data.team.find((member) => member.id === coupon.created_by_user_id) : null;
  if (byId) return byId;
  const byEmail = coupon.created_by_email
    ? data.team.find((member) => String(member.email || "").toLowerCase() === String(coupon.created_by_email || "").toLowerCase())
    : null;
  if (byEmail) return byEmail;
  const byName = coupon.created_by_name || coupon.created_by
    ? data.team.find((member) => member.name === (coupon.created_by_name || coupon.created_by))
    : null;
  return byName ?? null;
}

function getCouponOwnerRole(data, coupon = {}) {
  const explicit = String(coupon.created_by_role || "").toUpperCase();
  if (explicit) return explicit;
  const owner = getCouponOwnerTeamMember(data, coupon);
  if (owner?.role) return String(owner.role).toUpperCase();
  return String(coupon.created_by || "").toLowerCase().includes("admin") ? "ADMIN" : "";
}

function isCouponVisibleForActor(data, coupon = {}, actor = {}) {
  const actorRole = String(actor.role || "").toUpperCase();
  if (!actorRole) return true;
  if (["SUPER_ADMIN", "ADMIN", "MARKETING", "OPERATIONS"].includes(actorRole)) {
    return true;
  }

  const actorMember = getActorTeamMember(data, actor);
  const ownerRole = getCouponOwnerRole(data, coupon);
  const owner = getCouponOwnerTeamMember(data, coupon);

  if (actorRole === "BDM") {
    return ["ADMIN", "SUPER_ADMIN"].includes(ownerRole) || owner?.id === actorMember?.id;
  }

  if (actorRole === "BDA") {
    if (["ADMIN", "SUPER_ADMIN"].includes(ownerRole)) {
      return true;
    }
    return ownerRole === "BDM" && owner?.name === actorMember?.manager_name;
  }

  return false;
}

function validateCouponForOrder(data, coupon, product, actor = {}) {
  if (!coupon) return;
  if (!coupon.is_active) {
    throw new Error("Coupon is inactive");
  }

  if (isCouponExpired(coupon)) {
    throw new Error("This coupon has expired.");
  }

  if (coupon.usage_limit_total != null && Number(coupon.usage_count || 0) >= Number(coupon.usage_limit_total || 0)) {
    throw new Error("This coupon has reached its usage limit.");
  }

  if (coupon.applies_to === "PRODUCT" && coupon.applicable_product_id && coupon.applicable_product_id !== product?.id) {
    throw new Error("This coupon is not valid for the selected product.");
  }

  if (!isCouponVisibleForActor(data, coupon, actor)) {
    throw new Error("You do not have access to use this coupon.");
  }

  const ownerRole = getCouponOwnerRole(data, coupon);
  const productValue = Number(product?.discounted_price || 0);
  const discountValue = calculateCouponDiscount(coupon, productValue);

  if (ownerRole === "BDM") {
    const maxAllowed = Math.round(productValue * 0.2);
    if (discountValue > maxAllowed) {
      throw new Error("BDM coupons cannot exceed 20% of the selected product value.");
    }
  }
}

export async function createDashboardStore() {
  const data = await readDataFile();

  const store = {
    data,
    pendingPersist: Promise.resolve(),
    persist(reason = "persist") {
      const snapshot = buildPersistentData(structuredClone(store.data));
      writeFileSync(dataFile, JSON.stringify(snapshot, null, 2));
      store.pendingPersist = runtimePersistence.save(snapshot, reason);
      snapshotDataFile();
      return store.pendingPersist;
    },
    save() {
      return store.persist();
    },
    flush() {
      return store.pendingPersist;
    },
    async close() {
      await store.flush();
      await runtimePersistence.close();
    },
    getPersistenceStatus() {
      return runtimePersistence.getStatus();
    },
    attachInstructor(record) {
      return { ...record, instructor: store.data.instructors.find((item) => item.id === record.instructor_id) ?? null };
    },
    attachBootcamp(record) {
      return {
        ...record,
        instructor: store.data.instructors.find((item) => item.id === record.instructor_id) ?? null,
        facilitator: store.data.team.find((item) => item.id === record.facilitator_id) ?? null,
      };
    },
    attachOrder(record) {
      return withComputedPayment(record, store.data);
    },
    applyCouponToPaymentLink(input = {}) {
      const payment = input.payment_id ? store.getPaymentRecord(input.payment_id) : null;
      const order = payment
        ? store.data.orders.find((entry) => entry.id === payment.order_id)
        : store.data.orders.find((entry) => entry.id === input.order_id || entry.order_number === input.order_number);
      if (!order) {
        throw new Error("Order not found");
      }
      if (!payment) {
        throw new Error("Payment record not found");
      }
      if (payment.status === "PAID" || ["ACTIVE", "OPERATIONS_IN_PROGRESS"].includes(String(order.status || "").toUpperCase())) {
        throw new Error("Payment has already been completed for this link.");
      }
      if (payment.method !== "RAZORPAY") {
        throw new Error("Coupons can only be applied to Razorpay payment links.");
      }
      if (String(order.payment_mode || "").toUpperCase() !== "FULL" || String(payment.type || "").toUpperCase() !== "ENROLLMENT") {
        throw new Error("Coupons on the public page are only supported for full enrollment links.");
      }

      const code = String(input.coupon_code || "").trim().toUpperCase();
      if (!code) {
        throw new Error("Coupon code is required");
      }
      if (order.coupon_code) {
        if (String(order.coupon_code).toUpperCase() === code) {
          return {
            order: withComputedPayment(order, store.data),
            payment: store.getPaymentRecord(payment.id),
          };
        }
        throw new Error("A coupon has already been applied to this payment link.");
      }

      const product = order.product_id ? store.data.products.find((entry) => entry.id === order.product_id) ?? null : null;
      if (!product) {
        throw new Error("This payment link is not attached to a coupon-enabled product.");
      }
      const coupon = store.getCouponByCode(code, {});
      if (!coupon) {
        throw new Error("Coupon code not found");
      }
      validateCouponForOrder(store.data, coupon, product, {});

      const originalProductValue = Number(order.original_product_value_inr || product.discounted_price || order.product_value_inr || payment.amount_inr || 0);
      const productValue = Math.max(originalProductValue - calculateCouponDiscount(coupon, originalProductValue), 0);
      if (productValue <= 0) {
        throw new Error("Coupon discount cannot reduce order value to zero");
      }
      const discountInr = Math.max(originalProductValue - productValue, 0);
      const updatedAt = nowIso();

      order.original_product_value_inr = originalProductValue;
      order.discount_inr = discountInr;
      order.coupon_id = coupon.id || null;
      order.coupon_code = coupon.code || "";
      order.coupon_title = coupon.title || coupon.code || "";
      order.product_value_inr = productValue;
      order.amount_inr = productValue;
      order.updated_at = updatedAt;

      payment.amount_inr = productValue;
      payment.razorpay_order_id = "";
      payment.razorpay_payment_id = "";
      payment.razorpay_signature = "";
      payment.updated_at = updatedAt;

      coupon.usage_count = Number(coupon.usage_count || 0) + 1;
      coupon.updated_at = updatedAt;

      store.persist();
      return {
        order: withComputedPayment(order, store.data),
        payment: store.getPaymentRecord(payment.id),
      };
    },
    getOrders() {
      return store.data.orders
        .map((order) => withComputedPayment(order, store.data))
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
    },
    getOverview() {
      const enrichedOrders = store.getOrders();
      const paidPayments = store.data.payment_records.filter((payment) => isPaidStatus(payment.status));
      const approvedRefunds = getApprovedRefunds(store.data);
      const today = dayKey(new Date());
      const monthPrefix = nowIso().slice(0, 7);
      const weekFloor = daysAgo(6).getTime();
      const leaderboard = buildLeaderboard(store.data);
      const managerSummary = buildManagerSummary(store.data, leaderboard);
      const cashVsValueSeries = buildCashVsValueSeries(store.data.orders, store.data.payment_records, store.data, 30);

      const todayCash = paidPayments
        .filter((payment) => payment.paid_at && dayKey(payment.paid_at) === today)
        .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0);
      const todayRefunds = approvedRefunds
        .filter((refund) => dayKey(getApprovedRefundEventTime(refund)) === today)
        .reduce((sum, refund) => sum + Number(refund.amount_inr || 0), 0);
      const weekCash = paidPayments
        .filter((payment) => payment.paid_at && new Date(payment.paid_at).getTime() >= weekFloor)
        .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0);
      const weekRefunds = approvedRefunds
        .filter((refund) => new Date(getApprovedRefundEventTime(refund)).getTime() >= weekFloor)
        .reduce((sum, refund) => sum + Number(refund.amount_inr || 0), 0);
      const monthCash = paidPayments
        .filter((payment) => payment.paid_at && String(payment.paid_at).startsWith(monthPrefix))
        .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0);
      const monthRefunds = approvedRefunds
        .filter((refund) => String(getApprovedRefundEventTime(refund)).startsWith(monthPrefix))
        .reduce((sum, refund) => sum + Number(refund.amount_inr || 0), 0);
      const grossCollections = paidPayments.reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0);
      const refundedAmount = approvedRefunds.reduce((sum, refund) => sum + Number(refund.amount_inr || 0), 0);

      return {
        stats: {
          todayRevenue: Math.round(Math.max(todayCash - todayRefunds, 0) / 100),
          todayCount: paidPayments.filter((payment) => payment.paid_at && dayKey(payment.paid_at) === today).length,
          weekRevenue: Math.round(Math.max(weekCash - weekRefunds, 0) / 100),
          weekCount: paidPayments.filter((payment) => payment.paid_at && new Date(payment.paid_at).getTime() >= weekFloor).length,
          monthRevenue: Math.round(Math.max(monthCash - monthRefunds, 0) / 100),
          monthCount: paidPayments.filter((payment) => payment.paid_at && String(payment.paid_at).startsWith(monthPrefix)).length,
          activeWebinarsToday: store.data.webinars.filter((item) => item.status === "LIVE").length,
        },
        revenueTotals: {
          soldValue: enrichedOrders.reduce((sum, order) => sum + Number(order.product_value_inr || 0), 0),
          grossCollections,
          refundedAmount,
          cashInHand: Math.max(grossCollections - refundedAmount, 0),
          newRevenue: paidPayments
            .filter((payment) => payment.type === "ENROLLMENT")
            .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0),
          recoveryRevenue: paidPayments
            .filter((payment) => payment.type === "RECOVERY")
            .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0),
          outstandingAmount: enrichedOrders.reduce((sum, order) => sum + Number(order.amount_due_inr || 0), 0),
        },
        revenueSeries: cashVsValueSeries.map((row) => ({ label: row.label, value: Math.round(row.cashInHand / 100) })),
        cashVsValueSeries,
        enrollmentTrend: [
          { label: "Full Orders", value: enrichedOrders.filter((order) => order.payment_mode === "FULL").length },
          { label: "Token Orders", value: enrichedOrders.filter((order) => order.payment_mode === "TOKEN").length },
          { label: "Recovery Pending", value: enrichedOrders.filter((order) => order.amount_due_inr > 0).length },
        ],
        recentOrders: enrichedOrders.slice(0, 10),
        upcomingWebinars: store.data.webinars
          .map((item) => store.attachInstructor(item))
          .filter((item) => ["LIVE", "SCHEDULED"].includes(item.status)),
        leaderboard: leaderboard.slice(0, 5),
        managerSummary,
      };
    },
    getSalesSummary() {
      return store.getSalesSummaryForOrders(store.getOrders());
    },
    getSalesSummaryForOrders(orders = []) {
      const todayStart = startOfToday();
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);

      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      const weekStart = daysAgo(6);

      const monthStart = new Date(todayStart);
      monthStart.setDate(1);

      const lastMonthStart = new Date(monthStart);
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

      const windowSummary = (start, end, predicate = () => true) => {
        let gross = 0;
        let refunded = 0;
        const orderIds = new Set();

        orders.forEach((order) => {
          if (!predicate(order)) return;
          (order.payment_history || []).forEach((payment) => {
            const paidAt = payment.paid_at || payment.created_at;
            const time = paidAt ? new Date(paidAt).getTime() : Number.NaN;
            if (payment.status !== "PAID" || !Number.isFinite(time) || time < start.getTime() || time >= end.getTime()) return;
            gross += Number(payment.amount_inr || 0);
            orderIds.add(order.id);
          });
          (order.refund_history || []).forEach((refund) => {
            const approvedAt = refund.approved_at || refund.updated_at || refund.created_at;
            const time = approvedAt ? new Date(approvedAt).getTime() : Number.NaN;
            if (refund.status !== "APPROVED" || !Number.isFinite(time) || time < start.getTime() || time >= end.getTime()) return;
            refunded += Number(refund.amount_inr || 0);
          });
        });

        return {
          amount: Math.round(Math.max(gross - refunded, 0) / 100),
          count: orderIds.size,
        };
      };

      const productBucketKey = (order) => {
        if (order.product?.id || order.product_id) return order.product?.id || order.product_id;
        return `offer:${order.offer_title || order.source_label || order.source || "Manual Entry"}`;
      };

      const productBucketLabel = (order) => order.product?.name || order.offer_title || order.source_label || order.source || "Manual Entry";

      const productBuckets = new Map();
      store.data.products.forEach((product) => {
        productBuckets.set(product.id, { key: product.id, label: product.name });
      });
      orders.forEach((order) => {
        const key = productBucketKey(order);
        if (!productBuckets.has(key)) {
          productBuckets.set(key, { key, label: productBucketLabel(order) });
        }
      });

      const monthlyRevenue = Array.from({ length: 12 }, (_, index) => {
        const start = new Date(monthStart);
        start.setMonth(start.getMonth() - (11 - index));
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        return {
          label: start.toLocaleDateString("en-IN", { month: "short" }),
          amount: windowSummary(start, end).amount,
        };
      });

      const podSales = [...productBuckets.values()]
        .map((bucket) => ({
          product: bucket.label,
          today: windowSummary(todayStart, tomorrowStart, (order) => productBucketKey(order) === bucket.key).amount,
          yesterday: windowSummary(yesterdayStart, todayStart, (order) => productBucketKey(order) === bucket.key).amount,
          week: windowSummary(weekStart, tomorrowStart, (order) => productBucketKey(order) === bucket.key).amount,
          month: windowSummary(monthStart, tomorrowStart, (order) => productBucketKey(order) === bucket.key).amount,
          lastMonth: windowSummary(lastMonthStart, monthStart, (order) => productBucketKey(order) === bucket.key).amount,
        }))
        .filter((row) => row.today || row.yesterday || row.week || row.month || row.lastMonth || store.data.products.some((product) => product.name === row.product))
        .sort((left, right) => {
          const monthDiff = right.month - left.month;
          return monthDiff !== 0 ? monthDiff : left.product.localeCompare(right.product);
        });

      return {
        summary: [
          { label: "Today", ...windowSummary(todayStart, tomorrowStart) },
          { label: "Yesterday", ...windowSummary(yesterdayStart, todayStart) },
          { label: "This Week", ...windowSummary(weekStart, tomorrowStart) },
          { label: "This Month", ...windowSummary(monthStart, tomorrowStart) },
          { label: "Last Month", ...windowSummary(lastMonthStart, monthStart) },
        ],
        monthlyRevenue,
        podSales,
      };
    },
    getTracker(teacher) {
      return store.data.webinars
        .map((item) => store.attachInstructor(item))
        .filter((row) => !teacher || teacher === "ALL" || row.instructor_id === teacher);
    },
    getSalesTracker() {
      const enrollments = store.getOrders();
      const leaderboard = buildLeaderboard(store.data);
      const managerSummary = buildManagerSummary(store.data, leaderboard);
      const outstandingAmount = enrollments.reduce((sum, row) => sum + Number(row.amount_due_inr || 0), 0);
      const dueToday = enrollments.filter((row) => row.token_due?.due_date && dayKey(row.token_due.due_date) === dayKey(new Date())).length;
      const overdue = enrollments.filter((row) => row.token_due?.due_date && new Date(row.token_due.due_date).getTime() < startOfToday().getTime()).length;
      const monthPrefix = nowIso().slice(0, 7);
      const thisMonthCollections = store.data.payment_records
        .filter((payment) => isPaidStatus(payment.status) && payment.paid_at?.startsWith(monthPrefix))
        .reduce((sum, payment) => sum + Number(payment.amount_inr || 0), 0);

      return {
        enrollments,
        leaderboard,
        managerSummary,
        summary: {
          outstandingAmount,
          dueToday,
          overdue,
          thisMonthCollections,
          approvedRefundAmount: getApprovedRefunds(store.data).reduce((sum, refund) => sum + Number(refund.amount_inr || 0), 0),
        },
      };
    },
    getTeamSummary() {
      const leaderboard = buildLeaderboard(store.data);
      const managers = buildManagerSummary(store.data, leaderboard);
      return {
        team: store.data.team,
        admins: store.data.team.filter((member) => ["ADMIN", "SUPER_ADMIN", "OPERATIONS"].includes(member.role)),
        bdas: store.data.team.filter((member) => member.role === "BDA"),
        salesOwners: store.data.team.filter((member) => ["BDA", "BDM"].includes(member.role)),
        managers,
        leaderboard,
      };
    },
    getExportData(filters = {}) {
      const rows = buildExportRows(store.data);
      return {
        payments: applyExportFilters(rows.payments, filters),
        enrollments: applyExportFilters(rows.enrollments, filters),
        tokens: applyExportFilters(rows.tokens, filters),
        refunds: applyExportFilters(rows.refunds, filters),
      };
    },
    recalculateWebinar(webinarId) {
      const webinar = store.data.webinars.find((item) => item.id === webinarId);
      if (!webinar) {
        return null;
      }

      const attendance = store.data.webinarAttendance.filter((item) => item.webinar_id === webinarId && item.role === "ATTENDEE");
      webinar.total_entries = attendance.reduce((sum, item) => sum + Number(item.join_counts || 1), 0);
      webinar.total_attendees = new Set(attendance.map((item) => item.phone || item.email || item.id)).size;
      webinar.peak_attendance = Math.max(webinar.peak_attendance || 0, webinar.total_attendees);
      webinar.updated_at = nowIso();
      return webinar;
    },
    createShortLink(input) {
      const slug = input.slug ? slugify(input.slug) : createPrettySlug(input.label || input.original_url || "custom-link");
      const record = {
        id: crypto.randomUUID(),
        label: input.label || "Custom link",
        original_url: input.original_url,
        slug,
        short_path: `/${slug}`,
        short_url: input.short_url || `/${slug}`,
        created_at: nowIso(),
      };
      store.data.links.unshift(record);
      store.persist();
      return record;
    },
    createWebinar(input) {
      const roomName = createRoomName(input.title);
      const startTime = input.start_time ? new Date(input.start_time).toISOString() : nowIso();
      const endTime = input.end_time ? new Date(input.end_time).toISOString() : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const slug = slugify(input.slug || input.title || "masterclass");
      const sessionId = crypto.randomUUID();

      const webinar = {
        id: crypto.randomUUID(),
        title: input.title || "Untitled webinar",
        slug,
        type: input.type || "MASTERCLASS",
        instructor_id: input.instructor_id || store.data.instructors[0]?.id || null,
        category: input.category || "Finance",
        language: input.language || "English",
        description: input.description || "",
        banner_url: input.banner_url || "",
        thumbnail_url: input.thumbnail_url || "",
        start_time: startTime,
        end_time: endTime,
        livekit_room_name: roomName,
        host_token: `host-${roomName}`,
        attendee_token: `attendee-${roomName}`,
        host_url: buildAbsolutePath(roomName, "host"),
        attendee_url: buildAbsolutePath(roomName, "attend"),
        short_host_url: `/${createPrettySlug(`${slug}-host`)}`,
        short_attendee_url: `/${createPrettySlug(`${slug}-join`)}`,
        ui_type: input.ui_type || "WEBINAR",
        server_no: input.server_no || constants.serverOptions[0],
        product_ids: input.product_ids || [],
        payment_required: Boolean(input.payment_required),
        enroll_button_enabled: Boolean(input.enroll_button_enabled),
        price_inr: Number(input.price_inr || 0),
        token_price_inr: Number(input.token_price_inr || 49900),
        payment_mode: String(input.payment_mode || "FULL").toUpperCase() === "TOKEN" ? "TOKEN" : "FULL",
        razorpay_link: input.razorpay_link || "",
        status: input.status || "SCHEDULED",
        peak_attendance: 0,
        total_entries: 0,
        total_attendees: 0,
        is_simulation: Boolean(input.is_simulation),
        created_by: input.created_by || store.data.team[0]?.id || null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };

      const session = {
        id: sessionId,
        webinar_id: webinar.id,
        title: input.session_title || `${webinar.title} Session 1`,
        description: input.description || webinar.description,
        room_name: roomName,
        host_url: webinar.host_url,
        attendee_url: webinar.attendee_url,
        short_host_url: webinar.short_host_url,
        short_attendee_url: webinar.short_attendee_url,
        start_time: webinar.start_time,
        end_time: webinar.end_time,
        status: webinar.status,
        is_active: true,
        created_at: webinar.created_at,
        updated_at: webinar.updated_at,
      };

      store.data.webinars.unshift(webinar);
      store.data.webinarSessions.unshift(session);
      store.data.links.unshift(
        {
          id: crypto.randomUUID(),
          label: `${webinar.title} Host`,
          original_url: webinar.host_url,
          slug: webinar.short_host_url.slice(1),
          short_path: webinar.short_host_url,
          short_url: webinar.short_host_url,
          created_at: webinar.created_at,
        },
        {
          id: crypto.randomUUID(),
          label: `${webinar.title} Attendee`,
          original_url: webinar.attendee_url,
          slug: webinar.short_attendee_url.slice(1),
          short_path: webinar.short_attendee_url,
          short_url: webinar.short_attendee_url,
          created_at: webinar.created_at,
        },
      );
      store.persist();
      return store.attachInstructor(webinar);
    },
    createSession(webinarId, input = {}) {
      const webinar = store.data.webinars.find((item) => item.id === webinarId);
      if (!webinar) {
        throw new Error("Webinar not found");
      }

      const roomName = createRoomName(`${webinar.slug || webinar.title}-session`);
      const session = {
        id: crypto.randomUUID(),
        webinar_id: webinarId,
        title: input.title || `${webinar.title} Session ${store.data.webinarSessions.filter((item) => item.webinar_id === webinarId).length + 1}`,
        description: input.description || webinar.description,
        room_name: roomName,
        host_url: buildAbsolutePath(roomName, "host"),
        attendee_url: buildAbsolutePath(roomName, "attend"),
        short_host_url: `/${createPrettySlug(`${webinar.slug}-host`)}`,
        short_attendee_url: `/${createPrettySlug(`${webinar.slug}-join`)}`,
        start_time: input.start_time ? new Date(input.start_time).toISOString() : webinar.start_time,
        end_time: input.end_time ? new Date(input.end_time).toISOString() : webinar.end_time,
        status: input.status || "SCHEDULED",
        is_active: Boolean(input.is_active ?? true),
        created_at: nowIso(),
        updated_at: nowIso(),
      };

      if (session.is_active) {
        store.data.webinarSessions.forEach((item) => {
          if (item.webinar_id === webinarId) {
            item.is_active = false;
          }
        });
      }

      store.data.webinarSessions.unshift(session);
      store.data.links.unshift(
        {
          id: crypto.randomUUID(),
          label: `${session.title} Host`,
          original_url: session.host_url,
          slug: session.short_host_url.slice(1),
          short_path: session.short_host_url,
          short_url: session.short_host_url,
          created_at: session.created_at,
        },
        {
          id: crypto.randomUUID(),
          label: `${session.title} Attendee`,
          original_url: session.attendee_url,
          slug: session.short_attendee_url.slice(1),
          short_path: session.short_attendee_url,
          short_url: session.short_attendee_url,
          created_at: session.created_at,
        },
      );

      webinar.livekit_room_name = session.room_name;
      webinar.host_url = session.host_url;
      webinar.attendee_url = session.attendee_url;
      webinar.short_host_url = session.short_host_url;
      webinar.short_attendee_url = session.short_attendee_url;
      webinar.updated_at = nowIso();
      store.persist();
      return session;
    },
    getSessions(webinarId) {
      return store.data.webinarSessions
        .filter((item) => item.webinar_id === webinarId)
        .sort((left, right) => new Date(right.start_time).getTime() - new Date(left.start_time).getTime());
    },
    getRoomByName(roomName) {
      const session = store.data.webinarSessions.find((item) => item.room_name === roomName);
      if (!session) {
        return null;
      }

      const webinar = store.data.webinars.find((item) => item.id === session.webinar_id) ?? null;
      return {
        session,
        webinar: webinar ? store.attachInstructor(webinar) : null,
      };
    },
    upsertStudent(input) {
      const normalizedPhone = String(input.phone || "").replace(/\D/g, "");
      const normalizedEmail = String(input.email || "").trim().toLowerCase();
      let student =
        store.data.students.find((item) => item.phone === normalizedPhone || (normalizedEmail && item.email?.toLowerCase() === normalizedEmail)) ??
        null;
      const preferredLanguage = normalizePreferredLanguage(input.preferred_language || input.language || "English");
      const createdAt = coerceIsoTimestamp(input.created_at, nowIso());

      if (!student) {
        student = {
          id: crypto.randomUUID(),
          name: input.name || "Guest",
          phone: normalizedPhone || `guest-${Date.now()}`,
          email: normalizedEmail,
          city: "",
          state: "",
          product_ids: [],
          preferred_language: preferredLanguage,
          enrolled_at: createdAt,
          source: input.source || "Webinar Join",
          bda_id: input.bda_id || store.data.team.find((member) => member.role === "BDA")?.id || store.data.team[0]?.id || null,
          is_active: true,
          created_at: createdAt,
        };
        store.data.students.unshift(student);
      } else {
        student.name = input.name || student.name;
        student.email = normalizedEmail || student.email;
        student.source = input.source || student.source;
        student.bda_id = input.bda_id || student.bda_id;
        student.preferred_language = preferredLanguage || student.preferred_language || "English";
      }

      return student;
    },
    joinRoom({ roomName, role, name, phone, email }) {
      const room = store.getRoomByName(roomName);
      if (!room?.session || !room.webinar) {
        throw new Error("Room not found");
      }

      const student = role === "ATTENDEE" ? store.upsertStudent({ name, phone, email, source: room.webinar.title }) : null;
      const existing = store.data.webinarAttendance.find(
        (item) => item.session_id === room.session.id && item.role === role && (item.phone === phone || item.email === email || item.name === name) && !item.leave_time,
      );

      if (existing) {
        existing.join_counts = Number(existing.join_counts || 1) + 1;
        existing.updated_at = nowIso();
        store.recalculateWebinar(room.webinar.id);
        store.persist();
        return { webinar: room.webinar, session: room.session, student, attendance: existing };
      }

      const attendance = {
        id: crypto.randomUUID(),
        webinar_id: room.webinar.id,
        session_id: room.session.id,
        session_title: room.session.title,
        student_id: student?.id || null,
        role,
        name: name || (role === "HOST" ? "Host Console" : "Guest"),
        phone: phone || "",
        email: email || "",
        join_time: nowIso(),
        leave_time: null,
        duration_mins: 0,
        device: "Browser",
        rating: role === "HOST" ? 5 : 0,
        enroll_clicks: 0,
        payment_status: student ? (store.data.orders.some((item) => item.student_id === student.id && getAmountPaid(item, store.data) > 0) ? "PAID" : "UNPAID") : "N/A",
        connection_quality: 100,
        camera_duration: 0,
        mic_duration: 0,
        join_counts: 1,
        mic_toggle_count: 0,
        camera_toggle_count: 0,
        created_at: nowIso(),
        updated_at: nowIso(),
      };

      store.data.webinarAttendance.unshift(attendance);
      store.recalculateWebinar(room.webinar.id);
      store.persist();
      return { webinar: room.webinar, session: room.session, student, attendance };
    },
    leaveRoom(attendanceId) {
      const attendance = store.data.webinarAttendance.find((item) => item.id === attendanceId);
      if (!attendance || attendance.leave_time) {
        return attendance ?? null;
      }

      attendance.leave_time = nowIso();
      attendance.duration_mins = minutesBetween(attendance.join_time, attendance.leave_time);
      attendance.updated_at = nowIso();
      store.recalculateWebinar(attendance.webinar_id);
      store.persist();
      return attendance;
    },
    incrementEnrollClick(attendanceId) {
      const attendance = store.data.webinarAttendance.find((item) => item.id === attendanceId);
      if (!attendance) {
        return null;
      }
      attendance.enroll_clicks = Number(attendance.enroll_clicks || 0) + 1;
      attendance.updated_at = nowIso();
      store.persist();
      return attendance;
    },
    syncStudentPaymentStatus(studentId) {
      if (!studentId) return;
      const hasPaid = store.data.orders.some((item) => item.student_id === studentId && getAmountPaid(item, store.data) > 0);
      store.data.webinarAttendance.forEach((attendance) => {
        if (attendance.student_id === studentId) {
          attendance.payment_status = hasPaid ? "PAID" : "UNPAID";
          attendance.updated_at = nowIso();
        }
      });
    },
    listAttendance(webinarId) {
      return store.data.webinarAttendance
        .filter((item) => item.webinar_id === webinarId)
        .sort((left, right) => new Date(right.join_time).getTime() - new Date(left.join_time).getTime());
    },
    getWebinarAnalytics(webinarId) {
      const webinar = store.data.webinars.find((item) => item.id === webinarId);
      if (!webinar) {
        return null;
      }

      const sessions = store.getSessions(webinarId);
      const attendance = store.listAttendance(webinarId);
      const attendeeRows = attendance.filter((item) => item.role === "ATTENDEE");
      const totalDuration = attendeeRows.reduce((sum, row) => sum + Number(row.duration_mins || 0), 0);
      const quality = attendeeRows.length
        ? Math.round(attendeeRows.reduce((sum, row) => sum + Number(row.connection_quality || 0), 0) / attendeeRows.length)
        : 0;

      return {
        webinar: store.attachInstructor(webinar),
        sessions,
        stats: {
          totalDuration,
          totalEntries: webinar.total_entries,
          totalAttendees: webinar.total_attendees,
          pitchAttendance: Math.round(webinar.total_attendees * 0.22),
          avgPacketLoss: Number((Math.max(100 - quality, 0) / 100).toFixed(2)),
          peakAttendance: webinar.peak_attendance,
          enrollNowAttendance: attendeeRows.filter((item) => Number(item.enroll_clicks || 0) > 0).length,
          quality,
          deviceBreakdown: attendeeRows.reduce((acc, row) => {
            const device = row.device || "Browser";
            acc[device] = (acc[device] || 0) + 1;
            return acc;
          }, {}),
          interactions: {
            cameraOn: attendeeRows.reduce((sum, row) => sum + Number(row.camera_toggle_count || 0), 0),
            micOn: attendeeRows.reduce((sum, row) => sum + Number(row.mic_toggle_count || 0), 0),
          },
        },
        timeline: groupTimeline(attendeeRows),
        attendees: attendance,
      };
    },
    getPayments() {
      return store.getOrders();
    },
    getOperationsQueue() {
      const operations = store
        .getOrders()
        .filter((order) => {
          const hasSuccessfulPayment = Number(order.amount_paid_inr || 0) > 0 || (order.payment_history || []).some((payment) => isPaidStatus(payment.status));
          return hasSuccessfulPayment || order.access_revocation_requested || order.access_revoked;
        })
        .sort((left, right) => {
          if (left.operations_completed !== right.operations_completed) {
            return Number(left.operations_completed) - Number(right.operations_completed);
          }
          return new Date(right.updated_at || right.created_at).getTime() - new Date(left.updated_at || left.created_at).getTime();
        });

      return {
        operations,
        summary: {
          total: operations.length,
          pending: operations.filter((order) => !order.operations_completed).length,
          completed: operations.filter((order) => order.operations_completed).length,
          netCashInHand: operations.reduce((sum, order) => sum + Number(order.net_cash_in_hand_inr || 0), 0),
        },
      };
    },
    getMarketingSpend(filters = {}) {
      const query = String(filters.query || "").trim().toLowerCase();
      const year = Number(filters.year || 0) || null;
      const month = Number(filters.month || 0) || null;
      const rows = [...store.data.marketing_spend]
        .filter((row) => {
          const matchesQuery =
            !query
            || String(row.campaign_name || "").toLowerCase().includes(query)
            || String(row.channel || "").toLowerCase().includes(query)
            || String(row.department || "").toLowerCase().includes(query);
          const matchesYear = !year || Number(row.year || 0) === year;
          const matchesMonth = !month || Number(row.month || 0) === month;
          return matchesQuery && matchesYear && matchesMonth;
        })
        .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
      return {
        rows,
        summary: buildMarketingSummary(rows),
        campaigns: collectMarketingCampaigns(rows),
      };
    },
    getMarketingCampaigns(options = {}) {
      const query = String(options.query || "").trim().toLowerCase();
      const recentDays = Number(options.recentDays || 30) || 30;
      const campaigns = collectMarketingCampaigns(store.data.marketing_spend);
      const recentCutoff = Date.now() - recentDays * 24 * 60 * 60 * 1000;
      const recent_campaigns = campaigns.filter((campaign) => new Date(campaign.last_seen_at).getTime() >= recentCutoff);
      const matches = query
        ? campaigns.filter((campaign) => campaign.name.toLowerCase().includes(query) || campaign.channel.toLowerCase().includes(query))
        : recent_campaigns;
      return {
        recent_campaigns,
        campaigns: matches,
      };
    },
    createMarketingSpend(input = {}, actor = {}) {
      const row = normalizeMarketingSpend({
        id: crypto.randomUUID(),
        ...input,
        created_by_user_id: actor.id || null,
        created_by_name: actor.name || "",
        created_by_email: actor.email || "",
        created_by_role: actor.role || "",
        created_at: nowIso(),
        updated_at: nowIso(),
      }, store.data.marketing_spend.length);
      store.data.marketing_spend.unshift(row);
      store.persist();
      return row;
    },
    updateMarketingSpend(id, patch = {}, actor = {}) {
      const index = store.data.marketing_spend.findIndex((row) => row.id === id);
      if (index < 0) {
        throw new Error("Marketing spend row not found");
      }
      const current = store.data.marketing_spend[index];
      const updated = normalizeMarketingSpend({
        ...current,
        ...patch,
        updated_at: nowIso(),
        created_by_user_id: current.created_by_user_id || actor.id || null,
        created_by_name: current.created_by_name || actor.name || "",
        created_by_email: current.created_by_email || actor.email || "",
        created_by_role: current.created_by_role || actor.role || "",
      }, index);
      store.data.marketing_spend[index] = updated;
      store.persist();
      return updated;
    },
    getCoupons(actor = {}) {
      return [...store.data.coupons]
        .filter((coupon) => isCouponVisibleForActor(store.data, coupon, actor))
        .sort((left, right) => {
        if (left.is_active !== right.is_active) return left.is_active ? -1 : 1;
        return left.code.localeCompare(right.code);
      });
    },
    getCouponByCode(code = "", actor = {}) {
      const normalized = String(code || "").trim().toUpperCase();
      if (!normalized) return null;
      return store.data.coupons.find((coupon) => coupon.code === normalized && isCouponVisibleForActor(store.data, coupon, actor)) ?? null;
    },
    createCoupon(input = {}, actor = {}) {
      const code = String(input.code || "").trim().toUpperCase();
      if (!code) {
        throw new Error("Coupon code is required");
      }
      if (store.getCouponByCode(code)) {
        throw new Error("Coupon code already exists");
      }

      const type = normalizeCouponType(input.type || input.discount_type);
      const value = Number(input.value ?? input.discount_value ?? 0);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Coupon value must be greater than zero");
      }

      if (type === "PERCENT" && value > 100) {
        throw new Error("Percentage coupons cannot exceed 100%");
      }

      const actorRole = String(actor.role || "").toUpperCase();
      if (!["SUPER_ADMIN", "ADMIN", "BDM"].includes(actorRole)) {
        throw new Error("You do not have permission to create coupons");
      }
      const applicableProductId = input.applicable_product_id || input.applicableProductId || null;
      const applicableProduct = applicableProductId ? store.data.products.find((product) => product.id === applicableProductId) ?? null : null;
      const usageFrequency = normalizeCouponUsageFrequency(input.usage_frequency || input.usageFrequency);
      const usageLimitTotal =
        usageFrequency === "UNLIMITED"
          ? null
          : usageFrequency === "ONE_TIME"
            ? 1
            : Math.max(Number(input.usage_limit_total ?? input.usageLimitTotal ?? 0), 1);
      const expiresAt = toEndOfDayIso(input.expires_at || input.expiresAt || input.valid_until || input.validUntil);
      if (actorRole === "BDM") {
        if (type === "PERCENT" && value > 20) {
          throw new Error("BDM coupons cannot exceed 20% of the product value.");
        }
        if (applicableProduct) {
          const maxAllowed = Math.round(Number(applicableProduct.discounted_price || 0) * 0.2);
          const previewDiscount = calculateCouponDiscount({
            type,
            value,
            max_discount_inr: input.max_discount_inr || input.maxDiscountInr || null,
            is_active: true,
          }, Number(applicableProduct.discounted_price || 0));
          if (previewDiscount > maxAllowed) {
            throw new Error("BDM coupons cannot exceed 20% of the selected product value.");
          }
        }
      }

      const coupon = normalizeCoupon({
        id: crypto.randomUUID(),
        code,
        title: input.title || code,
        description: input.description || "",
        type,
        value,
        max_discount_inr: input.max_discount_inr || input.maxDiscountInr || null,
        applicable_product_id: applicableProduct?.id || null,
        applies_to: applicableProduct?.id ? "PRODUCT" : "GENERAL",
        is_active: input.is_active ?? true,
        usage_frequency: usageFrequency,
        usage_limit_total: usageLimitTotal,
        expires_at: expiresAt,
        created_by: actor.email || actor.name || input.created_by || input.createdBy || "admin",
        created_by_user_id: actor.id || null,
        created_by_name: actor.name || "",
        created_by_email: actor.email || "",
        created_by_role: actorRole,
        created_at: nowIso(),
        updated_at: nowIso(),
      });

      store.data.coupons.unshift(coupon);
      store.persist();
      return coupon;
    },
    getPaymentRecord(paymentId) {
      return store.data.payment_records.find((record) => record.id === paymentId) ?? null;
    },
    getLatestPaymentForOrder(orderId, options = {}) {
      const payments = getOrderPayments(store.data, orderId);
      if (options.preferOpen) {
        return payments.find((payment) => !isPaidStatus(payment.status) && payment.status !== "REFUNDED") ?? payments[0] ?? null;
      }
      return payments[0] ?? null;
    },
    refreshOrderState(orderId) {
      const order = store.data.orders.find((entry) => entry.id === orderId);
      if (!order) return null;

      order.product_value_inr = getProductValue(order, store.data);
      order.amount_paid_inr = getAmountPaid(order, store.data);
      order.refunded_amount_inr = getRefundedAmount(order, store.data);
      order.net_cash_in_hand_inr = getNetCashCollected(order, store.data);
      order.amount_due_inr = getAmountDue(order, store.data);
      order.status = computeOrderStatus(order, store.data);
      order.updated_at = nowIso();

      let promise = store.data.due_promises.find((entry) => entry.order_id === order.id);
      if (order.amount_due_inr > 0) {
        if (!promise) {
          promise = {
            id: crypto.randomUUID(),
            order_id: order.id,
            due_date:
              order.promise_date || new Date(new Date(order.created_at || nowIso()).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            amount_inr: order.amount_due_inr,
            fulfilled: false,
            created_at: nowIso(),
            updated_at: nowIso(),
          };
          store.data.due_promises.unshift(promise);
        } else {
          promise.amount_inr = order.amount_due_inr;
          promise.fulfilled = false;
          promise.updated_at = nowIso();
        }
      } else if (promise) {
        promise.amount_inr = 0;
        promise.fulfilled = true;
        promise.updated_at = nowIso();
      }

      store.syncStudentPaymentStatus(order.student_id);
      return order;
    },
    createPaymentRecord(order, input = {}) {
      const method = normalizePaymentMethod(input.payment_method || input.method || "RAZORPAY");
      const existingRecoveryCount = getOrderPayments(store.data, order.id).filter((payment) => payment.type === "RECOVERY").length;
      const paymentType = normalizePaymentType(input.type || (input.is_recovery ? "RECOVERY" : "ENROLLMENT"));
      const stage =
        paymentType === "RECOVERY"
          ? order.payment_mode === "TOKEN" && existingRecoveryCount === 0
            ? "TOKEN_2"
            : "RECOVERY"
          : order.payment_mode === "TOKEN"
            ? "TOKEN_1"
            : "FULL";
      const status = input.status ? normalizePaymentStatus(input.status) : isManualMethod(method) ? "PAID" : "CREATED";
      const createdAt = coerceIsoTimestamp(input.created_at, nowIso());
      const paidAt = input.paid_at ? coerceIsoTimestamp(input.paid_at, createdAt) : null;
      const payment = {
        id: crypto.randomUUID(),
        order_id: order.id,
        student_id: order.student_id || null,
        product_id: order.product_id || null,
        amount_inr: Number(input.amount_inr || 0),
        method,
        status,
        type: paymentType,
        stage,
        transaction_id: input.transaction_id || input.reference_code || `TXN-${Date.now()}`,
        razorpay_order_id: "",
        razorpay_payment_id: "",
        razorpay_signature: "",
        payment_link: method === "RAZORPAY" && status !== "PAID" ? `/payment/${input.payment_id || ""}` : "",
        slug: "",
        reference_code: input.reference_code || "",
        proof_url: input.proof_url || "",
        valid_until: order.promise_date ? toEndOfDayIso(order.promise_date) : null,
        created_at: createdAt,
        updated_at: createdAt,
        paid_at: status === "PAID" ? paidAt || createdAt : null,
      };

      payment.payment_link = method === "RAZORPAY" && status !== "PAID" ? `/payment/${payment.id}` : "";
      store.data.payment_records.unshift(payment);
      return payment;
    },
    createPaymentLink(input = {}, actor = {}) {
      const existingOrderId = input.existing_order_id || input.order_id || null;

      if (existingOrderId) {
        const existingOrder = store.data.orders.find((entry) => entry.id === existingOrderId);
        if (!existingOrder) {
          throw new Error("Existing order not found");
        }

        const amountToCollect = Number(input.amount_inr || getAmountDue(existingOrder, store.data));
        if (!amountToCollect || amountToCollect <= 0) {
          throw new Error("No pending amount is available for this order");
        }

        const payment = store.createPaymentRecord(existingOrder, {
          ...input,
          amount_inr: Math.min(amountToCollect, getAmountDue(existingOrder, store.data)),
          type: input.type || "RECOVERY",
          is_recovery: true,
        });

        if (payment.method === "RAZORPAY") {
          const link = store.createShortLink({
            label: `Recovery ${existingOrder.order_number}`,
            original_url: `/payment/${payment.id}`,
          });
          payment.payment_link = link.short_url;
          payment.slug = link.slug;
        }

        if (payment.method !== "RAZORPAY") {
          payment.razorpay_payment_id = input.reference_code || payment.transaction_id;
          payment.updated_at = nowIso();
          payment.paid_at = payment.paid_at || nowIso();
        }

        const refreshedOrder = store.refreshOrderState(existingOrder.id);
        store.persist();
        return {
          order: withComputedPayment(refreshedOrder, store.data),
          payment,
          link: payment.payment_link
            ? {
                short_url: payment.payment_link,
                slug: payment.slug || extractAliasFromLink(payment.payment_link),
              }
            : null,
        };
      }

      const actorRole = String(actor.role || "").toUpperCase();
      const actorTeamMember =
        actor.id
          ? store.data.team.find((member) => member.id === actor.id)
          : actor.email
            ? store.data.team.find((member) => String(member.email || "").toLowerCase() === String(actor.email || "").toLowerCase())
            : null;
      const bda =
        input.bda_id
          ? store.data.team.find((member) => member.id === input.bda_id) ?? null
          : actorRole === "BDA"
            ? actorTeamMember
            : null;
      const webinar = input.webinar_id ? store.data.webinars.find((item) => item.id === input.webinar_id) ?? null : null;
      const bootcamp = input.bootcamp_id ? store.data.bootcamps.find((item) => item.id === input.bootcamp_id) ?? null : null;
      const collectCustomerDetailsOnCheckout = Boolean(input.collect_customer_details_on_checkout);
      const isAdminOverrideAllowed = ["ADMIN", "SUPER_ADMIN"].includes(actorRole);
      const managerName =
        bda?.manager_name
        || (actorRole === "BDM" ? actorTeamMember?.name || actor.name || "" : "")
        || (actorRole === "BDA" ? actorTeamMember?.manager_name || "" : "");
      const teamName = bda?.team_name || actorTeamMember?.team_name || "";
      const createdAt = coerceIsoTimestamp(input.created_at, nowIso());
      const preferredLanguage = normalizePreferredLanguage(input.preferred_language || input.language || "English");
      const learningSchedule = normalizeLearningSchedule(input.learning_schedule || input.schedule_preference || input.schedule_type || "WEEKDAY");
      const student = store.upsertStudent({
        name: collectCustomerDetailsOnCheckout ? "Customer completes at checkout" : input.student_name || input.customer_name || input.name || "Payment Link Student",
        phone: collectCustomerDetailsOnCheckout ? "" : input.phone || input.customer_phone || "",
        email: collectCustomerDetailsOnCheckout ? "" : input.email || input.customer_email || "",
        source: input.source || input.campaign_source || webinar?.title || bootcamp?.title || "Manual Entry",
        bda_id: bda?.id || null,
        preferred_language: preferredLanguage,
        created_at: createdAt,
      });
      const product = input.product_id ? store.data.products.find((item) => item.id === input.product_id) ?? null : null;
      if (!product && !webinar && !bootcamp) {
        throw new Error("Product or class is required");
      }
      const originalProductValue = Number(
        input.original_product_value_inr
        || product?.discounted_price
        || webinar?.price_inr
        || bootcamp?.discounted_price
        || input.amount_inr
        || 0,
      );
      const coupon = store.getCouponByCode(input.coupon_code, actor);
      if (input.coupon_code && !coupon) {
        throw new Error("Coupon code not found");
      }
      validateCouponForOrder(store.data, coupon, product, actor);
      const batchMonthKey = normalizeBatchKey(input.batch_month_key || input.batchMonthKey || input.batch || "");
      const productSessionDate = normalizeSessionDateValue(input.session_date || input.sessionDate) || buildDefaultBatchSessionDate(batchMonthKey, createdAt);
      if (product && batchMonthKey) {
        const selectedBatch = (product.batches || []).find((batch) => batch.key === batchMonthKey) ?? null;
        if (!selectedBatch?.is_active) {
          throw new Error("The selected batch is not operational for this product.");
        }
      }
      const defaultSoldValue = Math.max(originalProductValue - (coupon ? calculateCouponDiscount(coupon, originalProductValue) : 0), 0);
      const explicitSoldValue = Number(input.product_value_inr ?? input.sale_price_inr ?? 0);
      if (explicitSoldValue > 0 && !isAdminOverrideAllowed && explicitSoldValue !== defaultSoldValue) {
        throw new Error("Only admin and super-admin users can override the sold price.");
      }
      const productValue = explicitSoldValue > 0 ? explicitSoldValue : defaultSoldValue;
      const discountInr = Math.max(originalProductValue - productValue, 0);
      if (productValue <= 0) {
        throw new Error("Coupon discount cannot reduce order value to zero");
      }
      const paymentMode = String(input.payment_type || input.payment_mode || webinar?.payment_mode || "FULL").toUpperCase() === "TOKEN" ? "TOKEN" : "FULL";
      const firstCollection =
        paymentMode === "TOKEN"
          ? Math.min(
            Math.max(Number(input.token_amount || input.amount_inr || webinar?.token_price_inr || Math.round(productValue * 0.2)), 1),
            Math.max(productValue - 1, 1),
          )
          : Number(input.amount_inr || productValue);
      const promiseDate = input.promise_date || input.token_due_date || null;
      const sourceType = normalizeSourceType(
        input.source_type
        || (input.webinar_id ? "WEBINAR" : input.bootcamp_id ? "BOOTCAMP" : bda?.id ? "BDA" : "MANUAL"),
      );

      const order = {
        id: crypto.randomUUID(),
        order_number: `LLW-${Date.now()}`,
        student_id: student.id,
        product_id: product?.id || null,
        bootcamp_id: input.bootcamp_id || null,
        webinar_id: input.webinar_id || null,
        amount_inr: firstCollection,
        original_product_value_inr: originalProductValue,
        discount_inr: discountInr,
        coupon_id: coupon?.id || null,
        coupon_code: coupon?.code || "",
        coupon_title: coupon?.title || "",
        product_value_inr: productValue,
        payment_mode: paymentMode,
        status: "PENDING",
        razorpay_order_id: "",
        razorpay_payment_id: "",
        razorpay_signature: "",
        utm_source: input.source || input.campaign_source || webinar?.title || bootcamp?.title || "manual-link",
        utm_medium: sourceType.toLowerCase(),
        utm_campaign: input.campaign || "payment-link",
        bda_id: bda?.id || null,
        source_type: sourceType,
        created_by_user_id: actorTeamMember?.id || actor.id || null,
        created_by_name: actorTeamMember?.name || actor.name || "",
        created_by_email: actorTeamMember?.email || actor.email || "",
        created_by_role: actorRole,
        manager_name: managerName,
        team_name: teamName,
        product_mode: product?.mode || "",
        session_date: productSessionDate,
        promise_date: promiseDate,
        batch_month_key: batchMonthKey,
        batch_month_label: batchMonthKey ? productBatchMonthByKey.get(batchMonthKey)?.label || batchMonthKey : "",
        collect_customer_details_on_checkout: collectCustomerDetailsOnCheckout,
        portal_access_done: false,
        broker_setup_done: false,
        demat_setup_done: false,
        welcome_kit_sent: false,
        access_revocation_requested: false,
        access_revoked: false,
        preferred_language: preferredLanguage,
        learning_schedule: learningSchedule,
        created_at: createdAt,
        updated_at: createdAt,
      };

      store.data.orders.unshift(order);
      if (coupon) {
        coupon.usage_count = Number(coupon.usage_count || 0) + 1;
        coupon.updated_at = nowIso();
      }

      const payment = store.createPaymentRecord(order, {
        ...input,
        amount_inr: firstCollection,
        type: "ENROLLMENT",
        is_recovery: false,
        created_at: createdAt,
        paid_at: input.paid_at || createdAt,
      });

      if (payment.method === "RAZORPAY" && payment.status !== "PAID") {
        const link = store.createShortLink({
          label: collectCustomerDetailsOnCheckout ? `Payment ${product?.name || webinar?.title || bootcamp?.title || order.order_number}` : `Payment ${student.name}`,
          original_url: `/payment/${payment.id}`,
        });
        payment.payment_link = link.short_url;
        payment.slug = link.slug;
      } else {
        payment.razorpay_payment_id = input.reference_code || payment.transaction_id;
        payment.updated_at = nowIso();
        payment.paid_at = payment.paid_at || nowIso();
      }

      const refreshedOrder = store.refreshOrderState(order.id);
      store.persist();
      return {
        order: withComputedPayment(refreshedOrder, store.data),
        payment,
        link: payment.payment_link
          ? {
              short_url: payment.payment_link,
              slug: payment.slug || extractAliasFromLink(payment.payment_link),
            }
          : null,
        };
    },
    captureCheckoutCustomer(orderId, input = {}) {
      const order = store.data.orders.find((entry) => entry.id === orderId);
      if (!order) {
        throw new Error("Order not found");
      }

      const name = String(input.customer_name || input.name || "").trim();
      const phone = String(input.phone || "").replace(/\D/g, "");
      const email = String(input.email || "").trim().toLowerCase();

      if (!name || !phone || !email) {
        throw new Error("Name, phone, and email are required before payment.");
      }

      const student = store.data.students.find((entry) => entry.id === order.student_id) ?? null;
      if (student) {
        student.name = name;
        student.phone = phone;
        student.email = email;
        student.source = order.utm_source || student.source;
        student.bda_id = order.bda_id || student.bda_id;
      } else {
        const createdStudent = store.upsertStudent({
          name,
          phone,
          email,
          source: order.utm_source || "Payment Link",
          bda_id: order.bda_id || null,
        });
        order.student_id = createdStudent.id;
      }

      order.collect_customer_details_on_checkout = false;
      order.updated_at = nowIso();
      store.persist();
      return withComputedPayment(order, store.data);
    },
    createRecoveryLink(orderId, input = {}) {
      const order = store.data.orders.find((entry) => entry.id === orderId);
      if (!order) {
        throw new Error("Order not found");
      }

      const remainingAmount = getAmountDue(order, store.data);
      if (remainingAmount <= 0) {
        throw new Error("No remaining amount is due on this order");
      }

      const recoveryInstallments = getRecoveryInstallmentSummary(order, store.data);
      if (order.payment_mode === "TOKEN" && recoveryInstallments.remaining <= 0) {
        throw new Error("This token order has already used both recovery installments.");
      }
      if (input.promise_date) {
        order.promise_date = input.promise_date;
        order.updated_at = nowIso();
      }

      return store.createPaymentLink({
        ...input,
        existing_order_id: order.id,
        amount_inr: Math.min(Number(input.amount_inr || remainingAmount), remainingAmount),
        type: "RECOVERY",
        payment_method: input.payment_method || "RAZORPAY",
      });
    },
    importPaymentRows(rows = [], actor = {}) {
      const created = [];
      const errors = [];
      const parseRowAmount = (value, fallback = 0) => {
        const normalized = String(value ?? "").replace(/,/g, "").trim();
        if (!normalized) return fallback;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : fallback;
      };

      const resolveProduct = (row = {}) => {
        const productId = String(row.product_id || "").trim();
        const productName = String(row.product_name || "").trim().toLowerCase();
        const productSlug = String(row.product_slug || "").trim().toLowerCase();
        return store.data.products.find((product) => (
          (productId && product.id === productId)
          || (productName && String(product.name || "").trim().toLowerCase() === productName)
          || (productSlug && String(product.slug || "").trim().toLowerCase() === productSlug)
        )) ?? null;
      };

      const resolveBda = (row = {}) => {
        const bdaId = String(row.bda_id || "").trim();
        const bdaEmail = String(row.bda_email || row.sales_owner_email || "").trim().toLowerCase();
        const bdaName = String(row.bda_name || row.sales_owner_name || "").trim().toLowerCase();
        return store.data.team.find((member) => (
          String(member.role || "").toUpperCase() === "BDA"
          && (
            (bdaId && member.id === bdaId)
            || (bdaEmail && String(member.email || "").trim().toLowerCase() === bdaEmail)
            || (bdaName && String(member.name || "").trim().toLowerCase() === bdaName)
          )
        )) ?? null;
      };

      rows.forEach((rawRow = {}, index) => {
        try {
          const product = resolveProduct(rawRow);
          if (!product) {
            throw new Error("Product not found. Use product_id, product_name, or product_slug.");
          }

          const bda = resolveBda(rawRow);
          const paymentMode = String(rawRow.payment_mode || "TOKEN").trim().toUpperCase() === "FULL" ? "FULL" : "TOKEN";
          const paymentMethod = normalizePaymentMethod(rawRow.payment_method || "CASH");
          const basePriceRs = parseRowAmount(rawRow.base_price_rs ?? rawRow.base_price, product.discounted_price / 100);
          const salePriceRs = parseRowAmount(rawRow.sale_price_rs ?? rawRow.sold_price_rs ?? rawRow.sale_price, basePriceRs);
          const collectedAmountRs = parseRowAmount(rawRow.collected_amount_rs ?? rawRow.amount_received_rs ?? rawRow.token_amount_rs ?? rawRow.amount_rs, paymentMode === "FULL" ? salePriceRs : 0);
          if (!collectedAmountRs || collectedAmountRs <= 0) {
            throw new Error("Collected amount must be greater than zero.");
          }
          if (paymentMode === "TOKEN" && collectedAmountRs >= salePriceRs) {
            throw new Error("Token collected amount must be lower than the sold price.");
          }
          const paidAt = coerceIsoTimestamp(rawRow.payment_date || rawRow.paid_at || rawRow.created_at, nowIso());
          const promiseDate = rawRow.promise_date ? String(rawRow.promise_date).trim() : "";
          const createdEntry = store.createPaymentLink({
            student_name: rawRow.customer_name || rawRow.student_name || rawRow.name || "Imported Customer",
            phone: rawRow.phone || "",
            email: rawRow.email || "",
            bda_id: bda?.id || null,
            product_id: product.id,
            original_product_value_inr: Math.round(basePriceRs * 100),
            product_value_inr: Math.round(salePriceRs * 100),
            payment_type: paymentMode,
            payment_method: paymentMethod,
            amount_inr: Math.round(collectedAmountRs * 100),
            token_amount: paymentMode === "TOKEN" ? Math.round(collectedAmountRs * 100) : 0,
            reference_code: String(rawRow.reference_code || rawRow.transaction_id || rawRow.receipt_number || rawRow.utr || `IMPORT-${Date.now()}-${index + 1}`).trim(),
            transaction_id: String(rawRow.transaction_id || rawRow.reference_code || rawRow.receipt_number || rawRow.utr || `IMPORT-${Date.now()}-${index + 1}`).trim(),
            source: String(rawRow.source || rawRow.campaign_source || "csv-import").trim(),
            campaign: String(rawRow.campaign || "csv-import").trim(),
            batch_month_key: rawRow.batch_month_key || rawRow.batch || "",
            promise_date: promiseDate || null,
            source_type: bda?.id ? "BDA" : "MANUAL",
            created_at: paidAt,
            paid_at: paidAt,
            status: "PAID",
            language: rawRow.language || "English",
            learning_schedule: rawRow.learning_schedule || rawRow.schedule_type || "WEEKDAY",
            collect_customer_details_on_checkout: false,
          }, actor);

          created.push({
            row_number: index + 2,
            order_id: createdEntry.order.id,
            order_number: createdEntry.order.order_number,
            customer_name: createdEntry.order.student?.name || rawRow.customer_name || rawRow.student_name || "",
          });
        } catch (error) {
          errors.push({
            row_number: index + 2,
            message: error instanceof Error ? error.message : "Unable to import row.",
          });
        }
      });

      if (created.length) {
        store.persist("payment-import");
      }

      return {
        created,
        errors,
      };
    },
    requestAccessRevoke(orderId, actor = {}) {
      const order = store.data.orders.find((entry) => entry.id === orderId);
      if (!order) {
        throw new Error("Order not found");
      }
      order.access_revocation_requested = true;
      order.access_revocation_requested_at = nowIso();
      order.access_revocation_requested_by = actor.name || actor.email || "Revenue desk";
      order.updated_at = nowIso();
      store.persist();
      return withComputedPayment(order, store.data);
    },
    attachRazorpayOrderToPayment(paymentId, razorpayOrder) {
      const payment = store.getPaymentRecord(paymentId);
      if (!payment) {
        throw new Error("Payment record not found");
      }

      payment.razorpay_order_id = razorpayOrder.id;
      payment.updated_at = nowIso();
      return payment;
    },
    markPaymentPaid(input = {}) {
      let payment = input.payment_id ? store.getPaymentRecord(input.payment_id) : null;

      if (!payment && input.order_id) {
        payment = store.getLatestPaymentForOrder(input.order_id, { preferOpen: true });
      }

      if (!payment) {
        throw new Error("Payment record not found");
      }

      payment.status = "PAID";
      payment.razorpay_order_id = input.razorpay_order_id || payment.razorpay_order_id;
      payment.razorpay_payment_id = input.razorpay_payment_id || payment.razorpay_payment_id || `pay_${Date.now()}`;
      payment.razorpay_signature = input.razorpay_signature || payment.razorpay_signature;
      payment.transaction_id = payment.razorpay_payment_id || payment.transaction_id;
      payment.paid_at = nowIso();
      payment.updated_at = nowIso();

      const order = store.refreshOrderState(payment.order_id);
      if (!order) {
        throw new Error("Order not found");
      }

      order.razorpay_order_id = payment.razorpay_order_id || order.razorpay_order_id;
      order.razorpay_payment_id = payment.razorpay_payment_id || order.razorpay_payment_id;
      order.razorpay_signature = payment.razorpay_signature || order.razorpay_signature;
      order.updated_at = nowIso();
      store.persist();

      return {
        payment,
        order: withComputedPayment(order, store.data),
      };
    },
    markPaymentFailed(input = {}) {
      let payment = input.payment_id ? store.getPaymentRecord(input.payment_id) : null;

      if (!payment && input.order_id) {
        payment = store.getLatestPaymentForOrder(input.order_id, { preferOpen: true });
      }

      if (!payment) {
        throw new Error("Payment record not found");
      }

      if (payment.status === "PAID" || payment.status === "REFUNDED") {
        return {
          payment,
          order: withComputedPayment(store.data.orders.find((entry) => entry.id === payment.order_id), store.data),
        };
      }

      payment.status = "FAILED";
      payment.failure_code = input.failure_code || payment.failure_code || "";
      payment.failure_reason = input.failure_reason || payment.failure_reason || "";
      payment.updated_at = nowIso();

      const order = store.refreshOrderState(payment.order_id);
      if (!order) {
        throw new Error("Order not found");
      }

      store.persist();
      return {
        payment,
        order: withComputedPayment(order, store.data),
      };
    },
    updateOperations(orderId, patch = {}) {
      const order = store.data.orders.find((entry) => entry.id === orderId);
      if (!order) {
        throw new Error("Order not found");
      }

      order.portal_access_done = patch.portal_access_done ?? order.portal_access_done;
      order.broker_setup_done = patch.broker_setup_done ?? order.broker_setup_done;
      order.demat_setup_done = patch.demat_setup_done ?? order.demat_setup_done;
      order.welcome_kit_sent = patch.welcome_kit_sent ?? order.welcome_kit_sent;
      if (patch.access_revoked != null) {
        order.access_revoked = Boolean(patch.access_revoked);
        order.access_revoked_at = patch.access_revoked ? nowIso() : null;
        order.access_revoked_by = patch.access_revoked_by || order.access_revoked_by || "";
        if (patch.access_revoked) {
          order.portal_access_done = false;
          order.access_revocation_requested = false;
          order.access_revocation_requested_at = null;
          order.access_revocation_requested_by = "";
        }
      }
      if (patch.batch_month_key != null || patch.batchMonthKey != null || patch.batch != null) {
        const product = store.data.products.find((entry) => entry.id === order.product_id) ?? null;
        if (!product) {
          throw new Error("This order does not have a product batch to update.");
        }
        const nextBatchKey = normalizeBatchKey(patch.batch_month_key || patch.batchMonthKey || patch.batch || "");
        if (!nextBatchKey) {
          order.batch_month_key = "";
          order.batch_month_label = "";
        } else {
          const selectedBatch = (product.batches || []).find((batch) => batch.key === nextBatchKey) ?? null;
          if (!selectedBatch) {
            throw new Error("The selected batch does not exist for this product.");
          }
          order.batch_month_key = nextBatchKey;
          order.batch_month_label = selectedBatch.label || productBatchMonthByKey.get(nextBatchKey)?.label || nextBatchKey;
        }
      }
      order.updated_at = nowIso();
      store.refreshOrderState(order.id);
      store.persist();

      return withComputedPayment(order, store.data);
    },
    getSystemSettings() {
      return store.data.settings || normalizeSettings({});
    },
    updateSystemSettings(patch = {}) {
      store.data.settings = normalizeSettings({
        ...(store.data.settings || {}),
        ...patch,
        updated_at: nowIso(),
      });
      store.persist();
      return store.data.settings;
    },
    createRefund(input = {}, requester = {}) {
      const order = store.data.orders.find((item) => item.id === input.order_id) ?? null;
      const payment = order ? withComputedPayment(order, store.data) : null;
      const existing = order ? store.data.refunds.find((item) => item.order_id === order.id && item.status === "REQUESTED") : null;
      if (existing) {
        const approvalFlow = buildRefundApprovalFlow(store.data, requester);
        const shouldRefreshRequesterRole =
          !existing.requested_by_role ||
          (approvalFlow.requestedByRole === "BDA" &&
            String(existing.requested_by_email || "").toLowerCase() === String(requester.email || "").toLowerCase() &&
            String(existing.requested_by_role || "").toUpperCase() !== "BDA");
        if (shouldRefreshRequesterRole || !existing.approval_chain || !existing.next_approver_role || !existing.next_approver_name) {
          existing.requested_by_role = shouldRefreshRequesterRole ? approvalFlow.requestedByRole : existing.requested_by_role;
          existing.approval_chain = existing.approval_chain || approvalFlow.approvalChain;
          existing.next_approver_name = existing.next_approver_name || approvalFlow.nextApproverName;
          existing.next_approver_role = existing.next_approver_role || approvalFlow.nextApproverRole;
          existing.updated_at = nowIso();
          store.persist();
        }
        return { ...existing, already_exists: true };
      }
      const approvalFlow = buildRefundApprovalFlow(store.data, requester);
      const refund = {
        id: crypto.randomUUID(),
        order_id: order?.id || null,
        payment_id: input.payment_id || payment?.payment_history?.[0]?.id || null,
        gateway_order_id: order?.razorpay_order_id || input.gateway_order_id || `manual_${Date.now()}`,
        student_name: payment?.student?.name || input.student_name || "Guest user",
        phone: payment?.student?.phone || input.phone || "",
        amount_inr: Number(input.amount_inr || payment?.amount_paid_inr || order?.amount_inr || 0),
        course_name: payment?.bootcamp?.title || payment?.webinar?.title || payment?.product?.name || input.course_name || "Manual refund",
        requested_by: input.requested_by || requester.name || "Admin",
        requested_by_email: input.requested_by_email || requester.email || "admin@livelongwealth.com",
        requested_by_role: approvalFlow.requestedByRole,
        user_comment: input.user_comment || "Refund requested from payment desk.",
        admin_comment: input.admin_comment || "",
        approval_chain: approvalFlow.approvalChain,
        next_approver_name: approvalFlow.nextApproverName,
        next_approver_role: approvalFlow.nextApproverRole,
        status: "REQUESTED",
        approved_at: null,
        rejected_at: null,
        decision_by: "",
        decision_by_role: "",
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      store.data.refunds.unshift(refund);
      store.persist();
      return { ...refund, already_exists: false };
    },
    getRefunds() {
      return store.data.refunds
        .map((refund) => ({
          ...refund,
          order:
            refund.order_id && store.data.orders.find((item) => item.id === refund.order_id)
              ? withComputedPayment(store.data.orders.find((item) => item.id === refund.order_id), store.data)
              : null,
        }))
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
    },
    getRefundSummary() {
      const rows = store.getRefunds();
      return {
        requestedCount: rows.filter((refund) => refund.status === "REQUESTED").length,
        approvedCount: rows.filter((refund) => refund.status === "APPROVED").length,
        rejectedCount: rows.filter((refund) => refund.status === "REJECTED").length,
        requestedAmount: rows.filter((refund) => refund.status === "REQUESTED").reduce((sum, refund) => sum + Number(refund.amount_inr || 0), 0),
        approvedAmount: rows.filter((refund) => refund.status === "APPROVED").reduce((sum, refund) => sum + Number(refund.amount_inr || 0), 0),
        rejectedAmount: rows.filter((refund) => refund.status === "REJECTED").reduce((sum, refund) => sum + Number(refund.amount_inr || 0), 0),
      };
    },
    updateRefund(refundId, decision, adminComment = "", actor = {}) {
      const refund = store.data.refunds.find((item) => item.id === refundId);
      if (!refund) {
        return null;
      }

      refund.status = normalizeRefundStatus(decision);
      refund.admin_comment = adminComment || refund.admin_comment;
      refund.decision_by = actor.name || actor.email || refund.decision_by || "";
      refund.decision_by_role = String(actor.role || refund.decision_by_role || "").toUpperCase();
      refund.next_approver_name = "";
      refund.next_approver_role = "";
      refund.updated_at = nowIso();
      if (refund.status === "APPROVED") {
        refund.approved_at = nowIso();
        refund.rejected_at = null;
      }
      if (refund.status === "REJECTED") {
        refund.rejected_at = nowIso();
      }

      const order = refund.order_id ? store.data.orders.find((item) => item.id === refund.order_id) : null;
      if (order) {
        order.status = computeOrderStatus(order, store.data);
        order.updated_at = nowIso();
        store.refreshOrderState(order.id);
      }

      store.persist();
      return refund;
    },
  };

  store.data.orders.forEach((order) => {
    store.refreshOrderState(order.id);
  });
  store.persist("startup-normalize");

  return store;
}

export { constants };
