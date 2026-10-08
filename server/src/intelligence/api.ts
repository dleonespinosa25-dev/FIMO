import type { Request, Response } from "express";
import { loadIntel, mutateIntel, applyMarginAssumptions, resetIntel } from "./store.js";
import { bearer, login, logout, publicUser, requireCorporate } from "./auth.js";
import {
  buildAllNba,
  buildSnapshots,
  cohortRows,
  crossBrandReport,
  filterSnapshots,
  overviewKpis,
  rfmGrid,
} from "./engine.js";
import { liveWalletTelemetry } from "./ingest.js";
import { recentFlow } from "../identity.js";
import { generateLab, labKpis, labPage } from "../lab/sqlite.js";
import { nowIso } from "../money.js";
import type { NbaDecision } from "./types.js";

async function gated(req: Request) {
  return requireCorporate(bearer(req));
}

export async function postLogin(req: Request, res: Response) {
  const { email, password } = req.body ?? {};
  res.json(await login(String(email || ""), String(password || "")));
}

export async function postLogout(req: Request, res: Response) {
  res.json(await logout(bearer(req)));
}

export async function getMe(req: Request, res: Response) {
  const { user } = await gated(req);
  res.json({ user: publicUser(user) });
}

function queryFilters(req: Request) {
  return {
    brandId: typeof req.query.brandId === "string" ? req.query.brandId : undefined,
    segment: typeof req.query.segment === "string" ? req.query.segment : undefined,
    membership: typeof req.query.membership === "string" ? req.query.membership : undefined,
    channel: typeof req.query.channel === "string" ? req.query.channel : undefined,
  };
}

export async function getOverview(req: Request, res: Response) {
  await gated(req);
  const db = await loadIntel();
  const snaps = filterSnapshots(buildSnapshots(db), queryFilters(req));
  res.json({
    ...overviewKpis(snaps, db),
    rfm: rfmGrid(snaps),
    brandEconomics: db.brandEconomics,
  });
}

export async function getCustomers(req: Request, res: Response) {
  await gated(req);
  const db = await loadIntel();
  const q = typeof req.query.q === "string" ? req.query.q.toLowerCase() : "";
  let snaps = filterSnapshots(buildSnapshots(db), queryFilters(req));
  if (q) {
    snaps = snaps.filter(
      (s) => s.customer.name.toLowerCase().includes(q) || s.customer.email.toLowerCase().includes(q),
    );
  }
  res.json({
    total: snaps.length,
    customers: snaps.slice(0, 80).map((s) => ({
      id: s.customer.id,
      name: s.customer.name,
      isMember: s.customer.isMember,
      segment: s.segment,
      recencyDays: s.recencyDays,
      purchaseCount: s.purchaseCount,
      revenueCents: s.revenueCents,
      netContributionCents: s.netContributionCents,
      projectedClvCents: s.projectedClv.presentValueCents,
      clvConfidence: s.projectedClv.confidence,
      churnLabel: s.churnLabel,
      churnScore: s.churnScore,
      brands: s.brandsUsed.length,
    })),
  });
}

export async function getCustomer(req: Request, res: Response) {
  await gated(req);
  const db = await loadIntel();
  const snaps = buildSnapshots(db);
  const snap = snaps.find((s) => s.customer.id === req.params.id);
  if (!snap) {
    res.status(404).json({ error: "Cliente sintético no encontrado." });
    return;
  }
  const nba = buildAllNba(db, [snap])[0];
  const history = db.sales
    .filter((s) => s.customerId === snap.customer.id)
    .sort((a, b) => b.soldAt.localeCompare(a.soldAt))
    .slice(0, 40);
  res.json({
    snapshot: snap,
    nba,
    history,
    walletNote:
      "La ficha comercial no comparte el libro de saldo. Si hay telemetría de billetera, el saldo ocioso no es ganancia.",
  });
}

export async function getSegmentation(req: Request, res: Response) {
  await gated(req);
  const db = await loadIntel();
  const snaps = filterSnapshots(buildSnapshots(db), queryFilters(req));
  res.json({
    rfm: rfmGrid(snaps),
    cohorts: cohortRows(db, snaps),
    atRisk: snaps
      .filter((s) => s.segment === "en_riesgo" || s.churnLabel === "alto")
      .slice(0, 40)
      .map((s) => ({
        id: s.customer.id,
        name: s.customer.name,
        segment: s.segment,
        churnScore: s.churnScore,
        churnLabel: s.churnLabel,
        reasons: s.churnReasons,
        recencyDays: s.recencyDays,
      })),
    methodNote:
      "El puntaje de abandono es un score de reglas explicable (0-100). No es una probabilidad calibrada ni un modelo de ML.",
  });
}

