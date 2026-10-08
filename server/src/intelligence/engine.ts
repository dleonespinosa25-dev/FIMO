import type { BrandId } from "../types.js";
import { daysBetween, monthsBetween } from "./rng.js";
import type {
  BrandEconomics,
  CommercialCustomer,
  CommercialSale,
  DynamicSegment,
  IntelligenceConfig,
  IntelligenceDatabase,
  NbaAction,
  NbaDecision,
  SaleCategory,
  WalletTelemetry,
} from "./types.js";

export interface CustomerSnapshot {
  customer: CommercialCustomer;
  purchaseCount: number;
  revenueCents: number;
  contributionCents: number;
  incentiveCostCents: number;
  variableCostCents: number;
  netContributionCents: number;
  aovCents: number;
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  tenureDays: number;
  observedRelationshipDays: number;
  recencyDays: number | null;
  frequencyMonthly: number;
  frequencyAnnual: number;
  brandsUsed: BrandId[];
  brandCounts: Record<string, number>;
  channelCounts: Record<string, number>;
  avgInterpurchaseDays: number | null;
  ticketTrend: "up" | "down" | "flat" | "na";
  r: number;
  f: number;
  m: number;
  rfm: string;
  segment: DynamicSegment;
  secondarySegments: DynamicSegment[];
  churnScore: number;
  churnLabel: "sin_historial_suficiente" | "bajo" | "medio" | "alto";
  churnReasons: string[];
  nextPurchaseWindow: { fromDays: number; toDays: number; note: string } | null;
  historicValue: {
    salesCents: number;
    purchases: number;
    aovCents: number;
    netContributionCents: number;
  };
  projectedClv: {
    available: boolean;
    presentValueCents: number | null;
    horizonMonths: number;
    expectedMonthlyFrequency: number;
    expectedAovCents: number;
    expectedMarginRate: number;
    futureCampaignCostCents: number;
    remainingMonthsEstimate: number | null;
    assumptions: string[];
    confidence: "none" | "low" | "medium" | "high";
    limitation: string;
  };
  cacRatio: { available: boolean; clvOverCac: number | null; note: string };
  wallet: WalletTelemetry | null;
  campaignResponse: { campaignsTouched: number; incentiveCents: number };
}

export interface NbaSuggestion {
  customerId: string;
  customerName: string;
  action: NbaAction;
  actionLabel: string;
  reason: string;
  segment: DynamicSegment;
  expectedCostCents: number;
  expectedIncrementalContributionCents: number;
  risks: string[];
  assumptions: string[];
  eligibility: string;
  approvalStatus: "pending" | "approved" | "rejected";
  wouldBuyAnyway: boolean;
  exceedsMarginGuardrail: boolean;
}

const ACTION_LABELS: Record<NbaAction, string> = {
  no_incentivo: "No ofrecer incentivos",
  recordatorio: "Recordatorio comercial (con consentimiento)",
  informativa: "Comunicación informativa",
  beneficio_membresia: "Beneficio exclusivo de membresía",
  reactivacion: "Incentivo de reactivación",
  recompra: "Campaña de recompra",
  venta_cruzada: "Campaña de venta cruzada",
  incentivo_proxima: "Incentivo para una próxima transacción",
  fidelizacion_multimarcas: "Campaña de fidelización multimarcas",
  no_contactar: "No contactar al cliente",
};

function activeSales(sales: CommercialSale[]) {
  return sales.filter((s) => !s.refunded);
}

function quantileBreaks(values: number[]) {
  if (!values.length) return [0, 0, 0, 0];
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))] as number;
  return [q(0.2), q(0.4), q(0.6), q(0.8)];
}

function scoreHighIsGood(value: number, breaks: number[]) {
  if (value <= breaks[0]) return 1;
  if (value <= breaks[1]) return 2;
  if (value <= breaks[2]) return 3;
  if (value <= breaks[3]) return 4;
  return 5;
}

function scoreLowIsGood(value: number, breaks: number[]) {
  if (value <= breaks[0]) return 5;
  if (value <= breaks[1]) return 4;
  if (value <= breaks[2]) return 3;
  if (value <= breaks[3]) return 2;
  return 1;
}

