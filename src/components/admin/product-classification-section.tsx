import type { CatalogCategoryMock, CatalogSubcategoryMock } from "@/types/category";

type ProductClassificationSectionProps = {
  categories: readonly CatalogCategoryMock[];
  category: string;
  onCategoryChange: (category: string) => void;
  subcategories: readonly CatalogSubcategoryMock[];
  subcategory: string;
  onSubcategoryChange: (subcategory: string) => void;
};

export function ProductClassificationSection({ categories, category, onCategoryChange, subcategories, subcategory, onSubcategoryChange }: ProductClassificationSectionProps) {
  return (
    <section aria-labelledby="product-classification-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="space-y-1">
        <h2 id="product-classification-title" className="text-lg font-semibold tracking-tight text-foreground">Clasificación</h2>
        <p className="text-sm leading-6 text-muted-foreground">Cada producto pertenece a una categoría y a una subcategoría.</p>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="product-category" className="text-sm font-medium text-foreground">Categoría</label>
          <select id="product-category" value={category} onChange={(event) => onCategoryChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <option value="">Selecciona una categoría</option>
            {categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="product-subcategory" className="text-sm font-medium text-foreground">Subcategoría</label>
          <select id="product-subcategory" value={subcategory} onChange={(event) => onSubcategoryChange(event.target.value)} disabled={!category} aria-describedby="product-subcategory-help" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-3 focus-visible:ring-ring/50">
            <option value="">{category ? "Selecciona una subcategoría" : "Primero selecciona una categoría"}</option>
            {subcategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
          </select>
          <p id="product-subcategory-help" className="mt-2 text-xs leading-5 text-muted-foreground">Las opciones se muestran según la categoría elegida.</p>
        </div>
      </div>
    </section>
  );
}
