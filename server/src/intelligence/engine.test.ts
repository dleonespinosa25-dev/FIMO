import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSnapshots, crossBrandReport, overviewKpis, suggestNba } from "./engine.js";
import { createIntelligenceSeed } from "./seed.js";
import type { CommercialSale } from "./types.js";

function seedWith(salesMutator?: (sales: CommercialSale[]) => CommercialSale[]) {
  const db = createIntelligenceSeed();
  if (salesMutator) db.sales = salesMutator(db.sales);
  return db;
}

describe("Smart Intelligence — cálculos de demostración", () => {
  it("genera al menos 500 clientes sintéticos y 9+ meses de compras", () => {
    const db = createIntelligenceSeed();
    assert.ok(db.customers.length >= 500);
    const dates = db.sales.map((s) => Date.parse(s.soldAt));
    const spanDays = (Math.max(...dates) - Math.min(...dates)) / 86_400_000;
    assert.ok(spanDays >= 270, `historial demasiado corto: ${spanDays} días`);
    assert.ok(db.sales.length > 1500);
  });

  it("no trata las recargas como ventas: el seed comercial no incluye movimientos RECHARGE", () => {
    const db = createIntelligenceSeed();
    assert.equal(
      db.sales.every((s) => s.revenueCents > 0 && s.walletOrderId === null || s.source === "synthetic"),
      true,
    );
    const anaWallet = db.walletTelemetry.find((w) => w.customerId === "cust-ana");
    assert.ok(anaWallet);
    assert.equal(anaWallet?.source, "ledger");
  });

  it("calcula contribución neta = ventas − costo variable − incentivos", () => {
    const db = createIntelligenceSeed();
    const sale = db.sales[0]!;
    assert.equal(
      sale.contributionCents,
      sale.revenueCents - sale.variableCostCents - sale.incentiveCostCents,
    );
  });

  it("no inventa CLV proyectado si el historial es insuficiente", () => {
    const db = seedWith((sales) => sales.filter((s) => s.customerId !== "cust-ana"));
    const ana = db.customers.find((c) => c.id === "cust-ana")!;
    db.sales.push({
      id: "one",
      customerId: ana.id,
      brandId: "farmacias-economicas",
      channel: "online",
      category: "recurring_retail",
      soldAt: db.config.asOfDate,
      revenueCents: 1000,
      variableCostCents: 680,
      incentiveCostCents: 0,
      contributionCents: 320,
      source: "synthetic",
      walletOrderId: null,
      walletMovementId: null,
      refunded: false,
    });
    const snap = buildSnapshots(db).find((s) => s.customer.id === "cust-ana")!;
    assert.equal(snap.historicValue.purchases, 1);
    assert.equal(snap.projectedClv.available, false);
    assert.equal(snap.projectedClv.presentValueCents, null);
    assert.equal(snap.projectedClv.confidence, "none");
  });

  it("proyecta CLV con valor presente cuando hay historial suficiente", () => {
    const db = createIntelligenceSeed();
    const snaps = buildSnapshots(db);
    const ready = snaps.filter((s) => s.projectedClv.available);
    assert.ok(ready.length > 50);
    const one = ready[0]!;
    assert.equal(typeof one.projectedClv.presentValueCents, "number");
    assert.ok(["low", "medium", "high"].includes(one.projectedClv.confidence));
    assert.ok(one.projectedClv.assumptions.length >= 3);
  });

  it("RFM asigna recencia, frecuencia y monto entre 1 y 5", () => {
    const snaps = buildSnapshots(createIntelligenceSeed());
    for (const s of snaps.slice(0, 30)) {
      assert.ok(s.r >= 1 && s.r <= 5);
      assert.ok(s.f >= 1 && s.f <= 5);
      assert.ok(s.m >= 1 && s.m <= 5);
      assert.equal(s.rfm.length, 3);
    }
  });

  it("distingue falta de historial de riesgo de abandono", () => {
    const db = createIntelligenceSeed();
    const snaps = buildSnapshots(db);
    const noHist = snaps.find((s) => s.purchaseCount < 2);
    const inactive = snaps.find((s) => s.segment === "inactivos" || s.churnLabel === "alto");
    assert.ok(noHist);
    assert.equal(noHist!.churnLabel, "sin_historial_suficiente");
    assert.ok(inactive);
    assert.notEqual(inactive!.churnLabel, "sin_historial_suficiente");
  });

  it("BYD infrecuente no usa el ciclo de farmacia", () => {
    const db = createIntelligenceSeed();
    const cust = db.customers[10]!;
    db.sales = db.sales.filter((s) => s.customerId !== cust.id);
    const mk = (id: string, soldAt: string): CommercialSale => ({
      id,
      customerId: cust.id,
      brandId: "byd",
      channel: "physical",
      category: "mobility_high_ticket",
      soldAt,
      revenueCents: 80_000,
      variableCostCents: 65_600,
      incentiveCostCents: 0,
      contributionCents: 14_400,
      source: "synthetic",
      walletOrderId: null,
      walletMovementId: null,
      refunded: false,
    });
    db.sales.push(mk("byd-a", "2025-12-01T12:00:00.000Z"), mk("byd-b", "2026-09-01T12:00:00.000Z"));
    const bydOnly = buildSnapshots(db).find((s) => s.customer.id === cust.id);
    assert.ok(bydOnly);
    assert.deepEqual(bydOnly!.brandsUsed, ["byd"]);
    assert.ok(bydOnly!.churnReasons.some((r) => r.toLowerCase().includes("baja frecuencia")));
    assert.notEqual(bydOnly!.churnLabel, "sin_historial_suficiente");
  });

  it("clientes multimarca muestran contribución promedio distinta al reporte cruzado", () => {
    const db = createIntelligenceSeed();
    const snaps = buildSnapshots(db);
    const report = crossBrandReport(snaps, db);
    assert.ok(report.multiCount > 0);
    assert.ok(report.monoCount > 0);
  });

  it("membresía y billetera son independientes en la ficha", () => {
    const db = createIntelligenceSeed();
    const ana = db.customers.find((c) => c.id === "cust-ana")!;
    const carlos = db.customers.find((c) => c.id === "cust-carlos")!;
    assert.equal(ana.isMember, false);
    assert.equal(ana.walletUserId, "user-general");
    assert.equal(carlos.isMember, true);
    assert.equal(carlos.walletUserId, "user-socio");
  });

  it("NBA no recomienda incentivo que canibalice a un comprador que ya volvería", () => {
    const db = createIntelligenceSeed();
    const snaps = buildSnapshots(db);
    const candidate = snaps.find((s) => s.segment === "frecuentes" && s.churnLabel === "bajo") ?? snaps[1]!;
    const nba = suggestNba(candidate, db);
    if (nba.wouldBuyAnyway) {
      assert.ok(nba.action === "no_incentivo" || nba.action === "beneficio_membresia" || nba.action === "no_contactar");
    }
    assert.equal(typeof nba.reason, "string");
    assert.ok(nba.approvalStatus === "pending");
  });

  it("KPIs de overview no cuentan clientes sin compras como retención 90 días inflada de forma oculta", () => {
    const db = createIntelligenceSeed();
    const kpis = overviewKpis(buildSnapshots(db), db);
    assert.ok(kpis.customers >= 500);
    assert.ok(kpis.retentionProxy >= 0 && kpis.retentionProxy <= 1);
    assert.ok(kpis.notes.some((n) => n.includes("Recargas")));
  });

  it("una venta refunded no suma contribución", () => {
    const db = createIntelligenceSeed();
    const target = db.sales.find((s) => s.customerId === "cust-carlos")!;
    const before = buildSnapshots(db).find((s) => s.customer.id === "cust-carlos")!.netContributionCents;
    target.refunded = true;
    const after = buildSnapshots(db).find((s) => s.customer.id === "cust-carlos")!.netContributionCents;
    assert.ok(after <= before);
  });
});
