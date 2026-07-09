// Cloud-hosted buffer for live-webinar activity.
//
// While a class is running, high-frequency events (joins, leaves, mic/camera
// toggles, enroll clicks, chat) are appended here instead of forcing a full
// main-store persist per event. After the webinar ends the in-memory store is
// persisted once and the buffered rows are marked imported. If the server dies
// mid-class, the unimported rows can be replayed into the main store.
//
// Enabled only when LIVE_EVENT_DB_URL (a Postgres connection string, e.g.
// Neon/Supabase/Render) is configured; otherwise every call is a no-op and the
// app behaves exactly as before.

const liveEventDbUrl = String(process.env.LIVE_EVENT_DB_URL || "").trim();
const liveEventDbSsl = /^(1|true|yes)$/i.test(String(process.env.LIVE_EVENT_DB_SSL || "true"));
const FLUSH_INTERVAL_MS = Math.max(500, Number(process.env.LIVE_EVENT_FLUSH_MS || 2000));
const FLUSH_BATCH_MAX = 200;
const QUEUE_HARD_CAP = 5000;

function createDisabledLiveEventStore() {
  return {
    enabled: false,
    recordEvent() {},
    async flush() {},
    async importRoomEvents() {
      return [];
    },
    async markImported() {
      return 0;
    },
    async close() {},
    getStatus() {
      return { enabled: false, mode: "disabled" };
    },
  };
}

export async function createLiveEventStore() {
  if (!liveEventDbUrl) {
    return createDisabledLiveEventStore();
  }

  let pool;
  try {
    const pg = await import("pg");
    const Pool = pg.default?.Pool || pg.Pool;
    pool = new Pool({
      connectionString: liveEventDbUrl,
      max: 3,
      ssl: liveEventDbSsl ? { rejectUnauthorized: false } : undefined,
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS webinar_live_events (
        id BIGSERIAL PRIMARY KEY,
        room_name TEXT NOT NULL,
        webinar_id TEXT,
        attendance_id TEXT,
        event_type TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        imported_at TIMESTAMPTZ
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS webinar_live_events_pending_idx
        ON webinar_live_events (room_name, id)
        WHERE imported_at IS NULL
    `);
  } catch (error) {
    console.error(
      "Live event store is unavailable, continuing without it:",
      error instanceof Error ? error.message : error,
    );
    return createDisabledLiveEventStore();
  }

  const queue = [];
  let flushing = Promise.resolve();
  let lastError = null;
  let lastFlushAt = null;
  let totalRecorded = 0;
  let droppedEvents = 0;

  async function flushNow() {
    if (!queue.length) return;
    const batch = queue.splice(0, FLUSH_BATCH_MAX);
    const values = [];
    const params = [];
    batch.forEach((event, index) => {
      const base = index * 5;
      values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
      params.push(
        event.roomName,
        event.webinarId || null,
        event.attendanceId || null,
        event.type,
        JSON.stringify(event.payload || {}),
      );
    });
    try {
      await pool.query(
        `INSERT INTO webinar_live_events (room_name, webinar_id, attendance_id, event_type, payload) VALUES ${values.join(", ")}`,
        params,
      );
      lastFlushAt = new Date().toISOString();
      lastError = null;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      droppedEvents += batch.length;
      console.error(`Live event flush failed (${batch.length} events dropped):`, lastError);
    }
    if (queue.length) {
      await flushNow();
    }
  }

  function scheduleFlush() {
    flushing = flushing.then(flushNow, flushNow);
    return flushing;
  }

  const timer = setInterval(() => {
    if (queue.length) scheduleFlush();
  }, FLUSH_INTERVAL_MS);
  timer.unref?.();

  return {
    enabled: true,
    recordEvent({ roomName, webinarId, attendanceId, type, payload }) {
      if (!roomName || !type) return;
      if (queue.length >= QUEUE_HARD_CAP) {
        droppedEvents += 1;
        return;
      }
      queue.push({ roomName: String(roomName), webinarId, attendanceId, type: String(type), payload });
      totalRecorded += 1;
      if (queue.length >= FLUSH_BATCH_MAX) {
        scheduleFlush();
      }
    },
    async flush() {
      await scheduleFlush();
    },
    async importRoomEvents(roomName) {
      await scheduleFlush();
      const result = await pool.query(
        `SELECT id, room_name, webinar_id, attendance_id, event_type, payload, created_at
           FROM webinar_live_events
          WHERE room_name = $1 AND imported_at IS NULL
          ORDER BY id ASC`,
        [String(roomName)],
      );
      return result.rows;
    },
    async markImported(roomName, maxId = null) {
      const result = maxId
        ? await pool.query(
            "UPDATE webinar_live_events SET imported_at = now() WHERE room_name = $1 AND id <= $2 AND imported_at IS NULL",
            [String(roomName), maxId],
          )
        : await pool.query(
            "UPDATE webinar_live_events SET imported_at = now() WHERE room_name = $1 AND imported_at IS NULL",
            [String(roomName)],
          );
      return result.rowCount || 0;
    },
    async close() {
      clearInterval(timer);
      await scheduleFlush();
      await pool.end().catch(() => undefined);
    },
    getStatus() {
      return {
        enabled: true,
        mode: "postgres",
        queued: queue.length,
        total_recorded: totalRecorded,
        dropped_events: droppedEvents,
        last_flush_at: lastFlushAt,
        last_error: lastError,
      };
    },
  };
}
