import type { ImageFallbackKind } from "@/types/media";

export type CartItem = {
  productoId: string;
  slug: string;
  presentacionId: string;
  nombre: string;
  rutaImagen?: string;
  altImagen?: string;
  imageFallback: ImageFallbackKind;
  cantidad: number;
  cantidadPresentacion: number;
  unidad: string;
  presentacionNombre: string;
  precioFinalReferencia: number;
  observacion?: string;
};

export type CartProductInput = Omit<CartItem, "cantidad" | "observacion">;
