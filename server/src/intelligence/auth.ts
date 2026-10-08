import { httpError, newId } from "../money.js";
import { mutateIntel, loadIntel } from "./store.js";
import type { CorporateUser } from "./types.js";

const TTL_MS = 8 * 60 * 60 * 1000;

export function publicUser(user: CorporateUser) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function login(email: string, password: string) {
  return mutateIntel((db) => {
    const user = db.corporateUsers.find((u) => u.email.toLowerCase() === String(email || "").toLowerCase());
    if (!user || user.password !== password) {
      throw httpError(401, "Credenciales corporativas inválidas.", "INTEL_AUTH");
    }
    const token = newId("SITOK");
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
    db.sessions = db.sessions.filter((s) => Date.parse(s.expiresAt) > Date.now());
    db.sessions.push({ token, userId: user.id, expiresAt });
    return { token, expiresAt, user: publicUser(user) };
  });
}

export async function logout(token: string | undefined) {
  if (!token) return { ok: true };
  return mutateIntel((db) => {
    db.sessions = db.sessions.filter((s) => s.token !== token);
    return { ok: true };
  });
}

export async function requireCorporate(token: string | undefined) {
  if (!token) throw httpError(401, "Se requiere sesión corporativa.", "INTEL_UNAUTHORIZED");
  const db = await loadIntel();
  const session = db.sessions.find((s) => s.token === token);
  if (!session || Date.parse(session.expiresAt) <= Date.now()) {
    throw httpError(401, "Sesión corporativa expirada o inválida.", "INTEL_UNAUTHORIZED");
  }
  const user = db.corporateUsers.find((u) => u.id === session.userId);
  if (!user) throw httpError(401, "Usuario corporativo no encontrado.", "INTEL_UNAUTHORIZED");
  return { user, token };
}

export function bearer(req: { header: (n: string) => string | undefined }) {
  const h = req.header("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1];
}