function dominantCycle(brands: BrandId[], eco: BrandEconomics[]) {
  const rows = eco.filter((e) => brands.includes(e.brandId));
  if (!rows.length) return { days: 40, infrequent: false };
  const infrequent = rows.every((r) => r.infrequent);
  const days = infrequent
    ? Math.max(...rows.map((r) => r.expectedCycleDays))
    : Math.min(...rows.filter((r) => !r.infrequent).map((r) => r.expectedCycleDays));
  return { days, infrequent };
}

function ticketTrend(sales: CommercialSale[]): CustomerSnapshot["ticketTrend"] {
  if (sales.length < 4) return "na";
  const mid = Math.floor(sales.length / 2);
  const first = sales.slice(0, mid).reduce((s, x) => s + x.revenueCents, 0) / mid;
  const last = sales.slice(mid).reduce((s, x) => s + x.revenueCents, 0) / (sales.length - mid);
  const delta = (last - first) / Math.max(first, 1);
  if (delta > 0.12) return "up";
  if (delta < -0.12) return "down";
  return "flat";
}

function avgGap(sales: CommercialSale[]) {
  if (sales.length < 2) return null;
  const ordered = [...sales].sort((a, b) => a.soldAt.localeCompare(b.soldAt));
  let sum = 0;
  for (let i = 1; i < ordered.length; i++) {
    sum += daysBetween(ordered[i - 1]!.soldAt, ordered[i]!.soldAt);
  }
  return sum / (ordered.length - 1);
}

export function buildSnapshots(db: IntelligenceDatabase): CustomerSnapshot[] {
  const asOf = db.config.asOfDate;
  const salesByCust = new Map<string, CommercialSale[]>();
  for (const s of activeSales(db.sales)) {
    const arr = salesByCust.get(s.customerId) ?? [];
    arr.push(s);
    salesByCust.set(s.customerId, arr);
  }
  const recencies: number[] = [];
  const freqs: number[] = [];
  const monies: number[] = [];
  const prelim = db.customers.map((customer) => {
    const list = (salesByCust.get(customer.id) ?? []).sort((a, b) => a.soldAt.localeCompare(b.soldAt));
    const last = list.at(-1)?.soldAt ?? null;
    const recency = last ? daysBetween(last, asOf) : 9999;
    recencies.push(recency);
    freqs.push(list.length);
    monies.push(list.reduce((s, x) => s + x.revenueCents, 0));
    return { customer, list, recency };
  });
  const rBreaks = quantileBreaks(recencies.filter((x) => x < 9999));
  const fBreaks = quantileBreaks(freqs);
  const mBreaks = quantileBreaks(monies);

  return prelim.map(({ customer, list, recency }) =>
    snapshotOne(db, customer, list, recency, rBreaks, fBreaks, mBreaks),
  );
}

