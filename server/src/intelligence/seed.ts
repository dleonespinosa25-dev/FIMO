import type { BrandId } from "../types.js";
import { addDays, mulberry32, pick, randInt } from "./rng.js";
import type {
  BrandEconomics,
  Campaign,
  CommercialCustomer,
  CommercialSale,
  IntelligenceConfig,
  IntelligenceDatabase,
  WalletTelemetry,
} from "./types.js";

const FIRST = [
  "Ana", "Carlos", "María", "Luis", "Sofía", "Diego", "Valentina", "Andrés", "Camila", "José",
  "Paula", "Mateo", "Lucía", "Daniel", "Elena", "Gabriel", "Isabel", "Sebastián", "Fernanda", "Pablo",
  "Carolina", "Nicolás", "Andrea", "Felipe", "Gabriela", "Ricardo", "Mónica", "Esteban", "Patricia", "Jorge",
];
const LAST = [
  "Pérez", "Mendoza", "García", "Vega", "Salazar", "Castro", "Morales", "Rojas", "Herrera", "Navarro",
  "Silva", "Ortiz", "Reyes", "Guerrero", "Paredes", "Cevallos", "Zambrano", "Moreira", "Benítez", "Quiroz",
];
const CITIES = ["Quito", "Guayaquil", "Cuenca", "Manta", "Ambato", "Loja", "Ibarra"];

export const DEFAULT_BRAND_ECONOMICS: BrandEconomics[] = [
  {
    brandId: "farmacias-economicas",
    contributionMarginRate: 0.32,
    expectedCycleDays: 22,
    infrequent: false,
    note: "Supuesto ficticio de margen de contribución sobre ventas de catálogo demo.",
  },
  {
    brandId: "medicity",
    contributionMarginRate: 0.28,
    expectedCycleDays: 45,
    infrequent: false,
    note: "Ciclo más largo que farmacia. No implica diagnóstico médico.",
  },
  {
    brandId: "wellderma",
    contributionMarginRate: 0.4,
    expectedCycleDays: 40,
    infrequent: false,
    note: "Cuidado personal. Sin inferencias de salud.",
  },
  {
    brandId: "ambiente",
    contributionMarginRate: 0.25,
    expectedCycleDays: 50,
    infrequent: false,
    note: "Hogar. Ticket medio, repetición moderada.",
  },
  {
    brandId: "mascotas",
    contributionMarginRate: 0.3,
    expectedCycleDays: 28,
    infrequent: false,
    note: "Alimento y accesorios de demostración.",
  },
  {
    brandId: "byd",
    contributionMarginRate: 0.18,
    expectedCycleDays: 280,
    infrequent: true,
    note: "Movilidad de baja frecuencia. No se trata como consumo semanal. No simula vehículos reales.",
  },
];

export const DEFAULT_CONFIG: IntelligenceConfig = {
  asOfDate: "2026-10-08T12:00:00.000Z",
  discountRateMonthly: 0.01,
  minPurchasesForProjection: 3,
  minTenureDaysForProjection: 90,
  horizonMonths: 12,
  maxIncentiveShareOfMargin: 0.4,
  defaultRetentionCostMonthlyCents: 35,
};

const BRANDS: BrandId[] = [
  "farmacias-economicas",
  "medicity",
  "wellderma",
  "ambiente",
  "mascotas",
  "byd",
];

function economicsMap() {
  return Object.fromEntries(DEFAULT_BRAND_ECONOMICS.map((b) => [b.brandId, b])) as Record<
    BrandId,
    BrandEconomics
  >;
}

function priceFor(rand: () => number, brandId: BrandId, mobilityHigh: boolean) {
  if (brandId === "byd" && mobilityHigh) return randInt(rand, 45_000, 160_000);
  const ranges: Record<BrandId, [number, number]> = {
    "farmacias-economicas": [650, 3200],
    medicity: [1400, 7800],
    wellderma: [1800, 6200],
    ambiente: [900, 3800],
    mascotas: [1100, 4200],
    byd: [800, 2800],
  };
  const [lo, hi] = ranges[brandId];
  return randInt(rand, lo, hi);
}

function costedSale(
  id: string,
  customerId: string,
  brandId: BrandId,
  channel: "physical" | "online",
  soldAt: string,
  revenueCents: number,
  incentiveCostCents: number,
  source: "synthetic" | "wallet",
  category: "recurring_retail" | "mobility_high_ticket",
  eco: Record<BrandId, BrandEconomics>,
): CommercialSale {
  const rate = eco[brandId].contributionMarginRate;
  const variableCostCents = Math.round(revenueCents * (1 - rate));
  return {
    id,
    customerId,
    brandId,
    channel,
    category,
    soldAt,
    revenueCents,
    variableCostCents,
    incentiveCostCents,
    contributionCents: revenueCents - variableCostCents - incentiveCostCents,
    source,
    walletOrderId: null,
    walletMovementId: null,
    refunded: false,
  };
}

