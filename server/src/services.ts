import { httpError, newId, nowIso, percentOf, assertPositiveCents } from "./money.js";
import { loadDb, mutate } from "./store.js";
import { markWalletSaleRefunded, recordWalletPurchase } from "./intelligence/ingest.js";
import { pushFlow } from "./identity.js";
import type {
  BrandId,
  Database,
  Movement,
  OrderItem,
  PaymentOrder,
  User,
} from "./types.js";

export function postedBalance(db: Database, userId: string) {
  return db.movements
    .filter((m) => m.userId === userId && m.status === "approved")
    .reduce((sum, m) => sum + m.signedAmountCents, 0);
}

export function getUser(db: Database, userId: string) {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw httpError(404, "Usuario de demostración no encontrado.", "USER_NOT_FOUND");
  return user;
}

function getBrand(db: Database, brandId: string) {
  const brand = db.brands.find((b) => b.id === brandId);
  if (!brand) throw httpError(404, "Marca de demostración no encontrada.", "BRAND_NOT_FOUND");
  return brand;
}

export async function walletSnapshot(userId: string) {
  const db = await loadDb();
  const user = getUser(db, userId);
  const balanceCents = postedBalance(db, userId);
  const movements = db.movements
    .filter((m) => m.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    disclaimer: "Fondos ficticios de demostración. No es dinero real ni un depósito bancario.",
    user,
    balanceCents,
    currency: "USD",
    membershipIndependent:
      "SmartWallet está disponible para cualquier usuario registrado. La membresía SmartClub es opcional y no condiciona el uso de la billetera.",
    movements,
  };
}

export async function requestRecharge(userId: string, amountCents: number) {
  assertPositiveCents(amountCents);
  return mutate((db) => {
    getUser(db, userId);
    const rechargeId = newId("REC");
    const movementId = newId("MOV");
    const createdAt = nowIso();
    const movement: Movement = {
      id: movementId,
      userId,
      type: "RECHARGE",
      status: "pending",
      amountCents,
      signedAmountCents: 0,
      brandId: null,
      channel: "recharge",
      orderId: null,
      orderReference: null,
      rechargeId,
      relatedMovementId: null,
      description: "Recarga en procesamiento simulado",
      receiptCode: null,
      createdAt,
      postedAt: null,
    };
    db.movements.push(movement);
    const recharge = {
      id: rechargeId,
      userId,
      amountCents,
      status: "pending" as const,
      processorRef: newId("PAYMOCK"),
      movementId,
      createdAt,
      settledAt: null,
    };
    db.recharges.push({
      ...recharge,
      origin: "APP",
      tender: "processor_sim",
      cashierId: null,
    });
    return { recharge: db.recharges.at(-1), movement, processor: "Payment Provider Mock — sin banco real", origin: "APP" };
  });
}

export async function settleRecharge(rechargeId: string, outcome: "approved" | "rejected") {
  return mutate((db) => {
    const recharge = db.recharges.find((r) => r.id === rechargeId);
    if (!recharge) throw httpError(404, "Recarga no encontrada.", "RECHARGE_NOT_FOUND");
    const movement = db.movements.find((m) => m.id === recharge.movementId);
    if (!movement) throw httpError(404, "Movimiento de recarga no encontrado.", "MOVEMENT_NOT_FOUND");

    if (recharge.status !== "pending") {
      return {
        recharge,
        movement,
        alreadySettled: true,
        message: "La recarga ya fue procesada. El saldo no se vuelve a modificar.",
      };
    }

    const settledAt = nowIso();
    recharge.status = outcome;
    recharge.settledAt = settledAt;
    movement.status = outcome;
    movement.postedAt = settledAt;

    if (outcome === "approved") {
      movement.signedAmountCents = recharge.amountCents;
      movement.type = "RECHARGE";
      movement.description = "Recarga APP aprobada (simulador · no es una venta)";
      movement.receiptCode = `RC-${recharge.id.slice(-8)}`;
    } else {
      movement.signedAmountCents = 0;
      movement.type = "RECHARGE_REJECTED";
      movement.description = "Recarga rechazada por el simulador. El saldo no cambió.";
      movement.receiptCode = null;
    }

    const before = postedBalance(db, recharge.userId) - (outcome === "approved" ? recharge.amountCents : 0);
    const after = postedBalance(db, recharge.userId);
    const actor = getUser(db, recharge.userId);
    if (outcome === "approved") {
      pushFlow(db, {
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: "Recarga desde la aplicación (APP)",
        recordType: "recharge",
        recordId: recharge.id,
        movementId: movement.id,
        commercialEvent: null,
        indicators: ["volumen recargado", "saldo de billetera", "recargas APP"],
        before: { balanceCents: before },
        after: { balanceCents: after, origin: "APP", note: "Recarga no contabilizada como venta." },
      });
    }
    return {
      recharge,
      movement,
      alreadySettled: false,
      balanceCents: after,
    };
  });
}

