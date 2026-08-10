import type { ImageAsset, ImageFallbackKind } from "@/types/media";
import type { ProductSaleUnit, ProductVisibilityStatus } from "@/types/product";

export type ProductFormValues = {
  name: string;
  description: string;
  category: string;
  subcategory: string;
  netPrice: number | undefined;
  unitPrice: number | undefined;
  saleUnit: ProductSaleUnit;
  image?: ImageAsset;
  imageFallback: ImageFallbackKind;
  status: ProductVisibilityStatus;
};
