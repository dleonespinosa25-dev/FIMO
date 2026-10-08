const USER_KEY = "smartwallet.demoUserId";
const TOKEN_KEY = "smartwallet.clientToken";

export function getUserId() {
  return localStorage.getItem(USER_KEY) || "user-general";
}

export function setUserId(id: string) {
  localStorage.setItem(USER_KEY, id);
}

export function getSession() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

const POS_KEY = "smartwallet.posToken";
export function getPosSession() {
  return sessionStorage.getItem(POS_KEY);
}
export function setPosSession(token: string | null) {
  if (token) sessionStorage.setItem(POS_KEY, token);
  else sessionStorage.removeItem(POS_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = path.startsWith("/api/pos/") && !path.includes("login") ? getPosSession() : getSession();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Demo-User-Id": getUserId(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Error de demostración") as Error & {
      status: number;
      payload: unknown;
    };
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data as T;
}

export const api = {
  catalog: () => request("/api/catalog"),
  wallet: () => request("/api/wallet"),
  movement: (id: string) => request(`/api/wallet/movements/${id}`),
  recharge: (amountCents: number) =>
    request("/api/recharges", { method: "POST", body: JSON.stringify({ amountCents }) }),
  settleRecharge: (id: string, outcome: "approved" | "rejected") =>
    request(`/api/recharges/${id}/simulate`, { method: "POST", body: JSON.stringify({ outcome }) }),
  createOrder: (body: unknown) => request("/api/orders", { method: "POST", body: JSON.stringify(body) }),
  getOrder: (id: string) => request(`/api/orders/${id}`),
  confirmPay: (body: unknown) =>
    request("/api/payments/confirm", { method: "POST", body: JSON.stringify(body) }),
  cancelPay: (body: unknown) =>
    request("/api/payments/cancel", { method: "POST", body: JSON.stringify(body) }),
  checkout: (body: unknown) =>
    request("/api/online/checkout", { method: "POST", body: JSON.stringify(body) }),
  refund: (movementId: string) =>
    request("/api/refunds", { method: "POST", body: JSON.stringify({ movementId }) }),
  admin: () => request("/api/admin/stats"),
  reset: () => request("/api/demo/reset", { method: "POST" }),
  register: (body: unknown) => request("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (email: string, password: string) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  posLogin: (email: string, password: string) =>
    request("/api/pos/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  posRecharge: (body: unknown) => request("/api/pos/recharges", { method: "POST", body: JSON.stringify(body) }),
};
