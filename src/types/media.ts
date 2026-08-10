export type ImageAsset = {
  src: string;
  alt: string;
  fit?: "cover" | "contain";
};

export type ImageFallbackKind =
  | "fresh-produce"
  | "fruit"
  | "herb"
  | "package"
  | "cookware"
  | "thermos"
  | "bedding"
  | "pillow"
  | "lighting"
  | "organization"
  | "cleaning"
  | "storage";
