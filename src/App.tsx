import { useEffect, useMemo, useState } from "react";
import {
  api,
  type ApprovedCard,
  type PoolRow,
  type PositionStatus,
  type SimilarityCard,
  type TaxonomyNode,
  type UserRow,
} from "./lib/api";

type PageId =
  | "dashboard"
  | "import"
  | "pool"
  | "assignments"
  | "builder"
  | "similarity"
  | "review"
  | "approved"
  | "taxonomy"
  | "admin";

type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

type NavItem = {
  id: PageId;
  label: string;
  section: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", section: "Architect" },
  { id: "import", label: "Import / Generate", section: "Architect" },
  { id: "pool", label: "Position Pool", section: "Architect" },
  { id: "assignments", label: "Assignments", section: "Builder" },
  { id: "builder", label: "Builder Workspace", section: "Builder" },
  { id: "similarity", label: "Similarity Intelligence", section: "Builder" },
  { id: "review", label: "Review Queue", section: "Review" },
  { id: "approved", label: "Approved Content", section: "Knowledge Base" },
  { id: "taxonomy", label: "Taxonomy", section: "Knowledge Base" },
  { id: "admin", label: "User Management", section: "Admin" },
];

const STATUS_META: Record<PositionStatus, { tone: StatusTone; label: string }> = {
  New: { tone: "neutral", label: "New" },
  Assigned: { tone: "info", label: "Assigned" },
  "In Progress": { tone: "info", label: "In Progress" },
  Submitted: { tone: "warning", label: "Submitted" },
  "Changes Requested": { tone: "danger", label: "Changes Requested" },
  Approved: { tone: "success", label: "Approved" },
};

const PIECE_IMAGES: Record<string, string> = {
  K: "/pieces/White-King.svg",
  Q: "/pieces/White-Queen.svg",
  R: "/pieces/White-Rook.svg",
  B: "/pieces/White-Bishop.svg",
  N: "/pieces/White-Knight.svg",
  P: "/pieces/White-Pawn.svg",
  k: "/pieces/Black-King.svg",
  q: "/pieces/Black-Queen.svg",
  r: "/pieces/Black-Rook.svg",
  b: "/pieces/Black-Bishop.svg",
  n: "/pieces/Black-Knight.svg",
  p: "/pieces/Black-Pawn.svg",
};






const DASHBOARD_METRICS: { label: string; value: string; delta: string }[] = [];

function statusPill(status: PositionStatus) {
  const meta = STATUS_META[status];
  return <span className={`pill ${meta.tone}`}>{meta.label}</span>;
}

function parseFen(fen: string) {
  const board = fen.split(" ")[0] ?? "";
  const ranks = board.split("/");
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  return ranks.flatMap((rank, rankIndex) => {
    const cells: { square: string; piece: string | null; dark: boolean }[] = [];
    let fileIndex = 0;
    rank.split("").forEach((char) => {
      const blanks = Number(char);
      if (Number.isNaN(blanks)) {
        const square = `${files[fileIndex]}${8 - rankIndex}`;
        cells.push({ square, piece: char, dark: (fileIndex + rankIndex) % 2 === 1 });
        fileIndex += 1;
        return;
      }
      for (let offset = 0; offset < blanks; offset += 1) {
        const currentFile = fileIndex + offset;
        const square = `${files[currentFile]}${8 - rankIndex}`;
        cells.push({ square, piece: null, dark: (currentFile + rankIndex) % 2 === 1 });
      }
      fileIndex += blanks;
    });
    return cells;
  });
}

