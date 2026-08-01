export type ImageAsset = {
  src: string;
  alt: string;
  fit?: "cover" | "contain";
};

export type ImageFallbackKind =
  | "cookware"
  | "thermos"
  | "bedding"
  | "pillow"
  | "lighting"
  | "organization"
  | "cleaning"
  | "toys"
  | "storage"
  | "tools"
  | "pets"
  | "garden"
  | "home"
  | "technology"
  | "seasonal";
