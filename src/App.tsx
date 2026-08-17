import { useMemo, useState } from "react";

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

type PositionStatus =
  | "New"
  | "Assigned"
  | "In Progress"
  | "Submitted"
  | "Changes Requested"
  | "Approved";

type NavItem = {
  id: PageId;
  label: string;
  section: string;
};

type PoolRow = {
  id: string;
  title: string;
  subtitle: string;
  fen: string;
  broadTags: string[];
  source: string;
  rating: string;
  status: PositionStatus;
  builder: string;
  priority: "Low" | "Normal" | "High";
  learningOutcome: string;
  solves: string;
  similarity: number;
  concept: string;
};

type SimilarityCard = {
  id: string;
  title: string;
  domain: string;
  topic: string;
  rating: string;
  positionMatch: number;
  conceptMatch: string;
  learningOutcomeMatch: number;
  studentProblemMatch: number;
  solutionSimilarity: number;
  label: string;
  fen: string;
};

type ApprovedCard = {
  concept: string;
  domain: string;
  topic: string;
  types: string[];
  positions: number;
  updated: string;
  coverage: string;
};

type TaxonomyNode = {
  domain: string;
  topics: {
    name: string;
    concepts: string[];
  }[];
};

type UserRow = {
  name: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
  joined: string;
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

const POOL_ROWS: PoolRow[] = [
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

const SIMILARITY_RESULTS: SimilarityCard[] = [
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

const APPROVED_CONTENT: ApprovedCard[] = [
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

const TAXONOMY: TaxonomyNode[] = [
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

const USERS: UserRow[] = [
  { name: "Vishu KA", email: "vishu@circlechess.com", role: "Knowledge Architect", status: "Active", joined: "May 10, 2024" },
  { name: "Arun Sharma", email: "arun.builder@circlechess.com", role: "Builder", status: "Active", joined: "May 12, 2024" },
  { name: "Meena R", email: "meena.builder@circlechess.com", role: "Builder", status: "Active", joined: "May 14, 2024" },
  { name: "Ravi K", email: "ravi.review@circlechess.com", role: "Peer Reviewer", status: "Active", joined: "May 15, 2024" },
  { name: "Sneha P", email: "sneha.builder@circlechess.com", role: "Builder", status: "Inactive", joined: "May 17, 2024" },
  { name: "Prakash Admin", email: "prakash.admin@circlechess.com", role: "Admin", status: "Active", joined: "May 08, 2024" },
];

const IMPORT_SUMMARY = [
  { label: "PGN Files", value: "3" },
  { label: "Games Found", value: "512" },
  { label: "Positions Extracted", value: "2,348" },
  { label: "Potential Duplicates", value: "28" },
  { label: "Partial Matches", value: "96" },
  { label: "Manual Review", value: "14" },
];

const DASHBOARD_METRICS = [
  { label: "Imported This Week", value: "2,348", delta: "+14%" },
  { label: "Assigned to Builders", value: "418", delta: "+22%" },
  { label: "Awaiting Review", value: "37", delta: "6 high risk" },
  { label: "Approved Knowledge", value: "1,284", delta: "+52 today" },
];

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

function App() {
  const [activePage, setActivePage] = useState<PageId>("import");
  const [selectedRowId, setSelectedRowId] = useState<string>(POOL_ROWS[0].id);
  const [selectedAssignmentTab, setSelectedAssignmentTab] = useState("All");

  const selectedRow = useMemo(
    () => POOL_ROWS.find((row) => row.id === selectedRowId) ?? POOL_ROWS[0],
    [selectedRowId],
  );

  const assignmentRows = useMemo(() => {
    if (selectedAssignmentTab === "All") {
      return POOL_ROWS.filter((row) => row.builder !== "Unassigned");
    }
    return POOL_ROWS.filter((row) => row.status === selectedAssignmentTab);
  }, [selectedAssignmentTab]);

  function renderDashboard() {
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
              {POOL_ROWS.map((row) => (
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
            <span className="section-kicker">1. Import / Generate Positions</span>
            <h2>Knowledge Architect intake</h2>
            <p>Support PGN uploads, pasted FENs, generated positions, and broad metadata before import.</p>
          </div>
          <button type="button">Import &amp; Analyze</button>
        </div>

        <div className="three-up">
          <section className="panel">
            <div className="tab-strip">
              <span className="tab active">Upload PGN</span>
              <span className="tab">Paste PGN</span>
              <span className="tab">Paste FEN</span>
              <span className="tab">Generate Positions</span>
              <span className="tab">Import Opening</span>
            </div>
            <div className="upload-box">
              <div className="upload-icon">+</div>
              <strong>Drag and drop PGN files here</strong>
              <p>Supports multi-file upload from CC game batches. Max 50MB each.</p>
              <button type="button">Choose Files</button>
            </div>
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
                <select defaultValue="Tactics">
                  <option>Tactics</option>
                  <option>Calculation</option>
                  <option>Endgames</option>
                  <option>Strategic Planning</option>
                </select>
              </label>
              <label>
                Rating Range
                <select defaultValue="600 - 800">
                  <option>400 - 600</option>
                  <option>600 - 800</option>
                  <option>800 - 1000</option>
                  <option>1000 - 1200</option>
                </select>
              </label>
              <label>
                Source Type
                <select defaultValue="Game">
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
            <div className="tag-row">
              <span className="tag blue">Tactics</span>
              <span className="tag blue">Defender Manipulation</span>
              <span className="tag blue">CC Content Batch</span>
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
              <li>Upload PGNs, paste PGN/FEN, and support generated positions.</li>
              <li>Show exact duplicates, existing positions, and partial overlaps.</li>
              <li>Apply initial domain, rating, source type, and broad tags before import.</li>
              <li>Treat chess positions separately from instructional knowledge items.</li>
            </ul>
          </section>
        </div>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Import Summary</span>
              <h3>Preview before final import</h3>
            </div>
          </div>
          <div className="metric-grid compact">
            {IMPORT_SUMMARY.map((item) => (
              <article key={item.label} className="metric-card compact">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </section>
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
                {POOL_ROWS.map((row) => (
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
                    <td>{row.builder}</td>
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
          <MetricCard label="Assigned" value="14" delta="4 due this week" />
          <MetricCard label="In Progress" value="9" delta="2 autosaved now" />
          <MetricCard label="Changes Requested" value="3" delta="Reviewer notes added" />
          <MetricCard label="Completed" value="22" delta="7 approved this week" />
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
            <button type="button">Submit</button>
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
                <select defaultValue="Removing the Defender">
                  <option>Removing the Defender</option>
                  <option>Deflection</option>
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
                <textarea rows={4} defaultValue={selectedRow.learningOutcome} />
              </label>
              <label className="span-2">
                What This Solves
                <textarea rows={4} defaultValue={selectedRow.solves} />
              </label>
            </div>
          </section>
        </div>
      </section>
    );
  }

  function renderSimilarityPage() {
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
              {SIMILARITY_RESULTS.map((item) => (
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
              <button type="button" className="warning-button">Request Changes</button>
              <button type="button" className="danger-button">Reject</button>
              <button type="button" className="success-button">Approve</button>
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
            {APPROVED_CONTENT.map((item) => (
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
          {TAXONOMY.map((node) => (
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
                {USERS.map((user) => (
                  <tr key={user.email}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td><span className={`pill ${user.status === "Active" ? "success" : "danger"}`}>{user.status}</span></td>
                    <td>{user.joined}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    );
  }

  function renderActivePage() {
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
            <div className="avatar">VK</div>
            <div>
              <strong>Vishu KA</strong>
              <p>Knowledge Architect</p>
            </div>
          </div>
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
            <span className="pill neutral">Desktop-first MVP</span>
            <span className="pill info">CC content seeded</span>
          </div>
        </header>
        {renderActivePage()}
      </main>
    </div>
  );
}

export default App;