function ChessBoard({
  fen,
  size = "large",
}: {
  fen: string;
  size?: "large" | "small";
}) {
  const squares = parseFen(fen);
  return (
    <div className={`chessboard ${size}`}>
      {squares.map((square) => (
        <div key={square.square} className={`board-cell ${square.dark ? "dark" : "light"}`}>
          {square.piece ? (
            <img
              className="piece-image"
              src={PIECE_IMAGES[square.piece]}
              alt={square.piece}
            />
          ) : null}
          <span className="board-coordinate">{square.square}</span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{delta}</small>
    </article>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: UserRow) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await api.login(email.trim(), password);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell login-shell">
      <form className="panel login-panel" onSubmit={submit}>
        <div className="brand-mark">CK</div>
        <h1>CC Knowledge Base</h1>
        <p>Sign in to the instructional knowledge pipeline.</p>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@circlechess.com"
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className="login-error">{error}</p> : null}
        <button type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign In"}</button>
      </form>
    </div>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState<UserRow | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activePage, setActivePage] = useState<PageId>("import");
  const [selectedRowId, setSelectedRowId] = useState<string>("");
  const [selectedAssignmentTab, setSelectedAssignmentTab] = useState("All");

  const [poolRows, setPoolRows] = useState<PoolRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyNode[]>([]);
  const [similarityResults, setSimilarityResults] = useState<SimilarityCard[]>([]);
  const [approvedContent, setApprovedContent] = useState<ApprovedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [importTitle, setImportTitle] = useState("");
  const [importFen, setImportFen] = useState("");
  const [importDomain, setImportDomain] = useState("Tactics");
  const [importRating, setImportRating] = useState("600 - 800");
  const [importSource, setImportSource] = useState("Game");
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const [builderNames, setBuilderNames] = useState<string[]>([]);

  // Builder Workspace controlled fields
  const [builderLearningOutcome, setBuilderLearningOutcome] = useState("");
  const [builderSolves, setBuilderSolves] = useState("");
  const [builderConcept, setBuilderConcept] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((user) => {
        if (!cancelled) setCurrentUser(user);
      })
      .catch(() => {
        // Not logged in.
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canManageUsers =
    currentUser?.role === "Admin" ||
    currentUser?.role === "Knowledge Architect" ||
    currentUser?.role === "Peer Reviewer";

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    setLoading(true);
    async function load() {
      try {
        const [positions, taxonomyRows, similarity, approved, builders, userRows] = await Promise.all([
          api.getPositions(),
          api.getTaxonomy(),
          api.getSimilarity(),
          api.getApproved(),
          api.getBuilders(),
          canManageUsers ? api.getUsers() : Promise.resolve<UserRow[]>([]),
        ]);
        if (cancelled) return;
        setPoolRows(positions);
        setUsers(userRows);
        setTaxonomy(taxonomyRows);
        setSimilarityResults(similarity);
        setApprovedContent(approved);
        setBuilderNames(builders.map((name) => name.split(" ")[0]));
        setSelectedRowId((current) => current || positions[0]?.id || "");
        setLoadError(null);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentUser, canManageUsers]);

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      setCurrentUser(null);
      setPoolRows([]);
      setUsers([]);
      setSelectedRowId("");
    }
  }

  const selectedRow = useMemo(
    () => poolRows.find((row) => row.id === selectedRowId) ?? poolRows[0],
    [poolRows, selectedRowId],
  );

  // Sync builder workspace fields when the selected position changes
  useEffect(() => {
    if (!selectedRow) return;
    setBuilderLearningOutcome(selectedRow.learningOutcome ?? "");
    setBuilderSolves(selectedRow.solves ?? "");
    setBuilderConcept(selectedRow.concept ?? "");
  }, [selectedRow?.id]);

  const assignmentRows = useMemo(() => {
    if (selectedAssignmentTab === "All") {
      return poolRows.filter((row) => row.builder !== "Unassigned");
    }
    return poolRows.filter((row) => row.status === selectedAssignmentTab);
  }, [poolRows, selectedAssignmentTab]);

  async function updatePosition(id: string, data: Partial<PoolRow>) {
    try {
      const updated = await api.updatePosition(id, data);
      setPoolRows((rows) => rows.map((row) => (row.id === id ? updated : row)));
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function assignBuilder(id: string, builder: string) {
    const row = poolRows.find((item) => item.id === id);
    const data: Partial<PoolRow> = { builder };
    if (builder === "Unassigned") {
      data.status = "New";
    } else if (row && (row.status === "New" || row.status === "Assigned")) {
      data.status = "Assigned";
    }
    await updatePosition(id, data);
  }

  async function handleImport() {
    if (!importFen.trim() || !importTitle.trim()) {
      setImportNotice("Enter a position title and a FEN before importing.");
      return;
    }
    try {
      const created = await api.createPosition({
        title: importTitle.trim(),
        subtitle: "Manual import",
        fen: importFen.trim(),
        broadTags: [importDomain],
        source: `${importSource} import`,
        rating: importRating,
      });
      setPoolRows((rows) => [...rows, created]);
      setSelectedRowId(created.id);
      setImportTitle("");
      setImportFen("");
      setImportNotice(`Imported ${created.id} into the position pool.`);
    } catch (err) {
      setImportNotice(err instanceof Error ? err.message : "Import failed");
    }
  }

  function renderDashboard() {
    if (!selectedRow) {
      return (
        <section className="page-stack">
          <EmptyState message="No positions have been imported yet." />
        </section>
      );
    }
    return (
      <section className="page-stack">
        <div className="hero-card">
          <div>
            <span className="section-kicker">Chess Knowledge Pipeline</span>
            <h2>Instructional production system for CC content</h2>
            <p>
              Import chess material, assign teachable moments to builders, detect overlap,
              and approve reusable curriculum knowledge with structured review.
            </p>
          </div>
          <div className="hero-actions">
            <button type="button" onClick={() => setActivePage("import")}>Import New Batch</button>
            <button type="button" className="ghost-button" onClick={() => setActivePage("review")}>
              Review Queue
            </button>
          </div>
        </div>

        <div className="metric-grid">
          {DASHBOARD_METRICS.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>

        <div className="two-up">
          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Pipeline Snapshot</span>
                <h3>Current queue health</h3>
              </div>
            </div>
            <div className="stack-list">
              {poolRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`list-row ${selectedRow.id === row.id ? "selected" : ""}`}
                  onClick={() => setSelectedRowId(row.id)}
                >
                  <div>
                    <strong>{row.id}</strong>
                    <p>{row.title}</p>
                  </div>
                  <div className="list-row-meta">
                    {statusPill(row.status)}
                    <span>{row.priority}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Featured Position</span>
                <h3>{selectedRow.id}</h3>
              </div>
              {statusPill(selectedRow.status)}
            </div>
            <div className="featured-board">
              <ChessBoard fen={selectedRow.fen} />
              <div className="feature-copy">
                <dl className="detail-grid">
                  <div>
                    <dt>Source</dt>
                    <dd>{selectedRow.source}</dd>
                  </div>
                  <div>
                    <dt>Concept</dt>
                    <dd>{selectedRow.concept}</dd>
                  </div>
                  <div>
                    <dt>Learning Outcome</dt>
                    <dd>{selectedRow.learningOutcome}</dd>
                  </div>
                  <div>
                    <dt>What This Solves</dt>
                    <dd>{selectedRow.solves}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
        </div>
      </section>
    );
  }

  function renderImportPage() {
    return (
      <section className="page-stack">
        <div className="page-title">
          <div>
            <span className="section-kicker">1. Import Positions</span>
            <h2>Knowledge Architect intake</h2>
            <p>Upload PGN files and add broad metadata before import.</p>
          </div>
          <button type="button" onClick={handleImport}>Import &amp; Analyze</button>
        </div>

        <div className="three-up">
          <section className="panel">
            <div className="tab-strip">
              <span className="tab active">Upload PGN</span>
            </div>
            <div className="form-grid">
              <label className="span-2">
                Position Title
                <input
                  placeholder="e.g. Carlsen vs Anand"
                  value={importTitle}
                  onChange={(event) => setImportTitle(event.target.value)}
                />
              </label>
              <label className="span-2">
                FEN
                <textarea
                  rows={3}
                  placeholder="Paste a FEN string here..."
                  value={importFen}
                  onChange={(event) => setImportFen(event.target.value)}
                />
              </label>
            </div>
            {importNotice ? <p className="import-notice">{importNotice}</p> : null}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Import Settings</span>
                <h3>Initial metadata</h3>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Initial Domain
                <select value={importDomain} onChange={(event) => setImportDomain(event.target.value)}>
                  <option>Tactics</option>
                  <option>Calculation</option>
                  <option>Endgames</option>
                  <option>Strategic Planning</option>
                </select>
              </label>
              <label>
                Rating Range
                <select value={importRating} onChange={(event) => setImportRating(event.target.value)}>
                  <option>400 - 600</option>
                  <option>600 - 800</option>
                  <option>800 - 1000</option>
                  <option>1000 - 1200</option>
                </select>
              </label>
              <label>
                Source Type
                <select value={importSource} onChange={(event) => setImportSource(event.target.value)}>
                  <option>Game</option>
                  <option>FEN</option>
                  <option>Puzzle</option>
                  <option>Generator</option>
                </select>
              </label>
              <label>
                Difficulty
                <select defaultValue="Medium">
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">PRD Coverage</span>
                <h3>Import workflow included</h3>
              </div>
            </div>
            <ul className="bullet-list">
              <li>Upload PGN files for position extraction.</li>
              <li>Show exact duplicates, existing positions, and partial overlaps.</li>
              <li>Apply initial domain, rating, source type, and broad tags before import.</li>
              <li>Treat chess positions separately from instructional knowledge items.</li>
            </ul>
          </section>
        </div>

      </section>
    );
  }

  function renderPoolPage() {
    return (
      <section className="page-stack">
        <div className="page-title">
          <div>
            <span className="section-kicker">2. Position Pool &amp; Assignment</span>
            <h2>Manage imported positions and assign builders</h2>
            <p>Search, filter, bulk tag, prioritize, and push content into builder queues.</p>
          </div>
          <button type="button">Bulk Actions</button>
        </div>

        <section className="panel">
          <div className="toolbar">
            <input placeholder="Search FEN, PGN, game, tags..." />
            <select defaultValue="All">
              <option>All Domains</option>
              <option>Tactics</option>
              <option>Endgames</option>
            </select>
            <select defaultValue="All">
              <option>All Sources</option>
              <option>CC games.pgn</option>
              <option>Generator</option>
            </select>
            <select defaultValue="All">
              <option>All Ratings</option>
              <option>600 - 800</option>
              <option>800 - 1000</option>
            </select>
            <button type="button" className="ghost-button">Filters</button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>FEN / PGN Info</th>
                  <th>Broad Tags</th>
                  <th>Source</th>
                  <th>Rating</th>
                  <th>Status</th>
                  <th>Builder</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {poolRows.map((row) => (
                  <tr key={row.id} className={selectedRow.id === row.id ? "active-row" : ""} onClick={() => setSelectedRowId(row.id)}>
                    <td><ChessBoard fen={row.fen} size="small" /></td>
                    <td>
                      <strong>{row.title}</strong>
                      <p>{row.subtitle}</p>
                      <small>{row.id}</small>
                    </td>
                    <td>
                      <div className="tag-row tight">
                        {row.broadTags.map((tag) => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td>{row.source}</td>
                    <td>{row.rating}</td>
                    <td>{statusPill(row.status)}</td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <select
                        value={row.builder}
                        onChange={(event) => assignBuilder(row.id, event.target.value)}
                      >
                        <option>Unassigned</option>
                        {builderNames.map((name) => (
                          <option key={name}>{name}</option>
                        ))}
                        {row.builder !== "Unassigned" && !builderNames.includes(row.builder) ? (
                          <option>{row.builder}</option>
                        ) : null}
                      </select>
                    </td>
                    <td>{row.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    );
  }

  function renderAssignmentsPage() {
    const tabs = ["All", "Assigned", "In Progress", "Changes Requested", "Approved"];
    return (
      <section className="page-stack">
        <div className="page-title">
          <div>
            <span className="section-kicker">3. My Assignments</span>
            <h2>Builder assignment queue</h2>
            <p>Track assigned work, progress states, and requested changes without leaving the workspace.</p>
          </div>
        </div>

        <div className="metric-grid compact">
          <MetricCard label="Assigned" value="0" delta="No assignments" />
          <MetricCard label="In Progress" value="0" delta="No work in progress" />
          <MetricCard label="Changes Requested" value="0" delta="No requested changes" />
          <MetricCard label="Completed" value="0" delta="No completed work" />
        </div>

        <div className="tab-strip wide">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`tab-button ${selectedAssignmentTab === tab ? "active" : ""}`}
              onClick={() => setSelectedAssignmentTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="card-grid">
          {assignmentRows.map((row) => (
            <article key={row.id} className="assignment-card">
              <ChessBoard fen={row.fen} size="small" />
              <div className="assignment-copy">
                <div className="assignment-head">
                  <div>
                    <strong>{row.id}</strong>
                    <p>{row.title}</p>
                  </div>
                  {statusPill(row.status)}
                </div>
                <div className="inline-meta">
                  <span>{row.rating}</span>
                  <span>{row.source}</span>
                  <span>{row.priority} priority</span>
                </div>
                <div className="tag-row tight">
                  {row.broadTags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
                <button type="button" onClick={() => { setSelectedRowId(row.id); setActivePage("builder"); }}>
                  Open Workspace
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderBuilderPage() {
    if (!selectedRow) return <EmptyState message="No position is available to build." />;
    return (
      <section className="page-stack">
        <div className="page-title">
          <div>
            <span className="section-kicker">4. Builder Workspace</span>
            <h2>View, tag, explain, compare, submit</h2>
            <p>Single-screen production workflow with board analysis, PGN context, metadata tagging, and autosave cues.</p>
          </div>
          <div className="header-actions">
            <span className="pill info">Autosaved 2 min ago</span>
            <button
              type="button"
              onClick={() =>
                updatePosition(selectedRow.id, {
                  status: "Submitted",
                  learningOutcome: builderLearningOutcome,
                  solves: builderSolves,
                  concept: builderConcept,
                })
              }
            >
              Submit
            </button>
          </div>
        </div>

        <div className="workspace-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">PGN / Position</span>
                <h3>{selectedRow.title}</h3>
              </div>
            </div>
            <div className="builder-left">
              <ChessBoard fen={selectedRow.fen} />
              <div className="analysis-card">
                <div className="engine-row">
                  <span>Engine (Stockfish)</span>
                  <strong>+1.35</strong>
                </div>
                <div className="engine-rows">
                  <span>Depth 22</span>
                  <span>1. Rc4</span>
                  <span>2. Nc3</span>
                  <span>3. h4</span>
                </div>
                <div className="move-table">
                  {["22. Bd5", "22... Rfd8", "24. Rc4", "24... h6", "25. Qe6+"].map((move, index) => (
                    <span key={move} className={index === 2 ? "active-move" : ""}>{move}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Instructional Metadata</span>
                <h3>Required submission fields</h3>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Domain
                <select defaultValue="Tactics">
                  <option>Tactics</option>
                  <option>Calculation</option>
                  <option>Endgames</option>
                </select>
              </label>
              <label>
                Major Topic
                <select defaultValue="Defender Manipulation">
                  <option>Defender Manipulation</option>
                  <option>Pins</option>
                  <option>Candidate Moves</option>
                </select>
              </label>
              <label>
                Concept
                <select
                  value={builderConcept}
                  onChange={(event) => setBuilderConcept(event.target.value)}
                  onBlur={() => updatePosition(selectedRow.id, { concept: builderConcept })}
                >
                  {taxonomy.flatMap((node) =>
                    node.topics.flatMap((topic) =>
                      topic.concepts.map((c) => <option key={c}>{c}</option>),
                    ),
                  )}
                  {builderConcept && !taxonomy.some((node) =>
                    node.topics.some((topic) => topic.concepts.includes(builderConcept))
                  ) ? <option>{builderConcept}</option> : null}
                </select>
              </label>
              <label>
                Rating Band
                <select defaultValue="600 - 800">
                  <option>600 - 800</option>
                  <option>800 - 1000</option>
                  <option>1000 - 1200</option>
                </select>
              </label>
              <label className="span-2">
                Knowledge Types
                <div className="check-grid">
                  {["Recognition", "Normal Action", "Importance", "Definition", "Common Mistake"].map((item, index) => (
                    <label key={item} className={`check-chip ${index < 2 ? "checked" : ""}`}>
                      <input type="checkbox" defaultChecked={index < 2} />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </label>
              <label className="span-2">
                Learning Outcome
                <textarea
                  rows={4}
                  value={builderLearningOutcome}
                  onChange={(event) => setBuilderLearningOutcome(event.target.value)}
                  onBlur={() => updatePosition(selectedRow.id, { learningOutcome: builderLearningOutcome })}
                />
              </label>
              <label className="span-2">
                What This Solves
                <textarea
                  rows={4}
                  value={builderSolves}
                  onChange={(event) => setBuilderSolves(event.target.value)}
                  onBlur={() => updatePosition(selectedRow.id, { solves: builderSolves })}
                />
              </label>
            </div>
          </section>
        </div>
      </section>
    );
  }

  function renderSimilarityPage() {
    if (SIMILARITY_RESULTS.length === 0) {
      return <EmptyState message="No similarity results are available." />;
    }
    return (
      <section className="page-stack">
        <div className="page-title">
          <div>
            <span className="section-kicker">5. Similar Content / Duplicate Intelligence</span>
            <h2>Explain overlap, don&apos;t just score it</h2>
            <p>Break down position similarity, concept match, learning outcome overlap, and student-problem overlap.</p>
          </div>
        </div>

        <div className="workspace-grid narrow-right">
          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Closest Existing Content</span>
                <h3>Related approved items</h3>
              </div>
            </div>
            <div className="stack-list">
              {similarityResults.map((item) => (
                <article key={item.id} className="similarity-card">
                  <ChessBoard fen={item.fen} size="small" />
                  <div className="similarity-copy">
                    <div className="similarity-head">
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.domain} • {item.topic}</p>
                      </div>
                      <span className="tag green">{item.label}</span>
                    </div>
                    <p>Rating: {item.rating}</p>
                    <div className="action-row">
                      <button type="button" className="ghost-button">View</button>
                      <button type="button" className="ghost-button">Use as Reference</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="action-row full-width">
              <button type="button" className="ghost-button">This teaches something different</button>
              <button type="button" className="ghost-button">Link as related</button>
              <button type="button" className="ghost-button">Attach source to existing</button>
              <button type="button" className="warning-button">Possible duplicate</button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Why This Is Similar</span>
                <h3>Best match breakdown</h3>
              </div>
            </div>
            <dl className="score-breakdown">
              <div><dt>Position Similarity</dt><dd>94%</dd></div>
              <div><dt>Concept Match</dt><dd>Exact</dd></div>
              <div><dt>Learning Outcome</dt><dd>86%</dd></div>
              <div><dt>Problem Similarity</dt><dd>91%</dd></div>
              <div><dt>Rating Band</dt><dd>Same</dd></div>
              <div><dt>Solution Line</dt><dd>73%</dd></div>
            </dl>
            <div className="coverage-card">
              <span className="section-kicker">Content Need</span>
              <h4>High</h4>
              <ul className="bullet-list">
                <li>Only one Common Mistake example exists for this concept.</li>
                <li>No strong 1000 - 1200 coverage in approved CC content.</li>
                <li>This item adds a cleaner defender-removal motif than the current batch.</li>
              </ul>
              <button type="button" className="ghost-button">View Coverage Report</button>
            </div>
          </section>
        </div>
      </section>
    );
  }

  function renderReviewPage() {
    if (!selectedRow) return <EmptyState message="There are no submissions to review." />;
    return (
      <section className="page-stack">
        <div className="page-title">
          <div>
            <span className="section-kicker">6. Review Queue</span>
            <h2>Knowledge Architect / Peer Reviewer</h2>
            <p>Review builder submissions, compare against duplicates, and approve or request changes.</p>
          </div>
        </div>

        <div className="workspace-grid review-layout">
          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Submission {selectedRow.id}</span>
                <h3>{selectedRow.title}</h3>
              </div>
            </div>
            <div className="review-card">
              <ChessBoard fen={selectedRow.fen} />
              <div className="review-copy">
                <div className="detail-columns">
                  <div><strong>Builder</strong><p>{selectedRow.builder}</p></div>
                  <div><strong>Domain</strong><p>Tactics</p></div>
                  <div><strong>Major Topic</strong><p>Defender Manipulation</p></div>
                  <div><strong>Concept</strong><p>{selectedRow.concept}</p></div>
                </div>
                <div className="review-text-card">
                  <strong>Learning Outcome</strong>
                  <p>{selectedRow.learningOutcome}</p>
                </div>
                <div className="review-text-card">
                  <strong>What This Solves</strong>
                  <p>{selectedRow.solves}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Duplicate Risk</span>
                <h3>Similarity checks</h3>
              </div>
            </div>
            <div className="review-score">
              <span className="risk-label">Overall Duplicate Risk</span>
              <strong>High</strong>
            </div>
            <dl className="score-breakdown compact">
              <div><dt>Exact FEN Match</dt><dd>No</dd></div>
              <div><dt>Same Concept</dt><dd>Yes</dd></div>
              <div><dt>Learning Outcome Similarity</dt><dd>92%</dd></div>
              <div><dt>Student Problem Similarity</dt><dd>94%</dd></div>
            </dl>
            <label>
              Reviewer Notes
              <textarea rows={8} placeholder="Add review notes here..." />
            </label>
            <div className="action-row full-width">
              <button
                type="button"
                className="warning-button"
                onClick={() => updatePosition(selectedRow.id, { status: "Changes Requested" })}
              >
                Request Changes
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => updatePosition(selectedRow.id, { status: "New", builder: "Unassigned" })}
              >
                Reject
              </button>
              <button
                type="button"
                className="success-button"
                onClick={() => updatePosition(selectedRow.id, { status: "Approved" })}
              >
                Approve
              </button>
            </div>
          </section>
        </div>
      </section>
    );
  }

  function renderApprovedPage() {
    return (
      <section className="page-stack">
        <div className="page-title">
          <div>
            <span className="section-kicker">Approved Knowledge Base</span>
            <h2>Reusable curriculum content</h2>
            <p>Search and filter approved instructional knowledge by concept, type, rating, and source.</p>
          </div>
        </div>
        <section className="panel">
          <div className="toolbar">
            <input placeholder="Search concepts, learning outcomes, or student problems..." />
            <select defaultValue="All"><option>All Domains</option><option>Tactics</option></select>
            <select defaultValue="All"><option>All Ratings</option><option>600 - 800</option></select>
            <button type="button" className="ghost-button">Export</button>
          </div>
          <div className="card-grid">
            {approvedContent.map((item) => (
              <article key={item.concept} className="approved-card">
                <div className="assignment-head">
                  <div>
                    <strong>{item.concept}</strong>
                    <p>{item.domain} • {item.topic}</p>
                  </div>
                  <span className="pill success">{item.positions} positions</span>
                </div>
                <div className="tag-row tight">
                  {item.types.map((type) => (
                    <span key={type} className="tag">{type}</span>
                  ))}
                </div>
                <p>{item.coverage}</p>
                <small>Last updated {item.updated}</small>
              </article>
            ))}
            {APPROVED_CONTENT.length === 0 && <EmptyState message="No approved content yet." />}
          </div>
        </section>
      </section>
    );
  }

  function renderTaxonomyPage() {
    return (
      <section className="page-stack">
        <div className="page-title">
          <div>
            <span className="section-kicker">Taxonomy Management</span>
            <h2>Domain → Major Topic → Concept hierarchy</h2>
            <p>Architect-owned structure for the canonical instructional vocabulary.</p>
          </div>
          <button type="button">Add Concept</button>
        </div>
        <div className="card-grid taxonomy-grid">
          {taxonomy.map((node) => (
            <article key={node.domain} className="panel taxonomy-card">
              <div className="panel-header">
                <div>
                  <span className="section-kicker">Domain</span>
                  <h3>{node.domain}</h3>
                </div>
              </div>
              {node.topics.map((topic) => (
                <div key={topic.name} className="taxonomy-topic">
                  <strong>{topic.name}</strong>
                  <div className="tag-row tight">
                    {topic.concepts.map((concept) => (
                      <span key={concept} className="tag">{concept}</span>
                    ))}
                  </div>
                </div>
              ))}
            </article>
          ))}
          {TAXONOMY.length === 0 && <EmptyState message="No taxonomy entries yet." />}
        </div>
      </section>
    );
  }

  function renderAdminPage() {
    return (
      <section className="page-stack">
        <div className="page-title">
          <div>
            <span className="section-kicker">7. Admin</span>
            <h2>User management</h2>
            <p>Simple MVP administration for roles, status, and invites.</p>
          </div>
          <button type="button">+ Add User</button>
        </div>
        <section className="panel">
          <div className="toolbar">
            <input placeholder="Search users..." />
            <select defaultValue="All"><option>All Roles</option><option>Builder</option><option>Knowledge Architect</option></select>
            <select defaultValue="All"><option>All Statuses</option><option>Active</option><option>Inactive</option></select>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined On</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.email}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td><span className={`pill ${user.status === "Active" ? "success" : "danger"}`}>{user.status}</span></td>
                    <td>{user.joined}</td>
                  </tr>
                ))}
                {USERS.length === 0 && (
                  <tr><td colSpan={5}>No users have been added.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    );
  }

  function renderActivePage() {
    if (loading) {
      return (
        <section className="page-stack">
          <section className="panel"><p>Loading pipeline data...</p></section>
        </section>
      );
    }
    if (loadError) {
      return (
        <section className="page-stack">
          <section className="panel"><p>Could not load data: {loadError}</p></section>
        </section>
      );
    }
    if (!selectedRow) {
      return (
        <section className="page-stack">
          <section className="panel"><p>No positions yet. Import a position to get started.</p></section>
        </section>
      );
    }
    switch (activePage) {
      case "dashboard":
        return renderDashboard();
      case "import":
        return renderImportPage();
      case "pool":
        return renderPoolPage();
      case "assignments":
        return renderAssignmentsPage();
      case "builder":
        return renderBuilderPage();
      case "similarity":
        return renderSimilarityPage();
      case "review":
        return renderReviewPage();
      case "approved":
        return renderApprovedPage();
      case "taxonomy":
        return renderTaxonomyPage();
      case "admin":
        return renderAdminPage();
      default:
        return renderDashboard();
    }
  }

  if (!authChecked) {
    return (
      <div className="app-shell login-shell">
        <div className="panel login-panel"><p>Loading...</p></div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={setCurrentUser} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <div className="brand-mark">CK</div>
          <div>
            <span className="section-kicker">CC Platform</span>
            <h1>CC Knowledge Base</h1>
            <p>Standalone product prototype for the CC instructional knowledge system.</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-link ${activePage === item.id ? "active" : ""}`}
              onClick={() => setActivePage(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.section}</small>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">
              {currentUser.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <strong>{currentUser.name}</strong>
              <p>{currentUser.role}</p>
            </div>
          </div>
          <button type="button" className="ghost-button" onClick={handleLogout}>
            Sign Out
          </button>
          <div className="sidebar-note">
            <span className="section-kicker">Core Pipeline</span>
            <p>Import → Position Pool → Assign → Builder Tagging → Similarity → Review → Approved KB</p>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="section-kicker">Standalone Product Build</span>
            <h2>{NAV_ITEMS.find((item) => item.id === activePage)?.label}</h2>
          </div>
          <div className="header-actions">
            {actionError ? <span className="pill danger">{actionError}</span> : null}
            <span className="pill neutral">Desktop-first MVP</span>
          </div>
        </header>
        {renderActivePage()}
      </main>
    </div>
  );
}

export default App;
