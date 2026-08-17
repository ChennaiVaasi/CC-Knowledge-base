import express from "express";
import pg from "pg";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";

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

const SEED_POSITIONS = [
  {
    id: "SR-3821",
    title: "Carlsen vs Anand",
    subtitle: "Wijk aan Zee 2013, Move 24",
    fen: "2r2rk1/pp3ppp/2p5/3p4/3P4/2P2N2/PP3PPP/2R2RK1 w - - 0 24",
    broadTags: ["Tactics", "Defender Manipulation"],
    source: "CC games.pgn",
    rating: "600 - 800",
    status: "Submitted",
    builder: "Arun",
    priority: "Normal",
    learningOutcome:
      "Recognize when a defender of an attacked piece can be removed or distracted.",
    solves:
      "Students often stop calculating when a defended piece appears safe and miss ways to eliminate the defender.",
    similarity: 92,
    concept: "Removing the Defender",
  },
  {
    id: "AS-2318",
    title: "Kasparov vs Karpov",
    subtitle: "Moscow 1986, Move 17",
    fen: "r2q1rk1/pp2bppp/2n1pn2/2bp4/3P4/2NBPN2/PPQ2PPP/R1B2RK1 w - - 0 10",
    broadTags: ["Strategy", "Pawn Structure"],
    source: "CC strategic batch",
    rating: "800 - 1000",
    status: "New",
    builder: "Unassigned",
    priority: "High",
    learningOutcome: "Detect when structure dictates the right piece regrouping plan.",
    solves: "Players know motifs but fail to convert them into strategic plans.",
    similarity: 44,
    concept: "Pawn Lever Timing",
  },
  {
    id: "AS-2404",
    title: "Capablanca rook ending",
    subtitle: "Generated endgame cluster",
    fen: "8/5pk1/6p1/8/3R2P1/5P2/5K2/8 w - - 0 1",
    broadTags: ["Endgames", "Rook Endings"],
    source: "CC endgame generator",
    rating: "1000 - 1200",
    status: "Assigned",
    builder: "Meena",
    priority: "Normal",
    learningOutcome: "Spot when king activity outweighs pawn count in rook endings.",
    solves: "Learners overvalue material and underplay king activation.",
    similarity: 37,
    concept: "Active King in Rook Endings",
  },
  {
    id: "AS-2497",
    title: "Nakamura vs Radjabov",
    subtitle: "Candidate move extraction",
    fen: "r4rk1/pp3ppp/2p2n2/3p4/3P1B2/2N2N2/PP3PPP/2R2RK1 w - - 0 19",
    broadTags: ["Calculation", "Pins"],
    source: "CC games.pgn",
    rating: "600 - 800",
    status: "In Progress",
    builder: "Vishu",
    priority: "High",
    learningOutcome: "Generate forcing candidate moves before settling on a quiet move.",
    solves: "Students choose the first playable move instead of comparing forcing options.",
    similarity: 58,
    concept: "Forcing Candidate Moves",
  },
];

const SEED_USERS = [
  { name: "Vishu KA", email: "vishu@circlechess.com", role: "Knowledge Architect", status: "Active", joined: "May 10, 2024" },
  { name: "Arun Sharma", email: "arun.builder@circlechess.com", role: "Builder", status: "Active", joined: "May 12, 2024" },
  { name: "Meena R", email: "meena.builder@circlechess.com", role: "Builder", status: "Active", joined: "May 14, 2024" },
  { name: "Ravi K", email: "ravi.review@circlechess.com", role: "Peer Reviewer", status: "Active", joined: "May 15, 2024" },
  { name: "Sneha P", email: "sneha.builder@circlechess.com", role: "Builder", status: "Inactive", joined: "May 17, 2024" },
  { name: "Prakash Admin", email: "prakash.admin@circlechess.com", role: "Admin", status: "Active", joined: "May 08, 2024" },
];

const SEED_TAXONOMY = [
  {
    domain: "Tactics",
    topics: [
      { name: "Defender Manipulation", concepts: ["Removing the Defender", "Deflection", "Overloaded Defender"] },
      { name: "Pins", concepts: ["Absolute Pin", "Relative Pin", "Pin Breaks"] },
    ],
  },
  {
    domain: "Calculation",
    topics: [{ name: "Candidate Moves", concepts: ["Forcing Candidate Moves", "Checks First Scan"] }],
  },
  {
    domain: "Endgames",
    topics: [{ name: "Rook Endings", concepts: ["Active King in Rook Endings", "Cutoff King", "Lucena Entry"] }],
  },
];

