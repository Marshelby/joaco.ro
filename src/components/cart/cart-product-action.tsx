"use client";

import { Check, Minus, Plus, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-provider";
import type { CartProductInput } from "@/types/cart";
import type { MockProduct } from "@/types/product";

function toCartProductInput(product: MockProduct): CartProductInput | null {
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

export function CartProductAction({ product, className }: { product: MockProduct; className?: string }) {
  const { agregarItem, disminuir, incrementar, obtenerCantidad, isHydrated } = useCart();
  const item = toCartProductInput(product);
  const quantity = item ? obtenerCantidad(item.productoId, item.presentacionId) : 0;
  const unavailable = product.availability === "out_of_stock" || !item;

  if (!isHydrated) return <div className={`${className ?? ""} min-h-11`} aria-hidden="true" />;

  if (unavailable) {
    return <Button type="button" disabled className={className}>No disponible</Button>;
  }

  if (quantity === 0) {
    return <Button type="button" className={className} onClick={() => agregarItem(item)} aria-label={`Agregar ${product.name} al carrito`}><ShoppingCart data-icon="inline-start" aria-hidden="true" />Agregar al carrito</Button>;
  }

  return (
    <div className={`flex min-h-11 items-center justify-between rounded-lg border border-primary/25 bg-primary/5 px-1 ${className ?? ""}`} aria-label={`${quantity} unidades de ${product.name} en el carrito`}>
      <Button type="button" variant="ghost" size="icon" onClick={() => disminuir(item.productoId, item.presentacionId)} aria-label={`Disminuir cantidad de ${product.name}`}><Minus aria-hidden="true" /></Button>
      <span className="flex items-center gap-1 text-sm font-semibold text-foreground"><Check className="size-4 text-primary" aria-hidden="true" />{quantity}</span>
      <Button type="button" variant="ghost" size="icon" onClick={() => incrementar(item.productoId, item.presentacionId)} aria-label={`Aumentar cantidad de ${product.name}`}><Plus aria-hidden="true" /></Button>
    </div>
  );
}
