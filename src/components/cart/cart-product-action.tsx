"use client";

import { useState } from "react";
import { Check, Minus, Pencil, Plus, ShoppingCart } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";
import { crearCartProductInput } from "@/lib/cart-product-input";
import {
  formatCartQuantity,
  getCartQuantityMinimum,
  getCartQuantityStep,
  getSubtotalParaCantidad,
  isFractionalKgItem,
  isValidCartQuantity,
} from "@/lib/cart-quantity";
import { formatCLP } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { MockProduct } from "@/types/product";

type EditingMode = "new" | "existing" | null;

export function CartProductAction({ product, className }: { product: MockProduct; className?: string }) {
  const { agregarItem, obtenerCantidad, setQuantity, isHydrated } = useCart();
  const [editingMode, setEditingMode] = useState<EditingMode>(null);
  const [draftQuantity, setDraftQuantity] = useState<number | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const item = crearCartProductInput(product);
  const confirmedQuantity = item ? obtenerCantidad(item.productoId, item.presentacionId) : 0;
  const unavailable = product.availability === "out_of_stock" || !item;

  if (!isHydrated) return <div className={cn("min-h-11 min-w-0 max-w-full", className)} aria-hidden="true" />;

  if (unavailable) {
    return <Button type="button" disabled className={cn("min-w-0 max-w-full", className)}>No disponible</Button>;
  }

  const fractionalKg = isFractionalKgItem(item);
  const step = getCartQuantityStep(item);
  const minimum = getCartQuantityMinimum(item);
  const quantityLabel = fractionalKg ? "kilos" : "cantidad";
  const isEditing = editingMode !== null;
  const activeDraftQuantity = draftQuantity ?? minimum;
  const canDecrease = isValidCartQuantity(item, activeDraftQuantity - step);
  const canIncrease = isValidCartQuantity(item, activeDraftQuantity + step);
  const draftSubtotal = getSubtotalParaCantidad(activeDraftQuantity, item.precioFinalReferencia);

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

  const cancelDraft = () => {
    setEditingMode(null);
    setDraftQuantity(null);
    setConfirmationMessage("");
  };

  if (isEditing) {
    return (
      <div className={cn("min-w-0 max-w-full space-y-2", className)}>
        <div className="flex min-h-11 min-w-0 max-w-full items-center justify-between rounded-lg border border-primary/25 bg-primary/5 px-1" aria-label={`Seleccionando ${quantityLabel} de ${product.name}`}>
          <Button type="button" variant="ghost" size="icon" className="shrink-0" disabled={!canDecrease} onClick={() => setDraftQuantity(activeDraftQuantity - step)} aria-label={`Disminuir ${quantityLabel} de ${product.name}`}><Minus aria-hidden="true" /></Button>
          <span className="min-w-0 flex-1 truncate px-1 text-center text-sm font-semibold text-foreground">{formatCartQuantity(item, activeDraftQuantity)}</span>
          <Button type="button" variant="ghost" size="icon" className="shrink-0" disabled={!canIncrease} onClick={() => setDraftQuantity(activeDraftQuantity + step)} aria-label={`Aumentar ${quantityLabel} de ${product.name}`}><Plus aria-hidden="true" /></Button>
        </div>
        <div className="flex min-w-0 max-w-full items-baseline justify-between gap-3 px-1 text-sm">
          <span className="min-w-0 shrink text-muted-foreground">Subtotal</span>
          <strong className="min-w-0 shrink truncate text-foreground">{formatCLP(draftSubtotal)}</strong>
        </div>
        <Button type="button" variant="secondary" className="w-full min-w-0 max-w-full" onClick={confirmDraft} aria-label={`Confirmar cantidad de ${product.name}`}>Listo</Button>
        <Button type="button" variant="ghost" className="w-full min-w-0 max-w-full" onClick={cancelDraft}>Cancelar</Button>
      </div>
    );
  }

  if (confirmedQuantity === 0) {
    return <Button type="button" className={cn("min-w-0 max-w-full", className)} onClick={() => startEditing("new")} aria-label={`Agregar ${product.name} al carrito`}><ShoppingCart data-icon="inline-start" aria-hidden="true" />Agregar al carrito</Button>;
  }

  return (
    <div className={cn("min-w-0 max-w-full", className)}>
      <Button type="button" variant="outline" className="w-full min-w-0 max-w-full" onClick={() => startEditing("existing")} aria-label={`Editar cantidad de ${product.name}`}>
        <Check className="text-primary" aria-hidden="true" />
        {formatCartQuantity(item, confirmedQuantity)}
        <Pencil data-icon="inline-end" aria-hidden="true" />
        Editar
      </Button>
      <span className="sr-only" aria-live="polite">{confirmationMessage}</span>
    </div>
  );
}