function snapshotOne(
  db: IntelligenceDatabase,
  customer: CommercialCustomer,
  list: CommercialSale[],
  recency: number,
  rBreaks: number[],
  fBreaks: number[],
  mBreaks: number[],
): CustomerSnapshot {
  const asOf = db.config.asOfDate;
  const revenueCents = list.reduce((s, x) => s + x.revenueCents, 0);
  const contributionCents = list.reduce((s, x) => s + x.contributionCents, 0);
  const incentiveCostCents = list.reduce((s, x) => s + x.incentiveCostCents, 0);
  const variableCostCents = list.reduce((s, x) => s + x.variableCostCents, 0);
  const first = list[0]?.soldAt ?? null;
  const last = list.at(-1)?.soldAt ?? null;
  const tenureDays = daysBetween(customer.createdAt, asOf);
  const observedRelationshipDays = first && last ? daysBetween(first, last) : 0;
  const monthsObs = first ? monthsBetween(first, asOf) : monthsBetween(customer.createdAt, asOf);
  const aovCents = list.length ? Math.round(revenueCents / list.length) : 0;
  const frequencyMonthly = list.length / monthsObs;
  const brandsUsed = [...new Set(list.map((s) => s.brandId))];
  const brandCounts: Record<string, number> = {};
  const channelCounts: Record<string, number> = {};
  for (const s of list) {
    brandCounts[s.brandId] = (brandCounts[s.brandId] ?? 0) + 1;
    channelCounts[s.channel] = (channelCounts[s.channel] ?? 0) + 1;
  }
  const r = list.length ? scoreLowIsGood(recency, rBreaks) : 1;
  const f = scoreHighIsGood(list.length, fBreaks);
  const m = scoreHighIsGood(revenueCents, mBreaks);
  const cycle = dominantCycle(brandsUsed.length ? brandsUsed : ["farmacias-economicas"], db.brandEconomics);
  const inter = avgGap(list);
  const { segment, secondary } = classifySegment({
    list,
    recency,
    tenureDays,
    brandsUsed,
    r,
    f,
    m,
    cycle,
    asOf,
  });
  const churn = churnRules({
    list,
    recency,
    cycle,
    inter,
    tenureDays,
    infrequent: cycle.infrequent,
  });
  const projected = projectClv(db.config, list, revenueCents, contributionCents, frequencyMonthly, aovCents, monthsObs, tenureDays, cycle);
  const wallet = db.walletTelemetry.find((w) => w.customerId === customer.id) ?? null;
  const clvForRatio = projected.available && projected.presentValueCents != null
    ? (projected.presentValueCents + contributionCents)
    : contributionCents;
  const cacOk =
    customer.acquisitionReliable &&
    customer.acquisitionCostCents != null &&
    customer.acquisitionCostCents > 0 &&
    list.length >= db.config.minPurchasesForProjection &&
    projected.confidence !== "none";
  return {
    customer,
    purchaseCount: list.length,
    revenueCents,
    contributionCents,
    incentiveCostCents,
    variableCostCents,
    netContributionCents: contributionCents,
    aovCents,
    firstPurchaseAt: first,
    lastPurchaseAt: last,
    tenureDays,
    observedRelationshipDays,
    recencyDays: list.length ? recency : null,
    frequencyMonthly,
    frequencyAnnual: frequencyMonthly * 12,
    brandsUsed,
    brandCounts,
    channelCounts,
    avgInterpurchaseDays: inter,
    ticketTrend: ticketTrend(list),
    r,
    f,
    m,
    rfm: `${r}${f}${m}`,
    segment,
    secondarySegments: secondary,
    churnScore: churn.score,
    churnLabel: churn.label,
    churnReasons: churn.reasons,
    nextPurchaseWindow: nextWindow(list, cycle, recency, inter),
    historicValue: {
      salesCents: revenueCents,
      purchases: list.length,
      aovCents,
      netContributionCents: contributionCents,
    },
    projectedClv: projected,
    cacRatio: cacOk
      ? {
          available: true,
          clvOverCac: clvForRatio / customer.acquisitionCostCents!,
          note: "Ratio solo informativo: CLV (histórico + VP proyectado si existe) / CAC supuesto. Ambos deben ser confiables.",
        }
      : {
          available: false,
          clvOverCac: null,
          note: "No se calcula CLV/CAC: falta historial suficiente o el CAC no es un dato confiable.",
        },
    wallet,
    campaignResponse: {
      campaignsTouched: list.filter((s) => s.incentiveCostCents > 0).length,
      incentiveCents: incentiveCostCents,
    },
  };
}

