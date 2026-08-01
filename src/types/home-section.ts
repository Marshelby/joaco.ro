export type HomeSectionKey = "featured" | "best-sellers" | "opportunities" | "new-arrivals";

export type HomeSectionMock = {
  id: HomeSectionKey;
  title: string;
  description: string;
  productIds: readonly string[];
};
