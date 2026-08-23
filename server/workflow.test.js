import test from "node:test";
import assert from "node:assert/strict";
import { ACTIONS, STATUSES, snapshotPosition, submissionMissing, transitionFor } from "./workflow.js";

test("workflow rejects bypasses and stale repeated decisions", () => {
  assert.equal(transitionFor(STATUSES.ASSIGNED, ACTIONS.PEER_APPROVE, "Peer Reviewer").code, "INVALID_WORKFLOW_STATE");
  assert.equal(transitionFor(STATUSES.SUBMITTED, ACTIONS.ARCHITECT_APPROVE, "Builder").code, "PERMISSION_DENIED");
  assert.equal(transitionFor(STATUSES.PEER_REVIEW, ACTIONS.PEER_APPROVE, "Peer Reviewer").nextStatus, STATUSES.APPROVED);
  assert.equal(transitionFor(STATUSES.APPROVED, ACTIONS.PEER_APPROVE, "Peer Reviewer").code, "INVALID_WORKFLOW_STATE");
});

test("submission validation reports every missing instructional field", () => {
  assert.deepEqual(submissionMissing({ fen: "", concept: "", learning_outcome: "", broad_tags: [] }), [
    "Position source (FEN or PGN)", "Concept", "Learning Outcome", "Domain / tags",
  ]);
});

test("approved snapshots preserve chess source and taxonomy exactly", () => {
  const row = { id: "p1", title: "Unicode ♟", subtitle: "", fen: "8/8/8/8/8/8/4K3/7k w - - 0 1", raw_pgn: "[SetUp \"1\"]\n[FEN \"8/8/8/8/8/8/4K3/7k w - - 0 1\"]\n\n*", broad_tags: ["Endgame", "Opposition"], learning_outcome: "Learn", solves: "", concept: "Opposition", builder: "A", revision: 7 };
  const snapshot = snapshotPosition(row);
  assert.equal(snapshot.rawPgn, row.raw_pgn);
  assert.equal(snapshot.fen, row.fen);
  assert.deepEqual(snapshot.broadTags, row.broad_tags);
  assert.equal(snapshot.revision, 7);
});

test("happy path and change-request path follow the complete state machine", () => {
  let status = STATUSES.NEW;
  const step = (action, role) => {
    const result = transitionFor(status, action, role);
    assert.equal(result.ok, true, `${status} -> ${action}`);
    status = result.nextStatus;
  };
  step(ACTIONS.ASSIGN, "Knowledge Architect");
  step(ACTIONS.SAVE, "Builder");
  step(ACTIONS.SUBMIT, "Builder");
  step(ACTIONS.REQUEST_CHANGES, "Knowledge Architect");
  step(ACTIONS.SAVE, "Builder");
  step(ACTIONS.SUBMIT, "Builder");
  step(ACTIONS.ARCHITECT_APPROVE, "Knowledge Architect");
  step(ACTIONS.PEER_APPROVE, "Peer Reviewer");
  step(ACTIONS.PUBLISH, "Knowledge Architect");
  assert.equal(status, STATUSES.PUBLISHED);
});