function classifySegment(input: {
  list: CommercialSale[];
  recency: number;
  tenureDays: number;
  brandsUsed: BrandId[];
  r: number;
  f: number;
  m: number;
  cycle: { days: number; infrequent: boolean };
  asOf: string;
}): { segment: DynamicSegment; secondary: DynamicSegment[] } {
  const { list, recency, tenureDays, brandsUsed, r, f, m, cycle } = input;
  const secondary: DynamicSegment[] = [];
  const last = list.at(-1);
  const hadLongGap =
    list.length >= 3 &&
    avgGap(list.slice(0, -1)) != null &&
    last != null &&
    recency < cycle.days &&
    daysBetween(list[list.length - 2]!.soldAt, last.soldAt) > cycle.days * 2.2;

  if (list.length === 0) return { segment: "nuevos", secondary };
  if (!cycle.infrequent && recency > cycle.days * 3.2) {
    if (hadLongGap && recency < cycle.days) secondary.push("reactivados");
    return { segment: "inactivos", secondary: brandsUsed.length >= 3 ? ["multimarcas"] : [] };
  }
  if (!cycle.infrequent && recency > cycle.days * 1.8) {
    return { segment: "en_riesgo", secondary: m >= 4 ? ["alto_valor"] : [] };
  }
  if (cycle.infrequent && recency > cycle.days * 1.5) {
    return { segment: "en_riesgo", secondary: [] };
  }
  if (hadLongGap) return { segment: "reactivados", secondary };
  if (tenureDays < 45 && list.length <= 2) return { segment: "nuevos", secondary };
  if (brandsUsed.length >= 3) secondary.push("multimarcas");
  if (m >= 5 && f >= 4) return { segment: "alto_valor", secondary };
  if (brandsUsed.length >= 3 && f >= 3) return { segment: "multimarcas", secondary };
  if (f >= 4 && r >= 4) return { segment: "frecuentes", secondary };
  if (m >= 3 && f <= 3 && r >= 3) return { segment: "potencial_crecimiento", secondary };
  if (list.length <= 4 && r <= 3) return { segment: "ocasionales", secondary };
  if (f >= 4) return { segment: "frecuentes", secondary };
  return { segment: "ocasionales", secondary };
}

function churnRules(input: {
  list: CommercialSale[];
  recency: number;
  cycle: { days: number; infrequent: boolean };
  inter: number | null;
  tenureDays: number;
  infrequent: boolean;
}) {
  const reasons: string[] = [];
  if (input.list.length < 2) {
    return {
      score: 0,
      label: "sin_historial_suficiente" as const,
      reasons: [
        "Hay menos de 2 compras. No se puede distinguir abandono de un cliente que todavía está empezando.",
      ],
    };
  }
  if (input.infrequent) {
    const ratio = input.recency / input.cycle.days;
    let score = Math.round(Math.min(100, Math.max(0, (ratio - 0.6) * 80)));
    reasons.push(
      `Marca de baja frecuencia (ciclo supuesto ${input.cycle.days} días). Un silencio de ${input.recency} días no equivale a abandono de farmacia.`,
    );
    if (ratio < 1) score = Math.min(score, 25);
    const label = score >= 70 ? "alto" : score >= 40 ? "medio" : "bajo";
    return { score, label: label as "bajo" | "medio" | "alto", reasons };
  }
  const expected = input.inter ?? input.cycle.days;
  const ratio = input.recency / Math.max(expected, 1);
  let score = Math.round(Math.min(100, Math.max(0, (ratio - 0.8) * 55)));
  if (ratio > 1.8) {
    reasons.push(`Lleva ${input.recency} días sin comprar; su intervalo habitual es ~${Math.round(expected)} días.`);
  } else {
    reasons.push(`La recencia (${input.recency} días) está cerca de su ritmo habitual (~${Math.round(expected)} días).`);
  }
  if (input.list.length >= 4) {
    const early = avgGap(input.list.slice(0, Math.ceil(input.list.length / 2)));
    const late = avgGap(input.list.slice(Math.floor(input.list.length / 2)));
    if (early && late && late > early * 1.35) {
      score = Math.min(100, score + 12);
      reasons.push("Los intervalos entre compras se alargaron respecto a la primera mitad del historial.");
    }
  }
  const label = score >= 70 ? "alto" : score >= 40 ? "medio" : "bajo";
  return { score, label: label as "bajo" | "medio" | "alto", reasons };
}

