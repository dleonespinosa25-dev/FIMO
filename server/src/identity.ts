import { httpError, newId, nowIso } from "./money.js";
import { loadDb, mutate } from "./store.js";
import { ensureLiveCustomer } from "./intelligence/ingest.js";
import type { Database, FlowEvent, Role, User } from "./types.js";

function balanceOf(db: Database, userId: string) {
  return db.movements
    .filter((m) => m.userId === userId && m.status === "approved")
    .reduce((sum, m) => sum + m.signedAmountCents, 0);
}

const TTL_MS = 12 * 60 * 60 * 1000;

export function publicUser(user: User) {
  const { password: _pw, ...rest } = user;
  return rest;
}

export function bearer(req: { header: (n: string) => string | undefined }) {
  const h = req.header("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1];
}

export async function loginWithRole(email: string, password: string, allowed: Role[]) {
  return mutate((db) => {
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.dataset === "live");
    if (!user || !user.password || user.password !== password) {
      throw httpError(401, "Credenciales inválidas.", "AUTH");
    }
    if (!allowed.includes(user.role)) {
      throw httpError(403, "Este usuario no tiene permiso para este portal.", "FORBIDDEN_ROLE");
    }
    const token = newId("TOK");
    db.sessions = db.sessions.filter((s) => Date.parse(s.expiresAt) > Date.now());
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
    db.sessions.push({ token, userId: user.id, role: user.role, expiresAt });
    return { token, expiresAt, user: publicUser(user) };
  });
}

export async function logout(token: string | undefined) {
  if (!token) return { ok: true };
  return mutate((db) => {
    db.sessions = db.sessions.filter((s) => s.token !== token);
    return { ok: true };
  });
}

export async function requireRole(token: string | undefined, roles: Role[]) {
  if (!token) throw httpError(401, "Se requiere iniciar sesión.", "UNAUTHORIZED");
  const db = await loadDb();
  const session = db.sessions.find((s) => s.token === token);
  if (!session || Date.parse(session.expiresAt) <= Date.now()) {
    throw httpError(401, "Sesión expirada.", "UNAUTHORIZED");
  }
  const user = db.users.find((u) => u.id === session.userId);
  if (!user) throw httpError(401, "Usuario no encontrado.", "UNAUTHORIZED");
  if (!roles.includes(user.role)) {
    throw httpError(403, "No autorizado para esta operación.", "FORBIDDEN_ROLE");
  }
  return { user, session };
}

export function pushFlow(db: { flowEvents: FlowEvent[] }, event: Omit<FlowEvent, "id" | "at">) {
  db.flowEvents.unshift({
    id: newId("FLOW"),
    at: nowIso(),
    ...event,
  });
  db.flowEvents = db.flowEvents.slice(0, 120);
}

export async function registerClient(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  termsAccepted: boolean;
  consentMarketing: boolean;
  wantMember?: boolean;
}) {
  if (!input.termsAccepted) throw httpError(400, "Debe aceptar los términos del prototipo.", "TERMS");
  if (!input.name?.trim() || !input.email?.trim() || !input.password) {
    throw httpError(400, "Nombre, correo y contraseña son obligatorios.", "INVALID_REGISTER");
  }
  const created = await mutate((db) => {
    if (db.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw httpError(409, "Ese correo ya está registrado en el demo.", "EMAIL_TAKEN");
    }
    const id = newId("USR");
    const user: User = {
      id,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || "+593 00 000 0000",
      isMember: Boolean(input.wantMember),
      memberTier: input.wantMember ? "Socio SmartClub (demo)" : null,
      memberSince: input.wantMember ? nowIso().slice(0, 10) : null,
      role: "CLIENTE",
      password: input.password,
      customerCode: `SWC-${id.slice(-6).toUpperCase()}`,
      virtualCard: `SW-DEMO-${id.replace(/\D/g, "").slice(-4).padStart(4, "0")}-${id.slice(-4).toUpperCase()}`,
      consentMarketing: Boolean(input.consentMarketing),
      termsAccepted: true,
      dataset: "live",
    };
    db.users.push(user);
    const token = newId("TOK");
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
    db.sessions.push({ token, userId: user.id, role: "CLIENTE", expiresAt });
    pushFlow(db, {
      actorId: user.id,
      actorName: user.name,
      actorRole: "CLIENTE",
      action: "Registro y activación de SmartWallet (sin exigir membresía)",
      recordType: "user",
      recordId: user.id,
      movementId: null,
      commercialEvent: "customer.created",
      indicators: ["nuevos registros", "total clientes LIVE"],
      before: { exists: false, balanceCents: 0 },
      after: { customerCode: user.customerCode, virtualCard: user.virtualCard, isMember: user.isMember, balanceCents: 0 },
    });
    return { token, expiresAt, user: publicUser(user) };
  });
  try {
    await ensureLiveCustomer(created.user);
  } catch {
    /* analytics optional */
  }
  return created;
}