export async function getClv(req: Request, res: Response) {
  await gated(req);
  const db = await loadIntel();
  const snaps = filterSnapshots(buildSnapshots(db), queryFilters(req));
  const withProj = snaps.filter((s) => s.projectedClv.available);
  const retentionCost = snaps.reduce((a, s) => a + s.incentiveCostCents, 0) / Math.max(snaps.length, 1);
  res.json({
    config: db.config,
    brandEconomics: db.brandEconomics,
    avgAovCents: snaps.length ? Math.round(snaps.reduce((a, s) => a + s.aovCents, 0) / snaps.length) : 0,
    avgRevenuePerCustomerCents: snaps.length
      ? Math.round(snaps.reduce((a, s) => a + s.revenueCents, 0) / snaps.length)
      : 0,
    avgContributionPerTxnCents: (() => {
      const n = snaps.reduce((a, s) => a + s.purchaseCount, 0);
      const c = snaps.reduce((a, s) => a + s.contributionCents, 0);
      return n ? Math.round(c / n) : 0;
    })(),
    avgContributionPerCustomerCents: snaps.length
      ? Math.round(snaps.reduce((a, s) => a + s.netContributionCents, 0) / snaps.length)
      : 0,
    avgIncentiveCents: Math.round(retentionCost),
    historicSumCents: snaps.reduce((a, s) => a + s.netContributionCents, 0),
    projectedSumCents: withProj.reduce((a, s) => a + (s.projectedClv.presentValueCents ?? 0), 0),
    clvCac: {
      reliableCount: snaps.filter((s) => s.cacRatio.available).length,
      avgRatio: (() => {
        const xs = snaps.filter((s) => s.cacRatio.available && s.cacRatio.clvOverCac != null);
        return xs.length ? xs.reduce((a, s) => a + s.cacRatio.clvOverCac!, 0) / xs.length : null;
      })(),
      note: "El ratio solo se calcula cuando el CLV y el CAC de demostración son confiables.",
    },
    distribution: withProj.slice(0, 12).map((s) => ({
      id: s.customer.id,
      name: s.customer.name,
      historic: s.netContributionCents,
      projected: s.projectedClv.presentValueCents,
      confidence: s.projectedClv.confidence,
    })),
  });
}

export async function patchAssumptions(req: Request, res: Response) {
  await gated(req);
  const { discountRateMonthly, margins } = req.body ?? {};
  res.json(await applyMarginAssumptions(discountRateMonthly, margins));
}

export async function getCross(req: Request, res: Response) {
  await gated(req);
  const db = await loadIntel();
  const snaps = filterSnapshots(buildSnapshots(db), queryFilters(req));
  res.json(crossBrandReport(snaps, db));
}

export async function getNba(req: Request, res: Response) {
  await gated(req);
  const db = await loadIntel();
  const snaps = filterSnapshots(buildSnapshots(db), queryFilters(req));
  const list = buildAllNba(db, snaps);
  const priority = [...list].sort(
    (a, b) => b.expectedIncrementalContributionCents - a.expectedIncrementalContributionCents,
  );
  res.json({
    methodNote:
      "Next Best Action es un motor de reglas. Cada acción requiere aprobación humana. No se envían mensajes.",
    total: priority.length,
    recommendations: priority.slice(0, 60),
  });
}

export async function postNbaDecision(req: Request, res: Response) {
  const { user } = await gated(req);
  const status = req.body?.status === "approved" ? "approved" : req.body?.status === "rejected" ? "rejected" : null;
  if (!status) {
    res.status(400).json({ error: "status debe ser approved o rejected." });
    return;
  }
  const customerId = String(req.params.id);
  res.json(
    await mutateIntel((db) => {
      const snaps = buildSnapshots(db);
      const snap = snaps.find((s) => s.customer.id === customerId);
      if (!snap) throw Object.assign(new Error("Cliente no encontrado"), { status: 404 });
      const suggestion = buildAllNba(db, [snap])[0]!;
      const existing = db.nbaDecisions.find((d) => d.customerId === customerId);
      const row: NbaDecision = {
        customerId,
        action: suggestion.action,
        status,
        decidedAt: nowIso(),
        decidedBy: user.id,
      };
      if (existing) Object.assign(existing, row);
      else db.nbaDecisions.push(row);
      return { ok: true, decision: row };
    }),
  );
}

