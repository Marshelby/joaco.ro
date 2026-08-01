import type { ProductFormValues } from "@/types/admin-product-form";

export function ProductGeneralSection({ values }: { values: ProductFormValues }) {
  return (
    <section aria-labelledby="product-general-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="space-y-1">
        <h2 id="product-general-title" className="text-lg font-semibold tracking-tight text-foreground">Información general</h2>
        <p className="text-sm leading-6 text-muted-foreground">Lo esencial para reconocer el producto en la tienda.</p>
      </div>
      <div className="mt-5 space-y-5">
        <div>
          <label htmlFor="product-name" className="text-sm font-medium text-foreground">Nombre</label>
          <input id="product-name" defaultValue={values.name} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="Ej. Organizador multiuso" />
        </div>
        <div>
          <label htmlFor="product-description" className="text-sm font-medium text-foreground">Descripción</label>
          <textarea id="product-description" defaultValue={values.description} aria-describedby="product-description-help" className="mt-2 min-h-28 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="Describe el producto de forma simple y útil." />
          <p id="product-description-help" className="mt-2 text-xs leading-5 text-muted-foreground">Una descripción breve ayuda a reconocerlo con rapidez.</p>
        </div>
      </div>
    </section>
  );
}
