import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recordWalletPurchase } from "./ingest.js";
import { loadIntel, resetIntel } from "./store.js";
import type { Movement, PaymentOrder } from "../types.js";

function orderFixture(): { order: PaymentOrder; movement: Movement } {
  const order: PaymentOrder = {
    id: "ORD-TEST-DUP-1",
    reference: "SWPAY-TEST-1",
    brandId: "farmacias-economicas",
    channel: "online",
    items: [],
    subtotalCents: 1000,
    discountCents: 0,
    totalCents: 1000,
    discountLabel: null,
    status: "approved",
    userId: "user-general",
    movementId: "MOV-TEST-1",
    idempotencyKey: "idem-1",
    createdAt: "2026-10-08T12:00:00.000Z",
    updatedAt: "2026-10-08T12:00:00.000Z",
    paidAt: "2026-10-08T12:00:00.000Z",
  };
  const movement: Movement = {
    id: "MOV-TEST-1",
    userId: "user-general",
    type: "PAYMENT",
    status: "approved",
    amountCents: 1000,
    signedAmountCents: -1000,
    brandId: "farmacias-economicas",
    channel: "online",
    orderId: order.id,
    orderReference: order.reference,
    rechargeId: null,
    relatedMovementId: null,
    description: "pago test",
    receiptCode: "COMP-TEST",
    createdAt: order.paidAt!,
    postedAt: order.paidAt,
  };
  return { order, movement };
}

describe("Ingesta comercial desde SmartWallet", () => {
  it("registra una compra de billetera una sola vez", async () => {
    await resetIntel();
    const { order, movement } = orderFixture();
    const first = await recordWalletPurchase(order, movement);
    const second = await recordWalletPurchase(order, movement);
    assert.equal(first.recorded, true);
    assert.equal("duplicate" in second && second.duplicate, true);
    const db = await loadIntel();
    const copies = db.sales.filter((s) => s.walletOrderId === order.id);
    assert.equal(copies.length, 1);
  });

  it("ignora un movimiento que no es pago aprobado", async () => {
    await resetIntel();
    const { order, movement } = orderFixture();
    movement.type = "RECHARGE";
    const res = await recordWalletPurchase(order, movement);
    assert.equal(res.recorded, false);
  });
});
