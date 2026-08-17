export type PipelineStatus =
  | "NEW"
  | "TRIAGED"
  | "ASSIGNED"
  | "BUILDING"
  | "REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "HOLD";

export type Role = "architect" | "builder";

export type Priority = "Low" | "Medium" | "High" | "Urgent";

export type Domain =
  | "Tactics"
  | "Strategy"
  | "Endgame"
  | "Opening"
  | "Calculation"
  | "Pawn Structure"
  | "King Safety";

export interface BuilderProfile {
  id: string;
  name: string;
  specialties: Domain[];
}

export interface Concept {
  id: string;
  name: string;
  domain: Domain;
  majorTopic: string;
  ratingIntroduction: string;
  definition: string;
  whatIsIt: string;
  recognition: string;
  playerNoticeProcess: string;
  importance: string;
  whyItMatters: string;
  normalAction: string;
  practicalAction: string;
  commonMistakes: string[];
  misunderstanding: string;
  relatedConcepts: string[];
  prerequisites: string[];
  atomicNodes: AtomicNode[];
  status: "Draft" | "Approved";
  createdBy: string;
  approvedBy?: string;
}

export interface AtomicNode {
  id: string;
  name: string;
  description: string;
  rating: string;
}

export interface Position {
  id: string;
  fen: string;
  sideToMove: "w" | "b";
  sourceType: "Generator" | "Game Import" | "Manual";
  sourceName: string;
  sourceId: string;
  generatorBatch?: string;
  createdAt: string;
  status: PipelineStatus;
  priority: Priority;
  rating: string;
  engineEval?: string;
  bestMove?: string;
  pv?: string;
  suggestedConceptId?: string;
  primaryConceptId?: string;
  atomicNodeIds: string[];
  teachingMode?: string;
  taskType?: string;
  difficulty?: string;
  whatPositionTeaches: string;
  weaknessItSolves: string;
  expectedMoveOrPlan: string;
  teachingExampleReason: string;
  builderId?: string;
  architectId?: string;
  architectNotes?: string;
  reviewComment?: string;
  rejectionReason?: string;
  approvedAt?: string;
  submittedAt?: string;
  pgn?: string;
}

export interface ReviewEntry {
  id: string;
  positionId: string;
  architectId: string;
  decision: "Approve" | "Request Changes" | "Reject";
  reasons: string[];
  comment: string;
  createdAt: string;
}

export interface ImportDraft {
  sourceType: Position["sourceType"];
  sourceName: string;
  sourceId: string;
  fen: string;
  pgn: string;
  sideToMove: "w" | "b";
  rating: string;
}

export type Screen =
  | "dashboard"
  | "inbox"
  | "builderQueue"
  | "positionBuilder"
  | "reviewQueue"
  | "conceptRegistry"
  | "approvedLibrary";

export interface AppState {
  concepts: Concept[];
  positions: Position[];
  reviews: ReviewEntry[];
  builders: BuilderProfile[];
  activeScreen: Screen;
  activePositionId: string;
  activeBuilderId: string;
  currentRole: Role;
}