function nextWindow(
  list: CommercialSale[],
  cycle: { days: number; infrequent: boolean },
  recency: number,
  inter: number | null,
) {
  if (list.length < 2) {
    return {
      fromDays: Math.max(cycle.days - recency, 0),
      toDays: cycle.days + 14,
      note: "Ventana tentativa por ciclo de marca. Historial insuficiente para personalizar.",
    };
  }
  const base = inter ?? cycle.days;
  const remaining = Math.max(base - recency, 0);
  return {
    fromDays: remaining,
    toDays: remaining + Math.round(base * 0.35) + 5,
    note: cycle.infrequent
      ? "Ventana amplia: no se espera una recompra de consumo frecuente."
      : "Ventana basada en el intervalo medio observado, no en un modelo de machine learning.",
  };
}

function projectClv(
  config: IntelligenceConfig,
  list: CommercialSale[],
  revenueCents: number,
  contributionCents: number,
  frequencyMonthly: number,
  aovCents: number,
  monthsObs: number,
  tenureDays: number,
  cycle: { days: number; infrequent: boolean },
) {
  const assumptions: string[] = [
    `Tasa de descuento mensual configurable: ${(config.discountRateMonthly * 100).toFixed(2)}%.`,
    `Horizonte máximo: ${config.horizonMonths} meses.`,
    "Las recargas de SmartWallet no entran en este cálculo.",
  ];
  const limitationBase =
    "El CLV proyectado es una estimación de demostración con reglas transparentes. No es un valor de mercado ni un modelo entrenado.";
  if (list.length < config.minPurchasesForProjection || tenureDays < config.minTenureDaysForProjection) {
    return {
      available: false,
      presentValueCents: null,
      horizonMonths: config.horizonMonths,
      expectedMonthlyFrequency: frequencyMonthly,
      expectedAovCents: aovCents,
      expectedMarginRate: revenueCents ? contributionCents / revenueCents : 0,
      futureCampaignCostCents: 0,
      remainingMonthsEstimate: null,
      assumptions,
      confidence: "none" as const,
      limitation: `No se proyecta CLV: se requieren al menos ${config.minPurchasesForProjection} compras y ${config.minTenureDaysForProjection} días de antigüedad. ${limitationBase}`,
    };
  }
  const marginRate = revenueCents ? Math.max(contributionCents / revenueCents, 0) : 0;
  const expectedMonthlyFrequency = cycle.infrequent
    ? 30.44 / cycle.days
    : frequencyMonthly;
  const remainingMonthsEstimate = cycle.infrequent
    ? Math.min(config.horizonMonths, 18)
    : Math.min(config.horizonMonths, Math.max(4, Math.round(monthsObs)));
  const futureCampaignCostMonthly = config.defaultRetentionCostMonthlyCents;
  const r = config.discountRateMonthly;
  let npv = 0;
  for (let t = 1; t <= remainingMonthsEstimate; t++) {
    const contrib =
      expectedMonthlyFrequency * aovCents * marginRate - futureCampaignCostMonthly;
    npv += contrib / Math.pow(1 + r, t);
  }
  const presentValueCents = Math.round(npv);
  const confidence: "low" | "medium" | "high" =
    list.length >= 8 && tenureDays >= 180 && (list.at(-1) ? daysBetween(list.at(-1)!.soldAt, config.asOfDate) < cycle.days * 2 : false)
      ? "high"
      : list.length >= 5
        ? "medium"
        : "low";
  assumptions.push(
    `Frecuencia futura: ${expectedMonthlyFrequency.toFixed(2)} compras/mes (observada o ciclo de marca si es infrecuente).`,
    `Ticket esperado: ${(aovCents / 100).toFixed(2)} USD.`,
    `Margen de contribución esperado: ${(marginRate * 100).toFixed(1)}%.`,
    `Costo futuro de retención supuesto: ${(futureCampaignCostMonthly / 100).toFixed(2)} USD/mes.`,
  );
  return {
    available: true,
    presentValueCents,
    horizonMonths: remainingMonthsEstimate,
    expectedMonthlyFrequency,
    expectedAovCents: aovCents,
    expectedMarginRate: marginRate,
    futureCampaignCostCents: futureCampaignCostMonthly * remainingMonthsEstimate,
    remainingMonthsEstimate,
    assumptions,
    confidence,
    limitation: limitationBase,
  };
}

