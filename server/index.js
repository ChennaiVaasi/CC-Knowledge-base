import express from "express";
import pg from "pg";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { Chess } from "chess.js";
import { ACTIONS, STATUSES, canEditPositionFields, snapshotPosition, submissionMissing, transitionFor } from "./workflow.js";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();
app.use(express.json());

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const PgSession = connectPgSimple(session);
app.set("trust proxy", 1);
app.use(
  session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

import crypto from "node:crypto";

function generatePassword() {
  return crypto.randomBytes(9).toString("base64url");
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.session.user;
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

const ADMIN = "Admin";
const ARCHITECT = "Knowledge Architect";
const REVIEWER = "Peer Reviewer";
const BUILDER = "Builder";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  fen TEXT NOT NULL,
  broad_tags JSONB NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT '',
  rating TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'New',
  builder TEXT NOT NULL DEFAULT 'Unassigned',
  priority TEXT NOT NULL DEFAULT 'Normal',
  learning_outcome TEXT NOT NULL DEFAULT '',
  solves TEXT NOT NULL DEFAULT '',
  similarity INTEGER NOT NULL DEFAULT 0,
  concept TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE positions ADD COLUMN IF NOT EXISTS raw_pgn TEXT NOT NULL DEFAULT '';
ALTER TABLE positions ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE positions ADD COLUMN IF NOT EXISTS approved_revision_id BIGINT;
CREATE TABLE IF NOT EXISTS content_revisions (
  id BIGSERIAL PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(position_id, revision)
);
CREATE TABLE IF NOT EXISTS content_reviews (
  id BIGSERIAL PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
  revision_id BIGINT NOT NULL REFERENCES content_revisions(id) ON DELETE RESTRICT,
  stage TEXT NOT NULL CHECK (stage IN ('Architect', 'Peer')),
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Approved', 'Changes Requested')),
  comment TEXT NOT NULL DEFAULT '',
  reviewer_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_review_per_position ON content_reviews(position_id) WHERE status = 'Open';
CREATE TABLE IF NOT EXISTS library_items (
  position_id TEXT PRIMARY KEY REFERENCES positions(id) ON DELETE RESTRICT,
  revision_id BIGINT NOT NULL UNIQUE REFERENCES content_revisions(id) ON DELETE RESTRICT,
  snapshot JSONB NOT NULL,
  approved_by TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL,
  published_by TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  joined TEXT NOT NULL DEFAULT ''
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
CREATE TABLE IF NOT EXISTS taxonomy_domains (
  domain TEXT PRIMARY KEY,
  topics JSONB NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS similarity_results (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS approved_content (
  concept TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
`;


const SEED_USERS = [
  { name: "Vishu KA", email: "vishu@circlechess.com", role: "Knowledge Architect", status: "Active", joined: "May 10, 2024" },
  { name: "Arun Sharma", email: "arun.builder@circlechess.com", role: "Builder", status: "Active", joined: "May 12, 2024" },
  { name: "Meena R", email: "meena.builder@circlechess.com", role: "Builder", status: "Active", joined: "May 14, 2024" },
  { name: "Ravi K", email: "ravi.review@circlechess.com", role: "Peer Reviewer", status: "Active", joined: "May 15, 2024" },
  { name: "Sneha P", email: "sneha.builder@circlechess.com", role: "Builder", status: "Inactive", joined: "May 17, 2024" },
  { name: "Prakash Admin", email: "prakash.admin@circlechess.com", role: "Admin", status: "Active", joined: "May 08, 2024" },
];


function rowToPosition(row) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    fen: row.fen,
    broadTags: row.broad_tags,
    source: row.source,
    rating: row.rating,
    status: row.status,
    builder: row.builder,
    priority: row.priority,
    learningOutcome: row.learning_outcome,
    solves: row.solves,
    similarity: row.similarity,
    concept: row.concept,
    rawPgn: row.raw_pgn,
    revision: row.revision,
    updatedAt: row.updated_at,
  };
}

async function initDb() {
  await pool.query(SCHEMA_SQL);
  const users = await pool.query("SELECT COUNT(*)::int AS n FROM users");
  if (users.rows[0].n === 0) {
    for (const u of SEED_USERS) {
      await pool.query(
        "INSERT INTO users (email, name, role, status, joined) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING",
        [u.email, u.name, u.role, u.status, u.joined],
      );
    }
  }
  // Any user without a password gets a unique random one, printed once to the
  // server log so the workspace owner can distribute credentials securely.
  const missing = await pool.query("SELECT email FROM users WHERE password_hash IS NULL");
  if (missing.rows.length > 0) {
    console.log("=== Initial credentials (shown once — ask users to change their password after first login) ===");
    for (const row of missing.rows) {
      const password = generatePassword();
      const hash = await bcrypt.hash(password, 10);
      await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [hash, row.email]);
      console.log(`  ${row.email}  ->  ${password}`);
    }
    console.log("=== End of initial credentials ===");
  }
}

// --- Auth ---
function publicUser(row) {
  return { email: row.email, name: row.name, role: row.role, status: row.status, joined: row.joined };
}

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: "email and password are required" });
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = rows[0];
    const ok = user?.password_hash ? await bcrypt.compare(password, user.password_hash) : false;
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });
    if (user.status !== "Active") return res.status(403).json({ error: "Account is inactive" });
    req.session.user = publicUser(user);
    res.json(req.session.user);
  } catch (err) { next(err); }
});

app.post("/api/auth/change-password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: "currentPassword and newPassword (min 8 chars) are required" });
    }
    const { rows } = await pool.query("SELECT password_hash FROM users WHERE email = $1", [req.session.user.email]);
    const ok = rows[0]?.password_hash ? await bcrypt.compare(currentPassword, rows[0].password_hash) : false;
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [hash, req.session.user.email]);
    res.status(204).end();
  } catch (err) { next(err); }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.status(204).end());
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not authenticated" });
  res.json(req.session.user);
});

// All routes below require an authenticated session, an active account,
// and use the current database role (not the cached session role) for authorization.
app.use("/api", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT role, status FROM users WHERE email = $1", [req.session.user.email]);
    if (!rows[0] || rows[0].status !== "Active") {
      req.session.destroy(() => {});
      return res.status(403).json({ error: "Account is inactive" });
    }
    // Keep session role in sync so downstream requireRole checks use current value.
    req.session.user = { ...req.session.user, role: rows[0].role };
    next();
  } catch (err) { next(err); }
});

// --- Positions ---
app.get("/api/positions", async (_req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM positions ORDER BY created_at, id");
    res.json(rows.map(rowToPosition));
  } catch (err) { next(err); }
});

const VALID_STATUSES = Object.values(STATUSES);
const VALID_PRIORITIES = ["Low", "Normal", "High"];

app.post("/api/positions", requireRole(ADMIN, ARCHITECT), async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.title || (!String(b.fen ?? "").trim() && !String(b.rawPgn ?? "").trim())) {
      return res.status(400).json({ error: "title and fen are required" });
    }
    let fen = String(b.fen ?? "").trim();
    const rawPgn = String(b.rawPgn ?? "");
    try {
      if (rawPgn) {
        const chess = new Chess();
        chess.loadPgn(rawPgn);
        if (!fen) fen = chess.fen();
        else if (new Chess(fen).fen() !== chess.fen()) {
          return res.status(400).json({ code: "CONTENT_SAVE_FAILED", error: "FEN does not match the final PGN position" });
        }
      }
      new Chess(fen);
    } catch {
      return res.status(400).json({ code: "UPLOAD_PARSE_FAILED", error: "The PGN or full FEN is invalid" });
    }
    const id = b.id || `AS-${Math.floor(1000 + Math.random() * 9000)}`;
    const status = VALID_STATUSES.includes(b.status) ? b.status : "New";
    const priority = VALID_PRIORITIES.includes(b.priority) ? b.priority : "Normal";
    const { rows } = await pool.query(
      `INSERT INTO positions (id, title, subtitle, fen, broad_tags, source, rating, status, builder, priority, learning_outcome, solves, similarity, concept, raw_pgn)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        id, b.title, b.subtitle ?? "", fen,
        JSON.stringify(Array.isArray(b.broadTags) ? b.broadTags : []),
        b.source ?? "Manual import", b.rating ?? "600 - 800", status,
        b.builder ?? "Unassigned", priority,
        b.learningOutcome ?? "", b.solves ?? "",
        Number.isFinite(b.similarity) ? b.similarity : 0, b.concept ?? "", rawPgn,
      ],
    );
    res.status(201).json(rowToPosition(rows[0]));
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Position id already exists" });
    next(err);
  }
});

app.patch("/api/positions/:id", async (req, res, next) => {
  try {
    const user = req.session.user;
    const body = req.body ?? {};
    const existing = await pool.query("SELECT builder, status FROM positions WHERE id = $1", [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "position not found" });
    const keys = Object.keys(body);
    if (!canEditPositionFields(user.role, existing.rows[0].status, keys)) {
      return res.status(403).json({ code: "PERMISSION_DENIED", error: "You cannot edit these fields at this review stage" });
    }
    if (user.role === BUILDER) {
      const firstName = user.name.split(" ")[0];
      if (existing.rows[0].builder !== firstName && existing.rows[0].builder !== user.name) {
        return res.status(403).json({ error: "You can only edit positions assigned to you" });
      }
    }
    const allowed = {
      title: "title", subtitle: "subtitle", fen: "fen", source: "source",
      rating: "rating", builder: "builder", priority: "priority", rawPgn: "raw_pgn",
      learningOutcome: "learning_outcome", solves: "solves", concept: "concept",
    };
    const sets = [];
    const values = [];
    if (req.body?.title !== undefined && !String(req.body.title).trim()) {
      return res.status(400).json({ error: "title is required" });
    }
    for (const [key, col] of Object.entries(allowed)) {
      if (req.body?.[key] !== undefined) {
        if (key === "priority" && !VALID_PRIORITIES.includes(req.body[key])) {
          return res.status(400).json({ error: "invalid priority" });
        }
        values.push(req.body[key]);
        sets.push(`${col} = $${values.length}`);
      }
    }
    if (req.body?.broadTags !== undefined) {
      if (!Array.isArray(req.body.broadTags)) return res.status(400).json({ error: "broadTags must be an array" });
      values.push(JSON.stringify(req.body.broadTags));
      sets.push(`broad_tags = $${values.length}`);
    }
    if (sets.length === 0) return res.status(400).json({ error: "no valid fields to update" });
    values.push(req.params.id);
    let where = `id = $${values.length}`;
    if (body.expectedRevision !== undefined) {
      values.push(body.expectedRevision);
      where += ` AND revision = $${values.length}`;
    }
    const { rows } = await pool.query(
      `UPDATE positions SET ${sets.join(", ")}, revision = revision + 1, updated_at = now() WHERE ${where} RETURNING *`, values,
    );
    if (rows.length === 0 && body.expectedRevision !== undefined) {
      const exists = await pool.query("SELECT 1 FROM positions WHERE id = $1", [req.params.id]);
      if (exists.rowCount) return res.status(409).json({ code: "STALE_REVISION", error: "This content was changed in another tab. Refresh before saving." });
    }
    if (rows.length === 0) return res.status(404).json({ error: "position not found" });
    res.json(rowToPosition(rows[0]));
  } catch (err) { next(err); }
});

app.post("/api/positions/:id/actions", async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const action = req.body?.action;
    const current = await client.query("SELECT * FROM positions WHERE id = $1 FOR UPDATE", [req.params.id]);
    if (!current.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "position not found" }); }
    const row = current.rows[0];
    if (req.body?.expectedRevision !== undefined && Number(req.body.expectedRevision) !== row.revision) {
      await client.query("ROLLBACK");
      return res.status(409).json({ code: "STALE_REVISION", error: "This content changed after you opened it. Refresh and retry." });
    }
    const rule = transitionFor(row.status, action, req.session.user.role);
    if (!rule.ok) { await client.query("ROLLBACK"); return res.status(rule.code === "PERMISSION_DENIED" ? 403 : 409).json(rule); }

    if ([ACTIONS.SAVE, ACTIONS.SUBMIT].includes(action)) {
      const assigned = row.builder === req.session.user.name || row.builder === req.session.user.name.split(" ")[0];
      if (!assigned) { await client.query("ROLLBACK"); return res.status(403).json({ code: "PERMISSION_DENIED", error: "This position is assigned to another builder" }); }
    }
    if (action === ACTIONS.ASSIGN) {
      const builder = String(req.body.builder ?? "").trim();
      const active = await client.query("SELECT name FROM users WHERE name = $1 AND role = $2 AND status = 'Active'", [builder, BUILDER]);
      if (!active.rowCount) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Select an active builder" }); }
      row.builder = builder;
    } else if (action === ACTIONS.UNASSIGN) {
      row.builder = "Unassigned";
    }
    if (action === ACTIONS.SUBMIT) {
      const missing = submissionMissing(row);
      if (missing.length) { await client.query("ROLLBACK"); return res.status(400).json({ code: "SUBMISSION_VALIDATION_FAILED", error: `Cannot submit for review. Missing: ${missing.join(", ")}`, missing }); }
    }

    let revisionId;
    if (action === ACTIONS.SUBMIT) {
      const revision = await client.query(
        `INSERT INTO content_revisions(position_id, revision, snapshot, created_by) VALUES ($1,$2,$3,$4)
         ON CONFLICT(position_id, revision) DO UPDATE SET snapshot = EXCLUDED.snapshot RETURNING id`,
        [row.id, row.revision, snapshotPosition(row), req.session.user.email],
      );
      revisionId = revision.rows[0].id;
      await client.query("UPDATE content_reviews SET status = 'Changes Requested', decided_at = now() WHERE position_id = $1 AND status = 'Open'", [row.id]);
      await client.query("INSERT INTO content_reviews(position_id, revision_id, stage) VALUES ($1,$2,'Architect')", [row.id, revisionId]);
    } else if ([ACTIONS.REQUEST_CHANGES, ACTIONS.ARCHITECT_APPROVE, ACTIONS.PEER_APPROVE].includes(action)) {
      const open = await client.query("SELECT * FROM content_reviews WHERE position_id = $1 AND status = 'Open' FOR UPDATE", [row.id]);
      if (!open.rowCount) { await client.query("ROLLBACK"); return res.status(409).json({ code: "INVALID_WORKFLOW_STATE", error: "No open review exists" }); }
      const expectedStage = row.status === STATUSES.PEER_REVIEW ? "Peer" : "Architect";
      if (open.rows[0].stage !== expectedStage) { await client.query("ROLLBACK"); return res.status(409).json({ code: "INVALID_WORKFLOW_STATE", error: "Review stage does not match content state" }); }
      if (action === ACTIONS.REQUEST_CHANGES && !String(req.body.comment ?? "").trim()) {
        await client.query("ROLLBACK"); return res.status(400).json({ error: "A change-request comment is required" });
      }
      revisionId = open.rows[0].revision_id;
      const decision = action === ACTIONS.REQUEST_CHANGES ? "Changes Requested" : "Approved";
      await client.query("UPDATE content_reviews SET status=$1, comment=$2, reviewer_email=$3, decided_at=now() WHERE id=$4", [decision, String(req.body.comment ?? ""), req.session.user.email, open.rows[0].id]);
      if (action === ACTIONS.ARCHITECT_APPROVE) {
        await client.query("INSERT INTO content_reviews(position_id, revision_id, stage) VALUES ($1,$2,'Peer')", [row.id, revisionId]);
      }
    }

    if (action === ACTIONS.PUBLISH) {
      if (!row.approved_revision_id) { await client.query("ROLLBACK"); return res.status(409).json({ code: "LIBRARY_PUBLISH_FAILED", error: "No approved revision is recorded" }); }
      const approved = await client.query("SELECT snapshot FROM content_revisions WHERE id=$1 AND position_id=$2", [row.approved_revision_id, row.id]);
      if (!approved.rowCount) { await client.query("ROLLBACK"); return res.status(409).json({ code: "LIBRARY_PUBLISH_FAILED", error: "Approved revision is missing" }); }
      await client.query(
        `INSERT INTO library_items(position_id,revision_id,snapshot,approved_by,approved_at,published_by)
         VALUES($1,$2,$3,$4,now(),$5)
         ON CONFLICT(position_id) DO UPDATE SET published_at=library_items.published_at
         WHERE library_items.revision_id=EXCLUDED.revision_id`,
        [row.id, row.approved_revision_id, approved.rows[0].snapshot, req.session.user.email, req.session.user.email],
      );
    }
    const updated = await client.query(
      `UPDATE positions SET status=$1, builder=$2, approved_revision_id=CASE WHEN $3::text='peer_approve' THEN $4 ELSE approved_revision_id END, updated_at=now()
       WHERE id=$5 RETURNING *`, [rule.nextStatus, row.builder, action, revisionId ?? null, row.id],
    );
    await client.query("COMMIT");
    console.info("content workflow", { contentId: row.id, revisionId, action, userId: req.session.user.email });
    res.json(rowToPosition(updated.rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

app.delete("/api/positions/:id", requireRole(ADMIN, ARCHITECT), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM positions WHERE id = $1", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "position not found" });
    res.status(204).end();
  } catch (err) { next(err); }
});

// --- Users ---
app.get("/api/users", requireRole(ADMIN, ARCHITECT, REVIEWER), async (_req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT email, name, role, status, joined FROM users ORDER BY joined, email");
    res.json(rows);
  } catch (err) { next(err); }
});

