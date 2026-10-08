export type BrandId =
  | "farmacias-economicas"
  | "medicity"
  | "wellderma"
  | "ambiente"
  | "mascotas"
  | "byd";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  isMember: boolean;
  memberTier: string | null;
  memberSince: string | null;
  customerCode?: string;
  virtualCard?: string;
  consentMarketing?: boolean;
  role?: string;
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
  status: "pending" | "approved" | "rejected" | "cancelled";
  userId: string | null;
  movementId: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface Movement {
  id: string;
  userId: string;
  type: "RECHARGE" | "PAYMENT" | "REFUND" | "RECHARGE_REJECTED" | "PAYMENT_REJECTED";
  status: "pending" | "approved" | "rejected" | "cancelled";
  amountCents: number;
  signedAmountCents: number;
  brandId: BrandId | null;
  channel: "physical" | "online" | "recharge" | "refund";
  orderId: string | null;
  orderReference: string | null;
  rechargeId: string | null;
  relatedMovementId: string | null;
  description: string;
  receiptCode: string | null;
  createdAt: string;
  postedAt: string | null;
}

export interface WalletSnapshot {
  disclaimer: string;
  user: User;
  balanceCents: number;
  currency: string;
  membershipIndependent: string;
  movements: Movement[];
}
