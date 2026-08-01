import type { ImageAsset, ImageFallbackKind } from "@/types/media";
import { CATEGORY_CATALOG_MOCK } from "@/mocks/categories";

export type HomeCategory = {
  name: string;
  description: string;
  image?: ImageAsset;
  imageFallback: ImageFallbackKind;
  subcategories: readonly string[];
};

export const HOME_CATEGORIES = CATEGORY_CATALOG_MOCK.map((category) => ({
  name: category.name,
  description: category.description,
  image: category.image,
  imageFallback: category.imageFallback,
  subcategories: category.subcategories.map((subcategory) => subcategory.name),
})) satisfies readonly HomeCategory[];