function buildItems(db: Database, brandId: BrandId, rawItems: { productId: string; quantity: number }[]) {
  if (!rawItems?.length) throw httpError(400, "La orden debe incluir productos.", "EMPTY_CART");
  const items: OrderItem[] = rawItems.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw httpError(400, "La cantidad debe ser un entero positivo.", "INVALID_QTY");
    }
    const product = db.products.find((p) => p.id === line.productId && p.brandId === brandId);
    if (!product) throw httpError(400, "Producto no válido para la marca seleccionada.", "INVALID_PRODUCT");
    return {
      productId: product.id,
      name: product.name,
      quantity: line.quantity,
      unitPriceCents: product.priceCents,
      lineTotalCents: product.priceCents * line.quantity,
    };
  });
  const subtotalCents = items.reduce((s, i) => s + i.lineTotalCents, 0);
  return { items, subtotalCents };
}

function pricingForUser(db: Database, user: User | null, subtotalCents: number) {
  const eligible = Boolean(user?.isMember);
  const percent = eligible ? db.membership.demoDiscountPercent : 0;
  const discountCents = percentOf(subtotalCents, percent);
  return {
    discountCents,
    totalCents: subtotalCents - discountCents,
    discountLabel: eligible
      ? `Descuento socio demo ${percent}% (ficticio)`
      : null,
    membershipNote: db.membership.note,
  };
}

export async function createPaymentOrder(input: {
  brandId: BrandId;
  channel: "physical" | "online";
  items: { productId: string; quantity: number }[];
  userId?: string | null;
}) {
  return mutate((db) => {
    getBrand(db, input.brandId);
    const { items, subtotalCents } = buildItems(db, input.brandId, input.items);
    const user = input.userId ? getUser(db, input.userId) : null;
    const pricing = pricingForUser(db, user, subtotalCents);
    const createdAt = nowIso();
    const order: PaymentOrder = {
      id: newId("ORD"),
      reference: newId("SWPAY"),
      brandId: input.brandId,
      channel: input.channel,
      items,
      subtotalCents,
      discountCents: pricing.discountCents,
      totalCents: pricing.totalCents,
      discountLabel: pricing.discountLabel,
      status: "pending",
      userId: user?.id ?? null,
      movementId: null,
      idempotencyKey: null,
      createdAt,
      updatedAt: createdAt,
      paidAt: null,
    };
    db.orders.push(order);
    return { order, qrPayload: qrPayload(order.reference), membershipNote: db.membership.note };
  });
}

export function qrPayload(reference: string) {
  return `SMARTWALLET:PAY:${reference}`;
}

