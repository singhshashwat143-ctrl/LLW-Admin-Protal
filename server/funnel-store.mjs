// Sales & marketing funnel: campaigns + leads. A marketing person creates a
// campaign (an LP + a WhatsApp group behind it), pastes the returned link in an
// ad; every form fill / CSV row becomes a lead in the DB, tagged to its
// campaign and source (webinar / BDA calling / CSV / landing page).
//
// Dedicated Postgres tables (not the app-data blob). In-memory fallback for dev.

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const databaseSsl = /^(1|true|yes)$/i.test(String(process.env.DATABASE_SSL || ""))
  ? { rejectUnauthorized: false }
  : undefined;

function uid() {
  try { return globalThis.crypto.randomUUID(); }
  catch { return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }
}
function slugify(v) {
  return String(v || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "campaign";
}

// Auto-map an arbitrary CSV row {header: value} to {name, email, phone, extra}.
function mapCsvRow(row = {}) {
  const keys = Object.keys(row);
  const find = (patterns) => {
    for (const k of keys) {
      const kl = k.toLowerCase().trim();
      if (patterns.some((p) => kl.includes(p))) return row[k];
    }
    return "";
  };
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRe = /^[+\d][\d\s\-()]{6,}$/;
  let email = String(find(["email", "e-mail", "mail"]) || "").trim();
  let phone = String(find(["phone", "mobile", "contact", "whatsapp", "number", "cell"]) || "").trim();
  let name = String(find(["name", "full name", "fullname", "lead"]) || "").trim();
  // Fallback: scan values for an email / phone if headers were unhelpful.
  if (!emailRe.test(email)) {
    const v = keys.map((k) => String(row[k] || "").trim()).find((x) => emailRe.test(x));
    if (v) email = v;
  }
  if (!phone) {
    const v = keys.map((k) => String(row[k] || "").trim()).find((x) => phoneRe.test(x.replace(/\s/g, "")));
    if (v) phone = v;
  }
  const extra = {};
  for (const k of keys) {
    const kl = k.toLowerCase();
    if (["name", "email", "e-mail", "mail", "phone", "mobile", "contact", "number"].some((p) => kl.includes(p))) continue;
    if (row[k] !== "" && row[k] != null) extra[k] = row[k];
  }
  return { name, email: email.toLowerCase(), phone, extra };
}

function createMemoryStore() {
  const campaigns = new Map();
  const leads = new Map(); // key: email|phone|id
  const keyOf = (l) => l.email || l.phone || l.id;
  return {
    mode: "memory",
    async init() { return this; },
    async createCampaign(c) {
      const id = uid();
      const row = { id, name: c.name || "Untitled", channel: c.channel || "meta", lp: c.lp || "webinar",
        whatsapp_group_url: c.whatsapp_group_url || "", distribution: c.distribution || "webinar",
        webinar_id: c.webinar_id || null, event_at: c.event_at || null, session_hours: Number(c.session_hours) || 2,
        room_name: c.room_name || "", slug: `${slugify(c.name)}-${id.slice(0, 6)}`, created_at: new Date().toISOString() };
      campaigns.set(id, row); return row;
    },
    async updateCampaign(id, patch) {
      const cur = campaigns.get(id); if (!cur) return null;
      const fields = ["name", "whatsapp_group_url", "event_at", "session_hours", "room_name", "distribution", "channel", "lp"];
      const next = { ...cur };
      for (const f of fields) if (patch[f] !== undefined) next[f] = f === "session_hours" ? (Number(patch[f]) || 2) : patch[f];
      campaigns.set(id, next); return next;
    },
    async listCampaigns() {
      const arr = [...campaigns.values()];
      return arr.map((c) => ({ ...c, lead_count: [...leads.values()].filter((l) => l.campaign_id === c.id).length }));
    },
    async getCampaignBySlug(slug) { return [...campaigns.values()].find((c) => c.slug === slug) || null; },
    async upsertLead(l) {
      const norm = { id: uid(), name: l.name || "", email: (l.email || "").toLowerCase(), phone: l.phone || "",
        campaign_id: l.campaign_id || null, source: l.source || "lp", stage: l.stage || "new",
        group_joined: Boolean(l.group_joined), extra: l.extra || {}, created_at: new Date().toISOString() };
      const k = norm.email || norm.phone || norm.id;
      const existing = leads.get(k);
      leads.set(k, existing ? { ...existing, ...norm, id: existing.id, created_at: existing.created_at } : norm);
      return { created: !existing };
    },
    async importLeads(rows, campaign_id, source) {
      let created = 0, updated = 0;
      for (const raw of rows) {
        const m = mapCsvRow(raw);
        if (!m.email && !m.phone && !m.name) continue;
        const r = await this.upsertLead({ ...m, campaign_id, source: source || "csv" });
        if (r.created) created += 1; else updated += 1;
      }
      return { created, updated, total: created + updated };
    },
    async listLeads({ limit = 500 } = {}) { return [...leads.values()].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, limit); },
    async leadStats() {
      const arr = [...leads.values()];
      const by = (f, v) => arr.filter((l) => l[f] === v).length;
      return { total: arr.length, group_joined: arr.filter((l) => l.group_joined).length,
        by_source: { lp: by("source", "lp"), webinar: by("source", "webinar"), bda: by("source", "bda"), csv: by("source", "csv") } };
    },
    async close() {},
  };
}

