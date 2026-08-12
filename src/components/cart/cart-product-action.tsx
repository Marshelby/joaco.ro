"use client";

import { useState } from "react";
import { Check, Minus, Pencil, Plus, ShoppingCart } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";
import {
  formatCartQuantity,
  getCartQuantityMinimum,
  getCartQuantityStep,
  isFractionalKgItem,
  isValidCartQuantity,
} from "@/lib/cart-quantity";
import type { CartProductInput } from "@/types/cart";
import type { MockProduct } from "@/types/product";

type EditingMode = "new" | "existing" | null;

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
  const { agregarItem, obtenerCantidad, setQuantity, isHydrated } = useCart();
  const [editingMode, setEditingMode] = useState<EditingMode>(null);
  const [draftQuantity, setDraftQuantity] = useState<number | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const item = toCartProductInput(product);
  const confirmedQuantity = item ? obtenerCantidad(item.productoId, item.presentacionId) : 0;
  const unavailable = product.availability === "out_of_stock" || !item;

  if (!isHydrated) return <div className={`${className ?? ""} min-h-11`} aria-hidden="true" />;

  if (unavailable) {
    return <Button type="button" disabled className={className}>No disponible</Button>;
  }

  const fractionalKg = isFractionalKgItem(item);
  const step = getCartQuantityStep(item);
  const minimum = getCartQuantityMinimum(item);
  const quantityLabel = fractionalKg ? "kilos" : "cantidad";
  const isEditing = editingMode !== null;
  const activeDraftQuantity = draftQuantity ?? minimum;
  const canDecrease = isValidCartQuantity(item, activeDraftQuantity - step);
  const canIncrease = isValidCartQuantity(item, activeDraftQuantity + step);

  const startEditing = (mode: Exclude<EditingMode, null>) => {
    setEditingMode(mode);
    setDraftQuantity(mode === "existing" ? confirmedQuantity : minimum);
    setConfirmationMessage("");
  };

  const confirmDraft = () => {
    if (!isValidCartQuantity(item, activeDraftQuantity)) return;

    if (editingMode === "new") {
      agregarItem(item, activeDraftQuantity);
    } else if (editingMode === "existing") {
      setQuantity(item.productoId, item.presentacionId, activeDraftQuantity);
    }

    setEditingMode(null);
    setDraftQuantity(null);
    setConfirmationMessage(`Cantidad de ${product.name} confirmada`);
  };

  if (isEditing) {
    return (
      <div className={`space-y-2 ${className ?? ""}`}>
        <div className="flex min-h-11 items-center justify-between rounded-lg border border-primary/25 bg-primary/5 px-1" aria-label={`Seleccionando ${quantityLabel} de ${product.name}`}>
          <Button type="button" variant="ghost" size="icon" disabled={!canDecrease} onClick={() => setDraftQuantity(activeDraftQuantity - step)} aria-label={`Disminuir ${quantityLabel} de ${product.name}`}><Minus aria-hidden="true" /></Button>
          <span className="min-w-20 text-center text-sm font-semibold text-foreground">{formatCartQuantity(item, activeDraftQuantity)}</span>
          <Button type="button" variant="ghost" size="icon" disabled={!canIncrease} onClick={() => setDraftQuantity(activeDraftQuantity + step)} aria-label={`Aumentar ${quantityLabel} de ${product.name}`}><Plus aria-hidden="true" /></Button>
        </div>
        <Button type="button" variant="secondary" className="w-full" onClick={confirmDraft} aria-label={`Confirmar cantidad de ${product.name}`}>Listo</Button>
      </div>
    );
  }

  if (confirmedQuantity === 0) {
    return <Button type="button" className={className} onClick={() => startEditing("new")} aria-label={`Agregar ${product.name} al carrito`}><ShoppingCart data-icon="inline-start" aria-hidden="true" />Agregar al carrito</Button>;
  }

  return (
    <div className={className}>
      <Button type="button" variant="outline" className="w-full" onClick={() => startEditing("existing")} aria-label={`Editar cantidad de ${product.name}`}>
        <Check className="text-primary" aria-hidden="true" />
        {formatCartQuantity(item, confirmedQuantity)}
        <Pencil data-icon="inline-end" aria-hidden="true" />
        Editar
      </Button>
      <span className="sr-only" aria-live="polite">{confirmationMessage}</span>
    </div>
  );
}