export async function getOrder(orderIdOrRef: string, viewerUserId?: string) {
  const db = await loadDb();
  const order = findOrder(db, orderIdOrRef);
  if (!order) throw httpError(404, "Orden de pago no encontrada.", "ORDER_NOT_FOUND");
  const viewer = viewerUserId ? getUser(db, viewerUserId) : order.userId ? getUser(db, order.userId) : null;
  const livePricing =
    order.status === "pending" ? pricingForUser(db, viewer, order.subtotalCents) : null;
  const preview = livePricing
    ? {
        ...order,
        discountCents: livePricing.discountCents,
        totalCents: livePricing.totalCents,
        discountLabel: livePricing.discountLabel,
      }
    : order;
  const brand = getBrand(db, order.brandId);
  return {
    order: preview,
    brand,
    qrPayload: qrPayload(order.reference),
    walletBalanceCents: viewer ? postedBalance(db, viewer.id) : null,
    membershipNote: db.membership.note,
    vendixBanner: "VENDIX SIMULATOR — NO CONECTADO A FARMAENLACE",
  };
}

function findOrder(db: Database, orderIdOrRef: string) {
  return db.orders.find((o) => o.id === orderIdOrRef || o.reference === orderIdOrRef);
}

export async function confirmPayment(input: {
  orderIdOrRef: string;
  userId: string;
  idempotencyKey: string;
}) {
  if (!input.idempotencyKey?.trim()) {
    throw httpError(400, "Se requiere una clave de idempotencia.", "MISSING_IDEMPOTENCY");
  }

  const result = await mutate((db) => {
    const user = getUser(db, input.userId);
    const existingKey = db.usedIdempotencyKeys[input.idempotencyKey];
    if (existingKey) {
      const existingOrder = db.orders.find((o) => o.id === existingKey);
      const existingMov = existingOrder?.movementId
        ? db.movements.find((m) => m.id === existingOrder.movementId)
        : undefined;
      return {
        ok: existingOrder?.status === "approved",
        duplicate: true,
        order: existingOrder,
        movement: existingMov,
        balanceCents: postedBalance(db, user.id),
        message: "La confirmación ya fue procesada. No se descontó dos veces.",
      };
    }

    const order = findOrder(db, input.orderIdOrRef);
    if (!order) throw httpError(404, "Orden de pago no encontrada.", "ORDER_NOT_FOUND");

    if (order.status === "approved") {
      db.usedIdempotencyKeys[input.idempotencyKey] = order.id;
      return {
        ok: true as const,
        duplicate: true,
        order,
        movement: db.movements.find((m) => m.id === order.movementId),
        balanceCents: postedBalance(db, user.id),
        message: "Esta orden ya estaba pagada. No se volvió a descontar.",
      };
    }

    if (order.status === "cancelled") {
      throw httpError(409, "La orden fue cancelada y no puede cobrarse.", "ORDER_CANCELLED");
    }
    if (order.status === "rejected") {
      throw httpError(409, "La orden ya fue rechazada.", "ORDER_REJECTED");
    }

    const pricing = pricingForUser(db, user, order.subtotalCents);
    order.discountCents = pricing.discountCents;
    order.totalCents = pricing.totalCents;
    order.discountLabel = pricing.discountLabel;
    order.userId = user.id;
    order.updatedAt = nowIso();

    const balance = postedBalance(db, user.id);
    if (balance < order.totalCents) {
      const rejected: Movement = {
        id: newId("MOV"),
        userId: user.id,
        type: "PAYMENT_REJECTED",
        status: "rejected",
        amountCents: order.totalCents,
        signedAmountCents: 0,
        brandId: order.brandId,
        channel: order.channel,
        orderId: order.id,
        orderReference: order.reference,
        rechargeId: null,
        relatedMovementId: null,
        description: "Intento de pago rechazado por saldo insuficiente",
        receiptCode: null,
        createdAt: nowIso(),
        postedAt: null,
      };
      db.movements.push(rejected);
      order.status = "rejected";
      order.movementId = rejected.id;
      db.usedIdempotencyKeys[input.idempotencyKey] = order.id;
      return {
        ok: false as const,
        code: "INSUFFICIENT_FUNDS",
        error: "Saldo insuficiente. El cobro no se realizó.",
        duplicate: false,
        order,
        movement: rejected,
        balanceCents: balance,
        totalCents: order.totalCents,
      };
    }

    const paidAt = nowIso();
    const movement: Movement = {
      id: newId("MOV"),
      userId: user.id,
      type: "PAYMENT",
      status: "approved",
      amountCents: order.totalCents,
      signedAmountCents: -order.totalCents,
      brandId: order.brandId,
      channel: order.channel,
      orderId: order.id,
      orderReference: order.reference,
      rechargeId: null,
      relatedMovementId: null,
      description: `Pago ${order.channel === "physical" ? "presencial" : "online"} en ${getBrand(db, order.brandId).name}`,
      receiptCode: `COMP-${order.reference.slice(-8)}`,
      createdAt: paidAt,
      postedAt: paidAt,
    };
    db.movements.push(movement);
    order.status = "approved";
    order.movementId = movement.id;
    order.idempotencyKey = input.idempotencyKey;
    order.paidAt = paidAt;
    db.usedIdempotencyKeys[input.idempotencyKey] = order.id;

    return {
      ok: true as const,
      duplicate: false,
      order,
      movement,
      balanceCents: postedBalance(db, user.id),
      receipt: receiptFrom(db, movement, order),
    };
  });

  if (result.ok && !result.duplicate && result.order && result.movement) {
    try {
      await recordWalletPurchase(result.order, result.movement);
    } catch {
      /* El cobro no debe fallar si el módulo analítico no responde. */
    }
    try {
      await mutate((db) => {
        const u = getUser(db, input.userId);
        const order = result.order!;
        pushFlow(db, {
          actorId: u.id,
          actorName: u.name,
          actorRole: u.role,
          action: `Compra ${order.channel === "physical" ? "física" : "online"}`,
          recordType: "order",
          recordId: order.id,
          movementId: result.movement?.id ?? null,
          commercialEvent: "sale.recorded",
          indicators: ["ingresos comerciales", "ticket", "marcas del cliente", "CLV histórico", "RFM", "NBA"],
          before: { balanceCents: result.balanceCents + order.totalCents },
          after: {
            balanceCents: result.balanceCents,
            brandId: order.brandId,
            totalCents: order.totalCents,
            note: "Venta comercial distinta de recarga.",
          },
        });
        return true;
      });
    } catch {
      /* monitor opcional */
    }
  }
  return result;
}

