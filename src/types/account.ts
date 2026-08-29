export type CustomerProfileMock = {
  avatarInitials: string;
  name: string;
  googleEmail: string;
  phone: string;
  commune: string;
};

export type CustomerAddressType = "home" | "work" | "other";

export type CustomerAddressMock = {
  id: string;
  label: string;
  type: CustomerAddressType;
  street: string;
  number: string;
  apartmentOrUnit: string | null;
  commune: string;
  region: string;
  reference?: string;
  recipientName: string;
  phone: string;
  isPrimary: boolean;
  isActive: boolean;
};

export type CustomerBenefitType = "giveaway" | "promotion" | "frequent_customer" | "campaign";
export type CustomerBenefitStatus = "active" | "upcoming" | "completed" | "used" | "expired";

export type CustomerBenefitMock = {
  id: string;
  title: string;
  description: string;
  type: CustomerBenefitType;
  status: CustomerBenefitStatus;
  startAt: string;
  endAt: string | null;
  image?: string;
  terms?: string;
  isFeatured: boolean;
  eligibilityText: string;
  actionLabel?: string;
  actionHref?: string | null;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type OrderDeliveryMethod = "delivery" | "pickup";
export type OrderPaymentMethod = "bank_transfer" | "cash";
export type OrderPaymentStatus = "pending" | "under_review" | "paid";
export type OrderStatusHistoryEvent = OrderStatus | "payment_confirmed";

import type { ImageAsset, ImageFallbackKind } from "@/types/media";

export type OrderItemSnapshot = {
  productId: string;
  productName: string;
  productImage?: ImageAsset;
  productImageFallback: ImageFallbackKind;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderStatusHistoryItem = {
  status: OrderStatusHistoryEvent;
  label: string;
  occurredAt: string;
  description?: string;
};

export type OrderDeliveryDetails =
  | {
      address: string;
      commune: string;
      region: string;
      addressType: string;
      recipientName: string;
      recipientPhone: string;
    }
  | {
      pickupLocation: string;
      commune: string;
      instructions?: string;
    };

export type CustomerOrderMock = {
  id: string;
  number: string;
  createdAt: string;
  status: OrderStatus;
  items: readonly OrderItemSnapshot[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryMethod: OrderDeliveryMethod;
  deliveryDetails: OrderDeliveryDetails;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  statusHistory: readonly OrderStatusHistoryItem[];
};

export type AccountSummaryMock = {
  profile: CustomerProfileMock;
};
