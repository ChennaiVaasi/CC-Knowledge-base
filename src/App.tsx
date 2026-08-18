import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
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

function SelectOrAddField({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const usesCustomValue = !options.includes(value);

  return (
    <label>
      {label}
      <select
        aria-label={`${label} options`}
        value={usesCustomValue ? "__custom__" : value}
        onChange={(event) => onChange(event.target.value === "__custom__" ? "" : event.target.value)}
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
        <option value="__custom__">+ Add new {label.toLowerCase()}</option>
      </select>
      {usesCustomValue ? (
        <input
          aria-label={`New ${label}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : null}
    </label>
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

  const [importTab, setImportTab] = useState<"upload-pgn" | "paste-pgn" | "paste-fen" | "generate" | "opening">("paste-fen");
  const [importTitle, setImportTitle] = useState("");
  const [importFen, setImportFen] = useState("");
  const [importDomain, setImportDomain] = useState("Tactics");
  const [importRating, setImportRating] = useState("600 - 800");
  const [importSource, setImportSource] = useState("Game");
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [pgnText, setPgnText] = useState("");
  const [pgnParseError, setPgnParseError] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const pgnFileRef = useRef<HTMLInputElement>(null);

  const [builderNames, setBuilderNames] = useState<string[]>([]);

  // Add User form state
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserName, setAddUserName] = useState("");
  const [addUserEmail, setAddUserEmail] = useState("");
  const [addUserRole, setAddUserRole] = useState("Builder");
  const [addUserPassword, setAddUserPassword] = useState("");
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [addUserBusy, setAddUserBusy] = useState(false);

  // Builder Workspace controlled fields
  const [builderLearningOutcome, setBuilderLearningOutcome] = useState("");
  const [builderSolves, setBuilderSolves] = useState("");
  const [builderConcept, setBuilderConcept] = useState("");
  const [builderDomain, setBuilderDomain] = useState("");
  const [builderTopic, setBuilderTopic] = useState("");
  const [builderRating, setBuilderRating] = useState("");

  // Taxonomy form state
  const [showTaxonomyForm, setShowTaxonomyForm] = useState(false);
  const [taxDomainMode, setTaxDomainMode] = useState<"existing" | "new">("existing");
  const [taxDomainSelect, setTaxDomainSelect] = useState("");
  const [taxDomainNew, setTaxDomainNew] = useState("");
  const [taxTopicMode, setTaxTopicMode] = useState<"existing" | "new">("existing");
  const [taxTopicSelect, setTaxTopicSelect] = useState("");
  const [taxTopicNew, setTaxTopicNew] = useState("");
  const [taxConceptNew, setTaxConceptNew] = useState("");
  const [taxFormError, setTaxFormError] = useState<string | null>(null);
  const [taxFormBusy, setTaxFormBusy] = useState(false);

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
    setBuilderRating(selectedRow.rating ?? "");
    // Infer domain and topic from broadTags or taxonomy lookup
    const tagDomain = selectedRow.broadTags[0] ?? "";
    const tagTopic = selectedRow.broadTags[1] ?? "";
    const domainExists = taxonomy.some((n) => n.domain === tagDomain);
    const resolvedDomain = domainExists ? tagDomain : (taxonomy[0]?.domain ?? "");
    setBuilderDomain(resolvedDomain);
    const domainNode = taxonomy.find((n) => n.domain === resolvedDomain);
    const topicExists = domainNode?.topics.some((t) => t.name === tagTopic);
    setBuilderTopic(topicExists ? tagTopic : (domainNode?.topics[0]?.name ?? ""));
  }, [selectedRow?.id, taxonomy]);

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

  async function handleAddUser(event: React.FormEvent) {
    event.preventDefault();
    setAddUserBusy(true);
    setAddUserError(null);
    try {
      const created = await api.createUser({
        name: addUserName.trim(),
        email: addUserEmail.trim(),
        role: addUserRole,
        password: addUserPassword,
      });
      setUsers((prev) => [...prev, created]);
      setShowAddUser(false);
      setAddUserName("");
      setAddUserEmail("");
      setAddUserRole("Builder");
      setAddUserPassword("");
    } catch (err) {
      setAddUserError(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setAddUserBusy(false);
    }
  }

  async function handleUpdateUser(email: string, data: { status?: string; role?: string }) {
    try {
      const updated = await api.updateUser(email, data);
      setUsers((prev) => prev.map((u) => (u.email === email ? updated : u)));
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Update failed");
    }
  }

  function applyParsedPgn(pgn: string) {
    setPgnParseError(null);
    try {
      const chess = new Chess();
      chess.loadPgn(pgn.trim());
      const h = chess.header() as Record<string, string>;
      const white = h.White ?? "White";
      const black = h.Black ?? "Black";
      const event = h.Event && h.Event !== "?" ? ` — ${h.Event}` : "";
      const round = h.Round && h.Round !== "?" ? ` Rd.${h.Round}` : "";
      setImportTitle(`${white} vs ${black}${event}${round}`);
      setImportFen(chess.fen());
      setImportSource("Game");
      setImportNotice("PGN parsed — review the position and click Import & Analyze.");
    } catch {
      setPgnParseError("Could not parse PGN. Make sure it is a valid PGN string.");
    }
  }

  function handlePgnTextParse() {
    if (!pgnText.trim()) {
      setPgnParseError("Paste a PGN before parsing.");
      return;
    }
    applyParsedPgn(pgnText);
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setPgnText(text);
      applyParsedPgn(text);
    };
    reader.readAsText(file);
    // Reset so same file can be re-selected
    event.target.value = "";
  }

  async function handleImport() {
    if (!importFen.trim() || !importTitle.trim()) {
      setImportNotice("Enter a position title and a FEN before importing.");
      return;
    }
    setImportBusy(true);
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
      setPgnText("");
      setImportNotice(`Imported ${created.id} into the position pool.`);
    } catch (err) {
      setImportNotice(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
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
    const IMPORT_TABS: { id: typeof importTab; label: string }[] = [
      { id: "upload-pgn", label: "Upload PGN" },
      { id: "paste-pgn", label: "Paste PGN" },
      { id: "paste-fen", label: "Paste FEN" },
      { id: "generate", label: "Generate Positions" },
      { id: "opening", label: "Import Opening" },
    ];

    const canImport = importTab === "paste-fen"
      ? importTitle.trim() && importFen.trim()
      : importTab === "upload-pgn" || importTab === "paste-pgn"
        ? importFen.trim() && importTitle.trim()
        : false;

    function renderTabPanel() {
      if (importTab === "upload-pgn") {
        return (
          <>
            <input
              ref={pgnFileRef}
              type="file"
              accept=".pgn,.txt"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            <div
              className="upload-box"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const text = ev.target?.result as string;
                  setPgnText(text);
                  applyParsedPgn(text);
                };
                reader.readAsText(file);
              }}
            >
              <div className="upload-icon">+</div>
              <strong>Drag and drop a PGN file here</strong>
              <p>Supports single-game PGN files. Max 50 MB.</p>
              <button type="button" onClick={() => pgnFileRef.current?.click()}>
                Choose File
              </button>
            </div>
            {pgnParseError ? <p className="import-notice error">{pgnParseError}</p> : null}
            {importFen && !pgnParseError ? (
              <div className="form-grid" style={{ marginTop: "0.75rem" }}>
                <label className="span-2">
                  Position Title (editable)
                  <input value={importTitle} onChange={(e) => setImportTitle(e.target.value)} />
                </label>
                <label className="span-2">
                  FEN (final position)
                  <input value={importFen} onChange={(e) => setImportFen(e.target.value)} />
                </label>
                <p className="import-notice span-2" style={{ marginTop: 0 }}>
                  {importNotice}
                </p>
              </div>
            ) : null}
          </>
        );
      }

      if (importTab === "paste-pgn") {
        return (
          <>
            <div className="form-grid">
              <label className="span-2">
                PGN
                <textarea
                  rows={7}
                  placeholder={"[Event \"Wijk aan Zee\"]\n[White \"Carlsen, M\"]\n[Black \"Anand, V\"]\n\n1. e4 e5 2. Nf3 ..."}
                  value={pgnText}
                  onChange={(e) => { setPgnText(e.target.value); setPgnParseError(null); }}
                />
              </label>
            </div>
            {pgnParseError ? <p className="import-notice error">{pgnParseError}</p> : null}
            <button type="button" onClick={handlePgnTextParse} style={{ marginTop: "0.5rem" }}>
              Parse PGN
            </button>
            {importFen && !pgnParseError ? (
              <div className="form-grid" style={{ marginTop: "0.75rem" }}>
                <label className="span-2">
                  Position Title (editable)
                  <input value={importTitle} onChange={(e) => setImportTitle(e.target.value)} />
                </label>
                <label className="span-2">
                  FEN (final position)
                  <input value={importFen} onChange={(e) => setImportFen(e.target.value)} />
                </label>
                <p className="import-notice span-2" style={{ marginTop: 0 }}>
                  {importNotice}
                </p>
              </div>
            ) : null}
          </>
        );
      }

      if (importTab === "paste-fen") {
        return (
          <>
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
          </>
        );
      }

      // generate / opening — informational
      const isGenerate = importTab === "generate";
      return (
        <div className="upload-box" style={{ textAlign: "left", padding: "1.5rem" }}>
          <strong style={{ display: "block", marginBottom: "0.5rem" }}>
            {isGenerate ? "Generate Positions" : "Import Opening"}
          </strong>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            {isGenerate
              ? "Position generation by criteria (rating band, theme, engine evaluation) is coming soon. For now, use Paste FEN or Upload PGN to add positions manually."
              : "Opening tree import is coming soon. You will be able to load an ECO line and extract instructional moments automatically. Use Paste PGN in the meantime."}
          </p>
        </div>
      );
    }

    return (
      <section className="page-stack">
        <div className="page-title">
          <div>
            <span className="section-kicker">1. Import / Generate Positions</span>
            <h2>Knowledge Architect intake</h2>
            <p>Support PGN uploads, pasted FENs, generated positions, and broad metadata before import.</p>
          </div>
          <button
            type="button"
            onClick={handleImport}
            disabled={!canImport || importBusy}
          >
            {importBusy ? "Importing…" : "Import & Analyze"}
          </button>
        </div>

        <div className="three-up">
          <section className="panel">
            <div className="tab-strip">
              {IMPORT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`tab ${importTab === tab.id ? "active" : ""}`}
                  onClick={() => {
                    setImportTab(tab.id);
                    setPgnParseError(null);
                    setImportNotice(null);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div style={{ padding: "1rem 0 0" }}>
              {renderTabPanel()}
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
            <div className="tag-row">
              <span className="tag blue">{importDomain}</span>
              <span className="tag blue">{importRating}</span>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">How it works</span>
                <h3>Import workflow</h3>
              </div>
            </div>
            <ul className="bullet-list">
              <li><strong>Upload PGN</strong> — drag a .pgn file; title and FEN auto-fill from headers.</li>
              <li><strong>Paste PGN</strong> — paste a game in PGN format and click Parse PGN.</li>
              <li><strong>Paste FEN</strong> — enter a title and any valid FEN string directly.</li>
              <li>Set domain, rating range, and source type, then click Import & Analyze.</li>
            </ul>
          </section>
        </div>

        {importFen ? (
          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Preview</span>
                <h3>{importTitle || "Untitled position"}</h3>
              </div>
            </div>
            <div className="featured-board">
              <ChessBoard fen={importFen} />
              <div className="feature-copy">
                <dl className="detail-grid">
                  <div><dt>FEN</dt><dd style={{ fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-all" }}>{importFen}</dd></div>
                  <div><dt>Domain</dt><dd>{importDomain}</dd></div>
                  <div><dt>Rating</dt><dd>{importRating}</dd></div>
                  <div><dt>Source</dt><dd>{importSource}</dd></div>
                </dl>
              </div>
            </div>
          </section>
        ) : null}
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
                  broadTags: [builderDomain, builderTopic].filter(Boolean),
                  rating: builderRating,
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
              <SelectOrAddField
                label="Domain"
                options={taxonomy.map((node) => node.domain)}
                value={builderDomain}
                placeholder="Enter a new domain"
                onChange={(d) => {
                    setBuilderDomain(d);
                    const domainNode = taxonomy.find((n) => n.domain === d);
                    const firstTopic = domainNode?.topics[0]?.name ?? "";
                    setBuilderTopic(firstTopic);
                    setBuilderConcept(domainNode?.topics[0]?.concepts[0] ?? "");
                }}
              />
              <SelectOrAddField
                label="Major Topic"
                options={(taxonomy.find((node) => node.domain === builderDomain)?.topics ?? []).map((topic) => topic.name)}
                value={builderTopic}
                placeholder="Enter a new major topic"
                onChange={(t) => {
                    setBuilderTopic(t);
                    const domainNode = taxonomy.find((n) => n.domain === builderDomain);
                    const topicObj = domainNode?.topics.find((tp) => tp.name === t);
                    setBuilderConcept(topicObj?.concepts[0] ?? "");
                }}
              />
              <SelectOrAddField
                label="Concept"
                options={taxonomy.find((node) => node.domain === builderDomain)?.topics.find((topic) => topic.name === builderTopic)?.concepts ?? []}
                value={builderConcept}
                placeholder="Enter a new concept"
                onChange={setBuilderConcept}
              />
              <SelectOrAddField
                label="Rating Band"
                options={["600 - 800", "800 - 1000", "1000 - 1200"]}
                value={builderRating}
                placeholder="Enter a new rating band"
                onChange={setBuilderRating}
              />
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
            {approvedContent.length === 0 && <EmptyState message="No approved content yet." />}
          </div>
        </section>
      </section>
    );
  }

  async function handleTaxonomyAdd(event: React.FormEvent) {
    event.preventDefault();
    setTaxFormError(null);
    setTaxFormBusy(true);
    try {
      const domainName = taxDomainMode === "new" ? taxDomainNew.trim() : taxDomainSelect;
      const topicName = taxTopicMode === "new" ? taxTopicNew.trim() : taxTopicSelect;
      const conceptName = taxConceptNew.trim();

      if (!domainName) { setTaxFormError("Domain is required."); return; }
      if (!topicName) { setTaxFormError("Topic is required."); return; }
      if (!conceptName) { setTaxFormError("Concept name is required."); return; }

      let updatedNode: TaxonomyNode;

      if (taxDomainMode === "new") {
        // Create domain, then topic (with concept)
        await api.createDomain(domainName);
        await api.createTopic(domainName, topicName);
        updatedNode = await api.createConcept(domainName, topicName, conceptName);
      } else if (taxTopicMode === "new") {
        // Create topic (under existing domain), then concept
        await api.createTopic(domainName, topicName);
        updatedNode = await api.createConcept(domainName, topicName, conceptName);
      } else {
        // Add concept to existing domain + topic
        updatedNode = await api.createConcept(domainName, topicName, conceptName);
      }

      setTaxonomy((prev) => {
        const exists = prev.find((n) => n.domain === updatedNode.domain);
        if (exists) return prev.map((n) => (n.domain === updatedNode.domain ? updatedNode : n));
        return [...prev, updatedNode];
      });

      // Reset form
      setTaxConceptNew("");
      if (taxDomainMode === "new") { setTaxDomainNew(""); setTaxTopicNew(""); }
      if (taxTopicMode === "new") { setTaxTopicNew(""); }
      setShowTaxonomyForm(false);
    } catch (err) {
      setTaxFormError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setTaxFormBusy(false);
    }
  }

  function renderTaxonomyPage() {
    const isArchitectOrAdmin =
      currentUser?.role === "Knowledge Architect" || currentUser?.role === "Admin";

    // Derive the resolved domain name for the form
    const formDomain = taxDomainMode === "new" ? taxDomainNew.trim() : taxDomainSelect;
    const formDomainNode = taxonomy.find((n) => n.domain === formDomain);
    const formTopicOptions = formDomainNode?.topics ?? [];

    return (
      <section className="page-stack">
        <div className="page-title">
          <div>
            <span className="section-kicker">Taxonomy Management</span>
            <h2>Domain → Major Topic → Concept hierarchy</h2>
            <p>Architect-owned structure for the canonical instructional vocabulary.</p>
          </div>
          {isArchitectOrAdmin && (
            <button
              type="button"
              onClick={() => {
                setShowTaxonomyForm((v) => !v);
                setTaxFormError(null);
                // Seed defaults when opening
                if (!showTaxonomyForm) {
                  setTaxDomainMode("existing");
                  setTaxDomainSelect(taxonomy[0]?.domain ?? "");
                  setTaxTopicMode("existing");
                  setTaxTopicSelect(taxonomy[0]?.topics[0]?.name ?? "");
                  setTaxConceptNew("");
                }
              }}
            >
              {showTaxonomyForm ? "Cancel" : "Add Concept"}
            </button>
          )}
        </div>

        {showTaxonomyForm && isArchitectOrAdmin && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Grow the Taxonomy</span>
                <h3>Add domain / topic / concept</h3>
              </div>
            </div>
            <form className="form-grid" onSubmit={handleTaxonomyAdd}>
              {/* Domain row: single select with existing + "New…" sentinel */}
              <label className="span-2">
                Domain
                <select
                  value={taxDomainMode === "new" ? "__new__" : taxDomainSelect}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setTaxDomainMode("new");
                      setTaxDomainNew("");
                      setTaxTopicMode("new");
                      setTaxTopicNew("");
                    } else {
                      setTaxDomainMode("existing");
                      setTaxDomainSelect(e.target.value);
                      const node = taxonomy.find((n) => n.domain === e.target.value);
                      setTaxTopicMode("existing");
                      setTaxTopicSelect(node?.topics[0]?.name ?? "");
                    }
                  }}
                >
                  {taxonomy.map((n) => <option key={n.domain} value={n.domain}>{n.domain}</option>)}
                  <option value="__new__">+ New domain…</option>
                </select>
              </label>
              {taxDomainMode === "new" && (
                <label className="span-2">
                  New Domain Name
                  <input
                    required
                    placeholder="e.g. Opening Theory"
                    value={taxDomainNew}
                    onChange={(e) => setTaxDomainNew(e.target.value)}
                  />
                </label>
              )}

              {/* Topic row: single select with existing topics + "New…" sentinel */}
              <label className="span-2">
                Major Topic
                <select
                  value={taxTopicMode === "new" ? "__new__" : taxTopicSelect}
                  disabled={taxDomainMode === "new"}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setTaxTopicMode("new");
                      setTaxTopicNew("");
                    } else {
                      setTaxTopicMode("existing");
                      setTaxTopicSelect(e.target.value);
                    }
                  }}
                >
                  {formTopicOptions.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                  <option value="__new__">+ New topic…</option>
                </select>
              </label>
              {(taxDomainMode === "new" || taxTopicMode === "new") && (
                <label className="span-2">
                  New Topic Name
                  <input
                    required
                    placeholder="e.g. Knight Outposts"
                    value={taxTopicNew}
                    onChange={(e) => setTaxTopicNew(e.target.value)}
                  />
                </label>
              )}

              {/* Concept always required */}
              <label className="span-2">
                Concept Name
                <input
                  required
                  placeholder="e.g. Removing the Defender"
                  value={taxConceptNew}
                  onChange={(e) => setTaxConceptNew(e.target.value)}
                />
              </label>

              {taxFormError && <p className="login-error span-2">{taxFormError}</p>}
              <div className="action-row span-2">
                <button type="submit" disabled={taxFormBusy}>
                  {taxFormBusy ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => { setShowTaxonomyForm(false); setTaxFormError(null); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

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
          {taxonomy.length === 0 && <EmptyState message="No taxonomy entries yet." />}
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
          {currentUser?.role === "Admin" && (
            <button type="button" onClick={() => { setShowAddUser(true); setAddUserError(null); }}>
              + Add User
            </button>
          )}
        </div>

        {currentUser?.role === "Admin" && showAddUser && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">New Team Member</span>
                <h3>Add User</h3>
              </div>
            </div>
            <form className="form-grid" onSubmit={handleAddUser}>
              <label>
                Full Name
                <input
                  required
                  placeholder="e.g. Arun Sharma"
                  value={addUserName}
                  onChange={(e) => setAddUserName(e.target.value)}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  required
                  placeholder="user@circlechess.com"
                  value={addUserEmail}
                  onChange={(e) => setAddUserEmail(e.target.value)}
                />
              </label>
              <label>
                Role
                <select value={addUserRole} onChange={(e) => setAddUserRole(e.target.value)}>
                  <option>Builder</option>
                  <option>Knowledge Architect</option>
                  <option>Peer Reviewer</option>
                  <option>Admin</option>
                </select>
              </label>
              <label>
                Initial Password
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Min 8 characters"
                  value={addUserPassword}
                  onChange={(e) => setAddUserPassword(e.target.value)}
                />
              </label>
              {addUserError && <p className="login-error span-2">{addUserError}</p>}
              <div className="action-row span-2">
                <button type="submit" disabled={addUserBusy}>
                  {addUserBusy ? "Adding..." : "Add User"}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => { setShowAddUser(false); setAddUserError(null); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.email}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      {currentUser?.role === "Admin" ? (
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateUser(user.email, { role: e.target.value })}
                        >
                          <option>Builder</option>
                          <option>Knowledge Architect</option>
                          <option>Peer Reviewer</option>
                          <option>Admin</option>
                        </select>
                      ) : (
                        user.role
                      )}
                    </td>
                    <td>
                      <span className={`pill ${user.status === "Active" ? "success" : "danger"}`}>
                        {user.status}
                      </span>
                    </td>
                    <td>{user.joined}</td>
                    <td>
                      {currentUser?.role === "Admin" && (
                        <button
                          type="button"
                          className={user.status === "Active" ? "warning-button" : "ghost-button"}
                          onClick={() =>
                            handleUpdateUser(user.email, {
                              status: user.status === "Active" ? "Inactive" : "Active",
                            })
                          }
                        >
                          {user.status === "Active" ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </td>
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
    if (activePage === "admin") return renderAdminPage();

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