export async function cancelOrder(orderIdOrRef: string, userId?: string) {
  return mutate((db) => {
    const order = findOrder(db, orderIdOrRef);
    if (!order) throw httpError(404, "Orden de pago no encontrada.", "ORDER_NOT_FOUND");
    if (order.status === "approved") {
      throw httpError(409, "No se puede cancelar un pago ya aprobado. Use un reembolso.", "ALREADY_PAID");
    }
    if (order.status === "cancelled") return { order };
    order.status = "cancelled";
    order.updatedAt = nowIso();
    if (userId) {
      getUser(db, userId);
      db.movements.push({
        id: newId("MOV"),
        userId,
        type: "PAYMENT_REJECTED",
        status: "cancelled",
        amountCents: order.totalCents,
        signedAmountCents: 0,
        brandId: order.brandId,
        channel: order.channel,
        orderId: order.id,
        orderReference: order.reference,
        rechargeId: null,
        relatedMovementId: null,
        description: "Pago cancelado por el usuario. El saldo no cambió.",
        receiptCode: null,
        createdAt: nowIso(),
        postedAt: null,
      });
    }
    return { order };
  });
}

export async function refundMovement(movementId: string) {
  return mutate((db) => {
    const original = db.movements.find((m) => m.id === movementId);
    if (!original) throw httpError(404, "Movimiento no encontrado.", "MOVEMENT_NOT_FOUND");
    if (original.type !== "PAYMENT" || original.status !== "approved") {
      throw httpError(400, "Solo se pueden reembolsar pagos aprobados.", "NOT_REFUNDABLE");
    }
    const already = db.movements.find(
      (m) => m.type === "REFUND" && m.relatedMovementId === original.id && m.status === "approved",
    );
    if (already) {
      throw httpError(409, "Este pago ya tiene un reembolso. El original se conserva.", "ALREADY_REFUNDED");
    }
    const createdAt = nowIso();
    const refund: Movement = {
      id: newId("MOV"),
      userId: original.userId,
      type: "REFUND",
      status: "approved",
      amountCents: original.amountCents,
      signedAmountCents: original.amountCents,
      brandId: original.brandId,
      channel: "refund",
      orderId: original.orderId,
      orderReference: original.orderReference,
      rechargeId: null,
      relatedMovementId: original.id,
      description: `Reembolso ficticio por reversión de ${original.receiptCode ?? original.id}`,
      receiptCode: `REV-${original.receiptCode ?? original.id.slice(-8)}`,
      createdAt,
      postedAt: createdAt,
    };
    db.movements.push(refund);
    return {
      original,
      refund,
      balanceCents: postedBalance(db, original.userId),
      note: "El movimiento original no se borra. Queda el pago y su reversión.",
    };
  }).then(async (result) => {
    try {
      await markWalletSaleRefunded(result.original.id);
    } catch {
      /* mismo criterio: el reembolso de billetera prevalece */
    }
    return result;
  });
}

