import type { ImageAsset, ImageFallbackKind } from "@/types/media";
import type { ProductVisibilityStatus } from "@/types/product";

export type ProductFormValues = {
  name: string;
  description: string;
  category: string;
  subcategory: string;
  unitPrice: number | undefined;
  wholesalePrice: number | undefined;
  wholesaleMinimum: number | undefined;
  image?: ImageAsset;
  imageFallback: ImageFallbackKind;
  status: ProductVisibilityStatus;
};
