import type { ProductFormValues } from "@/types/admin-product-form";

export function ProductStatusSection({ values }: { values: ProductFormValues }) {
  return (
    <section aria-labelledby="product-status-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="space-y-1">
        <h2 id="product-status-title" className="text-lg font-semibold tracking-tight text-foreground">Estado</h2>
        <p className="text-sm leading-6 text-muted-foreground">Controla si el producto se muestra en la tienda.</p>
      </div>
      <fieldset className="mt-5 grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Visibilidad del producto</legend>
        {[{ value: "active", label: "Activo", description: "Visible en la tienda." }, { value: "hidden", label: "Oculto", description: "No se muestra en la tienda." }].map((option) => (
          <label key={option.value} className="flex min-h-20 cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-4 has-checked:border-primary has-checked:ring-1 has-checked:ring-primary/25">
            <input className="mt-0.5 size-4 accent-primary" defaultChecked={values.status === option.value} name="product-status" type="radio" value={option.value} />
            <span><span className="block text-sm font-semibold text-foreground">{option.label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span></span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
