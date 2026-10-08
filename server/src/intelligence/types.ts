import type { BrandId } from "../types.js";

export type CorporateRole = "marketing" | "finance" | "executive";

export type SaleCategory = "recurring_retail" | "mobility_high_ticket";

export type SaleSource = "synthetic" | "wallet";

export type DynamicSegment =
  | "nuevos"
  | "frecuentes"
  | "alto_valor"
  | "potencial_crecimiento"
  | "multimarcas"
  | "ocasionales"
  | "en_riesgo"
  | "inactivos"
  | "reactivados";

export type NbaAction =
  | "no_incentivo"
  | "recordatorio"
  | "informativa"
  | "beneficio_membresia"
  | "reactivacion"
  | "recompra"
  | "venta_cruzada"
  | "incentivo_proxima"
  | "fidelizacion_multimarcas"
  | "no_contactar";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type CampaignStatus = "suggested" | "approved" | "rejected" | "simulated";

export interface BrandEconomics {
  brandId: BrandId;
  contributionMarginRate: number;
  expectedCycleDays: number;
  infrequent: boolean;
  note: string;
}

export interface IntelligenceConfig {
  asOfDate: string;
  discountRateMonthly: number;
  minPurchasesForProjection: number;
  minTenureDaysForProjection: number;
  horizonMonths: number;
  maxIncentiveShareOfMargin: number;
  defaultRetentionCostMonthlyCents: number;
}

export interface CorporateUser {
  id: string;
  email: string;
  name: string;
  role: CorporateRole;
  password: string;
}

export interface CorporateSession {
  token: string;
  userId: string;
  expiresAt: string;
}

export interface CommercialCustomer {
  id: string;
  name: string;
  email: string;
  isMember: boolean;
  memberSince: string | null;
  consentMarketing: boolean;
  preferredChannel: "physical" | "online" | "mixed";
  walletUserId: string | null;
  createdAt: string;
  acquisitionCostCents: number | null;
  acquisitionReliable: boolean;
  city: string;
}

export interface CommercialSale {
  id: string;
  customerId: string;
  brandId: BrandId;
  channel: "physical" | "online";
  category: SaleCategory;
  soldAt: string;
  revenueCents: number;
  variableCostCents: number;
  incentiveCostCents: number;
  contributionCents: number;
  source: SaleSource;
  walletOrderId: string | null;
  walletMovementId: string | null;
  refunded: boolean;
}

export interface WalletTelemetry {
  customerId: string;
  rechargeCents: number;
  purchaseWithWalletCents: number;
  avgBalanceCents: number;
  rechargeCount: number;
  source: "synthetic" | "ledger";
}

export interface Campaign {
  id: string;
  name: string;
  type: NbaAction;
  status: CampaignStatus;
  segment: DynamicSegment | "mixto";
  brandId: BrandId | null;
  incentiveCentsPerCustomer: number;
  budgetCents: number;
  treatmentCustomerIds: string[];
  controlCustomerIds: string[];
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  notes: string;
  observed: CampaignMetrics | null;
  simulated: CampaignMetrics | null;
}

export interface CampaignMetrics {
  kind: "observed" | "simulated" | "estimate";
  conversionRate: number;
  repurchaseRate: number;
  retentionAfter: number;
  aovAfterCents: number;
  crossBrandLift: number;
  costPerReactivatedCents: number;
  campaignContributionCents: number;
  incrementalRoi: number;
  clvChangeCents: number;
  disclaimer: string;
}

export interface NbaDecision {
  customerId: string;
  action: NbaAction;
  status: ApprovalStatus;
  decidedAt: string | null;
  decidedBy: string | null;
}

export interface IntelligenceDatabase {
  disclaimer: string;
  config: IntelligenceConfig;
  brandEconomics: BrandEconomics[];
  corporateUsers: CorporateUser[];
  sessions: CorporateSession[];
  customers: CommercialCustomer[];
  sales: CommercialSale[];
  walletTelemetry: WalletTelemetry[];
  campaigns: Campaign[];
  nbaDecisions: NbaDecision[];
}