const SEED_SIMILARITY = [
  {
    id: "KN-144",
    title: "Removing the Defender",
    domain: "Tactics",
    topic: "Defender Manipulation",
    rating: "600 - 800",
    positionMatch: 94,
    conceptMatch: "Exact",
    learningOutcomeMatch: 86,
    studentProblemMatch: 91,
    solutionSimilarity: 73,
    label: "94% Position Match",
    fen: "2r2rk1/pp3ppp/2p5/3p4/3P4/2P2N2/PP3PPP/2R2RK1 w - - 0 24",
  },
  {
    id: "KN-211",
    title: "Removing the Defender",
    domain: "Tactics",
    topic: "Defender Manipulation",
    rating: "800 - 1000",
    positionMatch: 72,
    conceptMatch: "Same Concept",
    learningOutcomeMatch: 78,
    studentProblemMatch: 82,
    solutionSimilarity: 69,
    label: "72% Position Match",
    fen: "3r2k1/pp3ppp/2p5/3p4/3P4/2P2N2/PP3PPP/2R2RK1 w - - 0 24",
  },
  {
    id: "KN-319",
    title: "Same Student Problem",
    domain: "Tactics",
    topic: "Defender Manipulation",
    rating: "400 - 600",
    positionMatch: 48,
    conceptMatch: "Related",
    learningOutcomeMatch: 65,
    studentProblemMatch: 88,
    solutionSimilarity: 42,
    label: "Same Student Problem",
    fen: "6k1/1p3ppp/p1p5/3p4/3P4/2P2N2/PP3PPP/2R2RK1 w - - 0 24",
  },
];

const SEED_APPROVED = [
  {
    concept: "Removing the Defender",
    domain: "Tactics",
    topic: "Defender Manipulation",
    types: ["Recognition", "Normal Action", "Common Mistake"],
    positions: 18,
    updated: "Aug 16, 2026",
    coverage: "Strong in 600 - 1000, weak in 1000 - 1200",
  },
  {
    concept: "Loose Piece Punishment",
    domain: "Tactics",
    topic: "Targets",
    types: ["Recognition", "Importance"],
    positions: 14,
    updated: "Aug 15, 2026",
    coverage: "Strong in 400 - 800",
  },
  {
    concept: "Active King in Rook Endings",
    domain: "Endgames",
    topic: "Rook Endings",
    types: ["Definition", "Normal Action"],
    positions: 9,
    updated: "Aug 14, 2026",
    coverage: "Missing under 600",
  },
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
  };
}

