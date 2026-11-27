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
  compact?: boolean;
};

export function OrderQuantityInput({ item, label, value, onValueChange, className, required, disabled, maximum, compact }: Props) {
  const fractional = isFractionalKgItem(item);
  const cantidad = Number(value);
  const anterior = adjustCartQuantity(item, cantidad, -1);
  const siguiente = adjustCartQuantity(item, cantidad, 1);
  const valido = isValidCartQuantity(item, cantidad);
  const limite = getCartQuantityMaximum(item) ?? maximum;
  const paso = fractional ? "0,1 kg" : "1 presentación";
  const input = <input type="number" aria-label={label} inputMode={fractional ? "decimal" : "numeric"}
    min={getCartQuantityMinimum(item)} max={limite} step={getCartQuantityInputStep(item)}
    value={value} required={required} disabled={disabled} onChange={(event) => onValueChange(event.target.value)}
    className={fractional || compact ? `${className} min-w-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none` : className} />;

  if (!fractional && !compact) return input;

  return <span className={compact ? "inline-flex items-center gap-1" : "flex max-w-56 items-baseline gap-1"}>
    <Button type="button" variant="outline" size={compact ? "icon" : "sm"} aria-label={`Restar ${paso}. ${label}`}
      disabled={disabled || !valido || !isValidCartQuantity(item, anterior)} onClick={() => onValueChange(String(anterior))}>−</Button>
    {input}
    <Button type="button" variant="outline" size={compact ? "icon" : "sm"} aria-label={`Sumar ${paso}. ${label}`}
      disabled={disabled || !valido || !isValidCartQuantity(item, siguiente) || (compact && limite !== undefined && siguiente > limite)} onClick={() => onValueChange(String(siguiente))}>+</Button>
  </span>;
}
