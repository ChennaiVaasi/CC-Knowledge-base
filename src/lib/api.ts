export type PositionStatus =
  | "New"
  | "Assigned"
  | "In Progress"
  | "Submitted"
  | "Changes Requested"
  | "Peer Review"
  | "Approved"
  | "Published";

export type PoolRow = {
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
  teachingFocus: string;
  similarity: number;
  concept: string;
  rawPgn: string;
  revision: number;
  updatedAt: string;
};

export type SimilarityCard = {
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

export type ApprovedCard = {
  concept: string;
  domain: string;
  topic: string;
  types: string[];
  positions: number;
  updated: string;
  coverage: string;
};

export type TaxonomyNode = {
  domain: string;
  topics: {
    name: string;
    concepts: string[];
  }[];
};

export type UserRow = {
  name: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
  joined: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<UserRow>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<UserRow>("/api/auth/me"),
  getBuilders: () => request<string[]>("/api/builders"),
  getPositions: () => request<PoolRow[]>("/api/positions"),
  createPosition: (data: Partial<PoolRow> & { title: string; fen: string }) =>
    request<PoolRow>("/api/positions", { method: "POST", body: JSON.stringify(data) }),
  updatePosition: (id: string, data: Partial<PoolRow> & { expectedRevision?: number }) =>
    request<PoolRow>(`/api/positions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  actOnPosition: (id: string, data: { action: string; expectedRevision: number; builder?: string; comment?: string }) =>
    request<PoolRow>(`/api/positions/${encodeURIComponent(id)}/actions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getUsers: () => request<UserRow[]>("/api/users"),
  createUser: (data: { name: string; email: string; role: string; password: string }) =>
    request<UserRow>("/api/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (email: string, data: { status?: string; role?: string }) =>
    request<UserRow>(`/api/users/${encodeURIComponent(email)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  getTaxonomy: () => request<TaxonomyNode[]>("/api/taxonomy"),
  createDomain: (domain: string) =>
    request<TaxonomyNode>("/api/taxonomy/domains", { method: "POST", body: JSON.stringify({ domain }) }),
  createTopic: (domain: string, topic: string) =>
    request<TaxonomyNode>(
      `/api/taxonomy/domains/${encodeURIComponent(domain)}/topics`,
      { method: "POST", body: JSON.stringify({ topic }) },
    ),
  createConcept: (domain: string, topic: string, concept: string) =>
    request<TaxonomyNode>(
      `/api/taxonomy/domains/${encodeURIComponent(domain)}/topics/${encodeURIComponent(topic)}/concepts`,
      { method: "POST", body: JSON.stringify({ concept }) },
    ),
  getSimilarity: () => request<SimilarityCard[]>("/api/similarity"),
  getApproved: () => request<ApprovedCard[]>("/api/approved"),
  elaborateTeachingDetail: (data: {
    field: "learningOutcome" | "solves";
    text: string;
    context: Record<string, string>;
  }) => request<{ text: string }>("/api/ai/elaborate", { method: "POST", body: JSON.stringify(data) }),
};
