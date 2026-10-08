import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { posRecharge, registerClient } from "./identity.js";
import { resetDb } from "./store.js";
import { postedBalance } from "./services.js";
import { loadDb } from "./store.js";

describe("Registro y recarga POS", () => {
  it("crea cliente LIVE con saldo 0 y sin exigir membresía", async () => {
    await resetDb();
    const r = await registerClient({
      name: "Nueva Demo",
      email: "nueva.wallet@smartclub.test",
      phone: "+593 99 1",
      password: "Demo2026!",
      termsAccepted: true,
      consentMarketing: false,
      wantMember: false,
    });
    assert.equal(r.user.isMember, false);
    assert.equal(r.user.role, "CLIENTE");
    const db = await loadDb();
    assert.equal(postedBalance(db, r.user.id), 0);
  });

  it("acredita recarga POS una sola vez y no la trata como venta", async () => {
    await resetDb();
    const key = "idem-pos-1";
    const first = await posRecharge({
      cashierId: "user-cajero",
      cashierName: "Caja",
      lookup: "SWC-ANA01",
      amountCents: 2000,
      tender: "cash_sim",
      idempotencyKey: key,
    });
    const second = await posRecharge({
      cashierId: "user-cajero",
      cashierName: "Caja",
      lookup: "SWC-ANA01",
      amountCents: 2000,
      tender: "cash_sim",
      idempotencyKey: key,
    });
    assert.equal(first.ok, true);
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    const db = await loadDb();
    const recs = db.recharges.filter((r) => r.userId === "user-general" && r.origin === "POS");
    assert.equal(recs.length, 1);
    assert.equal(postedBalance(db, "user-general"), 2000);
  });
});
