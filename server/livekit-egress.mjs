// Hybrid broadcast: view-only attendees watch the webinar over LL-HLS (fed by a
// LiveKit RoomComposite egress → segments served by the media box's Caddy → CDN)
// instead of each opening a WebRTC subscription. The SFU then only fans out to
// the host + panelists + one egress participant, so the box's egress budget no
// longer scales with the audience — this is how Zoom/Meet scale view-only.
//
// Entirely feature-flagged by LIVEKIT_HLS_BASE. When unset, hlsEnabled() is
// false and every export is a safe no-op: attendees keep the WebRTC path.
import { EgressClient, SegmentedFileOutput, SegmentedFileProtocol } from "livekit-server-sdk";

const HLS_BASE = String(process.env.LIVEKIT_HLS_BASE || "").trim().replace(/\/+$/, "");
// live.m3u8 = the sliding-window low-latency playlist; index.m3u8 = full VOD.
const PLAYLIST = String(process.env.LIVEKIT_HLS_PLAYLIST || "live.m3u8").trim();
const LAYOUT = String(process.env.LIVEKIT_HLS_LAYOUT || "single-speaker").trim();

export function hlsEnabled() {
  return Boolean(HLS_BASE);
}

const clients = new Map(); // controlUrl|apiKey -> EgressClient
const active = new Map();   // roomName -> { egressId, hlsUrl, startedAt }
const starting = new Set(); // rooms mid-start, to de-dupe concurrent joins

function sanitizeDir(roomName) {
  return String(roomName || "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "room";
}

function clientFor(config) {
  if (!config?.controlUrl || !config?.apiKey || !config?.apiSecret) return null;
  const key = `${config.controlUrl}|${config.apiKey}`;
  if (!clients.has(key)) clients.set(key, new EgressClient(config.controlUrl, config.apiKey, config.apiSecret));
  return clients.get(key) || null;
}

export function getRoomHls(roomName) {
  return active.get(roomName)?.hlsUrl || null;
}

// Start (idempotent) an HLS egress for a room. Safe to call on every host join.
export async function ensureRoomHls(roomName, config) {
  if (!hlsEnabled() || !roomName || !config) return null;
  const existing = active.get(roomName);
  if (existing) return existing.hlsUrl;
  if (starting.has(roomName)) return `${HLS_BASE}/${sanitizeDir(roomName)}/${PLAYLIST}`;
  const client = clientFor(config);
  if (!client) return null;

  starting.add(roomName);
  const dir = sanitizeDir(roomName);
  const hlsUrl = `${HLS_BASE}/${dir}/${PLAYLIST}`;
  try {
    const output = new SegmentedFileOutput({
      filenamePrefix: `/out/${dir}/seg`,
      playlistName: `/out/${dir}/index.m3u8`,
      livePlaylistName: `/out/${dir}/live.m3u8`,
      segmentDuration: 2,
      protocol: SegmentedFileProtocol.HLS_PROTOCOL,
    });
    const info = await client.startRoomCompositeEgress(roomName, { segments: output }, { layout: LAYOUT });
    active.set(roomName, { egressId: info?.egressId || "unknown", hlsUrl, startedAt: Date.now() });
    return hlsUrl;
  } catch (error) {
    console.error("[egress] start failed for", roomName, error?.message || error);
    return null;
  } finally {
    starting.delete(roomName);
  }
}

export async function stopRoomHls(roomName, config) {
  const cur = active.get(roomName);
  if (!cur) return false;
  active.delete(roomName);
  try {
    const client = clientFor(config);
    if (client && cur.egressId && cur.egressId !== "unknown") await client.stopEgress(cur.egressId);
    return true;
  } catch (error) {
    console.error("[egress] stop failed for", roomName, error?.message || error);
    return false;
  }
}
