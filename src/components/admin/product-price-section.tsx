import type { ProductFormValues } from "@/types/admin-product-form";

function PriceInput({ id, label, value, description }: { id: string; label: string; value: number | undefined; description?: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
      <input id={id} defaultValue={value} inputMode="numeric" min="0" type="number" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="$ 0" />
      {description ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function ProductPriceSection({ values }: { values: ProductFormValues }) {
  return (
    <section aria-labelledby="product-price-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="space-y-1">
        <h2 id="product-price-title" className="text-lg font-semibold tracking-tight text-foreground">Precio</h2>
        <p className="text-sm leading-6 text-muted-foreground">Registra el precio neto, el precio con IVA y la unidad comercial.</p>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <PriceInput id="product-net-price" label="Precio neto" value={values.netPrice} />
        <PriceInput id="product-unit-price" label="Precio con IVA" value={values.unitPrice} />
        <div className="sm:col-span-2 sm:max-w-[calc(50%-0.625rem)]">
          <label htmlFor="product-sale-unit" className="text-sm font-medium text-foreground">Unidad comercial</label>
          <select id="product-sale-unit" defaultValue={values.saleUnit} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <option value="kg">KG</option>
            <option value="unit">UND</option>
            <option value="sack">SACO</option>
            <option value="dozen">DOC</option>
            <option value="100g">100 GR</option>
          </select>
        </div>
      </div>
    </section>
  );
}