export function crossBrandReport(snapshots: CustomerSnapshot[], db: IntelligenceDatabase) {
  const brands = db.brandEconomics.map((b) => b.brandId);
  const multi = snapshots.filter((s) => s.brandsUsed.length >= 2);
  const mono = snapshots.filter((s) => s.brandsUsed.length === 1);
  const avg = (xs: CustomerSnapshot[]) =>
    xs.length ? Math.round(xs.reduce((a, s) => a + s.netContributionCents, 0) / xs.length) : 0;
  const neverMatrix = brands.map((brand) => ({
    brandId: brand,
    customersNever: snapshots.filter((s) => s.purchaseCount > 0 && !s.brandsUsed.includes(brand)).length,
  }));
  const pairs: { a: BrandId; b: BrandId; customers: number }[] = [];
  for (let i = 0; i < brands.length; i++) {
    for (let j = i + 1; j < brands.length; j++) {
      const a = brands[i]!;
      const b = brands[j]!;
      const customers = snapshots.filter((s) => s.brandsUsed.includes(a) && s.brandsUsed.includes(b)).length;
      pairs.push({ a, b, customers });
    }
  }
  pairs.sort((x, y) => y.customers - x.customers);
  const sequences: Record<string, number> = {};
  const byCust = new Map<string, CommercialSale[]>();
  for (const s of activeSales(db.sales)) {
    const arr = byCust.get(s.customerId) ?? [];
    arr.push(s);
    byCust.set(s.customerId, arr);
  }
  for (const list of byCust.values()) {
    const ordered = [...list].sort((a, b) => a.soldAt.localeCompare(b.soldAt));
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1]!.brandId;
      const b = ordered[i]!.brandId;
      if (a === b) continue;
      const key = `${a}→${b}`;
      sequences[key] = (sequences[key] ?? 0) + 1;
    }
  }
  const topSequences = Object.entries(sequences)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, count]) => ({ path, count }));
  return {
    disclaimer:
      "Oportunidades basadas en coocurrencia observable. No se recomiendan productos médicos ni se infieren necesidades de salud.",
    multiCount: multi.length,
    monoCount: mono.length,
    avgContributionMulti: avg(multi),
    avgContributionMono: avg(mono),
    neverMatrix,
    pairs: pairs.slice(0, 12),
    topSequences,
    incrementalGapCents: avg(multi) - avg(mono),
  };
}

function missingBrand(snap: CustomerSnapshot, db: IntelligenceDatabase): BrandId | null {
  const retail = db.brandEconomics.filter((b) => !b.infrequent).map((b) => b.brandId);
  return retail.find((b) => !snap.brandsUsed.includes(b)) ?? null;
}