export function resolveClient(db: { users: User[] }, raw: string) {
  const code = raw.trim();
  const fromQr = code.startsWith("SMARTWALLET:ID:") ? code.slice("SMARTWALLET:ID:".length) : code;
  return db.users.find(
    (u) =>
      u.dataset === "live" &&
      u.role === "CLIENTE" &&
      (u.id === fromQr ||
        u.customerCode.toUpperCase() === fromQr.toUpperCase() ||
        u.virtualCard.replace(/\s/g, "") === fromQr.replace(/\s/g, "") ||
        u.email.toLowerCase() === fromQr.toLowerCase()),
  );
}

export async function posRecharge(input: {
  cashierId: string;
  cashierName: string;
  lookup: string;
  amountCents: number;
  tender: "cash_sim" | "card_sim";
  idempotencyKey: string;
}) {
  if (!input.idempotencyKey?.trim()) throw httpError(400, "Falta clave de idempotencia.", "MISSING_IDEMPOTENCY");
  return mutate((db) => {
    if (db.usedIdempotencyKeys[input.idempotencyKey]) {
      const recharge = db.recharges.find((r) => r.id === db.usedIdempotencyKeys[input.idempotencyKey]);
      return {
        ok: true,
        duplicate: true,
        recharge,
        message: "Esta recarga POS ya fue acreditada. El saldo no se volvió a sumar.",
      };
    }
    const client = resolveClient(db, input.lookup);
    if (!client) throw httpError(404, "No se identificó una billetera de cliente.", "WALLET_NOT_FOUND");
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw httpError(400, "Importe inválido.", "INVALID_AMOUNT");
    }
    const before = balanceOf(db, client.id);
    const rechargeId = newId("REC");
    const movementId = newId("MOV");
    const now = nowIso();
    db.movements.push({
      id: movementId,
      userId: client.id,
      type: "RECHARGE",
      status: "approved",
      amountCents: input.amountCents,
      signedAmountCents: input.amountCents,
      brandId: null,
      channel: "recharge",
      orderId: null,
      orderReference: null,
      rechargeId,
      relatedMovementId: null,
      description: `Recarga POS acreditada (cajero demo · ${input.tender === "cash_sim" ? "efectivo simulado" : "tarjeta simulada"})`,
      receiptCode: `RCPOS-${rechargeId.slice(-8)}`,
      createdAt: now,
      postedAt: now,
    });
    const recharge = {
      id: rechargeId,
      userId: client.id,
      amountCents: input.amountCents,
      status: "approved" as const,
      processorRef: newId("POSMOCK"),
      movementId,
      createdAt: now,
      settledAt: now,
      origin: "POS" as const,
      tender: input.tender,
      cashierId: input.cashierId,
    };
    db.recharges.push(recharge);
    db.usedIdempotencyKeys[input.idempotencyKey] = rechargeId;
    const after = balanceOf(db, client.id);
    pushFlow(db, {
      actorId: input.cashierId,
      actorName: input.cashierName,
      actorRole: "CAJERO_DEMO",
      action: "Recarga en caja física (POS)",
      recordType: "recharge",
      recordId: rechargeId,
      movementId,
      commercialEvent: null,
      indicators: ["volumen recargado", "saldo agregado", "recargas POS"],
      before: { customer: client.name, balanceCents: before },
      after: { balanceCents: after, origin: "POS", amountCents: input.amountCents, note: "La recarga no es una venta comercial." },
    });
    return {
      ok: true,
      duplicate: false,
      recharge,
      client: publicUser(client),
      balanceCents: after,
      receipt: {
        title: "Comprobante de recarga POS (ficticio)",
        disclaimer: "No es un comprobante fiscal ni bancario.",
        receiptCode: `RCPOS-${rechargeId.slice(-8)}`,
        origin: "POS",
      },
    };
  });
}

export async function recentFlow() {
  const db = await loadDb();
  return {
    disclaimer: "Monitor privado. Solo muestra cuentas LIVE del prototipo, no el laboratorio masivo ni datos reales.",
    events: db.flowEvents.slice(0, 40),
  };
}
