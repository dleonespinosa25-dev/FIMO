export type BrandId =
  | "farmacias-economicas"
  | "medicity"
  | "wellderma"
  | "ambiente"
  | "mascotas"
  | "byd";

export type Channel = "physical" | "online" | "recharge" | "refund";

export type Role = "CLIENTE" | "CAJERO_DEMO" | "ADMIN_EMPRESA";

export type RechargeOrigin = "APP" | "POS";

export type MovementType =
  | "RECHARGE"
  | "PAYMENT"
  | "REFUND"
  | "RECHARGE_REJECTED"
  | "PAYMENT_REJECTED";

export type MovementStatus = "pending" | "approved" | "rejected" | "cancelled";

export type OrderStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  isMember: boolean;
  memberTier: string | null;
  memberSince: string | null;
  role: Role;
  password: string | null;
  customerCode: string;
  virtualCard: string;
  consentMarketing: boolean;
  termsAccepted: boolean;
  dataset: "live" | "lab";
}

export interface Brand {
  id: BrandId;
  name: string;
  shortName: string;
  category: string;
  color: string;
  description: string;
}

export interface Product {
  id: string;
  brandId: BrandId;
  name: string;
  description: string;
  priceCents: number;
  sku: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface PaymentOrder {
  id: string;
  reference: string;
  brandId: BrandId;
  channel: "physical" | "online";
  items: OrderItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  discountLabel: string | null;
  status: OrderStatus;
  userId: string | null;
  movementId: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

export interface Movement {
  id: string;
  userId: string;
  type: MovementType;
  status: MovementStatus;
  amountCents: number;
  signedAmountCents: number;
  brandId: BrandId | null;
  channel: Channel;
  orderId: string | null;
  orderReference: string | null;
  rechargeId: string | null;
  relatedMovementId: string | null;
  description: string;
  receiptCode: string | null;
  createdAt: string;
  postedAt: string | null;
}

export interface Recharge {
  id: string;
  userId: string;
  amountCents: number;
  status: MovementStatus;
  processorRef: string;
  movementId: string;
  createdAt: string;
  settledAt: string | null;
  origin: RechargeOrigin;
  tender: "processor_sim" | "cash_sim" | "card_sim";
  cashierId: string | null;
}

export interface MembershipConfig {
  demoDiscountPercent: number;
  note: string;
}

export interface Session {
  token: string;
  userId: string;
  role: Role;
  expiresAt: string;
}

export interface FlowEvent {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  actorRole: Role | string;
  action: string;
  recordType: string;
  recordId: string;
  movementId: string | null;
  commercialEvent: string | null;
  indicators: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface Database {
  users: User[];
  brands: Brand[];
  products: Product[];
  orders: PaymentOrder[];
  movements: Movement[];
  recharges: Recharge[];
  usedIdempotencyKeys: Record<string, string>;
  membership: MembershipConfig;
  sessions: Session[];
  flowEvents: FlowEvent[];
}
