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

type CartProductActionProps = {
  product: MockProduct;
  className?: string;
  compact?: boolean;
};

export function CartProductAction({ product, className, compact = false }: CartProductActionProps) {
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
          <span className={cn("min-w-0 flex-1 whitespace-nowrap px-1 text-center text-sm font-semibold text-foreground", compact && "px-0.5 text-xs md:px-1 md:text-sm")}>{formatCartQuantity(item, activeDraftQuantity)}</span>
          <Button type="button" variant="ghost" size="icon" className="shrink-0" disabled={!canIncrease} onClick={() => setDraftQuantity(activeDraftQuantity + step)} aria-label={`Aumentar ${quantityLabel} de ${product.name}`}><Plus aria-hidden="true" /></Button>
        </div>
        <div className={cn("min-w-0 max-w-full px-1 text-sm", compact ? "flex flex-col items-start gap-0.5 md:flex-row md:items-baseline md:justify-between md:gap-3" : "flex items-baseline justify-between gap-3")}>
          <span className="text-muted-foreground">Subtotal</span>
          <strong className={cn("whitespace-nowrap text-foreground", compact && "self-end md:self-auto")}>{formatCLP(draftSubtotal)}</strong>
        </div>
        <Button type="button" variant="secondary" className="w-full min-w-0 max-w-full" onClick={confirmDraft} aria-label={`Confirmar cantidad de ${product.name}`}>Listo</Button>
        <Button type="button" variant="ghost" className="w-full min-w-0 max-w-full" onClick={cancelDraft}>Cancelar</Button>
      </div>
    );
  }

  if (confirmedQuantity === 0) {
    return (
      <Button type="button" className={cn("min-w-0 max-w-full", compact && "gap-1 px-2 md:gap-2 md:px-4", className)} onClick={() => startEditing("new")} aria-label={`Agregar ${product.name} al carrito`}>
        <ShoppingCart data-icon="inline-start" aria-hidden="true" />
        {compact ? <><span className="md:hidden">Agregar</span><span className="hidden md:inline">Agregar al carrito</span></> : "Agregar al carrito"}
      </Button>
    );
  }

  return (
    <div className={cn("min-w-0 max-w-full", className)}>
      <Button type="button" variant="outline" className={cn("w-full min-w-0 max-w-full", compact && "gap-1 px-2 md:gap-2 md:px-3")} onClick={() => startEditing("existing")} aria-label={`Editar cantidad de ${product.name}`}>
        <Check className="text-primary" aria-hidden="true" />
        <span className="whitespace-nowrap">{formatCartQuantity(item, confirmedQuantity)}</span>
        <Pencil data-icon="inline-end" className={cn(compact && "hidden md:block")} aria-hidden="true" />
        Editar
      </Button>
      <span aria-live="polite" className="motion-fade-in block min-h-5 pt-1 text-xs font-medium text-primary">{confirmationMessage}</span>
    </div>
  );
}
