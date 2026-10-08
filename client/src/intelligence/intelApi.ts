const TOKEN_KEY = "smartintel.token";

export function getIntelToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setIntelToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

async function intelRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getIntelToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    setIntelToken(null);
    const err = new Error(data.error || "Sesión corporativa requerida") as Error & { status: number };
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    throw new Error(data.error || "Error de Smart Intelligence");
  }
  return data as T;
}

export const intelApi = {
  login: (email: string, password: string) =>
    intelRequest<{ token: string; user: { name: string; email: string; role: string } }>(
      "/api/intelligence/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    ),
  logout: () => intelRequest("/api/intelligence/logout", { method: "POST" }),
  me: () => intelRequest<{ user: { name: string; email: string; role: string } }>("/api/intelligence/me"),
  overview: (qs: string) => intelRequest<Record<string, unknown>>(`/api/intelligence/overview${qs}`),
  customers: (qs: string) => intelRequest<{ total: number; customers: CustomerRow[] }>(`/api/intelligence/customers${qs}`),
  customer: (id: string) => intelRequest<Record<string, unknown>>(`/api/intelligence/customers/${id}`),
  segmentation: (qs: string) => intelRequest<Record<string, unknown>>(`/api/intelligence/segmentation${qs}`),
  clv: (qs: string) => intelRequest<Record<string, unknown>>(`/api/intelligence/clv${qs}`),
  patchAssumptions: (body: unknown) =>
    intelRequest("/api/intelligence/assumptions", { method: "PATCH", body: JSON.stringify(body) }),
  cross: (qs: string) => intelRequest<Record<string, unknown>>(`/api/intelligence/cross-brand${qs}`),
  nba: (qs: string) => intelRequest<{ methodNote: string; total: number; recommendations: NbaRow[] }>(`/api/intelligence/nba${qs}`),
  nbaDecision: (id: string, status: "approved" | "rejected") =>
    intelRequest(`/api/intelligence/nba/${id}/decision`, { method: "POST", body: JSON.stringify({ status }) }),
  campaigns: () => intelRequest<{ disclaimer: string; campaigns: CampaignRow[] }>("/api/intelligence/campaigns"),
  campaignDecision: (id: string, status: "approved" | "rejected") =>
    intelRequest(`/api/intelligence/campaigns/${id}/decision`, { method: "POST", body: JSON.stringify({ status }) }),
  campaignSimulate: (id: string) =>
    intelRequest(`/api/intelligence/campaigns/${id}/simulate`, { method: "POST" }),
  wallet: () => intelRequest<Record<string, unknown>>("/api/intelligence/wallet-performance"),
  reset: () => intelRequest("/api/intelligence/reset", { method: "POST" }),
  flow: () => intelRequest<{ disclaimer: string; events: FlowEvt[] }>("/api/intelligence/flow"),
  lab: () => intelRequest<Record<string, unknown>>("/api/intelligence/lab"),
  labGenerate: (n: number) =>
    intelRequest<Record<string, unknown>>("/api/intelligence/lab/generate", { method: "POST", body: JSON.stringify({ n }) }),
};

export interface FlowEvt {
  id: string;
  at: string;
  actorName: string;
  actorRole: string;
  action: string;
  recordType: string;
  recordId: string;
  commercialEvent: string | null;
  indicators: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface CustomerRow {
  id: string;
  name: string;
  isMember: boolean;
  segment: string;
  recencyDays: number | null;
  purchaseCount: number;
  revenueCents: number;
  netContributionCents: number;
  projectedClvCents: number | null;
  clvConfidence: string;
  churnLabel: string;
  churnScore: number;
  brands: number;
}

export interface NbaRow {
  customerId: string;
  customerName: string;
  action: string;
  actionLabel: string;
  reason: string;
  segment: string;
  expectedCostCents: number;
  expectedIncrementalContributionCents: number;
  risks: string[];
  assumptions: string[];
  eligibility: string;
  approvalStatus: "pending" | "approved" | "rejected";
  wouldBuyAnyway: boolean;
}

export interface CampaignRow {
  id: string;
  name: string;
  type: string;
  status: string;
  segment: string;
  incentiveCentsPerCustomer: number;
  budgetCents: number;
  notes: string;
  observed: Record<string, unknown> | null;
  simulated: Record<string, unknown> | null;
}
