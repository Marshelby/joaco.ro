import type { ImageAsset, ImageFallbackKind } from "@/types/media";

export type CatalogVisibilityStatus = "active" | "hidden";

export type CatalogSubcategoryMock = {
  id: string;
  name: string;
  status: CatalogVisibilityStatus;
};

export type CatalogCategoryMock = {
  id: string;
  name: string;
  description: string;
  image?: ImageAsset;
  imageFallback: ImageFallbackKind;
  status: CatalogVisibilityStatus;
  subcategories: readonly CatalogSubcategoryMock[];
};