export function suggestNba(snap: CustomerSnapshot, db: IntelligenceDatabase, decision?: NbaDecision): NbaSuggestion {
  const marginNext = Math.round(snap.aovCents * (snap.projectedClv.expectedMarginRate || 0.28));
  const guard = Math.round(marginNext * db.config.maxIncentiveShareOfMargin);
  const wouldBuyAnyway =
    snap.churnLabel === "bajo" &&
    snap.segment !== "en_riesgo" &&
    snap.segment !== "inactivos" &&
    (snap.recencyDays ?? 999) < (snap.avgInterpurchaseDays ?? 30) * 0.7 &&
    snap.f >= 4;

  let action: NbaAction = "no_incentivo";
  let reason = "";
  let cost = 0;
  let incremental = 0;
  const risks: string[] = [];
  const assumptions: string[] = [
    "Reglas de demostración. No hay modelo de machine learning entrenado.",
    "Se prioriza contribución incremental, no el volumen de transacciones.",
  ];
  const cross = missingBrand(snap, db);

  if (!snap.customer.consentMarketing) {
    action = "no_contactar";
    reason = "El cliente de demostración no tiene consentimiento de marketing. La mejor acción es no contactar.";
  } else if (snap.churnLabel === "sin_historial_suficiente") {
    action = snap.customer.consentMarketing ? "informativa" : "no_contactar";
    reason = "Historial corto: no se trata como abandono. Solo información general, sin incentivo.";
    incremental = 40;
  } else if (wouldBuyAnyway) {
    action = "no_incentivo";
    reason =
      "El ritmo de compra sigue activo. Un descuento probablemente pagaría una compra que ocurriría de todas formas (canibalización).";
    risks.push("Un incentivo erosionaría margen sin lift incremental.");
    incremental = 80;
  } else if (snap.segment === "inactivos" && snap.netContributionCents > 1500) {
    action = "reactivacion";
    cost = Math.min(150, guard || 150);
    reason = "Cliente con contribución histórica positiva y silencio prolongado. Reactivación acotada al margen disponible.";
    incremental = Math.round(marginNext * 0.35 - cost);
  } else if (snap.segment === "en_riesgo") {
    action = "recompra";
    cost = Math.min(80, guard || 80);
    reason = "Desviación respecto de su frecuencia habitual. Campaña de recompra, no un descuento agresivo.";
    incremental = Math.round(marginNext * 0.28 - cost);
  } else if (cross && snap.segment === "potencial_crecimiento") {
    action = "venta_cruzada";
    cost = Math.min(120, guard || 120);
    reason = `Nunca ha comprado en ${cross} (dato observable). Prueba de cruce no médico, sujeta a aprobación.`;
    incremental = Math.round(marginNext * 0.22);
    assumptions.push("El cruce se basa en marcas no usadas, no en perfiles de salud.");
  } else if (snap.brandsUsed.length >= 3 && snap.customer.isMember) {
    action = "fidelizacion_multimarcas";
    reason = "Ya compra en varias marcas. Conviene fidelizar el ecosistema, no descontar una sola transacción.";
    incremental = 90;
  } else if (snap.customer.isMember && snap.segment === "frecuentes") {
    action = "beneficio_membresia";
    reason = "Socio frecuente: usar el beneficio de membresía ya existente, sin incentivo extra de margen.";
    incremental = 50;
  } else if (snap.segment === "ocasionales" && snap.customer.consentMarketing) {
    action = "recordatorio";
    reason = "Comprador ocasional con consentimiento. Recordatorio, no cupón.";
    incremental = 35;
  } else {
    action = "no_incentivo";
    reason = "No hay evidencia de que un incentivo mejore la contribución neta.";
    incremental = 20;
  }

  const exceeds = cost > 0 && guard > 0 && cost > guard;
  if (exceeds) {
    risks.push("El incentivo propuesto supera el tope de margen configurado. Queda bloqueado hasta autorización.");
    action = "no_incentivo";
    cost = 0;
    reason = "Se evitó un incentivo que excedía el margen disponible configurado.";
  }
  if (action !== "no_contactar" && action !== "no_incentivo" && action !== "informativa") {
    risks.push("Ninguna campaña se activa sin revisión humana. Este demo no envía comunicaciones.");
  }

  return {
    customerId: snap.customer.id,
    customerName: snap.customer.name,
    action,
    actionLabel: ACTION_LABELS[action],
    reason,
    segment: snap.segment,
    expectedCostCents: cost,
    expectedIncrementalContributionCents: incremental,
    risks,
    assumptions,
    eligibility: snap.customer.consentMarketing
      ? snap.customer.isMember
        ? "Elegible a beneficios de socio demo; consentimiento de marketing sí."
        : "Sin membresía; consentimiento de marketing sí. SmartWallet independiente."
      : "Sin consentimiento: no campañas comerciales.",
    approvalStatus: decision && decision.action === action ? decision.status : "pending",
    wouldBuyAnyway,
    exceedsMarginGuardrail: exceeds,
  };
}

export function buildAllNba(db: IntelligenceDatabase, snapshots: CustomerSnapshot[]): NbaSuggestion[] {
  const byCust = new Map(db.nbaDecisions.map((d) => [d.customerId, d]));
  return snapshots.map((s) => suggestNba(s, db, byCust.get(s.customer.id)));
}