export async function getCampaigns(_req: Request, res: Response) {
  await gated(_req);
  const db = await loadIntel();
  res.json({
    disclaimer: "Campañas ficticias. Distinguir observado / simulado / estimado. No hay envío real.",
    campaigns: db.campaigns,
  });
}

export async function postCampaignDecision(req: Request, res: Response) {
  const { user } = await gated(req);
  const status = req.body?.status;
  if (status !== "approved" && status !== "rejected") {
    res.status(400).json({ error: "status debe ser approved o rejected." });
    return;
  }
  res.json(
    await mutateIntel((db) => {
      const camp = db.campaigns.find((c) => c.id === req.params.id);
      if (!camp) throw Object.assign(new Error("Campaña no encontrada"), { status: 404 });
      camp.status = status;
      camp.decidedAt = nowIso();
      camp.decidedBy = user.id;
      return { ok: true, campaign: camp };
    }),
  );
}

export async function postCampaignSimulate(req: Request, res: Response) {
  await gated(req);
  res.json(
    await mutateIntel((db) => {
      const camp = db.campaigns.find((c) => c.id === req.params.id);
      if (!camp) throw Object.assign(new Error("Campaña no encontrada"), { status: 404 });
      camp.status = "simulated";
      camp.simulated = {
        kind: "simulated",
        conversionRate: 0.11,
        repurchaseRate: 0.14,
        retentionAfter: 0.62,
        aovAfterCents: 2000,
        crossBrandLift: 0.05,
        costPerReactivatedCents: 540,
        campaignContributionCents: Math.round(camp.budgetCents * 0.22),
        incrementalRoi: 0.55,
        clvChangeCents: 180,
        disclaimer:
          "Simulación ejecutada en el demo. No envía mensajes. Compare siempre tratamiento vs control; no atribuya automáticamente ventas posteriores.",
      };
      return { ok: true, campaign: camp };
    }),
  );
}

export async function getWalletPerf(req: Request, res: Response) {
  await gated(req);
  const db = await loadIntel();
  const synthetic = db.walletTelemetry.filter((w) => w.source === "synthetic");
  const live = await liveWalletTelemetry();
  const recargas = synthetic.reduce((a, w) => a + w.rechargeCents, 0);
  const compras = synthetic.reduce((a, w) => a + w.purchaseWithWalletCents, 0);
  const utilization = recargas > 0 ? compras / recargas : 0;
  res.json({
    separationNote:
      "Esta vista mezcla (1) telemetría sintética de adopción y (2) el ledger real del demo de Ana/Carlos. Las recargas no son ventas. El saldo no utilizado no es ganancia de Farmaenlace.",
    synthetic: {
      customers: synthetic.length,
      avgRechargeCents: Math.round(recargas / Math.max(synthetic.length, 1)),
      avgBalanceCents: Math.round(
        synthetic.reduce((a, w) => a + w.avgBalanceCents, 0) / Math.max(synthetic.length, 1),
      ),
      purchaseWithWalletCents: compras,
      utilization,
    },
    liveLedger: live,
  });
}

export async function postResetIntel(req: Request, res: Response) {
  await gated(req);
  await resetIntel();
  res.json({ ok: true, message: "Universo sintético de Smart Intelligence restaurado." });
}

export async function getFlow(req: Request, res: Response) {
  await gated(req);
  res.json(await recentFlow());
}

export async function getLab(req: Request, res: Response) {
  await gated(req);
  res.json(labKpis());
}

export async function postLabGenerate(req: Request, res: Response) {
  await gated(req);
  const n = Number(req.body?.n) || 1000;
  const allowed = [100, 1000, 10_000, 50_000];
  const size = allowed.includes(n) ? n : 1000;
  res.json(generateLab(size));
}

export async function getLabCustomers(req: Request, res: Response) {
  await gated(req);
  const limit = Math.min(Number(req.query.limit) || 40, 100);
  const offset = Number(req.query.offset) || 0;
  res.json(labPage(limit, offset));
}