async function initDb() {
  await pool.query(SCHEMA_SQL);
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM positions");
  if (rows[0].n === 0) {
    for (const p of SEED_POSITIONS) {
      await pool.query(
        `INSERT INTO positions (id, title, subtitle, fen, broad_tags, source, rating, status, builder, priority, learning_outcome, solves, similarity, concept)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO NOTHING`,
        [p.id, p.title, p.subtitle, p.fen, JSON.stringify(p.broadTags), p.source, p.rating, p.status, p.builder, p.priority, p.learningOutcome, p.solves, p.similarity, p.concept],
      );
    }
  }
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
  const tax = await pool.query("SELECT COUNT(*)::int AS n FROM taxonomy_domains");
  if (tax.rows[0].n === 0) {
    for (const t of SEED_TAXONOMY) {
      await pool.query(
        "INSERT INTO taxonomy_domains (domain, topics) VALUES ($1,$2) ON CONFLICT (domain) DO NOTHING",
        [t.domain, JSON.stringify(t.topics)],
      );
    }
  }
  const sim = await pool.query("SELECT COUNT(*)::int AS n FROM similarity_results");
  if (sim.rows[0].n === 0) {
    for (const s of SEED_SIMILARITY) {
      await pool.query(
        "INSERT INTO similarity_results (id, data) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING",
        [s.id, JSON.stringify(s)],
      );
    }
  }
  const appr = await pool.query("SELECT COUNT(*)::int AS n FROM approved_content");
  if (appr.rows[0].n === 0) {
    for (const a of SEED_APPROVED) {
      await pool.query(
        "INSERT INTO approved_content (concept, data) VALUES ($1,$2) ON CONFLICT (concept) DO NOTHING",
        [a.concept, JSON.stringify(a)],
      );
    }
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

// All routes below require an authenticated session.
app.use("/api", requireAuth);

// --- Positions ---
app.get("/api/positions", async (_req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM positions ORDER BY created_at, id");
    res.json(rows.map(rowToPosition));
  } catch (err) { next(err); }
});

const VALID_STATUSES = ["New", "Assigned", "In Progress", "Submitted", "Changes Requested", "Approved"];
const VALID_PRIORITIES = ["Low", "Normal", "High"];

app.post("/api/positions", requireRole(ADMIN, ARCHITECT), async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.title || !b.fen) {
      return res.status(400).json({ error: "title and fen are required" });
    }
    const id = b.id || `AS-${Math.floor(1000 + Math.random() * 9000)}`;
    const status = VALID_STATUSES.includes(b.status) ? b.status : "New";
    const priority = VALID_PRIORITIES.includes(b.priority) ? b.priority : "Normal";
    const { rows } = await pool.query(
      `INSERT INTO positions (id, title, subtitle, fen, broad_tags, source, rating, status, builder, priority, learning_outcome, solves, similarity, concept)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        id, b.title, b.subtitle ?? "", b.fen,
        JSON.stringify(Array.isArray(b.broadTags) ? b.broadTags : []),
        b.source ?? "Manual import", b.rating ?? "600 - 800", status,
        b.builder ?? "Unassigned", priority,
        b.learningOutcome ?? "", b.solves ?? "",
        Number.isFinite(b.similarity) ? b.similarity : 0, b.concept ?? "",
      ],
    );
    res.status(201).json(rowToPosition(rows[0]));
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Position id already exists" });
    next(err);
  }
});

const BUILDER_FIELDS = new Set(["learningOutcome", "solves", "concept", "status"]);
const BUILDER_STATUSES = new Set(["In Progress", "Submitted"]);
const REVIEW_STATUSES = new Set(["New", "Approved", "Changes Requested"]);

app.patch("/api/positions/:id", async (req, res, next) => {
  try {
    const user = req.session.user;
    const body = req.body ?? {};
    if (user.role === BUILDER) {
      // Builders may only edit instructional content and move their own
      // assigned positions into In Progress / Submitted.
      const keys = Object.keys(body);
      if (keys.some((key) => !BUILDER_FIELDS.has(key))) {
        return res.status(403).json({ error: "Builders can only edit instructional fields and progress status" });
      }
      if (body.status !== undefined && !BUILDER_STATUSES.has(body.status)) {
        return res.status(403).json({ error: "Builders can only set status to In Progress or Submitted" });
      }
      const existing = await pool.query("SELECT builder FROM positions WHERE id = $1", [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: "position not found" });
      const firstName = user.name.split(" ")[0];
      if (existing.rows[0].builder !== firstName && existing.rows[0].builder !== user.name) {
        return res.status(403).json({ error: "You can only edit positions assigned to you" });
      }
    } else if (user.role === REVIEWER) {
      // Reviewers may only change review status and leave review outcomes.
      const keys = Object.keys(body);
      if (keys.some((key) => !["status", "builder"].includes(key))) {
        return res.status(403).json({ error: "Reviewers can only update review status" });
      }
      if (body.status !== undefined && !REVIEW_STATUSES.has(body.status)) {
        return res.status(403).json({ error: "Reviewers can only approve, reject, or request changes" });
      }
    } else if (user.role !== ADMIN && user.role !== ARCHITECT) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    const allowed = {
      title: "title", subtitle: "subtitle", fen: "fen", source: "source",
      rating: "rating", status: "status", builder: "builder", priority: "priority",
      learningOutcome: "learning_outcome", solves: "solves", concept: "concept",
    };
    const sets = [];
    const values = [];
    for (const [key, col] of Object.entries(allowed)) {
      if (req.body?.[key] !== undefined) {
        if (key === "status" && !VALID_STATUSES.includes(req.body[key])) {
          return res.status(400).json({ error: "invalid status" });
        }
        if (key === "priority" && !VALID_PRIORITIES.includes(req.body[key])) {
          return res.status(400).json({ error: "invalid priority" });
        }
        values.push(req.body[key]);
        sets.push(`${col} = $${values.length}`);
      }
    }
    if (req.body?.broadTags !== undefined) {
      values.push(JSON.stringify(req.body.broadTags));
      sets.push(`broad_tags = $${values.length}`);
    }
    if (sets.length === 0) return res.status(400).json({ error: "no valid fields to update" });
    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE positions SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (rows.length === 0) return res.status(404).json({ error: "position not found" });
    res.json(rowToPosition(rows[0]));
  } catch (err) { next(err); }
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

// --- Taxonomy ---
app.get("/api/taxonomy", async (_req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM taxonomy_domains ORDER BY domain");
    res.json(rows.map((r) => ({ domain: r.domain, topics: r.topics })));
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
    const { rows } = await pool.query("SELECT data FROM approved_content ORDER BY concept");
    res.json(rows.map((r) => r.data));
  } catch (err) { next(err); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.API_PORT || 3001;
initDb()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => console.log(`API server listening on ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
