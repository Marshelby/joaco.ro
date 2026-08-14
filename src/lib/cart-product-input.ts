import type { CartProductInput } from "@/types/cart";
import type { MockProduct } from "@/types/product";

export function crearCartProductInput(product: MockProduct): CartProductInput | null {
  if (!product.presentationId || !product.presentationName || product.presentationQuantity === undefined || !product.presentationUnit) return null;

  return {
    productoId: product.id,
    slug: product.slug,
    presentacionId: product.presentationId,
    nombre: product.name,
    rutaImagen: product.image?.src,
    altImagen: product.image?.alt,
    imageFallback: product.imageFallback,
    cantidadPresentacion: product.presentationQuantity,
    unidad: product.presentationUnit,
    presentacionNombre: product.presentationName,
    precioFinalReferencia: product.unitPrice,
  };
}
