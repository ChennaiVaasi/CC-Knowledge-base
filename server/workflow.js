export const STATUSES = Object.freeze({
  NEW: "New",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  SUBMITTED: "Submitted",
  CHANGES_REQUESTED: "Changes Requested",
  PEER_REVIEW: "Peer Review",
  APPROVED: "Approved",
  PUBLISHED: "Published",
});

export const ACTIONS = Object.freeze({
  ASSIGN: "assign",
  UNASSIGN: "unassign",
  SAVE: "save",
  SUBMIT: "submit",
  REQUEST_CHANGES: "request_changes",
  ARCHITECT_APPROVE: "architect_approve",
  PEER_APPROVE: "peer_approve",
  PUBLISH: "publish",
});

const transitions = [
  { from: [STATUSES.NEW, STATUSES.ASSIGNED], action: ACTIONS.ASSIGN, to: STATUSES.ASSIGNED, roles: ["Admin", "Knowledge Architect"] },
  { from: [STATUSES.NEW, STATUSES.ASSIGNED], action: ACTIONS.UNASSIGN, to: STATUSES.NEW, roles: ["Admin", "Knowledge Architect"] },
  { from: [STATUSES.ASSIGNED, STATUSES.IN_PROGRESS, STATUSES.CHANGES_REQUESTED], action: ACTIONS.SAVE, to: STATUSES.IN_PROGRESS, roles: ["Builder"] },
  { from: [STATUSES.ASSIGNED, STATUSES.IN_PROGRESS, STATUSES.CHANGES_REQUESTED], action: ACTIONS.SUBMIT, to: STATUSES.SUBMITTED, roles: ["Builder"] },
  { from: [STATUSES.SUBMITTED], action: ACTIONS.REQUEST_CHANGES, to: STATUSES.CHANGES_REQUESTED, roles: ["Admin", "Knowledge Architect"] },
  { from: [STATUSES.SUBMITTED], action: ACTIONS.ARCHITECT_APPROVE, to: STATUSES.PEER_REVIEW, roles: ["Admin", "Knowledge Architect"] },
  { from: [STATUSES.PEER_REVIEW], action: ACTIONS.REQUEST_CHANGES, to: STATUSES.CHANGES_REQUESTED, roles: ["Admin", "Peer Reviewer"] },
  { from: [STATUSES.PEER_REVIEW], action: ACTIONS.PEER_APPROVE, to: STATUSES.APPROVED, roles: ["Admin", "Peer Reviewer"] },
  { from: [STATUSES.APPROVED, STATUSES.PUBLISHED], action: ACTIONS.PUBLISH, to: STATUSES.PUBLISHED, roles: ["Admin", "Knowledge Architect"] },
];

export function transitionFor(status, action, role) {
  const rule = transitions.find((candidate) => candidate.action === action && candidate.from.includes(status));
  if (!rule) return { ok: false, code: "INVALID_WORKFLOW_STATE", error: `Cannot ${action} content in ${status} state` };
  if (!rule.roles.includes(role)) return { ok: false, code: "PERMISSION_DENIED", error: `${role} cannot ${action} content` };
  return { ok: true, nextStatus: rule.to };
}

export function submissionMissing(position) {
  const missing = [];
  if (!String(position.fen ?? "").trim() && !String(position.raw_pgn ?? position.pgn ?? "").trim()) missing.push("Position source (FEN or PGN)");
  if (!String(position.concept ?? "").trim()) missing.push("Concept");
  if (!String(position.learning_outcome ?? position.learningOutcome ?? "").trim()) missing.push("Learning Outcome");
  const tags = position.broad_tags ?? position.broadTags;
  if (!Array.isArray(tags) || tags.length === 0) missing.push("Domain / tags");
  return missing;
}

const BUILDER_EDITABLE_FIELDS = new Set(["title", "learningOutcome", "solves", "concept", "broadTags", "expectedRevision"]);
const PEER_REVIEWER_EDITABLE_FIELDS = new Set(["title", "expectedRevision"]);

export function canEditPositionFields(role, status, fields) {
  if (role === "Builder") {
    const editableStatus = [STATUSES.ASSIGNED, STATUSES.IN_PROGRESS, STATUSES.CHANGES_REQUESTED].includes(status);
    return editableStatus && fields.every((field) => BUILDER_EDITABLE_FIELDS.has(field));
  }
  if (role === "Peer Reviewer") {
    return status === STATUSES.PEER_REVIEW && fields.every((field) => PEER_REVIEWER_EDITABLE_FIELDS.has(field));
  }
  return role === "Admin" || role === "Knowledge Architect";
}

export function snapshotPosition(position) {
  return {
    id: position.id,
    title: position.title,
    subtitle: position.subtitle,
    fen: position.fen,
    rawPgn: position.raw_pgn ?? position.rawPgn ?? "",
    broadTags: position.broad_tags ?? position.broadTags ?? [],
    source: position.source,
    rating: position.rating,
    learningOutcome: position.learning_outcome ?? position.learningOutcome ?? "",
    solves: position.solves,
    concept: position.concept,
    builder: position.builder,
    revision: Number(position.revision),
  };
}