async function createPostgresStore() {
  let Pool;
  try { const pg = await import("pg"); Pool = (pg.default && pg.default.Pool) || pg.Pool; }
  catch (e) { console.error("[funnel] pg unavailable:", e?.message || e); return createMemoryStore(); }
  if (!Pool) return createMemoryStore();
  const pool = new Pool({ connectionString: databaseUrl, ssl: databaseSsl, max: 3 });
  const store = {
    mode: "postgres",
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS campaigns (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, channel TEXT DEFAULT 'meta', lp TEXT DEFAULT 'webinar',
          whatsapp_group_url TEXT DEFAULT '', distribution TEXT DEFAULT 'webinar', webinar_id TEXT,
          slug TEXT UNIQUE NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS leads (
          id TEXT PRIMARY KEY, name TEXT DEFAULT '', email TEXT, phone TEXT,
          campaign_id TEXT, source TEXT DEFAULT 'lp', stage TEXT DEFAULT 'new',
          group_joined BOOLEAN DEFAULT false, extra JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS leads_email_idx ON leads (email) WHERE email IS NOT NULL AND email <> '';`);
      await pool.query(`CREATE INDEX IF NOT EXISTS leads_campaign_idx ON leads (campaign_id);`);
      // Dynamic LP fields (added after the first release).
      await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS event_at TIMESTAMPTZ;`);
      await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS session_hours INT DEFAULT 2;`);
      await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS room_name TEXT DEFAULT '';`);
      return this;
    },
    async createCampaign(c) {
      const id = uid(); const slug = `${slugify(c.name)}-${id.slice(0, 6)}`;
      const r = await pool.query(
        `INSERT INTO campaigns (id,name,channel,lp,whatsapp_group_url,distribution,webinar_id,slug,event_at,session_hours,room_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [id, c.name || "Untitled", c.channel || "meta", c.lp || "webinar", c.whatsapp_group_url || "", c.distribution || "webinar", c.webinar_id || null, slug,
          c.event_at || null, Number(c.session_hours) || 2, c.room_name || ""]);
      return r.rows[0];
    },
    async updateCampaign(id, patch) {
      const map = { name: "name", whatsapp_group_url: "whatsapp_group_url", event_at: "event_at",
        session_hours: "session_hours", room_name: "room_name", distribution: "distribution", channel: "channel", lp: "lp" };
      const sets = [], vals = []; let i = 1;
      for (const [k, col] of Object.entries(map)) {
        if (patch[k] === undefined) continue;
        sets.push(`${col}=$${i++}`);
        vals.push(k === "session_hours" ? (Number(patch[k]) || 2) : (patch[k] === "" && k === "event_at" ? null : patch[k]));
      }
      if (!sets.length) return (await pool.query(`SELECT * FROM campaigns WHERE id=$1`, [id])).rows[0] || null;
      vals.push(id);
      const r = await pool.query(`UPDATE campaigns SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, vals);
      return r.rows[0] || null;
    },
    async listCampaigns() {
      const r = await pool.query(`
        SELECT c.*, COALESCE(l.n,0)::int AS lead_count FROM campaigns c
        LEFT JOIN (SELECT campaign_id, COUNT(*) n FROM leads GROUP BY campaign_id) l ON l.campaign_id=c.id
        ORDER BY c.created_at DESC`);
      return r.rows;
    },
    async getCampaignBySlug(slug) { return (await pool.query(`SELECT * FROM campaigns WHERE slug=$1`, [slug])).rows[0] || null; },
    async upsertLead(l) {
      const email = (l.email || "").toLowerCase().trim();
      if (email) {
        const r = await pool.query(
          `INSERT INTO leads (id,name,email,phone,campaign_id,source,stage,group_joined,extra)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (email) DO UPDATE SET
             name=COALESCE(NULLIF(EXCLUDED.name,''),leads.name),
             phone=COALESCE(NULLIF(EXCLUDED.phone,''),leads.phone),
             campaign_id=COALESCE(EXCLUDED.campaign_id,leads.campaign_id),
             group_joined=(leads.group_joined OR EXCLUDED.group_joined),
             extra=leads.extra||EXCLUDED.extra, updated_at=now()
           RETURNING (xmax=0) AS created`,
          [uid(), l.name || "", email, l.phone || "", l.campaign_id || null, l.source || "lp", l.stage || "new", Boolean(l.group_joined), JSON.stringify(l.extra || {})]);
        return { created: r.rows[0]?.created };
      }
      await pool.query(
        `INSERT INTO leads (id,name,email,phone,campaign_id,source,stage,group_joined,extra)
         VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8)`,
        [uid(), l.name || "", l.phone || "", l.campaign_id || null, l.source || "lp", l.stage || "new", Boolean(l.group_joined), JSON.stringify(l.extra || {})]);
      return { created: true };
    },
    async importLeads(rows, campaign_id, source) {
      let created = 0, updated = 0;
      for (const raw of rows) {
        const m = mapCsvRow(raw);
        if (!m.email && !m.phone && !m.name) continue;
        const r = await this.upsertLead({ ...m, campaign_id, source: source || "csv" });
        if (r.created) created += 1; else updated += 1;
      }
      return { created, updated, total: created + updated };
    },
    async listLeads({ limit = 500 } = {}) {
      return (await pool.query(`SELECT * FROM leads ORDER BY created_at DESC LIMIT $1`, [limit])).rows;
    },
    async leadStats() {
      const r = await pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE group_joined)::int AS group_joined,
               COUNT(*) FILTER (WHERE source='lp')::int AS lp,
               COUNT(*) FILTER (WHERE source='webinar')::int AS webinar,
               COUNT(*) FILTER (WHERE source='bda')::int AS bda,
               COUNT(*) FILTER (WHERE source='csv')::int AS csv
        FROM leads`);
      const x = r.rows[0];
      return { total: x.total, group_joined: x.group_joined, by_source: { lp: x.lp, webinar: x.webinar, bda: x.bda, csv: x.csv } };
    },
    async close() { await pool.end().catch(() => {}); },
  };
  return store;
}

export async function createFunnelStore() {
  if (!databaseUrl) { console.warn("[funnel] DATABASE_URL not set — campaigns/leads in-memory only (dev)."); return createMemoryStore().init(); }
  try { return await (await createPostgresStore()).init(); }
  catch (e) { console.error("[funnel] Postgres init failed, in-memory:", e?.message || e); return createMemoryStore().init(); }
}