type Persona =
  | "nuevo"
  | "leal"
  | "alto"
  | "ocasional"
  | "riesgo"
  | "inactivo"
  | "reactivado"
  | "multimarca";

function personaForIndex(i: number): Persona {
  if (i < 2) return i === 0 ? "ocasional" : "multimarca";
  const bucket = i % 100;
  if (bucket < 15) return "nuevo";
  if (bucket < 35) return "leal";
  if (bucket < 50) return "alto";
  if (bucket < 65) return "ocasional";
  if (bucket < 75) return "riesgo";
  if (bucket < 85) return "inactivo";
  if (bucket < 93) return "reactivado";
  return "multimarca";
}

export function createIntelligenceSeed(): IntelligenceDatabase {
  const rand = mulberry32(20261008);
  const eco = economicsMap();
  const asOf = DEFAULT_CONFIG.asOfDate;
  const customers: CommercialCustomer[] = [];
  const sales: CommercialSale[] = [];
  const walletTelemetry: WalletTelemetry[] = [];
  let saleN = 0;

  for (let i = 0; i < 520; i++) {
    const persona = personaForIndex(i);
    const id = i === 0 ? "cust-ana" : i === 1 ? "cust-carlos" : `cust-${String(i).padStart(4, "0")}`;
    const name =
      i === 0
        ? "Ana Pérez"
        : i === 1
          ? "Carlos Mendoza"
          : `${pick(rand, FIRST)} ${pick(rand, LAST)}`;
    const isMember = i === 1 ? true : i === 0 ? false : rand() < 0.42;
    const createdOffset =
      persona === "nuevo" ? randInt(rand, 10, 40) : randInt(rand, 180, 360);
    const createdAt = addDays(asOf, -createdOffset);
    const customer: CommercialCustomer = {
      id,
      name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}.${i}@smartclub.test`,
      isMember,
      memberSince: isMember ? addDays(createdAt, randInt(rand, 0, 40)) : null,
      consentMarketing: rand() < 0.82,
      preferredChannel: pick(rand, ["physical", "online", "mixed"]),
      walletUserId: i === 0 ? "user-general" : i === 1 ? "user-socio" : null,
      createdAt,
      acquisitionCostCents: rand() < 0.55 ? randInt(rand, 400, 2200) : null,
      acquisitionReliable: rand() < 0.5,
      city: pick(rand, CITIES),
    };
    customers.push(customer);

    const brandsForPersona = ((): BrandId[] => {
      if (persona === "multimarca") return [...BRANDS.filter((b) => b !== "byd"), ...(rand() < 0.25 ? (["byd"] as BrandId[]) : [])];
      if (persona === "alto") return pick(rand, [ ["farmacias-economicas", "wellderma", "medicity"], ["mascotas", "ambiente", "farmacias-economicas"] ]) as BrandId[];
      if (rand() < 0.08) return ["byd"];
      const core = pick(rand, BRANDS.filter((b) => b !== "byd"));
      const extra = rand() < 0.35 ? pick(rand, BRANDS.filter((b) => b !== core)) : null;
      return extra ? [core, extra] : [core];
    })();

    const cycle = Math.min(
      ...brandsForPersona.map((b) => eco[b].expectedCycleDays),
    );

    let nPurchases = 6;
    let lastGap = 12;
    if (persona === "nuevo") {
      nPurchases = randInt(rand, 1, 2);
      lastGap = randInt(rand, 3, 18);
    } else if (persona === "leal") {
      nPurchases = randInt(rand, 9, 16);
      lastGap = randInt(rand, 5, 18);
    } else if (persona === "alto") {
      nPurchases = randInt(rand, 8, 14);
      lastGap = randInt(rand, 8, 25);
    } else if (persona === "ocasional") {
      nPurchases = randInt(rand, 3, 5);
      lastGap = randInt(rand, 20, 45);
    } else if (persona === "riesgo") {
      nPurchases = randInt(rand, 5, 9);
      lastGap = Math.round(cycle * 2.1 + randInt(rand, 5, 20));
    } else if (persona === "inactivo") {
      nPurchases = randInt(rand, 4, 8);
      lastGap = Math.round(cycle * 3.5 + randInt(rand, 20, 60));
    } else if (persona === "reactivado") {
      nPurchases = randInt(rand, 6, 11);
      lastGap = randInt(rand, 4, 16);
    } else {
      nPurchases = randInt(rand, 10, 18);
      lastGap = randInt(rand, 6, 20);
    }

    if (brandsForPersona.length === 1 && brandsForPersona[0] === "byd") {
      nPurchases = persona === "nuevo" ? 1 : randInt(rand, 1, 2);
      lastGap = persona === "inactivo" ? randInt(rand, 300, 400) : randInt(rand, 20, 90);
    }

    const dates: string[] = [];
    let cursor = addDays(asOf, -lastGap);
    dates.push(cursor);
    for (let p = 1; p < nPurchases; p++) {
      const step =
        brandsForPersona[0] === "byd" && brandsForPersona.length === 1
          ? randInt(rand, 200, 320)
          : persona === "reactivado" && p === 1
            ? randInt(rand, 90, 150)
            : randInt(rand, Math.max(8, Math.round(cycle * 0.6)), Math.round(cycle * 1.4));
      cursor = addDays(cursor, -step);
      if (Date.parse(cursor) < Date.parse(createdAt) - 86_400_000) break;
      dates.push(cursor);
    }
    dates.reverse();

    dates.forEach((soldAt, idx) => {
      let brandId = brandsForPersona[idx % brandsForPersona.length] as BrandId;
      if (persona === "multimarca") brandId = brandsForPersona[idx % brandsForPersona.length] as BrandId;
      const mobilityHigh = brandId === "byd" && rand() < 0.35;
      const revenue = priceFor(rand, brandId, mobilityHigh);
      const incentive =
        persona === "reactivado" && idx === dates.length - 1 ? randInt(rand, 50, 180) : rand() < 0.12 ? randInt(rand, 40, 150) : 0;
      saleN += 1;
      sales.push(
        costedSale(
          `sale-${saleN}`,
          id,
          brandId,
          customer.preferredChannel === "mixed" ? pick(rand, ["physical", "online"]) : customer.preferredChannel,
          soldAt,
          revenue,
          incentive,
          "synthetic",
          mobilityHigh ? "mobility_high_ticket" : "recurring_retail",
          eco,
        ),
      );
    });

    const walletUser = Boolean(customer.walletUserId);
    const purchaseWithWallet = sales
      .filter((s) => s.customerId === id)
      .reduce((sum, s) => sum + Math.round(s.revenueCents * (walletUser ? 0.7 : rand() < 0.55 ? 0.4 : 0)), 0);
    const recharge = walletUser
      ? i === 1
        ? 5000
        : 0
      : Math.max(purchaseWithWallet + randInt(rand, 0, 4000), randInt(rand, 0, 2000));
    walletTelemetry.push({
      customerId: id,
      rechargeCents: recharge,
      purchaseWithWalletCents: Math.min(purchaseWithWallet, recharge || purchaseWithWallet),
      avgBalanceCents: Math.round(Math.max(recharge - purchaseWithWallet, 0) * 0.45),
      rechargeCount: recharge > 0 ? randInt(rand, 1, 6) : 0,
      source: walletUser ? "ledger" : "synthetic",
    });
  }

  const bySegmentSample = (start: number, n: number) => customers.slice(start, start + n).map((c) => c.id);

  const campaigns: Campaign[] = [
    {
      id: "camp-001",
      name: "Recompra Farmacias — clientes en riesgo (demo)",
      type: "recompra",
      status: "simulated",
      segment: "en_riesgo",
      brandId: "farmacias-economicas",
      incentiveCentsPerCustomer: 80,
      budgetCents: 40_000,
      treatmentCustomerIds: bySegmentSample(20, 40),
      controlCustomerIds: bySegmentSample(60, 40),
      createdAt: "2026-07-01T12:00:00.000Z",
      decidedAt: "2026-07-02T12:00:00.000Z",
      decidedBy: "corp-marketing",
      notes: "Simulación con grupo de control. No se enviaron mensajes reales.",
      observed: null,
      simulated: {
        kind: "simulated",
        conversionRate: 0.18,
        repurchaseRate: 0.22,
        retentionAfter: 0.71,
        aovAfterCents: 1850,
        crossBrandLift: 0.04,
        costPerReactivatedCents: 420,
        campaignContributionCents: 12_400,
        incrementalRoi: 1.35,
        clvChangeCents: 640,
        disclaimer:
          "Resultado SIMULADO con tratamiento vs control ficticios. No atribuye ventas reales a la campaña.",
      },
    },
    {
      id: "camp-002",
      name: "Cruce Wellderma para compradores de Farmacias (demo)",
      type: "venta_cruzada",
      status: "suggested",
      segment: "potencial_crecimiento",
      brandId: "wellderma",
      incentiveCentsPerCustomer: 120,
      budgetCents: 30_000,
      treatmentCustomerIds: bySegmentSample(100, 30),
      controlCustomerIds: bySegmentSample(140, 30),
      createdAt: "2026-09-15T12:00:00.000Z",
      decidedAt: null,
      decidedBy: null,
      notes: "Recomendación pendiente de aprobación humana. Sin envío.",
      observed: null,
      simulated: {
        kind: "estimate",
        conversionRate: 0.09,
        repurchaseRate: 0.11,
        retentionAfter: 0.66,
        aovAfterCents: 2400,
        crossBrandLift: 0.14,
        costPerReactivatedCents: 0,
        campaignContributionCents: 8_100,
        incrementalRoi: 0.92,
        clvChangeCents: 380,
        disclaimer: "Estimación previa. No es un resultado observado. Requiere aprobación.",
      },
    },
    {
      id: "camp-003",
      name: "Reactivación Mascotas (demo)",
      type: "reactivacion",
      status: "approved",
      segment: "inactivos",
      brandId: "mascotas",
      incentiveCentsPerCustomer: 150,
      budgetCents: 18_000,
      treatmentCustomerIds: bySegmentSample(200, 24),
      controlCustomerIds: bySegmentSample(230, 24),
      createdAt: "2026-08-10T12:00:00.000Z",
      decidedAt: "2026-08-11T12:00:00.000Z",
      decidedBy: "corp-executive",
      notes: "Aprobada para simulación de ejecución. No hay canal de mensajería real.",
      observed: {
        kind: "observed",
        conversionRate: 0.12,
        repurchaseRate: 0.15,
        retentionAfter: 0.58,
        aovAfterCents: 2100,
        crossBrandLift: 0.02,
        costPerReactivatedCents: 890,
        campaignContributionCents: 3_600,
        incrementalRoi: 0.41,
        clvChangeCents: 210,
        disclaimer:
          "Cifras OBSERVADAS solo dentro del universo sintético, comparadas con control. No equivalen a un experimento real de Farmaenlace.",
      },
      simulated: null,
    },
    {
      id: "camp-004",
      name: "No descontar a leales de alto valor (demo)",
      type: "no_incentivo",
      status: "approved",
      segment: "alto_valor",
      brandId: null,
      incentiveCentsPerCustomer: 0,
      budgetCents: 0,
      treatmentCustomerIds: bySegmentSample(10, 20),
      controlCustomerIds: bySegmentSample(40, 20),
      createdAt: "2026-06-01T12:00:00.000Z",
      decidedAt: "2026-06-02T12:00:00.000Z",
      decidedBy: "corp-finance",
      notes: "La acción ganadora fue no ofrecer incentivo: el grupo sin descuento compró igual.",
      observed: {
        kind: "observed",
        conversionRate: 0.61,
        repurchaseRate: 0.64,
        retentionAfter: 0.88,
        aovAfterCents: 3100,
        crossBrandLift: 0.01,
        costPerReactivatedCents: 0,
        campaignContributionCents: 21_000,
        incrementalRoi: 0,
        clvChangeCents: 90,
        disclaimer:
          "Comparación sintética: el tratamiento fue no contactar / no descontar. El control recibió un incentivo ficticio que erosionó margen sin lift claro.",
      },
      simulated: null,
    },
  ];

  return {
    disclaimer:
      "Smart Intelligence usa únicamente datos sintéticos de demostración. No hay clientes reales, ni envío de campañas, ni conexión a Farmaenlace.",
    config: DEFAULT_CONFIG,
    brandEconomics: DEFAULT_BRAND_ECONOMICS,
    corporateUsers: [
      {
        id: "corp-marketing",
        email: "inteligencia@farmaenlace.demo",
        name: "Marina López (Marketing demo)",
        role: "marketing",
        password: "Intel2026!",
      },
      {
        id: "corp-finance",
        email: "finanzas@farmaenlace.demo",
        name: "Héctor Ruiz (Finanzas demo)",
        role: "finance",
        password: "Intel2026!",
      },
      {
        id: "corp-executive",
        email: "direccion@farmaenlace.demo",
        name: "Elena Vargas (Dirección demo)",
        role: "executive",
        password: "Intel2026!",
      },
    ],
    sessions: [],
    customers,
    sales,
    walletTelemetry,
    campaigns,
    nbaDecisions: [],
  };
}

export function recomputeSaleEconomics(sale: CommercialSale, rate: number): CommercialSale {
  const variableCostCents = Math.round(sale.revenueCents * (1 - rate));
  return {
    ...sale,
    variableCostCents,
    contributionCents: sale.revenueCents - variableCostCents - sale.incentiveCostCents,
  };
}
