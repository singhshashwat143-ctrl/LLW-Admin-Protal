import fs from "node:fs";
import path from "node:path";

const workspaceRoot = "/Users/shashwatsingh/Desktop/llw_webinare";
const sourceBackupPath = process.argv[2] || path.join(workspaceRoot, "data", "backups", "app-data.2026-06-02.json");

process.env.GOOGLE_SHEETS_AS_PRIMARY_DB = "true";
process.env.GOOGLE_SHEETS_SYNC_TIMEOUT_MS = process.env.GOOGLE_SHEETS_SYNC_TIMEOUT_MS || "200000";

const { createGoogleSheetsPrimaryPersistence } = await import("../server/google-sheets-primary-persistence.mjs");

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildLinkIdentity(link) {
  return [
    String(link?.id || "").trim().toLowerCase(),
    String(link?.slug || "").trim().toLowerCase(),
    String(link?.short_path || "").trim().toLowerCase(),
    String(link?.short_url || "").trim().toLowerCase(),
    String(link?.original_url || "").trim().toLowerCase(),
  ].filter(Boolean).join("|");
}

const sourceBackup = JSON.parse(fs.readFileSync(sourceBackupPath, "utf8"));
const persistence = await createGoogleSheetsPrimaryPersistence();
const remoteSnapshot = await persistence.load({});

const remotePayloadBackup = {
  exported_at: new Date().toISOString(),
  status: persistence.getStatus(),
  snapshot: clone(remoteSnapshot),
};

const backupDir = path.join(workspaceRoot, "data", "backups");
fs.mkdirSync(backupDir, { recursive: true });
const remoteBackupPath = path.join(backupDir, `live-remote-pre-webinar-restore-${nowStamp()}.json`);
fs.writeFileSync(remoteBackupPath, JSON.stringify(remotePayloadBackup, null, 2));

const remote = clone(remoteSnapshot);
remote.webinars = ensureArray(remote.webinars);
remote.webinarSessions = ensureArray(remote.webinarSessions);
remote.links = ensureArray(remote.links);

const sourceWebinars = ensureArray(sourceBackup.webinars);
const sourceSessions = ensureArray(sourceBackup.webinarSessions);
const sourceLinks = ensureArray(sourceBackup.links);

const remoteWebinarIds = new Set(remote.webinars.map((item) => item.id).filter(Boolean));
const referencedWebinarIds = new Set(remote.webinarSessions.map((item) => item.webinar_id).filter(Boolean));

const webinarsToRestore = sourceWebinars.filter((webinar) => referencedWebinarIds.has(webinar.id) && !remoteWebinarIds.has(webinar.id));
const webinarIdsToRestore = new Set(webinarsToRestore.map((item) => item.id));
const sessionsForRestoredWebinars = sourceSessions.filter((session) => webinarIdsToRestore.has(session.webinar_id));

const existingLinkIdentities = new Set(remote.links.map((link) => buildLinkIdentity(link)));
const linksToRestore = sourceLinks.filter((link) => {
  const originalUrl = String(link?.original_url || "");
  const matchesWebinar = webinarsToRestore.some((webinar) => (
    originalUrl === webinar.host_url
    || originalUrl === webinar.attendee_url
    || String(link?.short_path || "") === webinar.short_host_url
    || String(link?.short_path || "") === webinar.short_attendee_url
  ));
  const matchesSession = sessionsForRestoredWebinars.some((session) => (
    originalUrl === session.host_url
    || originalUrl === session.attendee_url
    || String(link?.short_path || "") === session.short_host_url
    || String(link?.short_path || "") === session.short_attendee_url
  ));
  if (!matchesWebinar && !matchesSession) {
    return false;
  }
  const identity = buildLinkIdentity(link);
  return identity && !existingLinkIdentities.has(identity);
});

remote.webinars.unshift(...webinarsToRestore);
remote.links.unshift(...linksToRestore);

await persistence.save(remote, "restore-missing-webinars");
await persistence.flush();

console.log(JSON.stringify({
  ok: true,
  sourceBackupPath,
  remoteBackupPath,
  restored_webinars: webinarsToRestore.length,
  restored_titles: webinarsToRestore.map((item) => item.title),
  restored_links: linksToRestore.length,
  final_counts: {
    webinars: remote.webinars.length,
    webinarSessions: remote.webinarSessions.length,
    webinarAttendance: ensureArray(remote.webinarAttendance).length,
    links: remote.links.length,
  },
  persistence: persistence.getStatus(),
}, null, 2));

await persistence.close();
