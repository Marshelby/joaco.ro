"use client";

import { Button } from "@/components/ui/button";
import {
  adjustCartQuantity,
  getCartQuantityInputStep,
  getCartQuantityMaximum,
  getCartQuantityMinimum,
  isFractionalKgItem,
  isValidCartQuantity,
} from "@/lib/cart-quantity";

type Props = {
  item: Parameters<typeof isFractionalKgItem>[0];
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  className: string;
  required?: boolean;
  disabled?: boolean;
  maximum?: number;
};

export function OrderQuantityInput({ item, label, value, onValueChange, className, required, disabled, maximum }: Props) {
  const fractional = isFractionalKgItem(item);
  const cantidad = Number(value);
  const anterior = adjustCartQuantity(item, cantidad, -1);
  const siguiente = adjustCartQuantity(item, cantidad, 1);
  const valido = isValidCartQuantity(item, cantidad);
  const input = <input type="number" aria-label={label} inputMode={fractional ? "decimal" : "numeric"}
    min={getCartQuantityMinimum(item)} max={getCartQuantityMaximum(item) ?? maximum} step={getCartQuantityInputStep(item)}
    value={value} required={required} disabled={disabled} onChange={(event) => onValueChange(event.target.value)}
    className={fractional ? `${className} min-w-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none` : className} />;

  if (!fractional) return input;

  return <span className="flex max-w-56 items-baseline gap-1">
    <Button type="button" variant="outline" size="sm" aria-label={`Restar 0,1 kg. ${label}`}
      disabled={disabled || !valido || !isValidCartQuantity(item, anterior)} onClick={() => onValueChange(String(anterior))}>−</Button>
    {input}
    <Button type="button" variant="outline" size="sm" aria-label={`Sumar 0,1 kg. ${label}`}
      disabled={disabled || !valido || !isValidCartQuantity(item, siguiente)} onClick={() => onValueChange(String(siguiente))}>+</Button>
  </span>;
}
