import type { Database, Movement, PaymentOrder } from "../types.js";
import { loadDb } from "../store.js";
import { loadIntel, mutateIntel } from "./store.js";
import { recomputeSaleEconomics } from "./seed.js";
import type { CommercialCustomer, CommercialSale } from "./types.js";
import { nowIso } from "../money.js";

export async function ensureLiveCustomer(user: {
  id: string;
  name: string;
  email: string;
  isMember: boolean;
  consentMarketing?: boolean;
}) {
  return mutateIntel((db) => {
    const existing = db.customers.find((c) => c.walletUserId === user.id);
    if (existing) return existing;
    const row: CommercialCustomer = {
      id: `cust-live-${user.id}`,
      name: user.name,
      email: user.email,
      isMember: user.isMember,
      memberSince: user.isMember ? nowIso().slice(0, 10) : null,
      consentMarketing: Boolean(user.consentMarketing),
      preferredChannel: "mixed",
      walletUserId: user.id,
      createdAt: nowIso(),
      acquisitionCostCents: null,
      acquisitionReliable: false,
      city: "Quito",
    };
    db.customers.push(row);
    db.walletTelemetry.push({
      customerId: row.id,
      rechargeCents: 0,
      purchaseWithWalletCents: 0,
      avgBalanceCents: 0,
      rechargeCount: 0,
      source: "ledger",
    });
    return row;
  });
}

function ledgerBalance(db: Database, userId: string) {
  return db.movements
    .filter((m) => m.userId === userId && m.status === "approved")
    .reduce((sum, m) => sum + m.signedAmountCents, 0);
}

function customerByWallet(userId: string, customers: CommercialCustomer[]) {
  return customers.find((c) => c.walletUserId === userId);
}

export async function recordWalletPurchase(order: PaymentOrder, movement: Movement) {
  if (!order.userId || order.status !== "approved") return { recorded: false, reason: "not_approved" };
  if (movement.type !== "PAYMENT" || movement.status !== "approved") {
    return { recorded: false, reason: "not_a_sale" };
  }

  return mutateIntel((db) => {
    const existing = db.sales.find((s) => s.walletOrderId === order.id || s.walletMovementId === movement.id);
    if (existing) {
      return { recorded: false, duplicate: true, saleId: existing.id };
    }
    let customer = customerByWallet(order.userId!, db.customers);
    if (!customer) {
      const liveUser = { id: order.userId!, name: "Cliente LIVE", email: `${order.userId}@live.test`, isMember: false };
      customer = {
        id: `cust-live-${order.userId}`,
        name: liveUser.name,
        email: liveUser.email,
        isMember: false,
        memberSince: null,
        consentMarketing: false,
        preferredChannel: "mixed",
        walletUserId: order.userId!,
        createdAt: nowIso(),
        acquisitionCostCents: null,
        acquisitionReliable: false,
        city: "Quito",
      };
      db.customers.push(customer);
    }
    const rate =
      db.brandEconomics.find((b) => b.brandId === order.brandId)?.contributionMarginRate ?? 0.25;
    const sale: CommercialSale = recomputeSaleEconomics(
      {
        id: `sale-wallet-${order.id}`,
        customerId: customer.id,
        brandId: order.brandId,
        channel: order.channel,
        category: order.brandId === "byd" ? "mobility_high_ticket" : "recurring_retail",
        soldAt: order.paidAt || movement.postedAt || movement.createdAt,
        revenueCents: order.totalCents,
        variableCostCents: 0,
        incentiveCostCents: order.discountCents || 0,
        contributionCents: 0,
        source: "wallet",
        walletOrderId: order.id,
        walletMovementId: movement.id,
        refunded: false,
      },
      rate,
    );
    db.sales.push(sale);
    return { recorded: true, duplicate: false, saleId: sale.id };
  });
}

export async function markWalletSaleRefunded(movementId: string) {
  return mutateIntel((db) => {
    const sale = db.sales.find((s) => s.walletMovementId === movementId && s.source === "wallet");
    if (!sale) return { updated: false };
    sale.refunded = true;
    sale.contributionCents = 0;
    return { updated: true, saleId: sale.id };
  });
}

export async function resetWalletLinkedSales() {
  return mutateIntel((db) => {
    db.sales = db.sales.filter((s) => s.source !== "wallet");
    return { ok: true };
  });
}

export async function liveWalletTelemetry() {
  const walletDb = await loadDb();
  const intel = await loadIntel();
  const linked = intel.customers.filter((c) => c.walletUserId);
  return Promise.all(
    linked.map(async (c) => {
      const uid = c.walletUserId!;
      const movements = walletDb.movements.filter((m) => m.userId === uid && m.status === "approved");
      const recharges = movements.filter((m) => m.type === "RECHARGE");
      const payments = movements.filter((m) => m.type === "PAYMENT");
      const rechargeCents = recharges.reduce((s, m) => s + m.amountCents, 0);
      const purchaseWithWalletCents = payments.reduce((s, m) => s + m.amountCents, 0);
      const utilization = rechargeCents > 0 ? Math.min(purchaseWithWalletCents / rechargeCents, 1) : 0;
      return {
        customerId: c.id,
        name: c.name,
        walletUserId: uid,
        source: "ledger" as const,
        rechargeCents,
        rechargeCount: recharges.length,
        purchaseWithWalletCents,
        avgBalanceCents: ledgerBalance(walletDb, uid),
        utilization,
        note: "Cifras del libro de billetera. El saldo no gastado no es utilidad comercial.",
      };
    }),
  );
}