export function receiptFrom(db: Database, movement: Movement, order?: PaymentOrder | null) {
  const user = getUser(db, movement.userId);
  const brand = movement.brandId ? getBrand(db, movement.brandId) : null;
  return {
    title: "Comprobante digital de demostración",
    disclaimer: "Documento ficticio. No tiene validez tributaria ni bancaria.",
    receiptCode: movement.receiptCode,
    movement,
    order: order ?? db.orders.find((o) => o.id === movement.orderId) ?? null,
    user: { id: user.id, name: user.name, isMember: user.isMember },
    brand,
  };
}

export async function getMovement(userId: string, movementId: string) {
  const db = await loadDb();
  getUser(db, userId);
  const movement = db.movements.find((m) => m.id === movementId && m.userId === userId);
  if (!movement) throw httpError(404, "Movimiento no encontrado.", "MOVEMENT_NOT_FOUND");
  const order = movement.orderId ? db.orders.find((o) => o.id === movement.orderId) : null;
  return receiptFrom(db, movement, order);
}

export async function adminStats() {
  const db = await loadDb();
  const approved = db.movements.filter((m) => m.status === "approved");
  const rejected = db.movements.filter((m) => m.status === "rejected" || m.status === "cancelled");
  const recharges = approved.filter((m) => m.type === "RECHARGE");
  const physical = approved.filter((m) => m.type === "PAYMENT" && m.channel === "physical");
  const online = approved.filter((m) => m.type === "PAYMENT" && m.channel === "online");
  const byBrand = db.brands.map((brand) => {
    const pays = approved.filter((m) => m.type === "PAYMENT" && m.brandId === brand.id);
    return {
      brandId: brand.id,
      brandName: brand.name,
      payments: pays.length,
      volumeCents: pays.reduce((s, m) => s + m.amountCents, 0),
    };
  });
  const wallets = db.users.map((user) => ({
    userId: user.id,
    name: user.name,
    isMember: user.isMember,
    balanceCents: postedBalance(db, user.id),
  }));
  return {
    disclaimer: "Panel con datos ficticios. No se utilizan datos reales de clientes ni de Farmaenlace.",
    totalWalletBalanceCents: wallets.reduce((s, w) => s + w.balanceCents, 0),
    rechargeCount: recharges.length,
    rechargeValueCents: recharges.reduce((s, m) => s + m.amountCents, 0),
    physicalPayments: physical.length,
    physicalVolumeCents: physical.reduce((s, m) => s + m.amountCents, 0),
    onlinePayments: online.length,
    onlineVolumeCents: online.reduce((s, m) => s + m.amountCents, 0),
    approvedCount: approved.length,
    rejectedCount: rejected.length,
    memberUsers: db.users.filter((u) => u.isMember).length,
    generalUsers: db.users.filter((u) => !u.isMember).length,
    byBrand,
    wallets,
  };
}
