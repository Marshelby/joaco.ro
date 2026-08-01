"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { searchAdminProducts } from "@/lib/admin-products";
import type { MockProduct } from "@/types/product";

import { ProductListItem } from "./product-list-item";

export function ProductList({ products }: { products: readonly MockProduct[] }) {
  const [query, setQuery] = useState("");
  const filteredProducts = useMemo(() => searchAdminProducts(products, query), [products, query]);

  return (
    <section aria-labelledby="product-list-title" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 id="product-list-title" className="text-2xl font-semibold tracking-tight text-foreground">Listado de productos</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{filteredProducts.length} {filteredProducts.length === 1 ? "producto" : "productos"}</p></div>
        <form role="search" onSubmit={(event) => event.preventDefault()} className="w-full sm:max-w-xs">
          <label className="sr-only" htmlFor="admin-product-search">Buscar productos</label>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><input id="admin-product-search" value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar productos" className="h-11 w-full rounded-lg border border-input bg-background py-2 pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50" /></div>
        </form>
      </div>
      {filteredProducts.length > 0 ? <ul className="space-y-3" aria-label="Productos">{filteredProducts.map((product) => <ProductListItem key={product.id} product={product} />)}</ul> : <EmptyState title="No encontramos productos" description="Prueba con otro nombre, categoría o subcategoría." />}
    </section>
  );
}
