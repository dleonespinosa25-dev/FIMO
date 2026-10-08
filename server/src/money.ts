export function assertPositiveCents(amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw Object.assign(new Error("El monto debe ser un valor positivo en centavos."), {
      status: 400,
      code: "INVALID_AMOUNT",
    });
  }
}

export function centsToUsd(cents: number) {
  return cents / 100;
}

export function percentOf(cents: number, percent: number) {
  return Math.round((cents * percent) / 100);
}

export function newId(prefix: string) {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `${prefix}-${rand}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function httpError(status: number, message: string, code: string) {
  return Object.assign(new Error(message), { status, code });
}
