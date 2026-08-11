import type { ImageAsset, ImageFallbackKind } from "@/types/media";

export type ProductAvailability =
  | "available_subject_to_confirmation"
  | "limited_availability"
  | "out_of_stock";

export type ProductVisibilityStatus = "active" | "hidden";

export type ProductSaleUnit =
  | "kg"
  | "unit"
  | "sack"
  | "dozen"
  | "100g"
  | `presentation:${string}`;

export type MockProduct = {
  id: string;
  name: string;
  slug: string;
  image?: ImageAsset;
  images?: readonly ImageAsset[];
  imageFallback: ImageFallbackKind;
  category: string;
  subcategory?: string;
  description: string;
  netPrice: number;
  unitPrice: number;
  saleUnit: ProductSaleUnit;
  presentationId?: string;
  presentationName?: string;
  presentationQuantity?: number;
  presentationUnit?: string;
  badge?: string;
  availability: ProductAvailability;
  adminStatus: ProductVisibilityStatus;
  featured: boolean;
  bestSeller: boolean;
  opportunity: boolean;
  newArrival: boolean;
};