export function overviewKpis(snapshots: CustomerSnapshot[], db: IntelligenceDatabase) {
  const withPurchases = snapshots.filter((s) => s.purchaseCount > 0);
  const active90 = withPurchases.filter((s) => (s.recencyDays ?? 999) <= 90);
  const atRisk = snapshots.filter((s) => s.segment === "en_riesgo" || s.segment === "inactivos");
  const clvReady = snapshots.filter((s) => s.projectedClv.available && s.projectedClv.presentValueCents != null);
  const hist = withPurchases.reduce((a, s) => a + s.netContributionCents, 0);
  const proj = clvReady.reduce((a, s) => a + (s.projectedClv.presentValueCents ?? 0), 0);
  const members = snapshots.filter((s) => s.customer.isMember);
  const non = snapshots.filter((s) => !s.customer.isMember);
  const avg = (xs: CustomerSnapshot[]) =>
    xs.length ? Math.round(xs.reduce((a, s) => a + s.netContributionCents, 0) / xs.length) : 0;
  const aov =
    withPurchases.length
      ? Math.round(withPurchases.reduce((a, s) => a + s.aovCents, 0) / withPurchases.length)
      : 0;
  const arpc =
    snapshots.length ? Math.round(snapshots.reduce((a, s) => a + s.revenueCents, 0) / snapshots.length) : 0;
  return {
    disclaimer: db.disclaimer,
    asOf: db.config.asOfDate,
    customers: snapshots.length,
    customersWithPurchases: withPurchases.length,
    active90: active90.length,
    retentionProxy: withPurchases.length ? active90.length / withPurchases.length : 0,
    atRisk: atRisk.length,
    avgAovCents: aov,
    avgRevenuePerCustomerCents: arpc,
    avgContributionCents: avg(withPurchases),
    historicNetContributionCents: hist,
    projectedClvSumCents: proj,
    customersWithClvProjection: clvReady.length,
    memberAvgContributionCents: avg(members),
    nonMemberAvgContributionCents: avg(non),
    memberCount: members.length,
    notes: [
      "La retención 90 días es un proxy de demostración, no un Kaplan-Meier.",
      "El CLV proyectado se suma solo en clientes con historial suficiente.",
      "Recargas de billetera excluidas de ventas y de contribución.",
    ],
  };
}

export function filterSnapshots(
  snapshots: CustomerSnapshot[],
  q: {
    brandId?: string;
    segment?: string;
    membership?: string;
    channel?: string;
  },
) {
  return snapshots.filter((s) => {
    if (q.brandId && !s.brandsUsed.includes(q.brandId as BrandId)) return false;
    if (q.segment && s.segment !== q.segment && !s.secondarySegments.includes(q.segment as DynamicSegment))
      return false;
    if (q.membership === "member" && !s.customer.isMember) return false;
    if (q.membership === "general" && s.customer.isMember) return false;
    if (q.channel && !(s.channelCounts[q.channel] > 0)) return false;
    return true;
  });
}

export function cohortRows(db: IntelligenceDatabase, snapshots: CustomerSnapshot[]) {
  const map = new Map<string, { month: string; acquired: number; stillActive60: number }>();
  for (const s of snapshots) {
    if (!s.firstPurchaseAt) continue;
    const month = s.firstPurchaseAt.slice(0, 7);
    const row = map.get(month) ?? { month, acquired: 0, stillActive60: 0 };
    row.acquired += 1;
    if ((s.recencyDays ?? 999) <= 60) row.stillActive60 += 1;
    map.set(month, row);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function rfmGrid(snapshots: CustomerSnapshot[]) {
  const cells: Record<string, number> = {};
  for (const s of snapshots) {
    cells[s.rfm] = (cells[s.rfm] ?? 0) + 1;
  }
  const bySegment: Record<string, number> = {};
  for (const s of snapshots) {
    bySegment[s.segment] = (bySegment[s.segment] ?? 0) + 1;
  }
  return { cells, bySegment };
}

export type { SaleCategory };
