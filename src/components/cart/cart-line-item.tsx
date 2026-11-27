"use client";

import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";
import { CatalogImage } from "@/components/media/catalog-image";
import { Button } from "@/components/ui/button";
import {
  adjustCartQuantity,
  formatCartQuantity,
  getCartQuantityInputStep,
  getCartQuantityMaximum,
  getCartQuantityMinimum,
  getCartLineSubtotal,
  isFractionalKgItem,
  isValidCartQuantity,
} from "@/lib/cart-quantity";
import { formatCLP } from "@/lib/formatters";
import type { CartItem } from "@/types/cart";

export function CartLineItem({ item }: { item: CartItem }) {
  const { incrementar, disminuir, eliminar, setQuantity } = useCart();
  const fractionalKg = isFractionalKgItem(item);
  const [draft, setDraft] = useState<string | null>(null);
  const quantityLabel = fractionalKg ? "kilos" : "cantidad";
  const minimum = getCartQuantityMinimum(item);
  const canIncrease = isValidCartQuantity(item, adjustCartQuantity(item, item.cantidad, 1));
  const canDecrease = item.cantidad === minimum || isValidCartQuantity(item, adjustCartQuantity(item, item.cantidad, -1));
  const priceReference = fractionalKg ? "por kg" : "por presentación";

  return (
    <article className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-4 sm:p-4">
      <div className="relative size-[4.5rem] overflow-hidden rounded-lg bg-white sm:size-[5.5rem]">
        <CatalogImage
          image={item.rutaImagen ? { src: item.rutaImagen, alt: item.altImagen ?? `Fotografía de ${item.nombre}`, fit: "contain" } : undefined}
          fallback={item.imageFallback}
          sizes="88px"
        />
      </div>

      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-sm font-semibold leading-5 text-foreground sm:text-base">{item.nombre}</h2>
            <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{item.presentacionNombre}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{formatCLP(item.precioFinalReferencia)} {priceReference}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-2 size-11 shrink-0" onClick={() => eliminar(item.productoId, item.presentacionId)} aria-label={`Eliminar ${item.nombre} del carrito`}>
            <Trash2 className="text-destructive" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="col-span-2 mt-3 grid min-w-0 gap-3 min-[360px]:grid-cols-[minmax(0,1fr)_auto] min-[360px]:items-center sm:col-span-1 sm:col-start-2">
        <div className="inline-flex min-h-11 w-fit items-center rounded-lg border border-border">
          <Button type="button" variant="ghost" size="icon" className="size-11" disabled={!canDecrease} onClick={() => disminuir(item.productoId, item.presentacionId)} aria-label={`Disminuir ${quantityLabel} de ${item.nombre}`}>
            <Minus aria-hidden="true" />
          </Button>
          {fractionalKg ? <label className="flex items-center gap-1 text-sm font-semibold">
            <input type="number" inputMode="decimal" aria-label={`Cantidad de ${item.nombre} en kg`}
              min={minimum} max={getCartQuantityMaximum(item)} step={getCartQuantityInputStep(item)}
              value={draft ?? String(item.cantidad)} aria-invalid={draft !== null && !isValidCartQuantity(item, Number(draft))}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => {
                if (draft !== null && isValidCartQuantity(item, Number(draft))) {
                  setQuantity(item.productoId, item.presentacionId, Number(draft));
                }
                setDraft(null);
              }}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
              className="w-16 rounded bg-background px-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            kg
          </label> : <span className="min-w-16 px-1 text-center text-sm font-semibold text-foreground">{formatCartQuantity(item, item.cantidad)}</span>}
          <Button type="button" variant="ghost" size="icon" className="size-11" disabled={!canIncrease} onClick={() => incrementar(item.productoId, item.presentacionId)} aria-label={`Aumentar ${quantityLabel} de ${item.nombre}`}>
            <Plus aria-hidden="true" />
          </Button>
        </div>
        <div className="min-w-0 min-[360px]:text-right">
          <p className="text-xs leading-4 text-muted-foreground">Subtotal</p>
          <p className="mt-0.5 text-base font-semibold leading-5 text-foreground">{formatCLP(getCartLineSubtotal(item))}</p>
        </div>
      </div>
    </article>
  );
}