// Builders need the assignable-builder list without seeing full user records.
app.get("/api/builders", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT name FROM users WHERE role = 'Builder' AND status = 'Active' ORDER BY name",
    );
    res.json(rows.map((r) => r.name));
  } catch (err) { next(err); }
});

app.post("/api/users", requireRole(ADMIN), async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.name || !b.email || !b.role || !b.password) {
      return res.status(400).json({ error: "name, email, role and password are required" });
    }
    const joined = b.joined || new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    const hash = await bcrypt.hash(b.password, 10);
    const { rows } = await pool.query(
      "INSERT INTO users (email, name, role, status, joined, password_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING email, name, role, status, joined",
      [b.email, b.name, b.role, b.status === "Inactive" ? "Inactive" : "Active", joined, hash],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "User already exists" });
    next(err);
  }
});

app.patch("/api/users/:email", requireRole(ADMIN), async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const VALID_ROLES = ["Admin", "Knowledge Architect", "Builder", "Peer Reviewer"];
    const sets = [];
    const values = [];
    if (b.status !== undefined) {
      if (!["Active", "Inactive"].includes(b.status)) {
        return res.status(400).json({ error: "status must be Active or Inactive" });
      }
      values.push(b.status);
      sets.push(`status = $${values.length}`);
    }
    if (b.role !== undefined) {
      if (!VALID_ROLES.includes(b.role)) {
        return res.status(400).json({ error: "invalid role" });
      }
      values.push(b.role);
      sets.push(`role = $${values.length}`);
    }
    if (sets.length === 0) return res.status(400).json({ error: "no valid fields to update" });
    values.push(req.params.email);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(", ")} WHERE email = $${values.length} RETURNING email, name, role, status, joined`,
      values,
    );
    if (rows.length === 0) return res.status(404).json({ error: "user not found" });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// --- Taxonomy ---
app.get("/api/taxonomy", async (_req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM taxonomy_domains ORDER BY domain");
    res.json(rows.map((r) => ({ domain: r.domain, topics: r.topics })));
  } catch (err) { next(err); }
});

// Add a new domain
app.post("/api/taxonomy/domains", requireRole(ADMIN, ARCHITECT), async (req, res, next) => {
  try {
    const { domain } = req.body ?? {};
    if (!domain || !String(domain).trim()) return res.status(400).json({ error: "domain is required" });
    const { rows } = await pool.query(
      "INSERT INTO taxonomy_domains (domain, topics) VALUES ($1, $2) RETURNING domain, topics",
      [String(domain).trim(), JSON.stringify([])],
    );
    res.status(201).json({ domain: rows[0].domain, topics: rows[0].topics });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Domain already exists" });
    next(err);
  }
});

// Add a topic to an existing domain
app.post("/api/taxonomy/domains/:domain/topics", requireRole(ADMIN, ARCHITECT), async (req, res, next) => {
  try {
    const { topic } = req.body ?? {};
    if (!topic || !String(topic).trim()) return res.status(400).json({ error: "topic is required" });
    const { rows } = await pool.query("SELECT topics FROM taxonomy_domains WHERE domain = $1", [req.params.domain]);
    if (rows.length === 0) return res.status(404).json({ error: "Domain not found" });
    const topics = rows[0].topics;
    if (topics.some((t) => t.name === String(topic).trim())) {
      return res.status(409).json({ error: "Topic already exists in this domain" });
    }
    topics.push({ name: String(topic).trim(), concepts: [] });
    const updated = await pool.query(
      "UPDATE taxonomy_domains SET topics = $1 WHERE domain = $2 RETURNING domain, topics",
      [JSON.stringify(topics), req.params.domain],
    );
    res.status(201).json({ domain: updated.rows[0].domain, topics: updated.rows[0].topics });
  } catch (err) { next(err); }
});

// Add a concept to an existing domain+topic
app.post("/api/taxonomy/domains/:domain/topics/:topic/concepts", requireRole(ADMIN, ARCHITECT), async (req, res, next) => {
  try {
    const { concept } = req.body ?? {};
    if (!concept || !String(concept).trim()) return res.status(400).json({ error: "concept is required" });
    const { rows } = await pool.query("SELECT topics FROM taxonomy_domains WHERE domain = $1", [req.params.domain]);
    if (rows.length === 0) return res.status(404).json({ error: "Domain not found" });
    const topics = rows[0].topics;
    const topicObj = topics.find((t) => t.name === req.params.topic);
    if (!topicObj) return res.status(404).json({ error: "Topic not found" });
    if (topicObj.concepts.includes(String(concept).trim())) {
      return res.status(409).json({ error: "Concept already exists in this topic" });
    }
    topicObj.concepts.push(String(concept).trim());
    const updated = await pool.query(
      "UPDATE taxonomy_domains SET topics = $1 WHERE domain = $2 RETURNING domain, topics",
      [JSON.stringify(topics), req.params.domain],
    );
    res.status(201).json({ domain: updated.rows[0].domain, topics: updated.rows[0].topics });
  } catch (err) { next(err); }
});

// --- Similarity results ---
app.get("/api/similarity", async (_req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT data FROM similarity_results ORDER BY id");
    res.json(rows.map((r) => r.data));
  } catch (err) { next(err); }
});

// --- Approved content ---
app.get("/api/approved", async (_req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT snapshot, published_at FROM library_items ORDER BY published_at DESC");
    res.json(rows.map((r) => ({ ...r.snapshot, updated: r.published_at, domain: r.snapshot.broadTags?.[0] ?? "", topic: r.snapshot.broadTags?.[1] ?? "", types: r.snapshot.broadTags ?? [], positions: 1, coverage: r.snapshot.rating ?? "" })));
  } catch (err) { next(err); }
});

// Serve built frontend in production
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || process.env.API_PORT || 3001;
initDb()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => console.log(`API server listening on ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
